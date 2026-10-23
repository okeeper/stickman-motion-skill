"""Behavioral checks for concept semantics, contact, rendering and audio."""

from pathlib import Path
import math
import subprocess
import sys
import unittest
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from demo_engine import scenes
from demo_engine.audio import synthesize
from demo_engine.drawing import joint


class NoDraw:
    """Run all geometry at production frame rate without rasterizing."""

    def __getattr__(self, name):
        return lambda *args, **kwargs: None


class ConceptTests(unittest.TestCase):
    def test_negative_motion_matches_sign_and_stops(self):
        for t in (5.0, 6.0, 7.0):
            speed = (
                scenes.negative_state(t + 0.001)["cart_x"]
                - scenes.negative_state(t)["cart_x"]
            ) / 0.001
            self.assertAlmostEqual(speed, 40 * scenes.negative_state(t)["command"])
        for t in (23.0, 25.0, 27.0):
            speed = (
                scenes.negative_state(t + 0.001)["cart_x"]
                - scenes.negative_state(t)["cart_x"]
            ) / 0.001
            self.assertAlmostEqual(speed, 40 * scenes.negative_state(t)["command"])
        self.assertEqual(
            [scenes.negative_state(t)["command"] for t in (0, 11, 16, 21)],
            [3, -3, 3, -3],
        )
        self.assertEqual(scenes.negative_state(36)["cart_x"], 228)
        self.assertFalse(scenes.negative_state(36)["running"])
        for t in (4.8, 7.8, 22.7, 28.8):
            self.assertLess(
                abs(
                    scenes.negative_state(t - 0.00001)["cart_x"]
                    - scenes.negative_state(t + 0.00001)["cart_x"]
                ),
                0.003,
            )

    def test_binary_search_every_target_preserved(self):
        for index, target in enumerate(scenes.VALUES, 1):
            steps = scenes.binary_steps(target)
            self.assertLessEqual(len(steps), 5)
            for step in steps:
                low, high = step["after"]
                self.assertLessEqual(low, index)
                self.assertGreaterEqual(high, index)
                self.assertEqual(step["value"], scenes.VALUES[step["mid"] - 1])
                before = step["before"]
                if step["relation"] != "=":
                    self.assertLessEqual(
                        high - low + 1, (before[1] - before[0] + 1) // 2
                    )
            self.assertEqual(steps[-1]["value"], target)
            self.assertEqual(steps[-1]["relation"], "=")

    def test_demo_queries(self):
        self.assertEqual([step["mid"] for step in scenes.STEPS], [8, 12, 14, 13])
        self.assertEqual([step["value"] for step in scenes.STEPS], [31, 55, 70, 63])
        self.assertEqual(
            [step["after"] for step in scenes.STEPS],
            [(9, 16), (13, 16), (13, 13), (13, 13)],
        )

    def test_invalid_binary_inputs(self):
        for args in [(100, scenes.VALUES), (1, ()), (1, (2, 1)), (1, (1, 1))]:
            with self.assertRaises(ValueError):
                scenes.binary_steps(*args)

    def test_complex_quarter_turns_and_unit_norm(self):
        last_theta = -1
        for t in np.linspace(0, 36, 1081):
            state = scenes.complex_state(t)
            self.assertAlmostEqual(abs(state["z"]), 1)
            self.assertGreaterEqual(state["theta"], last_theta)
            last_theta = state["theta"]
        for time, expected in [(0, 1), (8.4, 1j), (13.8, -1), (21.4, -1j), (28, 1)]:
            self.assertLess(abs(scenes.complex_state(time)["z"] - expected), 1e-12)
        self.assertLess(
            scenes.complex_state(7)["point"][1], 450
        )  # counterclockwise on screen


class AnimationTests(unittest.TestCase):
    def test_button_contacts_and_frame_bounds(self):
        for render in (scenes.negative, scenes.binary, scenes.complex_rotation):
            contacts = []
            for frame in range(1080):
                info = render(NoDraw(), frame / 30)
                x, y = info["actor_head"]
                self.assertTrue(
                    22 < x < 1258 and 22 < y < 698, (render.__name__, frame, x, y)
                )
                contacts.extend(info["contacts"])
            self.assertGreater(len(contacts), 8)
            self.assertLess(max(contacts), 0.01)

    def test_unreachable_hand_is_clamped(self):
        elbow, end = joint((0, 0), (1000, 0), 40, 41)
        self.assertLessEqual(math.dist((0, 0), end), 81)
        self.assertAlmostEqual(math.dist((0, 0), elbow), 40)
        self.assertAlmostEqual(math.dist(elbow, end), 41)

    def test_frame_deterministic_and_motion_changes_pixels(self):
        for scene in scenes.SCENES:
            a, _ = scenes.render_frame(scene, 7, 1)
            b, _ = scenes.render_frame(scene, 7, 1)
            c, _ = scenes.render_frame(scene, 7.5, 1)
            self.assertEqual(a.size, (1280, 720))
            self.assertEqual(a.tobytes(), b.tobytes())
            self.assertNotEqual(a.tobytes(), c.tobytes())

    def test_unknown_scene_rejected(self):
        with self.assertRaises(ValueError):
            scenes.render_frame("not-a-scene", 0)

    def test_cli_rejects_invalid_arguments(self):
        for args in [
            ("--scene", "typo"),
            ("--scale", "nan"),
            ("--scale", "0"),
            ("--fps", "0"),
        ]:
            result = subprocess.run(
                [sys.executable, str(ROOT / "scripts/render_demo.py"), *args],
                capture_output=True,
            )
            self.assertEqual(result.returncode, 2)


class AudioTests(unittest.TestCase):
    def test_original_audio_finite_audible_and_unclipped(self):
        for scene in scenes.SCENES:
            samples = synthesize(scene, rate=8000)
            self.assertEqual(samples.shape, (288000, 2))
            self.assertTrue(np.isfinite(samples).all())
            self.assertGreater(np.abs(samples).max(), 0.05)
            self.assertLess(np.abs(samples).max(), 0.96)
            self.assertLess(np.abs(samples[-1]).max(), 1e-5)

    def test_audio_deterministic(self):
        a = synthesize("binary-search", rate=8000)
        b = synthesize("binary-search", rate=8000)
        np.testing.assert_array_equal(a, b)


if __name__ == "__main__":
    unittest.main()
