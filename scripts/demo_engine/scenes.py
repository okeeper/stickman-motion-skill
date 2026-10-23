from __future__ import annotations
import math
from .drawing import (
    AMBER,
    BG,
    LINE,
    MINT,
    MUTED,
    RED,
    WHITE,
    Canvas,
    clamp,
    lerp,
    mix,
    polar,
    progress,
    title,
)

from .performance import negative_actor, binary_actor, complex_actor

DURATION = 36.0
SCENES = ("negative-ride", "binary-search", "complex-rotation")
FLIPS = (10.5, 15.0, 20.0)
TURNS = ((5.6, 8.4), (11.0, 13.8), (18.6, 21.4), (25.2, 28.0))


# Hidden door values are sorted, distinct, and independent of their indices.
VALUES = (2, 5, 8, 12, 19, 24, 28, 31, 37, 42, 48, 55, 63, 70, 81, 96)
TARGET = 63


def binary_steps(target=TARGET, values=VALUES):
    if not values or any(a >= b for a, b in zip(values, values[1:])):
        raise ValueError("values must be nonempty, sorted and unique")
    if target not in values:
        raise ValueError("target must be present for these demos")
    low, high = 1, len(values)
    steps = []
    while low <= high:
        mid = (low + high) // 2
        value = values[mid - 1]
        before = (low, high)
        relation = "=" if value == target else ("<" if value < target else ">")
        if value == target:
            after = (mid, mid)
        elif value < target:
            low = mid + 1
            after = (low, high)
        else:
            high = mid - 1
            after = (low, high)
        steps.append(
            {
                "before": before,
                "mid": mid,
                "value": value,
                "relation": relation,
                "after": after,
            }
        )
        if value == target:
            break
    return steps


STEPS = binary_steps()
COMPARE = (11.5, 18.0, 23.5, 28.5)
DISCARD = (13.0, 19.5, 25.0, 29.5)


def negative_state(t):
    flips = sum(t >= at for at in FLIPS)
    sign = (-1) ** flips
    if t < 4.8:
        x = 600.0
    elif t < 7.8:
        x = 600 + (t - 4.8) * 120
    elif t < 22.7:
        x = 960.0
    elif t < 28.8:
        x = 960 - (t - 22.7) * 120
    else:
        x = 228.0
    return {
        "cart_x": x,
        "command": 3 * sign,
        "flips": flips,
        "running": 4.8 <= t < 7.8 or 22.7 <= t < 28.8,
    }


def complex_state(t):
    theta = 0.0
    completed = 0
    for a, b in TURNS:
        theta += math.pi / 2 * progress(t, a, b)
        completed += t >= b
    z = complex(math.cos(theta), math.sin(theta))
    return {
        "theta": theta,
        "z": z,
        "completed": completed,
        "point": polar(640, 450, 210, theta),
        "moving": any(a < t < b for a, b in TURNS),
    }


def key(c, x, y, label=TARGET, color=AMBER, s=1):
    c.circle(x, y, 18 * s, outline=color, width=3)
    c.line([(x + 18 * s, y), (x + 66 * s, y)], color, 4)
    c.line([(x + 51 * s, y), (x + 51 * s, y + 11 * s)], color, 4)
    c.line([(x + 63 * s, y), (x + 63 * s, y + 8 * s)], color, 4)
    c.text((x, y), label, 17 * s, color)


