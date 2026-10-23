from __future__ import annotations
import math
from functools import lru_cache
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

W, H = 1280, 720
BG = "#10171c"
WHITE = "#e6ecea"
MUTED = "#6e838c"
LINE = "#354850"
AMBER = "#f7b955"
MINT = "#81d8bc"
RED = "#ed8675"
FONT = Path(__file__).resolve().parents[2] / "assets" / "fonts" / "DejaVuSans.ttf"


def clamp(v, lo=0.0, hi=1.0):
    return min(hi, max(lo, v))


def smooth(v):
    v = clamp(v)
    return v * v * (3 - 2 * v)


def lerp(a, b, p):
    return a + (b - a) * p


def progress(t, a, b):
    return smooth((t - a) / (b - a))


def mix(a, b, p):
    def rgb(c):
        return tuple(int(c[i : i + 2], 16) for i in (1, 3, 5))

    return tuple(round(lerp(x, y, clamp(p))) for x, y in zip(rgb(a), rgb(b)))


def polar(x, y, r, a):
    return (x + r * math.cos(a), y - r * math.sin(a))


@lru_cache(maxsize=128)
def font(size, scale):
    return ImageFont.truetype(str(FONT), max(1, round(size * scale)))


class Canvas:
    def __init__(self, scale=1.5):
        self.scale = scale
        self.im = Image.new("RGB", (round(W * scale), round(H * scale)), BG)
        self.d = ImageDraw.Draw(self.im)

    def p(self, p):
        return tuple(round(x * self.scale) for x in p)

    def line(self, pts, color=WHITE, width=3, rounded=True):
        pts = [self.p(p) for p in pts]
        width = max(1, round(width * self.scale))
        self.d.line(pts, fill=color, width=width, joint="curve")
        if rounded:
            r = width / 2
            for x, y in (pts[0], pts[-1]):
                self.d.ellipse((x - r, y - r, x + r, y + r), fill=color)

    def rect(self, box, fill=None, outline=None, width=2, radius=0):
        box = tuple(round(v * self.scale) for v in box)
        self.d.rounded_rectangle(
            box,
            radius=round(radius * self.scale),
            fill=fill,
            outline=outline,
            width=max(1, round(width * self.scale)),
        )

    def circle(self, x, y, r, fill=None, outline=None, width=2):
        self.d.ellipse(
            self.p((x - r, y - r)) + self.p((x + r, y + r)),
            fill=fill,
            outline=outline,
            width=max(1, round(width * self.scale)),
        )

    def poly(self, pts, fill):
        self.d.polygon([self.p(p) for p in pts], fill=fill)

    def text(self, xy, value, size=28, color=WHITE, anchor="mm"):
        self.d.text(
            self.p(xy),
            str(value),
            font=font(size, self.scale),
            fill=color,
            anchor=anchor,
        )

    def arrow(self, a, b, color=WHITE, width=4, head=12):
        self.line([a, b], color, width)
        ang = math.atan2(b[1] - a[1], b[0] - a[0])
        c, s = math.cos(ang), math.sin(ang)
        self.poly(
            [
                b,
                (b[0] - head * c + head * 0.55 * s, b[1] - head * s - head * 0.55 * c),
                (b[0] - head * c - head * 0.55 * s, b[1] - head * s + head * 0.55 * c),
            ],
            color,
        )

    def arc(self, x, y, r, a, b, color=WHITE, width=3):
        n = max(3, int(abs(b - a) * r / 5))
        self.line(
            [polar(x, y, r, lerp(a, b, i / n)) for i in range(n + 1)], color, width
        )

    def star(self, x, y, r=17, color=AMBER, angle=-math.pi / 2):
        self.poly(
            [
                (
                    x
                    + (r if i % 2 == 0 else r * 0.43)
                    * math.cos(angle + i * math.pi / 5),
                    y
                    + (r if i % 2 == 0 else r * 0.43)
                    * math.sin(angle + i * math.pi / 5),
                )
                for i in range(10)
            ],
            color,
        )

    def ring(self, x, y, t, start, color=MINT):
        u = t - start
        if 0 <= u < 0.65:
            self.circle(x, y, 12 + u * 50, outline=mix(color, BG, u / 0.65), width=2)

    def sparks(self, x, y, t, start):
        dt = t - start
        if not 0 <= dt < 2:
            return
        for j in range(12):
            a = j * math.tau / 12
            r = 20 + dt * 70
            self.line(
                [
                    (x + math.cos(a) * r, y + math.sin(a) * r + dt * dt * 20),
                    (
                        x + math.cos(a) * (r + 8),
                        y + math.sin(a) * (r + 8) + dt * dt * 20,
                    ),
                ],
                mix(AMBER, BG, dt / 2),
                3,
            )

    def image(self):
        return self.im.resize((W, H), Image.Resampling.LANCZOS)


