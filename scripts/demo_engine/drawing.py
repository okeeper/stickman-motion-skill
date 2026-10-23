from __future__ import annotations
import math
from functools import lru_cache
from dataclasses import dataclass
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
    return v * v * v * (v * (6 * v - 15) + 10)


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

    def limb(self, a, hinge, b, color=AMBER, width=7, softness=0.62):
        """Round the hinge with a tangent-continuous quadratic, retaining endpoints."""
        before = tuple(lerp(j, v, softness) for j, v in zip(hinge, a))
        after = tuple(lerp(j, v, softness) for j, v in zip(hinge, b))
        points = [a, before]
        for i in range(1, 17):
            u = i / 16
            points.append(
                tuple(
                    (1 - u) ** 2 * q + 2 * u * (1 - u) * j + u * u * r
                    for q, j, r in zip(before, hinge, after)
                )
            )
        self.line([*points, b], color, width)

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
    """Two-bone IK with near/far clamping. ±1 preserves bone lengths;
    intermediate bends deliberately foreshorten a cartoon hinge.
    """
    if l1 <= 0 or l2 <= 0:
        raise ValueError("bone lengths must be positive")
    dx, dy = b[0] - a[0], b[1] - a[1]
    raw = math.hypot(dx, dy)
    d = clamp(raw, abs(l1 - l2) + 0.001, l1 + l2 - 0.001)
    ux, uy = (dx / raw, dy / raw) if raw > 1e-9 else (0.0, 1.0)
    b = (a[0] + ux * d, a[1] + uy * d)
    along = (l1 * l1 + d * d - l2 * l2) / (2 * d)
    height = math.sqrt(max(0, l1 * l1 - along * along))
    return (
        a[0] + ux * along - uy * height * bend,
        a[1] + uy * along + ux * height * bend,
    ), b