def cart(c, x, t, state):
    c.rect((x - 67, 565, x + 67, 595), fill="#26353b", outline=MUTED, width=2, radius=8)
    c.line([(x - 60, 561), (x + 60, 561)], WHITE, 3)
    for wheel in (x - 43, x + 43):
        c.circle(wheel, 605, 14, fill=BG, outline=MUTED, width=3)
        a = (x - 600) / 14
        c.line(
            [
                (wheel - 10 * math.cos(a), 605 - 10 * math.sin(a)),
                (wheel + 10 * math.cos(a), 605 + 10 * math.sin(a)),
            ],
            MUTED,
            2,
        )
    c.line([(x - 30, 565), (x - 30, 525)], MUTED, 3)
    c.rect((x - 70, 490, x + 10, 530), fill=BG, outline=WHITE, radius=9)
    c.text((x - 30, 510), "×(−1)", 21)
    c.circle(x - 30, 551, 11, fill=MINT)
    c.poly([(x - 33, 546), (x - 33, 556), (x - 25, 551)], BG)
    angle = 0 if state["command"] > 0 else math.pi
    for i, at in enumerate(FLIPS):
        if at <= t < at + 0.65:
            angle = i * math.pi + math.pi * progress(t, at, at + 0.65)
    dx = 85 * math.cos(angle)
    dy = -85 * math.sin(angle)
    c.arrow(
        (x - 8 * math.cos(angle), 440 - 8 * math.sin(angle)),
        (x + dx, 440 + dy),
        MINT,
        4,
    )
    settled = not any(at <= t < at + 0.7 for at in FLIPS)
    if settled:
        c.text((x, 393), f"{state['command']:+d}", 34, MINT)
        c.text((x, 369), "NEXT SPEED", 12, MUTED)
    for at in FLIPS:
        c.ring(x - 30, 510, t, at)


def negative(c, t):
    s = negative_state(t)
    cx = s["cart_x"]
    title(c, t, 1, "NEGATIVE RIDE", "A sign changes the way forward.")
    # Two islands and a single rail across the gap.
    c.rect((30, 620, 260, 720), fill="#19252b")
    c.rect((430, 620, 1250, 720), fill="#19252b")
    c.line([(30, 620), (260, 620)], LINE, 4)
    c.line([(430, 620), (1250, 620)], LINE, 4)
    for xx in range(50, 1220, 35):
        c.line([(xx, 614), (xx, 628)], LINE, 2)
    c.line([(45, 618), (1230, 618)], MUTED, 2)
    for xx in range(1060, 1210, 28):
        c.poly([(xx, 620), (xx + 13, 590), (xx + 26, 620)], mix(RED, BG, 0.3))
    c.line([(1030, 620), (1030, 570)], RED, 4)
    c.circle(1030, 563, 7, fill=RED)
    c.text((157, 661), "DESTINATION", 13, MUTED)
    c.line([(155, 585), (155, 620)], MUTED, 2)
    c.circle(155, 581, 7, outline=MINT)
    if t < 30.1:
        c.star(155, 550, 18)
    cart(c, cx, t, s)
    eq = ""
    if 4.8 < t < 9.0:
        eq = "+3  →"
    if 11.2 < t < 14.8:
        eq = "+3 × (−1) = −3"
    if 15.7 < t < 19.2:
        eq = "−3 × (−1) = +3"
    if 20.7 < t < 23.5:
        eq = "+3 × (−1) = −3"
    if 25 < t < 31.5:
        eq = "←  −3"
    if eq:
        c.text((640, 220), eq, 46, MINT if t > 20 else WHITE)
    rig = negative_actor(c, t, cx, FLIPS)
    c.sparks(155, 550, t, 30.1)
    if 1 < t < 1.8:
        c.text((455, 443), "?", 31, AMBER)
    if 16.0 < t < 17.0:
        c.text((838, 459), "?", 31, AMBER)
    contacts = []
    for at, kind in [(4.4, "play"), *[(at, "flip") for at in FLIPS], (22.55, "play")]:
        if abs(t - at) < 0.045:
            goal = (cx - 30, 510 if kind == "flip" else 551)
            contacts.append(math.dist(rig["right"], goal))
    return {"state": s, "contacts": contacts, "actor_head": rig["head"], "rig": rig}


def door_x(n):
    return 145 + (n - 1) * 64


