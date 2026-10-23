#!/usr/bin/env python3
"""Render the three hand-authored example scenes, without network or API keys."""

from __future__ import annotations
import argparse
import json
import math
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from PIL import Image, ImageDraw
from demo_engine.drawing import W, H, font
from demo_engine.scenes import SCENES, DURATION, render_frame
from motion_tools.common import encoding
from demo_engine.audio import write_audio

ROOT = Path(__file__).resolve().parents[1]


def positive_float(value):
    result = float(value)
    if not math.isfinite(result) or result <= 0:
        raise argparse.ArgumentTypeError("must be a positive finite number")
    return result


def posters(scene, out, scale):
    folder = out.parent / "posters"
    folder.mkdir(parents=True, exist_ok=True)
    times = {
        "negative-ride": [4.4, 7.8, 11.5, 16.2, 25.5, 32.5],
        "binary-search": [4.5, 11.6, 14.5, 20.8, 25.9, 32.5],
        "complex-rotation": [5, 8.5, 15, 21.5, 28, 32],
    }[scene]
    cover = {"negative-ride": 25.5, "binary-search": 20.8, "complex-rotation": 15}[
        scene
    ]
    render_frame(scene, cover, scale)[0].save(folder / f"{scene}.jpg", quality=92)
    sheet = Image.new("RGB", (1280, 1080), "#10171c")
    for j, t in enumerate(times):
        tile = render_frame(scene, t, scale)[0].resize(
            (640, 360), Image.Resampling.LANCZOS
        )
        ImageDraw.Draw(tile).text(
            (602, 12), f"{t:g}s", font=font(14, 1), fill="#e6ecea", anchor="ra"
        )
        sheet.paste(tile, ((j % 2) * 640, (j // 2) * 360))
    sheet.save(folder / f"{scene}-contact-sheet.jpg", quality=90)


def render(scene, out, fps, scale):
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("FFmpeg is required; install it and put ffmpeg on PATH.")
    out.mkdir(parents=True, exist_ok=True)
    dest = out / f"{scene}.mp4"
    start = time.monotonic()
    frames = round(DURATION * fps)
    # Render/mux in a temporary directory, then atomically replace the result.
    with tempfile.TemporaryDirectory(prefix="stickman-", dir=out) as work:
        work = Path(work)
        sound = work / "score.wav"
        part = work / "movie.mp4"
        log = work / "ffmpeg.log"
        audio = write_audio(sound, scene)
        command = [
            ffmpeg,
            "-y",
            "-loglevel",
            "error",
            "-f",
            "rawvideo",
            "-pixel_format",
            "rgb24",
            "-video_size",
            f"{W}x{H}",
            "-framerate",
            str(fps),
            "-i",
            "pipe:0",
            "-i",
            str(sound),
            "-map",
            "0:v:0",
            "-map",
            "1:a:0",
            *encoding(),
            "-t",
            str(DURATION),
            str(part),
        ]
        with log.open("wb") as errors:
            proc = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=errors)
            try:
                for n in range(frames):
                    im, _ = render_frame(scene, n / fps, scale)
                    proc.stdin.write(im.tobytes())
                    if n % (fps * 6) == 0:
                        print(f"{scene}: {n}/{frames} frames", flush=True)
                proc.stdin.close()
                if proc.wait() != 0:
                    raise RuntimeError(log.read_text())
            except BaseException:
                if proc.poll() is None:
                    proc.kill()
                proc.wait()
                if log.stat().st_size:
                    print(log.read_text(), flush=True)
                raise
        part.replace(dest)
    posters(scene, out, scale)
    info = {
        "scene": scene,
        "duration": DURATION,
        "fps": fps,
        "frames": frames,
        "size": [W, H],
        "bytes": dest.stat().st_size,
        "audio": audio,
        "render_seconds": round(time.monotonic() - start, 1),
    }
    (out / f"{scene}.json").write_text(json.dumps(info, indent=2) + "\n")
    print(json.dumps(info), flush=True)


def preview(scene, out):
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("FFmpeg is required for GIF previews.")
    source = out / f"{scene}.mp4"
    if not source.is_file():
        raise RuntimeError(f"Render the video first: {source.name}")
    folder = out.parent / "previews"
    folder.mkdir(parents=True, exist_ok=True)
    start = {"negative-ride": 20, "binary-search": 10, "complex-rotation": 10}[scene]
    with tempfile.TemporaryDirectory(prefix="preview-", dir=folder) as work:
        part = Path(work) / "preview.gif"
        filters = "fps=10,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3"
        subprocess.run(
            [
                ffmpeg,
                "-v",
                "error",
                "-y",
                "-ss",
                str(start),
                "-i",
                str(source),
                "-t",
                "12",
                "-filter_complex",
                filters,
                "-loop",
                "0",
                str(part),
            ],
            check=True,
        )
        part.replace(folder / f"{scene}.gif")
    print(f"{scene}: 12-second GIF preview ready", flush=True)


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--scene", choices=(*SCENES, "all"), default="all")
    p.add_argument("--out-dir", type=Path, default=ROOT / "demos" / "videos")
    p.add_argument("--fps", type=int, choices=(15, 24, 30, 60), default=30)
    p.add_argument(
        "--scale",
        type=positive_float,
        default=1.5,
        help="drawing supersampling; default 1.5",
    )
    mode = p.add_mutually_exclusive_group()
    mode.add_argument(
        "--stills-only",
        action="store_true",
        help="render posters and six-frame contact sheets",
    )
    mode.add_argument(
        "--gifs-only",
        action="store_true",
        help="make 12-second previews from existing MP4s",
    )
    args = p.parse_args()
    if not 0.5 <= args.scale <= 3:
        p.error("--scale must be between 0.5 and 3")
    scenes = SCENES if args.scene == "all" else (args.scene,)
    try:
        for scene in scenes:
            if args.stills_only:
                posters(scene, args.out_dir, args.scale)
            elif args.gifs_only:
                preview(scene, args.out_dir)
            else:
                render(scene, args.out_dir, args.fps, args.scale)
    except (RuntimeError, OSError, subprocess.CalledProcessError) as e:
        p.exit(1, f"Render failed: {e}\n")


if __name__ == "__main__":
    main()
