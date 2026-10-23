"""Regress the visible crossed legs, pose pops, elbow flips and foot sliding."""

import math
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from demo_engine.drawing import actor, joint, press_target
from demo_engine.performance import (
    negative_actor,
    binary_actor,
    complex_actor,
    walk_track,
)
from demo_engine.scenes import negative_state, complex_state, FLIPS, TURNS, door_x


class NoDraw:
    def __getattr__(self, name):
        return lambda *a, **k: None


def sample(scene, t):
    c = NoDraw()
    if scene == "negative-ride":
        return negative_actor(c, t, negative_state(t)["cart_x"], FLIPS)
    if scene == "binary-search":
        return binary_actor(c, t, door_x)
    return complex_actor(c, t, complex_state(t)["point"], TURNS)


def points(rig):
    return [
        rig["head"],
        rig["hip"],
        rig["shoulder"],
        rig["left"],
        rig["right"],
        *rig["knees"],
        *rig["elbows"],
        *rig["feet"],
    ]


class MotionTests(unittest.TestCase):
    def test_standing_and_celebration_do_not_cross_or_lift_feet(self):
        for f in (-1, 1):
            for i in range(121):
                rig = actor(NoDraw(), 640, 620, 32 + i / 30, facing=f, pose="celebrate")
                self.assertEqual(rig["feet"], [(624, 620), (656, 620)])
                self.assertLess(rig["knees"][0][0], rig["hip"][0])
                self.assertGreater(rig["knees"][1][0], rig["hip"][0])

    def test_walking_foot_plants_and_swing_clearance_in_both_directions(self):
        for x0, x1 in [(125, 445), (445, 125), (0, 44), (44, 0)]:
            old = None
            support_samples = 0
            for i in range(481):
                t = i / 120
                track = walk_track(t, 0.5, 3.5, x0, x1, 620)
                for k in range(2):
                    self.assertLessEqual(track["feet"][k][1], 620)
                    if old and track["planted"][k] and old["planted"][k]:
                        self.assertEqual(track["feet"][k], old["feet"][k])
                        support_samples += 1
                old = track
            self.assertGreater(support_samples, 150)
            self.assertEqual(old["feet"], [(x1 - 16, 620), (x1 + 16, 620)])
            self.assertEqual(old["moving"], 0)
        still = walk_track(1, 0, 2, 50, 50, 620)
        self.assertEqual(still["feet"], [(34, 620), (66, 620)])
        self.assertEqual(still["moving"], 0)

    def test_all_authored_pose_boundaries_are_continuous(self):
        # Check both sides of every 10 ms time, including pose changes, contact,
        # ownership changes, turns, walk starts/stops and jump landings.
        # At 20 microseconds even a fast swing moves < .03 logical pixels;
        # the old hard pose switches produced jumps of tens of pixels.
        for scene in ("negative-ride", "binary-search", "complex-rotation"):
            for i in range(3601):
                t = i / 100
                before = sample(scene, t - 1e-5)
                after = sample(scene, t + 1e-5)
                delta = max(
                    math.dist(a, b) for a, b in zip(points(before), points(after))
                )
                self.assertLess(delta, 0.03, (scene, t, delta))

    def test_frame_motion_has_no_large_elbow_flip_and_feet_reach_support(self):
        for scene in ("negative-ride", "binary-search", "complex-rotation"):
            old = None
            for i in range(1080):
                rig = sample(scene, i / 30)
                for end, goal in zip(rig["feet"], rig["foot_targets"]):
                    self.assertLess(math.dist(end, goal), 0.001, (scene, i))
                if old:
                    # Subtract shoulder motion so transport isn't an arm flip.
                    for j in range(2):
                        a = tuple(
                            v - s for v, s in zip(rig["elbows"][j], rig["shoulder"])
                        )
                        b = tuple(
                            v - s for v, s in zip(old["elbows"][j], old["shoulder"])
                        )
                        self.assertLess(math.dist(a, b), 22, (scene, i, j))
                old = rig

    def test_pickup_and_release_wrist_ownership_is_continuous(self):
        for scene, t, target in [
            ("negative-ride", 30.1, (155, 550)),
            ("binary-search", 31, (door_x(13), 533)),
            ("complex-rotation", 15.2, (385, 350)),
            ("complex-rotation", 31.1, (1000, 395)),
        ]:
            for offset in (-1e-6, 0, 1e-6):
                self.assertLess(
                    math.dist(sample(scene, t + offset)["left"], target), 0.001
                )

    def test_press_blends_from_live_pose_and_holds_exact_target(self):
        goal = (700, 530)
        for t in (1.3, 2.6):
            base = actor(NoDraw(), 640, 620, t, pose="think")
            rig = actor(
                NoDraw(),
                640,
                620,
                t,
                pose="think",
                right=press_target(t, 2, None, goal),
            )
            self.assertLess(math.dist(base["right"], rig["right"]), 1e-8)
        for t in (1.95, 2, 2.05):
            rig = actor(NoDraw(), 640, 620, t, right=press_target(t, 2, None, goal))
            self.assertLess(math.dist(rig["right"], goal), 1e-8)

    def test_scrubbing_does_not_depend_on_frame_history(self):
        for scene in ("negative-ride", "binary-search", "complex-rotation"):
            before = sample(scene, 15.2)
            for t in (35, 0, 15, 8, 20):
                sample(scene, t)
            self.assertEqual(before, sample(scene, 15.2))

    def test_degenerate_ik_and_invalid_animation_inputs(self):
        for target in ((0, 0), (0.01, 0), (1000, 0)):
            elbow, end = joint((0, 0), target, 40, 41)
            self.assertAlmostEqual(math.dist((0, 0), elbow), 40)
            self.assertAlmostEqual(math.dist(elbow, end), 41)
        with self.assertRaises(ValueError):
            joint((0, 0), (1, 1), 0, 40)
        with self.assertRaises(ValueError):
            walk_track(0, 1, 1, 0, 100, 620)
        with self.assertRaises(ValueError):
            actor(NoDraw(), 640, 620, 0, pose="unknown")
        with self.assertRaises(ValueError):
            actor(NoDraw(), 640, 620, 0, scale=0)


if __name__ == "__main__":
    unittest.main()