def binary(c, t):
    title(c, t, 2, "HALVE THE SEARCH", "One key. Sixteen sorted doors.")
    c.line([(65, 620), (1215, 620)], LINE, 3)
    c.rect((65, 622, 1215, 720), fill="#152027")
    key(c, 120, 188, TARGET, s=1.6)
    c.text((685, 300), "SORTED VALUES  ·  TAP TO REVEAL", 13, MUTED)
    c.text((120, 137), "FIND", 14, MUTED)
    active = (1, 16)
    previous = active
    transition = None
    for at, step in zip(DISCARD, STEPS):
        if t >= at:
            previous = active
            active = step["after"]
            if t < at + 1.3:
                transition = (previous, active, progress(t, at, at + 1.3))
    low, high = active
    opened = progress(t, 29.0, 30.0)
    for n in range(1, 17):
        x = door_x(n)
        eliminated = None
        for at, step in zip(DISCARD, STEPS):
            if (
                not step["after"][0] <= n <= step["after"][1]
                and step["before"][0] <= n <= step["before"][1]
            ):
                eliminated = at
                break
        drop = 0
        opacity = 1
        if eliminated is not None and t >= eliminated:
            u = progress(
                t, eliminated + 0.025 * (n % 4), eliminated + 0.8 + 0.025 * (n % 4)
            )
            drop = 220 * u * u
            opacity = 1 - 0.88 * u
        color = mix(BG, MUTED, opacity)
        if 4.1 < t < 5.5 and n == 3:
            color = RED
            x += math.sin(t * 45) * 4 * (1 - progress(t, 4.1, 5.5))
        if n == 13 and t >= 28.5:
            color = MINT
        y = 439 + drop
        if n == 13 and opened > 0:
            c.rect(
                (x - 25, 439, x + 25, 600),
                fill="#223a37",
                outline=MINT,
                width=2,
                radius=5,
            )
            if t < 31.0:
                c.star(x, 533, 16, MINT)
            width = 50 * (1 - opened)
            if width > 1:
                c.rect(
                    (x - 25, 439, x - 25 + width, 600),
                    fill="#283a40",
                    outline=MINT,
                    width=2,
                    radius=3,
                )
            c.text((x, 412), TARGET, 22, MINT)
        else:
            c.rect(
                (x - 25, y, x + 25, y + 161),
                fill=mix(BG, "#24343b", opacity),
                outline=color,
                width=2,
                radius=5,
            )
            revealed = (n == 3 and t >= 4.1) or any(
                t >= at and n == step["mid"] for at, step in zip(COMPARE, STEPS)
            )
            c.text(
                (x, y + 28),
                VALUES[n - 1] if revealed else "?",
                24,
                mix(BG, WHITE if revealed else MUTED, opacity),
            )
            c.circle(x + 12, y + 94, 3, fill=color)
        c.text((x, 652), n, 13, mix(BG, MUTED, 0.25 if n < low or n > high else 0.6))
    l, r = door_x(low) - 27, door_x(high) + 27
    if transition:
        old, new, p = transition
        l = lerp(door_x(old[0]) - 27, door_x(new[0]) - 27, p)
        r = lerp(door_x(old[1]) + 27, door_x(new[1]) + 27, p)
    if t < 29:
        c.line([(l, 401), (l, 388), (r, 388), (r, 401)], MINT, 2)
        c.text(((l + r) / 2, 357), f"{high - low + 1} possible", 18, MINT)
    comparison = "8 ≠ 63" if 4.2 <= t < 7.2 else ""
    for at, step in zip(COMPARE, STEPS):
        if t >= at:
            comparison = f"{step['value']} {step['relation']} {TARGET}"
    if comparison:
        c.text((685, 213), comparison, 56, MINT if t >= 28.5 else WHITE)
    rig = binary_actor(c, t, door_x)
    for at, n in [(4.1, 3), (11.5, 8), (18, 12), (23.5, 14), (28.5, 13)]:
        c.ring(door_x(n), 467, t, at, RED if n == 3 else MINT)
    if t < 29:
        key(c, rig["right"][0] - 24, rig["right"][1], TARGET, s=0.36)
    c.sparks(door_x(13), 533, t, 31)
    contacts = []
    for at, n in [(4.1, 3), (11.5, 8), (18, 12), (23.5, 14), (28.5, 13)]:
        if abs(t - at) < 0.045:
            contacts.append(math.dist(rig["right"], (door_x(n) + 12, 533)))
    return {
        "active": active,
        "contacts": contacts,
        "actor_head": rig["head"],
        "rig": rig,
    }


