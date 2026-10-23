"""Reusable absolute-time acting: planted gait, overlapping poses and contacts.

The scene supplies world objects; these tracks supply intent and body motion.
Nothing depends on the previously rendered frame, so scrubbing is reproducible.
"""

from __future__ import annotations
import math
from .drawing import Reach, actor, clamp, lerp, press_target, progress, smooth


def window(t, start, end, attack=0.3, release=0.3):
    return progress(t, start, start + attack) * (1 - progress(t, end - release, end))


def walk_track(t, start, end, x0, x1, y):
    """Alternating world-space foot plants; C2 swing arcs and a complete stop.

    The root advances in distance phase. A foot holds its last world position
    outside its swing interval, including the first and last double support.
    """
    if end <= start:
        raise ValueError("walk end must follow start")
    u = progress(t, start, end)
    distance = abs(x1 - x0)
    if distance < 1e-9:
        return {
            "x": x0,
            "y": y,
            "feet": [(x0 - 16, y), (x0 + 16, y)],
            "moving": 0.0,
            "gait_phase": 0.0,
            "planted": (True, True),
        }
    direction = 1 if x1 >= x0 else -1
    steps = max(2, 2 * math.ceil(distance / 70))
    phase = u * steps
    feet, planted = [], []
    for side, offset in enumerate((-16, 16)):
        first = side if direction == 1 else 1 - side
        previous = x0 + offset
        height = 0.0
        contact = True
        for step in range(first, steps, 2):
            if phase <= step:
                break
            q = clamp((phase - step) / 0.85)
            goal = (
                x1 + offset
                if step >= steps - 2
                else lerp(x0, x1, (step + 1) / steps) + direction * 18
            )
            current = lerp(previous, goal, smooth(q))
            height = -18 * 64 * q**3 * (1 - q) ** 3
            contact = q == 1
            if q < 1:
                previous = current
                break
            previous = goal
        feet.append((previous, y + height))
        planted.append(contact)
    weight = window(
        t, start, end, min(0.3, (end - start) / 4), min(0.35, (end - start) / 4)
    )
    return {
        "x": lerp(x0, x1, u),
        "y": y,
        "feet": feet,
        "moving": weight,
        "gait_phase": phase * math.pi,
        "planted": planted,
    }


def locomotion(t, moves, y):
    selected = moves[0]
    for move in moves:
        if t >= move[0]:
            selected = move
    return walk_track(t, *selected, y)


def jump_track(t, start, end, origin, destination, height):
    q = clamp((t - start) / (end - start))
    p = smooth(q)
    return (
        lerp(origin[0], destination[0], p),
        lerp(origin[1], destination[1], p) - height * math.sin(math.pi * q) ** 2,
    )


def pickup(t, start, grab, settled, target):
    """The object and wrist coincide at the ownership change on `grab`."""
    if start <= t < settled:
        weight = (
            progress(t, start, grab - 0.08)
            if t < grab
            else 1 - progress(t, grab, settled)
        )
        return Reach(target, weight)
    return None


def draw(c, t, track, **kwargs):
    planted = track.pop("planted", (True, True))
    rig = actor(c, t=t, **track, **kwargs)
    rig["planted"] = planted
    return rig


def negative_actor(c, t, cx, flips):
    track = locomotion(t, [(2, 4, 466, 510), (5.6, 8.7, 510, 870)], 620)
    facing = -1 + 2 * progress(t, 1.7, 2.4) - 2 * progress(t, 22.05, 22.65)
    pose = {
        "recoil": window(t, 8.55, 10.0, 0.22, 0.5),
        "think": window(t, 11.9, 14.4, 0.4, 0.4) + window(t, 16.9, 19.3, 0.4, 0.4),
        "jump": window(t, 21.3, 22.3, 0.22, 0.23) + window(t, 29.1, 30.1, 0.2, 0.23),
        "ride": window(t, 22.25, 29.1, 0.3, 0.3),
        "celebrate": progress(t, 31.15, 32.2),
    }
    lean = (
        -0.5 * window(t, 0, 2, 0.7, 0.65)
        + 0.45 * window(t, 5.6, 8.75, 0.6, 0.65)
        - 0.35 * pose["recoil"]
        + 0.12 * window(t, 10, 21.3, 0.4, 0.4)
        - 0.28 * window(t, 22.45, 28.9, 0.4, 0.35)
        + 0.20 * window(t, 28.7, 29.15, 0.2, 0.25)
    )
    crouch = (
        0.38 * window(t, 20.9, 21.6, 0.25, 0.3)
        + 1.0 * window(t, 22.0, 23.55, 0.3, 0.7)
        + 0.24 * window(t, 23.0, 29.1, 0.6, 0.3)
        + 0.35 * window(t, 28.8, 29.35, 0.2, 0.35)
        + 0.38 * window(t, 29.9, 30.6, 0.2, 0.5)
    )
    if 21.3 <= t < 22.3:
        x, y = jump_track(t, 21.3, 22.3, (870, 620), (965, 561), 75)
        track = {"x": x, "y": y, "planted": (False, False)}
    elif 22.3 <= t < 29.1:
        track = {"x": cx + 5, "y": 561}
    elif 29.1 <= t < 30.1:
        x, y = jump_track(t, 29.1, 30.1, (233, 561), (166, 620), 55)
        track = {"x": x, "y": y, "planted": (False, False)}
    elif t >= 30.1:
        track = {"x": 166, "y": 620}
    right = None
    for at, target in [
        (4.4, (cx - 30, 551)),
        *[(at, (cx - 30, 510)) for at in flips],
        (22.55, (cx - 30, 551)),
    ]:
        reach = press_target(t, at, None, target)
        if reach is not None:
            right = reach
    left = pickup(t, 29.7, 30.1, 31.1, (155, 550))
    return draw(
        c,
        t,
        track,
        facing=facing,
        pose=pose,
        lean=lean,
        crouch=crouch,
        right=right,
        left=left,
        carry=t >= 30.1,
    )


