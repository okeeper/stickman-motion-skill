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


if __name__ == "__main__":
    unittest.main()
