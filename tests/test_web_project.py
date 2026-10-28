"""The TS starter must be portable and must preserve an existing destination."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("init_web", ROOT / "scripts" / "init_web.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class WebProjectTest(unittest.TestCase):
    def test_motion_canvas_starter_shares_only_needed_modules(self):
        with tempfile.TemporaryDirectory() as folder:
            project = MODULE.initialize(Path(folder) / "motion-film", "trace", "motion-canvas")
            for relative in ("motion/src/scenes/trace.tsx", "motion/src/project.meta", "motion/scripts/render.mjs",
                             "motion/package-lock.json", "web/src/physics.ts", "web/scripts/video.mjs", "web/scripts/score.mjs",
                             "assets/fonts/DejaVuSans.ttf", "assets/fonts/LICENSE_DEJAVU"):
                self.assertTrue((project / relative).is_file(), relative)
            self.assertFalse((project / "web/package.json").exists())
            self.assertFalse(any(project.rglob("node_modules")))
            self.assertIn("/preview.html", (project / "README.md").read_text())
            with self.assertRaises(ValueError):
                MODULE.initialize(Path(folder) / "bad", "adventure", "motion-canvas")
            self.assertFalse((Path(folder) / "bad").exists())
    def test_starter_contains_relative_assets_and_no_installed_dependencies(self):
        with tempfile.TemporaryDirectory() as folder:
            project = MODULE.initialize(Path(folder) / "film")
            for relative in ("web/src/adventure/model.ts", "web/scripts/render.mjs", "web/package-lock.json",
                             "assets/fonts/DejaVuSans.ttf", "assets/fonts/LICENSE_DEJAVU",
                             "web/assets/fonts/OFL.txt", "README.md", "LICENSE"):
                self.assertTrue((project / relative).is_file(), relative)
            for name in ("node_modules", "dist", ".test-build", "test-results", ".env"):
                self.assertFalse((project / "web" / name).exists())
            css = project / "web/src/adventure/style.css"
            self.assertTrue((css.parent / "../../../assets/fonts/DejaVuSans.ttf").resolve().is_file())
            self.assertFalse(any(project.rglob("*.mp4")))
            self.assertIn("/film.html", (project / "README.md").read_text())

    def test_newton_starter_contains_its_actual_model_and_no_audio_cache(self):
        with tempfile.TemporaryDirectory() as folder:
            project = MODULE.initialize(Path(folder) / "newton", "newton", "motion-canvas")
            for relative in ("motion/newton.html", "motion/src/scenes/newton.tsx", "motion/src/newton-project.ts",
                             "web/src/newton/model.ts", "motion/scripts/test-newton.mjs"):
                self.assertTrue((project / relative).is_file(), relative)
            self.assertIn("/newton.html", (project / "README.md").read_text())
            self.assertFalse(any(project.rglob("*.wav")))
            self.assertFalse(any(project.rglob("bank-local.json")))
            with self.assertRaisesRegex(ValueError, "already exists"):
                MODULE.initialize(project, "newton", "motion-canvas")
            self.assertTrue((project / "motion/newton.html").exists())

    def test_newton_v2_starter_includes_revision_and_does_not_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            project = MODULE.initialize(Path(folder) / "revision", "newton-v2", "motion-canvas")
            for relative in ("motion/newton-v2.html", "motion/src/scenes/newton-v2.tsx",
                             "web/src/newton/refinement.ts", "web/src/newton/model.ts"):
                self.assertTrue((project / relative).is_file(), relative)
            self.assertIn("/newton-v2.html", (project / "README.md").read_text())
            with self.assertRaisesRegex(ValueError, "already exists"):
                MODULE.initialize(project, "newton-v2", "motion-canvas")
            self.assertTrue((project / "motion/newton-v2.html").is_file())

    def test_concept_starters_keep_shared_actions_scenes_and_entrypoints(self):
        with tempfile.TemporaryDirectory() as folder:
            for scene in ("negative-ride", "binary-search", "complex-rotation"):
                project = MODULE.initialize(Path(folder) / scene, scene, "motion-canvas")
                for relative in (f"motion/{scene}.html", f"motion/src/{scene}-project.ts",
                                 "motion/src/scenes/series.tsx", "web/src/series/model.ts",
                                 "web/src/series/motion.ts", "motion/scripts/render-series.mjs"):
                    self.assertTrue((project / relative).is_file(), relative)
                self.assertIn(f"/{scene}.html", (project / "README.md").read_text())
                self.assertFalse(any(project.rglob("*.mp4")))

    def test_existing_project_and_invalid_mode_leave_files_untouched(self):
        with tempfile.TemporaryDirectory() as folder:
            project = Path(folder) / "existing"
            project.mkdir()
            marker = project / "keep.txt"
            marker.write_text("keep")
            with self.assertRaisesRegex(ValueError, "already exists"):
                MODULE.initialize(project)
            self.assertEqual(marker.read_text(), "keep")
            with self.assertRaises(ValueError):
                MODULE.initialize(Path(folder) / "bad", "unknown")
            self.assertFalse((Path(folder) / "bad").exists())

    def test_action_starter_preserves_the_sound_bank_and_its_license(self):
        with tempfile.TemporaryDirectory() as folder:
            project = MODULE.initialize(Path(folder) / "action", "action", "motion-canvas")
            for relative in ("web/src/stunt.ts", "web/src/action/model.ts", "web/src/foley.mjs",
                             "motion/action.html", "motion/src/preview.ts", "motion/scripts/action-audio.mjs",
                             "motion/public/audio/bank.json", "motion/public/audio/LICENSE-impact.txt",
                             "scripts/prepare_audio.py", ".gitignore"):
                self.assertTrue((project / relative).is_file(), relative)
            self.assertIn("/action.html", (project / "README.md").read_text())
            self.assertFalse(any(project.rglob("*.mp4")))


if __name__ == "__main__":
    unittest.main()