def binary_actor(c, t, door_x):
    moves = [(0.3, 2.6, 125, door_x(3) - 48)]
    moves += [
        (a, b, door_x(old) - 48, door_x(new) - 48)
        for a, b, old, new in [
            (7.5, 10.5, 3, 8),
            (15, 17, 8, 12),
            (21, 22.5, 12, 14),
            (26.5, 27.5, 14, 13),
        ]
    ]
    moves += [(31, 32.15, door_x(13) - 48, door_x(13))]
    track = locomotion(t, moves, 620)
    facing = 1 - 2 * window(t, 26.2, 27.95, 0.35, 0.45)
    pose = {
        "recoil": window(t, 4.15, 5.5, 0.23, 0.45),
        "think": window(t, 5.35, 7.5, 0.5, 0.4),
        "celebrate": progress(t, 32.05, 33.0),
    }
    lean = 0.16 * window(t, 3.4, 4.4, 0.35, 0.35) - 0.38 * pose["recoil"]
    right = None
    for at, n in [(4.1, 3), (11.5, 8), (18, 12), (23.5, 14), (28.5, 13)]:
        reach = press_target(t, at, None, (door_x(n) + 12, 533))
        if reach is not None:
            right = reach
    left = pickup(t, 30.1, 31, 32, (door_x(13), 533))
    return draw(
        c,
        t,
        track,
        facing=facing,
        pose=pose,
        lean=lean,
        right=right,
        left=left,
        carry=t >= 31,
    )


def complex_actor(c, t, point, turns):
    px, py = point
    track = {"x": px, "y": py}
    ride = sum(window(t, a - 0.1, b + 0.15, 0.4, 0.4) for a, b in turns)
    pose = {
        "think": window(t, 2.35, 4.3, 0.4, 0.4),
        "ride": ride,
        "jump": window(t, 28.8, 30.1, 0.23, 0.25),
        "celebrate": progress(t, 32, 33),
    }
    lean = -0.55 * window(t, 0, 2.5, 0.7, 0.75) + 0.12 * ride
    crouch = 0.32 * window(t, 28.4, 29.1, 0.25, 0.3) + 0.35 * window(
        t, 29.9, 30.65, 0.2, 0.55
    )
    facing = 1 - 2 * window(t, 14.05, 16.4, 0.5, 0.55)
    if 28.8 <= t < 30.1:
        x, y = jump_track(t, 28.8, 30.1, (850, 450), (950, 450), 65)
        track = {"x": x, "y": y, "planted": (False, False)}
    elif t >= 30.1:
        track = {"x": 950, "y": 450}
    right = None
    for at in (5, 10.4, 18, 24.6):
        reach = press_target(t, at, None, (px + 48, py - 70))
        if reach is not None:
            right = reach
    left = pickup(t, 14.4, 15.2, 16.2, (385, 350))
    if 30.2 <= t < 31.8:
        u = progress(t, 30.2, 31.0) if t < 31.1 else 1 - progress(t, 31.1, 31.8)
        left = Reach((1000, 395), u)
    return draw(
        c,
        t,
        track,
        facing=facing,
        pose=pose,
        lean=lean,
        crouch=crouch,
        right=right,
        left=left,
        carry=15.2 <= t < 31.1,
    )
