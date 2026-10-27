#!/usr/bin/env python3
"""Rebuild current demo GIFs and posters from the delivered MP4s, not the scene model."""
from __future__ import annotations
import argparse
import io
from pathlib import Path
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFont
from check_demo_media import check, SCENES

ROOT = Path(__file__).resolve().parents[1]
TIMES = {
    "negative-ride": [0,4.8,12.9,14,17,34.7,37,44.2,60.7,61.14,61.5,70],
    "binary-search": [0,5,12,16,22.9,28.6,33.1,38.5,45.6,51.3,68,77.2],
    "newton": [0,4,11,12.7,21.8,25.65,26.7,43,49.5,58.9,68,79],
    "complex-rotation": [0,6,12.8,13.7,20,32.5,41.5,55.4,73.8,74.8,77,88],
}
COVERS = {"newton": 68, "negative-ride": 61.5, "binary-search": 72, "complex-rotation": 32.5}


def frame(video: Path, t: float) -> Image.Image:
    result = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", str(video),
                             "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
                            check=True, capture_output=True)
    return Image.open(io.BytesIO(result.stdout)).convert("RGB")


def generate(video_dir: Path, scenes: tuple[str, ...] = SCENES) -> None:
    # Validate all inputs first, so a partial or historical set cannot replace current previews.
    for scene in scenes:
        check(video_dir / f"{scene}.mp4")
    out = video_dir.parent
    font = ImageFont.truetype(str(ROOT / "assets/fonts/DejaVuSans.ttf"), 17)
    for folder in (out / "posters", out / "previews"):
        folder.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".series-previews-", dir=out) as tmp:
        work = Path(tmp)
        for scene in scenes:
            times = TIMES[scene]
            source = video_dir / f"{scene}.mp4"
            frame(source, COVERS[scene]).save(work / f"{scene}.jpg", quality=92)
            sheet = Image.new("RGB", (1280, 1040), "#080a0d")
            for i, t in enumerate(times):
                tile = frame(source, t).resize((426, 240), Image.Resampling.LANCZOS)
                x, y = (i % 3) * 426, (i // 3) * 260
                sheet.paste(tile, (x, y + 20))
                ImageDraw.Draw(sheet).text((x + 10, y), f"{t:.2f} s", font=font, fill="#c7ced5")
            sheet.save(work / f"{scene}-contact-sheet.jpg", quality=92)
            filters = "fps=12,scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3"
            subprocess.run(["ffmpeg", "-v", "error", "-i", str(source), "-filter_complex", filters,
                            "-loop", "0", str(work / f"{scene}.gif")], check=True)
        for scene in scenes:
            for suffix in (".jpg", "-contact-sheet.jpg"):
                (work / (scene + suffix)).replace(out / "posters" / (scene + suffix))
            (work / f"{scene}.gif").replace(out / "previews" / f"{scene}.gif")
            print(f"{scene}: encoded-frame posters and full-length GIF ready")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video-dir", type=Path, default=ROOT / "demos/videos")
    parser.add_argument("--scene", choices=tuple(TIMES), action="append")
    args = parser.parse_args()
    try:
        generate(args.video_dir, tuple(args.scene or SCENES))
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f"Preview generation failed: {exc}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