def joint(a, b, l1, l2, bend=1):
    dx, dy = b[0] - a[0], b[1] - a[1]
    raw = math.hypot(dx, dy)
    d = clamp(raw, abs(l1 - l2) + 0.001, l1 + l2 - 0.001)
    if raw > d:
        b = (a[0] + dx * d / raw, a[1] + dy * d / raw)
    theta = math.atan2(dy, dx)
    cosine = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)
    alpha = theta + bend * math.acos(cosine)
    return (a[0] + l1 * math.cos(alpha), a[1] + l1 * math.sin(alpha)), b


def actor(
    c,
    x,
    y,
    t,
    facing=1,
    walk=0.0,
    moving=False,
    pose="idle",
    lean=0.0,
    crouch=0.0,
    right=None,
    left=None,
    carry=False,
    scale=1.0,
):
    """Articulated figure; return actual wrists to check prop contact."""
    f = facing
    s = scale
    bob = (
        math.sin(t * 2.6) * 0.6
        if not moving
        else abs(math.sin(walk / 116.667 * math.tau)) * 2
    )

    def pt(dx, dy):
        return (x + s * dx, y + s * (dy + bob))

    hip = pt(lean * 12, -54 + crouch * 22)
    shoulder = pt(lean * 24, -96 + crouch * 30)
    head = pt(lean * 28 + f * 2, -124 + crouch * 30)
    if moving:

        def foot(p):
            p = p % 1
            if p < 0.6:
                return (f * (35 - 116.667 * p), 0)
            q = (p - 0.6) / 0.4
            return (f * lerp(-35, 35, smooth(q)), -math.sin(q * math.pi) * 23)

        feet = [
            (x + s * dx, y + s * dy)
            for dx, dy in (foot(walk / 116.667), foot(walk / 116.667 + 0.5))
        ]
    else:
        feet = [(x + s * (-19 - f * lean * 4), y), (x + s * (19 + f * lean * 5), y)]
    if pose == "jump":
        feet = [pt(-25, -5), pt(28, -22)]
    if pose == "recoil":
        feet = [pt(-28, 0), pt(23, -5)]
    for k, foot in enumerate(feet):
        knee, end = joint(hip, foot, 39 * s, 40 * s, f * (1 if k else -1))
        c.line([hip, knee, end], mix(AMBER, BG, 0.2 if k == 0 else 0), 7 * s)
    c.line([hip, pt(lean * 19, -75 + crouch * 26), shoulder], AMBER, 8 * s)
    default_r = pt(f * 25 + lean * 10, -58 + crouch * 20)
    default_l = pt(-f * 18 + lean * 10, -62 + crouch * 20)
    if moving:
        q = math.sin(walk / 116.667 * math.tau)
        default_r = pt(f * q * 31, -65)
        default_l = pt(-f * q * 28, -67)
    if pose == "think":
        default_r = (head[0] + f * 15 * s, head[1] - 4 * s)
        default_l = pt(-f * 18, -65)
    if pose == "recoil":
        default_r = pt(f * 45, -105)
        default_l = pt(-f * 28, -111)
    if pose == "jump":
        default_r = pt(f * 42, -104)
        default_l = pt(-f * 35, -100)
    if pose == "celebrate":
        default_r = pt(f * 39, -149)
        default_l = pt(-f * 37, -145)
    if pose == "ride":
        default_r = pt(f * 40, -92)
        default_l = pt(-f * 29, -85)
    if carry and pose != "celebrate":
        default_l = pt(-31, -94)
    wrists = []
    for k, target in enumerate([left or default_l, right or default_r]):
        elbow, end = joint(shoulder, target, 40 * s, 41 * s, (-f if k else f))
        c.line([shoulder, elbow, end], mix(AMBER, BG, 0.16 if k == 0 else 0), 7 * s)
        wrists.append(end)
    c.circle(*head, 18 * s, fill=BG, outline=AMBER, width=7 * s)
    if carry:
        c.star(*wrists[0], 13 * s)
    return {"left": wrists[0], "right": wrists[1], "head": head, "feet": feet}


def title(c, t, index, label, subtitle):
    fade = 1 - progress(t, 3, 4.5)
    if fade > 0:
        c.text(
            (65, 57), f"{index:02d}  /  {label}", 21, mix(BG, MUTED, fade), anchor="lm"
        )
        c.text((65, 91), subtitle, 15, mix(BG, MUTED, fade * 0.65), anchor="lm")


def press_target(t, when, rest, target):
    if when - 0.7 <= t <= when + 0.6:
        u = (
            progress(t, when - 0.7, when - 0.1)
            if t <= when
            else 1 - progress(t, when + 0.12, when + 0.6)
        )
        return tuple(lerp(a, b, u) for a, b in zip(rest, target))
    return None
