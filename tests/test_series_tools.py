"""Current media tools must reject partial inputs before changing published previews."""
import importlib.util
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from check_demo_media import check
from series_previews import generate


class SeriesToolsTest(unittest.TestCase):
    def test_missing_input_preserves_existing_previews(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            videos = root / "videos"
            videos.mkdir()
            (root / "previews").mkdir()
            marker = root / "previews/negative-ride.gif"
            marker.write_bytes(b"keep")
            with self.assertRaisesRegex(ValueError, "missing video"):
                generate(videos)
            self.assertEqual(marker.read_bytes(), b"keep")
            self.assertFalse((root / "posters").exists())

    @unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "requires FFmpeg")
    def test_short_video_is_rejected_as_a_current_demo(self):
        with tempfile.TemporaryDirectory() as folder:
            video = Path(folder) / "negative-ride.mp4"
            subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "color=s=1280x720:r=60:d=0.1",
                            "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", "0.1",
                            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(video)], check=True)
            with self.assertRaisesRegex(ValueError, "frame count / duration"):
                check(video)


if __name__ == "__main__":
    unittest.main()