def complex_rotation(c, t):
    title(c, t, 3, "A QUARTER TURN", "Bring the star home. Keep the rule.")
    s = complex_state(t)
    theta = s["theta"]
    px, py = s["point"]
    for x in range(430, 851, 42):
        c.line([(x, 240), (x, 660)], mix(BG, LINE, 0.2), 1)
    for y in range(240, 661, 42):
        c.line([(430, y), (850, y)], mix(BG, LINE, 0.2), 1)
    c.arrow((380, 450), (900, 450), LINE, 2, 8)
    c.arrow((640, 680), (640, 210), LINE, 2, 8)
    c.circle(640, 450, 210, outline=MUTED, width=2)
    if theta > 0.01:
        c.arc(640, 450, 210, 0, theta, MINT, 4)
    c.circle(640, 450, 4, fill=MUTED)
    c.text((620, 474), "0", 16, MUTED)
    for x, y, lab in [
        (883, 478, "1"),
        (674, 225, "i"),
        (394, 474, "−1"),
        (682, 664, "−i"),
    ]:
        c.text((x, y), lab, 24, WHITE)
    for j in range(4):
        x, y = polar(640, 450, 210, j * math.pi / 2)
        c.circle(x, y, 5, fill=WHITE)
    c.line([(850, 454), (1060, 454)], LINE, 4)
    c.line([(370, 454), (430, 454)], LINE, 4)
    c.rect((980, 418, 1020, 454), fill="#22342f", outline=MINT, width=2, radius=4)
    c.text((1000, 480), "HOME", 14, MUTED)
    if t < 15.2:
        c.star(385, 350, 18)
    if t >= 31.1:
        c.star(1000, 395, 18)
    # The rotating point is the mathematical object. The actor remains upright.
    c.line([(640, 450), (px, py)], mix(BG, MINT, 0.35), 2)
    c.rect((px - 30, py, px + 30, py + 7), fill=MINT, radius=3)
    c.line([(px + 36, py), (px + 36, py - 61)], MUTED, 2)
    c.rect(
        (px + 18, py - 88, px + 78, py - 51), fill=BG, outline=WHITE, width=2, radius=8
    )
    c.text((px + 48, py - 70), "×i", 25)
    at_press = (5.0, 10.4, 18.0, 24.6)
    for at in at_press:
        c.ring(px + 48, py - 70, t, at)
    equations = ["", "1 × i = i", "i × i = −1", "(−1) × i = −i", "(−i) × i = 1"]
    if not s["moving"] and s["completed"]:
        c.text((640, 391), equations[s["completed"]], 30, MINT)
    if t >= 29:
        c.text((640, 506), "i⁴ = 1", 40, MINT)
    elif s["completed"]:
        c.text((640, 510), f"{s['completed']} × 90°", 22, MUTED)
    if s["moving"]:
        a = theta + 0.3
        c.arc(640, 450, 232, theta - 0.15, a, MINT, 2)
        tail = polar(640, 450, 232, a - 0.08)
        tip = polar(640, 450, 232, a)
        c.arrow(tail, tip, MINT, 2, 8)
    rig = complex_actor(c, t, (px, py), TURNS)
    c.sparks(385, 350, t, 15.2)
    c.sparks(1000, 395, t, 31.1)
    contacts = []
    for at in at_press:
        if abs(t - at) < 0.045:
            contacts.append(math.dist(rig["right"], (px + 48, py - 70)))
    return {"state": s, "contacts": contacts, "actor_head": rig["head"], "rig": rig}


def render_frame(scene, t, scale=1.5):
    if scene not in SCENES:
        raise ValueError(f"unknown scene: {scene}")
    t = clamp(float(t), 0, DURATION)
    c = Canvas(scale)
    metrics = {
        "negative-ride": negative,
        "binary-search": binary,
        "complex-rotation": complex_rotation,
    }[scene](c, t)
    return c.image(), metrics


def cues(scene):
    if scene == "negative-ride":
        return [
            (4.4, "click"),
            (4.8, "move"),
            (7.8, "wrong"),
            *[(x, "flip") for x in FLIPS],
            (21.3, "jump"),
            (22.55, "click"),
            (22.7, "move"),
            (29.1, "jump"),
            (30.1, "win"),
        ]
    if scene == "binary-search":
        return [
            (4.1, "wrong"),
            *[(x, "click") for x in COMPARE],
            *[(x, "sweep") for x in DISCARD[:3]],
            (29, "open"),
            (31, "win"),
        ]
    return [
        (5, "click"),
        (5.6, "sweep"),
        (10.4, "click"),
        (11, "sweep"),
        (15.2, "pickup"),
        (18, "click"),
        (18.6, "sweep"),
        (24.6, "click"),
        (25.2, "sweep"),
        (28.8, "jump"),
        (31.1, "win"),
    ]
