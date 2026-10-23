"""Real FFmpeg regression cases for editing, failure handling and portable projects."""

from __future__ import annotations
import copy
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from motion_tools.common import (
    ToolError,
    ffmpeg,
    hash_file,
    load_json,
    probe,
    write_json,
)
from motion_tools.edit import execute, plan
from motion_tools.review import deliver, inspect, verify


@unittest.skipUnless(
    shutil.which("ffmpeg") and shutil.which("ffprobe"), "FFmpeg required"
)
class ToolingIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory(prefix="motion-tests-")
        cls.root = Path(cls.temp.name)
        cls.a = cls.root / "红色 'first clip.mp4"
        cls.b = cls.root / "portrait silent.mp4"
        cls.wav = cls.root / "tone.wav"
        ffmpeg(
            [
                "-f",
                "lavfi",
                "-i",
                "color=c=red:s=320x180:r=30:d=2",
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=440:duration=2",
                "-c:v",
                "libx264",
                "-threads",
                "2",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-shortest",
                cls.a,
            ]
        )
        ffmpeg(
            [
                "-f",
                "lavfi",
                "-i",
                "color=c=blue:s=120x240:r=24:d=2",
                "-c:v",
                "libx264",
                "-threads",
                "2",
                "-pix_fmt",
                "yuv420p",
                cls.b,
            ]
        )
        ffmpeg(
            [
                "-f",
                "lavfi",
                "-i",
                "sine=frequency=660:duration=2",
                "-ar",
                "48000",
                cls.wav,
            ]
        )

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def spec(self, name, clips=None, **kwargs):
        data = {
            "version": 1,
            "canvas": {"width": 320, "height": 180, "fps": 30},
            "clips": clips or [{"source": self.a.name, "in": 0, "out": 1}],
            "output": name + ".mp4",
            **kwargs,
        }
        path = self.root / (name + ".json")
        write_json(path, data)
        return path

    def pcm(self, path):
        return np.frombuffer(
            ffmpeg(
                [
                    "-i",
                    path,
                    "-map",
                    "0:a:0",
                    "-ac",
                    "1",
                    "-ar",
                    "48000",
                    "-f",
                    "f32le",
                    "-",
                ]
            ),
            dtype="<f4",
        )

    def pixel(self, path, t):
        raw = ffmpeg(
            [
                "-ss",
                str(t),
                "-i",
                path,
                "-frames:v",
                "1",
                "-f",
                "image2pipe",
                "-vcodec",
                "png",
                "-",
            ]
        )
        return np.asarray(Image.open(io.BytesIO(raw)).convert("RGB"))

    def test_cut_normalizes_size_rate_speed_and_silent_audio(self):
        spec = self.spec(
            "cut",
            [
                {"source": self.a.name, "in": 0.2, "out": 1.7, "speed": 1.5},
                {"source": self.b.name, "in": 0.25, "out": 1.25, "speed": 0.5},
            ],
        )
        hashes = [hash_file(self.a), hash_file(self.b)]
        p = plan(spec)
        result = execute(p)
        info = probe(p["destination"], count=True)
        self.assertEqual(result["frames"], 90)
        self.assertEqual(int(info["video"]["nb_read_frames"]), 90)
        self.assertAlmostEqual(info["duration"], 3, places=2)
        self.assertEqual((info["video"]["width"], info["video"]["height"]), (320, 180))
        self.assertEqual([hash_file(self.a), hash_file(self.b)], hashes)
        first = self.pixel(p["destination"], 0.5)
        last = self.pixel(p["destination"], 2)
        self.assertGreater(first[90, 160, 0], 200)
        self.assertGreater(last[90, 160, 2], 200)
        self.assertLess(
            last[90, 10].max(), 40
        )  # contain pads portrait, no distortion/crop
        audio = self.pcm(p["destination"])
        self.assertGreater(np.abs(audio[10000:30000]).max(), 0.03)
        self.assertLess(np.abs(audio[80000:110000]).max(), 0.001)
        # Pitch is preserved by atempo; a naive resample would move 440Hz to 660Hz.
        sample = audio[12000:36000]
        freq = np.argmax(np.abs(np.fft.rfft(sample))) * 48000 / len(sample)
        self.assertLess(abs(freq - 440), 8)
        self.assertTrue(all(c["hit"] for c in plan(spec)["clips"]))
        p["clips"][0]["cache"].write_bytes(b"broken cache")
        self.assertFalse(plan(spec)["clips"][0]["hit"])

    def test_fade_mix_offsets_and_utf8_subtitles(self):
        srt = self.root / "字幕 'track.srt"
        srt.write_text("1\n00:00:00,000 --> 00:00:03,800\n测试字幕\n", encoding="utf-8")
        spec = self.spec(
            "fade",
            [
                {"source": self.a.name, "mute": True},
                {"source": self.b.name},
                {"source": self.a.name, "mute": True},
            ],
            transition={"type": "fade", "duration": 0.2},
            audio=[
                {
                    "source": self.wav.name,
                    "in": 0,
                    "out": 0.5,
                    "at": 0.5,
                    "gain_db": -6,
                    "fade_in": 0.05,
                    "fade_out": 0.05,
                }
            ],
            subtitles=srt.name,
        )
        p = plan(spec)
        execute(p)
        info = probe(p["destination"], count=True)
        self.assertEqual(int(info["video"]["nb_read_frames"]), 168)
        self.assertAlmostEqual(info["duration"], 5.6, places=2)
        middle = self.pixel(p["destination"], 1.9)[90, 160]
        self.assertTrue(50 < middle[0] < 210 and 50 < middle[2] < 210, middle)
        audio = self.pcm(p["destination"])
        self.assertLess(np.abs(audio[5000:15000]).max(), 0.001)
        self.assertGreater(np.abs(audio[30000:40000]).max(), 0.02)
        self.assertLess(np.abs(audio[60000:70000]).max(), 0.001)
        subtitles = ffmpeg(
            ["-i", p["destination"], "-map", "0:s:0", "-f", "srt", "-"]
        ).decode("utf-8")
        self.assertIn("测试字幕", subtitles)

    def test_cache_invalidation_and_errors_preserve_output(self):
        copy_source = self.root / "mutable.mp4"
        shutil.copy2(self.a, copy_source)
        spec = self.spec("invalidation", [{"source": copy_source.name}])
        before = plan(spec)["clips"][0]["key"]
        shutil.copy2(self.b, copy_source)
        after = plan(spec)["clips"][0]["key"]
        self.assertNotEqual(before, after)
        sentinel = self.root / "preserved.mp4"
        sentinel.write_bytes(b"existing final")
        original = load_json(spec)
        original["output"] = sentinel.name
        variants = []
        for patch in (
            {"speed": 0},
            {"speed": float("nan")},
            {"out": 99},
            {"in": 1, "out": 0.5},
            {"typo": 1},
        ):
            v = copy.deepcopy(original)
            v["clips"][0].update(patch)
            variants.append(v)
        v = copy.deepcopy(original)
        v["canvas"]["fps"] = True
        variants.append(v)
        v = copy.deepcopy(original)
        v["transition"] = {"type": "fade", "duration": 4}
        variants.append(v)
        v = copy.deepcopy(original)
        v["output"] = copy_source.name
        variants.append(v)
        for variant in variants:
            spec.write_text(json.dumps(variant), encoding="utf-8")
            with self.assertRaises(ToolError):
                plan(spec)
            self.assertEqual(sentinel.read_bytes(), b"existing final")

    def test_encoder_failure_keeps_existing_movie(self):
        bad = self.root / "invalid.srt"
        bad.write_text("not a subtitle file", encoding="utf-8")
        spec = self.spec("encode-failure", subtitles=bad.name)
        output = self.root / "encode-failure.mp4"
        output.write_bytes(b"existing movie")
        with self.assertRaises(ToolError):
            execute(plan(spec))
        self.assertEqual(output.read_bytes(), b"existing movie")

    def test_inspection_accepts_silence_and_delivery_detects_tampering(self):
        report = inspect(self.b, self.root / "review", samples=4)
        self.assertEqual(report["decode"], "pass")
        self.assertIsNone(report["audio"])
        self.assertEqual(report["human_review"], "not_recorded")
        out = self.root / "delivery"
        deliver(self.b, out)
        self.assertTrue(verify(out)["verified"])
        (out / "video.mp4").write_bytes(b"changed")
        with self.assertRaises(ToolError):
            verify(out)
        with self.assertRaises(ToolError):
            deliver(self.b, out)

    def test_portable_project_render_window_cache_and_stills(self):
        project = self.root / "standalone project"

        def cli(*args, cwd=None):
            result = subprocess.run(
                [sys.executable, str(project / "scripts/motion.py"), *map(str, args)],
                cwd=cwd,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)

        init = subprocess.run(
            [sys.executable, str(ROOT / "scripts/motion.py"), "init", str(project)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(init.returncode, 0, init.stderr)
        # Change process directory and remove PYTHONPATH assumptions.
        command = (
            "render",
            project / "project.json",
            "--profile",
            "preview",
            "--start",
            5,
            "--end",
            6,
            "--out",
            project / "renders/window.mp4",
        )
        a = cli(*command, cwd=self.root)
        b = cli(*command, cwd=self.root)
        self.assertFalse(a["cache_hit"])
        self.assertTrue(b["cache_hit"])
        self.assertEqual(a["frames"], 15)
        data = probe(project / "renders/window.mp4", count=True)
        self.assertEqual(int(data["video"]["nb_read_frames"]), 15)
        cli(
            "render",
            project / "project.json",
            "--stills",
            5,
            6,
            "--out",
            project / "stills",
            cwd=self.root,
        )
        self.assertEqual(len(list((project / "stills").glob("*.png"))), 2)
        with (project / "scene.py").open("a") as f:
            f.write("\n# revised scene\n")
        c = cli(*command, cwd=self.root)
        self.assertFalse(c["cache_hit"])
        init = subprocess.run(
            [sys.executable, str(ROOT / "scripts/motion.py"), "init", str(project)],
            capture_output=True,
            text=True,
        )
        self.assertEqual(init.returncode, 1)


if __name__ == "__main__":
    unittest.main()