@dataclass(frozen=True)
class Reach:
    """Blend from the current animated wrist, then hold an exact world target."""

    target: tuple[float, float]
    weight: float = 1.0
    arc: float = 7.0


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
    feet=None,
    gait_phase=None,
):
    """A deterministic bendy rig. World-space feet/Reach targets take priority.

    Pose dictionaries are continuous weights; physical left/right never swap on
    a turn. Soft arm poles allow foreshortening without a binary elbow flip.
    """
    f, s = facing, scale
    weights = {pose: 1.0} if isinstance(pose, str) else dict(pose)
    if any(
        k not in {"idle", "think", "recoil", "jump", "celebrate", "ride"}
        for k in weights
    ):
        raise ValueError("unknown actor pose")
    if scale <= 0:
        raise ValueError("actor scale must be positive")
    weight = lambda name: clamp(weights.get(name, 0.0))
    move = clamp(float(moving))
    phase = walk / 116.667 * math.tau if gait_phase is None else gait_phase
    cheer, jump = weight("celebrate"), weight("jump")
    sway = cheer * 3.8 * math.sin(t * 2.4)
    breath = 0.65 * math.sin(t * 2.2)
    compression = (
        crouch
        + 0.12 * weight("recoil")
        + 0.10 * weight("ride")
        + cheer * 0.07 * (1 + math.sin(t * 2.4 - 0.4))
    )
    bob = breath * (1 - move) + move * (1.5 * math.cos(phase * 2) - 2.0)

    def pt(dx, dy):
        return x + s * dx, y + s * dy

    hip = pt(lean * 7 + sway * 0.4, -73 + compression * 24 + bob + move * 10)
    shoulder = pt(lean * 20 + sway, -101 + compression * 25 + bob)
    head = pt(
        lean * 25 + sway * 0.8 + f * 2,
        -130
        + compression * 24
        + 0.7 * math.sin(t * 2.2 - 0.2) * (1 - move)
        + bob * move,
    )
    rest_feet = [pt(-16, 0), pt(16, 0)] if feet is None else list(feet)
    # Tuck only while airborne; standing celebration keeps both soles planted.
    goals = [
        (v[0] + s * jump * dx, v[1] + s * jump * dy)
        for v, dx, dy in zip(rest_feet, (-5, 7), (-5, -17))
    ]
    knees, soles = [], []
    for k, foot in enumerate(goals):
        knee, end = joint(
            hip, foot, 39 * s, 40 * s, lerp(1 if k == 0 else -1, -f, move)
        )
        c.limb(hip, knee, end, mix(AMBER, BG, 0.18 if k == 0 else 0), 7 * s, 0.58)
        knees.append(knee)
        soles.append(end)
    spine = pt(
        lean * 11 + sway * 0.65 - 1.5 * math.sin(t * 2.2), -83 + compression * 21 + bob
    )
    c.limb(hip, spine, shoulder, AMBER, 8 * s, 0.85)
    c.line([shoulder, (head[0], head[1] + 18 * s)], AMBER, 6 * s)

    # Wrists lead the action; shoulders and head have different small offsets.
    # Movement is layered onto a rest pose instead of switching whole rigs.
    local = [
        (-26 + lean * 9, -43 + compression * 18),
        (27 + lean * 9, -43 + compression * 18),
    ]
    gait = [
        (-26 - 18 * math.sin(phase - 0.25), -48 - 9 * math.cos(phase - 0.25)),
        (27 + 18 * math.sin(phase - 0.25), -48 + 9 * math.cos(phase - 0.25)),
    ]
    local = [tuple(lerp(a, b, move) for a, b in zip(v, w)) for v, w in zip(local, gait)]
    poses = {
        "think": [(-27, -60), (f * 17 + lean * 25, -132)],
        "recoil": [(-38, -108), (43, -110)],
        "jump": [(-36, -114), (40, -124)],
        "ride": [(-33, -83), (38, -86)],
        "celebrate": [
            (-45 + 4 * math.sin(t * 2.4 - 0.55), -160 + 3 * math.sin(t * 3 - 0.7)),
            (47 + 4 * math.sin(t * 2.4 + 0.25), -166 + 3 * math.sin(t * 3 + 0.2)),
        ],
    }
    # Normalized additive blend handles overlapping reaction/anticipation clips.
    total = max(1.0, sum(weight(name) for name in poses))
    for k in range(2):
        base = local[k]
        local[k] = tuple(
            base[j]
            + sum(
                weight(name) / total * (v[k][j] - base[j]) for name, v in poses.items()
            )
            for j in range(2)
        )
    carry_weight = clamp(float(carry)) * (1 - cheer)
    local[0] = tuple(lerp(a, b, carry_weight) for a, b in zip(local[0], (-31, -94)))
    wrists, elbows = [], []
    for k, override in enumerate((left, right)):
        dx, dy = local[k]
        transition = clamp(sum(weight(name) for name in poses))
        dx += (-1 if k == 0 else 1) * 16 * 4 * transition * (1 - transition)
        target = pt(dx + sway * 0.8, dy + bob * 0.5)
        if isinstance(override, Reach):
            u = clamp(override.weight)
            target = tuple(lerp(a, b, u) for a, b in zip(target, override.target))
            target = (
                target[0],
                target[1] - override.arc * 16 * u * u * (1 - u) * (1 - u),
            )
        elif override is not None:
            target = override
        dx, dy = target[0] - shoulder[0], target[1] - shoulder[1]
        # A continuous pole, rather than sign(facing), prevents snapping across
        # the shoulder. This deliberately permits cartoon foreshortening.
        pole_x = (-40 if k == 0 else 40) * s
        pole_y = 25 * s
        cross = dx * pole_y - dy * pole_x
        bend = math.tanh(cross / max(1e-6, math.hypot(dx, dy) * 24 * s))
        bend *= smooth(math.hypot(dx, dy) / (45 * s))
        elbow, end = joint(shoulder, target, 40 * s, 41 * s, bend)
        c.limb(shoulder, elbow, end, mix(AMBER, BG, 0.14 if k == 0 else 0), 7 * s, 0.66)
        wrists.append(end)
        elbows.append(elbow)
    c.circle(*head, 18 * s, fill=BG, outline=AMBER, width=7 * s)
    if carry:
        c.star(*wrists[0], 13 * s)
    return {
        "left": wrists[0],
        "right": wrists[1],
        "head": head,
        "feet": soles,
        "foot_targets": goals,
        "knees": knees,
        "hip": hip,
        "shoulder": shoulder,
        "elbows": elbows,
    }


def title(c, t, index, label, subtitle):
    fade = 1 - progress(t, 3, 4.5)
    if fade > 0:
        c.text(
            (65, 57), f"{index:02d}  /  {label}", 21, mix(BG, MUTED, fade), anchor="lm"
        )
        c.text((65, 91), subtitle, 15, mix(BG, MUTED, fade * 0.65), anchor="lm")


def press_target(t, when, rest, target):
    """Backward-compatible arguments; blend from the live pose, not frozen rest."""
    if when - 0.7 <= t <= when + 0.6:
        u = (
            progress(t, when - 0.7, when - 0.1)
            if t <= when
            else 1 - progress(t, when + 0.12, when + 0.6)
        )
        return Reach(target, u)
    return None
