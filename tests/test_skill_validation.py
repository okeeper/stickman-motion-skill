"""Validate the standalone skill package and meaningful failure paths."""
from __future__ import annotations

from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "validate.py"


class SkillValidationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        for file in ("package.json", "package-lock.json", "scripts/autopilot.mjs", "scripts/autopilot-core.mjs", "scripts/autopilot-render.mjs", "licenses/stickman-video-director-MIT.txt"):
            path = self.root / file
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("fixture", encoding="utf-8")
        (self.root / "SKILL.md").write_text("---\nname: stickman-motion-skill\ndescription: Test the skill.\n---\n\nInstructions.\n", encoding="utf-8")

    def run_check(self):
        return subprocess.run([sys.executable, str(SCRIPT), "--root", str(self.root)], capture_output=True, text=True)

    def test_standalone_package_does_not_require_legacy_examples(self):
        result = self.run_check()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_missing_runtime_and_broken_link_fail(self):
        (self.root / "scripts/autopilot-render.mjs").unlink()
        (self.root / "SKILL.md").write_text("---\nname: stickman-motion-skill\ndescription: Test.\n---\n\n[Missing](missing.md)\n", encoding="utf-8")
        result = self.run_check()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("required runtime file is missing", result.stderr)
        self.assertIn("missing local link", result.stderr)


if __name__ == "__main__":
    unittest.main()
