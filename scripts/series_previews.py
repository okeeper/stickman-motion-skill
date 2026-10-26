#!/usr/bin/env python3
"""Rebuild current demo GIFs and posters from the delivered MP4s, not the scene model."""
from __future__ import annotations
import argparse
import io
from pathlib import Path
import subprocess
import tempfile
from PIL import Image, ImageDraw, ImageFont
from check_demo_media import check

ROOT = Path(__file__).resolve().parents[1]
TIMES = {
    "negative-ride": [0, .65, 1.7, 2.6, 3.25, 3.65, 5.1, 6.7, 8.6, 9.2, 10.2, 12.5],
    "binary-search": [.6, 2.65, 3.1, 4.7, 6.2, 7.4, 8.8, 10.8, 11.7, 13.5, 14.7, 16.8],
    "complex-rotation": [.6, 1.7, 3.65, 4.9, 6.6, 7.9, 8.4, 10.4, 12.95, 14.2, 17.35, 19.8],
}
COVERS = {"negative-ride": 6.7, "binary-search": 10.8, "complex-rotation": 10.4}


def frame(video: Path, t: float) -> Image.Image:
    result = subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", str(video),
                             "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "-"],
                            check=True, capture_output=True)
    return Image.open(io.BytesIO(result.stdout)).convert("RGB")


def generate(video_dir: Path) -> None:
    # Validate all inputs first, so a partial or historical set cannot replace current previews.
    for scene in TIMES:
        check(video_dir / f"{scene}.mp4")
    out = video_dir.parent
    font = ImageFont.truetype(str(ROOT / "assets/fonts/DejaVuSans.ttf"), 17)
    for folder in (out / "posters", out / "previews"):
        folder.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".series-previews-", dir=out) as tmp:
        work = Path(tmp)
        for scene, times in TIMES.items():
            source = video_dir / f"{scene}.mp4"
            frame(source, COVERS[scene]).save(work / f"{scene}.jpg", quality=92)
            sheet = Image.new("RGB", (1280, 1040), "#080a0d")
            for i, t in enumerate(times):
                tile = frame(source, t).resize((426, 240), Image.Resampling.LANCZOS)
                x, y = (i % 3) * 426, (i // 3) * 260
                sheet.paste(tile, (x, y + 20))
                ImageDraw.Draw(sheet).text((x + 10, y), f"{t:.2f} s", font=font, fill="#c7ced5")
            sheet.save(work / f"{scene}-contact-sheet.jpg", quality=92)
            filters = "fps=16,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=3"
            subprocess.run(["ffmpeg", "-v", "error", "-i", str(source), "-filter_complex", filters,
                            "-loop", "0", str(work / f"{scene}.gif")], check=True)
        for scene in TIMES:
            for suffix in (".jpg", "-contact-sheet.jpg"):
                (work / (scene + suffix)).replace(out / "posters" / (scene + suffix))
            (work / f"{scene}.gif").replace(out / "previews" / f"{scene}.gif")
            print(f"{scene}: encoded-frame posters and full-length GIF ready")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--video-dir", type=Path, default=ROOT / "demos/videos")
    args = parser.parse_args()
    try:
        generate(args.video_dir)
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        parser.exit(1, f"Preview generation failed: {exc}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
