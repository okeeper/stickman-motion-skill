#!/usr/bin/env python3
"""Check actual MP4s: decode, duration, streams, frame count and audio peak."""

from __future__ import annotations
import argparse
import hashlib
import json
import math
import shutil
import subprocess
from pathlib import Path
import numpy as np
EXPECTED = {"negative-ride": 75, "binary-search": 85, "complex-rotation": 90, "newton": 82}
SCENES = ("negative-ride", "binary-search", "complex-rotation")


def check(path, legacy=False):
    duration = 36 if legacy else EXPECTED.get(path.stem)
    if duration is None:
        raise ValueError("unknown demo name")
    if not path.is_file():
        raise ValueError(f"missing video: {path}")
    probe = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-count_frames",
            "-show_streams",
            "-show_format",
            "-of",
            "json",
            str(path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    data = json.loads(probe.stdout)
    video = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
    audio = next((s for s in data["streams"] if s["codec_type"] == "audio"), None)
    if not video or not audio:
        raise ValueError(f"{path.name}: requires video and audio streams")
    if video["codec_name"] != "h264" or video["pix_fmt"] != "yuv420p":
        raise ValueError("expected H.264 / yuv420p")
    if (video["width"], video["height"]) != (1280, 720):
        raise ValueError("expected 1280 x 720")
    num, den = map(int, video["avg_frame_rate"].split("/"))
    fps = num / den
    frames = int(video["nb_read_frames"])
    if fps != (30 if legacy else 60):
        raise ValueError("unexpected final demo frame rate")
    if fps <= 0 or abs(frames / fps - duration) > 1 / fps:
        raise ValueError("unexpected frame count / duration")
    if abs(float(audio["duration"]) - duration) > 0.05:
        raise ValueError("audio duration does not match timeline")
    if audio["codec_name"] != "aac" or audio["channels"] != 2:
        raise ValueError("expected stereo AAC")
    subprocess.run(
        ["ffmpeg", "-v", "error", "-xerror", "-i", str(path), "-f", "null", "-"],
        check=True,
        capture_output=True,
    )
    raw = subprocess.run(
        [
            "ffmpeg",
            "-v",
            "error",
            "-i",
            str(path),
            "-map",
            "0:a:0",
            "-f",
            "f32le",
            "-acodec",
            "pcm_f32le",
            "-",
        ],
        check=True,
        capture_output=True,
    ).stdout
    samples = np.frombuffer(raw, dtype="<f4")
    if not np.isfinite(samples).all():
        raise ValueError("non-finite decoded audio")
    peak = float(np.abs(samples).max())
    if not 0.01 < peak < 0.99:
        raise ValueError(f"decoded audio silent or clipping: {peak}")
    return {
        "file": path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "duration": float(data["format"]["duration"]),
        "fps": fps,
        "frames": frames,
        "video": video["codec_name"],
        "pixel_format": video["pix_fmt"],
        "audio": audio["codec_name"],
        "sample_rate": int(audio["sample_rate"]),
        "channels": audio["channels"],
        "decoded_peak_dbfs": round(20 * math.log10(peak), 2),
        "bytes": path.stat().st_size,
        "decode": "pass",
    }


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument(
        "--video-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "demos/videos",
    )
    p.add_argument("--report", type=Path)
    p.add_argument("--scene", choices=tuple(EXPECTED), action="append")
    p.add_argument("--legacy", action="store_true", help="expect historical 36-second / 30 fps Python output")
    args = p.parse_args()
    if not all(shutil.which(tool) for tool in ("ffmpeg", "ffprobe")):
        p.exit(1, "FFmpeg and ffprobe must be on PATH.\n")
    try:
        results = [check(args.video_dir / f"{scene}.mp4", args.legacy) for scene in (args.scene or SCENES)]
    except (OSError, ValueError, subprocess.CalledProcessError) as e:
        p.exit(1, f"Media check failed: {e}\n")
    content = json.dumps(results, indent=2) + "\n"
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(content)
    print(content, end="")


if __name__ == "__main__":
    main()
