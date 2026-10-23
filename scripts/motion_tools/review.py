"""Inspect actual media, create review evidence, and package verified artifacts."""

from __future__ import annotations
import io
import math
import shutil
import subprocess
import tempfile
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from .common import (
    ToolError,
    ffmpeg,
    fields,
    hash_file,
    load_json,
    probe,
    run,
    tool,
    write_json,
)

ROOT = Path(__file__).resolve().parents[2]


def inspect(video, out, samples=12):
    video = Path(video).resolve()
    out = Path(out).resolve()
    if (
        isinstance(samples, bool)
        or not isinstance(samples, int)
        or not 2 <= samples <= 60
    ):
        raise ToolError("samples must be an integer from 2 to 60")
    info = probe(video, count=True)
    if not info["video"]:
        raise ToolError("Inspection requires a video stream")
    initial_hash = hash_file(video)
    run([tool("ffmpeg"), "-v", "error", "-xerror", "-i", video, "-f", "null", "-"])
    warnings = []
    audio = None
    if info["audio"]:
        peak = 0.0
        count = 0
        energy = 0.0
        with tempfile.TemporaryFile() as errors:
            process = subprocess.Popen(
                [
                    tool("ffmpeg"),
                    "-v",
                    "error",
                    "-i",
                    str(video),
                    "-map",
                    "0:a:0",
                    "-ac",
                    "2",
                    "-ar",
                    "48000",
                    "-f",
                    "f32le",
                    "-",
                ],
                stdout=subprocess.PIPE,
                stderr=errors,
            )
            try:
                while raw := process.stdout.read(65536):
                    values = np.frombuffer(raw, dtype="<f4")
                    if not np.isfinite(values).all():
                        raise ToolError("Audio contains non-finite samples")
                    count += len(values)
                    peak = max(peak, float(np.abs(values).max()))
                    energy += float(np.dot(values.astype("float64"), values))
                process.stdout.close()
                if process.wait():
                    errors.seek(0)
                    raise ToolError(errors.read().decode(errors="replace"))
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait()
        if not count:
            raise ToolError("Audio stream did not decode any samples")
        audio = {
            "analysis_sample_rate": 48000,
            "analysis_channels": 2,
            "source_sample_rate": int(info["audio"]["sample_rate"]),
            "source_channels": info["audio"]["channels"],
            "decoded_duration": round(count / 2 / 48000, 6),
            "decoded_samples_per_channel": count // 2,
            "peak_dbfs": round(20 * math.log10(peak), 3) if peak else None,
            "rms_dbfs": round(10 * math.log10(energy / count), 3) if energy else None,
        }
        if abs(count / 2 / 48000 - info["duration"]) > max(
            0.1, 1 / max(info["fps"], 1)
        ):
            warnings.append(
                "Decoded audio and video durations differ; check the intended timing."
            )
        if peak >= 0.99:
            warnings.append("Audio peak is close to full scale; listen for clipping.")
        if peak < 0.0001:
            warnings.append(
                "Audio stream is effectively silent; confirm this is intentional."
            )
    else:
        warnings.append("No audio stream; confirm this is intentional.")
    out.mkdir(parents=True, exist_ok=True)
    width = 320
    height = round(width * info["video"]["height"] / info["video"]["width"])
    if height > 480:
        height = 480
        width = round(height * info["video"]["width"] / info["video"]["height"])
    sheet = Image.new(
        "RGB", (width * 4, (height + 26) * math.ceil(samples / 4)), "#10171c"
    )
    font = ImageFont.truetype(str(ROOT / "assets/fonts/DejaVuSans.ttf"), 13)
    last = None
    changed = []
    quiet = []
    moments = []
    for i in range(samples):
        t = (i + 0.5) * info["duration"] / samples
        moments.append(round(t, 4))
        image = Image.open(
            io.BytesIO(
                ffmpeg(
                    [
                        "-ss",
                        str(t),
                        "-i",
                        video,
                        "-frames:v",
                        "1",
                        "-vf",
                        f"scale={width}:{height}",
                        "-f",
                        "image2pipe",
                        "-vcodec",
                        "png",
                        "pipe:1",
                    ]
                )
            )
        ).convert("RGB")
        array = np.asarray(image).astype(np.int16)
        if array.std() < 1:
            quiet.append(round(t, 3))
        if last is not None:
            changed.append(float((np.abs(array - last).max(axis=2) > 12).mean()))
        last = array
        x = (i % 4) * width
        y = (i // 4) * (height + 26)
        sheet.paste(image, (x, y + 26))
        ImageDraw.Draw(sheet).text(
            (x + 8, y + 5), f"{t:.3f}s", font=font, fill="#e6ecea"
        )
    sheet.save(out / "contact-sheet.jpg", quality=90)
    if quiet:
        warnings.append(
            "Near-uniform sampled frames at "
            + ", ".join(map(str, quiet))
            + " s; inspect context."
        )
    if initial_hash != hash_file(video):
        raise ToolError("Input changed during inspection; repeat the check")
    report = {
        "version": 1,
        "file": video.name,
        "sha256": initial_hash,
        "bytes": video.stat().st_size,
        "duration": info["duration"],
        "width": info["video"]["width"],
        "height": info["video"]["height"],
        "fps": info["fps"],
        "frames": int(info["video"].get("nb_read_frames", 0)),
        "video_codec": info["video"]["codec_name"],
        "pixel_format": info["video"].get("pix_fmt"),
        "audio": audio,
        "decode": "pass",
        "sample_times": moments,
        "sampled_changed_fraction_mean": round(float(np.mean(changed)), 6),
        "warnings": warnings,
        "human_review": "not_recorded",
    }
    write_json(out / "qa.json", report)
    (out / "QA.md").write_text(
        f"""# 媒体检查

- 文件：{video.name}
- SHA-256：{initial_hash}
- 时长：{info["duration"]:.6g} 秒；帧数：{report["frames"]}；帧率：{info["fps"]:.6g}
- 画幅：{report["width"]}×{report["height"]}；完整解码通过。
- 音轨：{"已检查长度、有限值与峰值" if audio else "无"}。
- 正常速度观片、听审、概念正确性：脚本未检查，不自动标记为通过。

[抽帧联系表](contact-sheet.jpg) · [机器结果](qa.json)

抽帧差异只描述采样点之间的变化，不是动画质量评分。留白、低运动和无音轨可能符合创作意图。

"""
        + (
            "\n".join("- " + w for w in warnings)
            if warnings
            else "未发现上述技术提示项。"
        )
        + "\n",
        encoding="utf-8",
    )
    return report


def deliver(video, destination):
    video = Path(video).resolve()
    destination = Path(destination).resolve()
    if not video.is_file():
        raise ToolError("Delivery source does not exist")
    if destination.exists():
        raise ToolError("Delivery directory already exists; choose a new directory")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        prefix=".deliver-", dir=destination.parent
    ) as temp:
        root = Path(temp) / "package"
        root.mkdir()
        shutil.copy2(video, root / "video.mp4")
        report = inspect(root / "video.mp4", root / "review", samples=8)
        (root / "DELIVERY.md").write_text(
            f"""# 交付记录

[成片](video.mp4) · [检查记录](review/QA.md) · [抽帧](review/contact-sheet.jpg)

实际成片：{report["duration"]:.6g} 秒，{report["width"]}×{report["height"]}，{report["frames"]} 帧。完整解码通过；人工观片与听审未记录。

manifest.json 记录包内文件的 SHA-256。使用 `motion.py verify <本目录>` 检查文件是否变化；指纹用于一致性核对，不是第三方签名或质量认证。
""",
            encoding="utf-8",
        )
        files = {
            str(p.relative_to(root)).replace("\\", "/"): hash_file(p)
            for p in sorted(root.rglob("*"))
            if p.is_file()
        }
        write_json(root / "manifest.json", {"version": 1, "files": files})
        root.rename(destination)
    return {
        "delivery": str(destination),
        "files": len(files),
        "media_sha256": report["sha256"],
    }


def verify(directory):
    directory = Path(directory).resolve()
    manifest = load_json(directory / "manifest.json")
    fields(manifest, ("version", "files"), ("version", "files"), "manifest")
    if (
        manifest["version"] != 1
        or not isinstance(manifest["files"], dict)
        or not manifest["files"]
    ):
        raise ToolError("Invalid delivery manifest")
    for name, digest in manifest["files"].items():
        path = directory / name
        if (
            Path(name).is_absolute()
            or not path.resolve().is_relative_to(directory)
            or path.is_symlink()
        ):
            raise ToolError("Manifest path escapes package")
        if not path.is_file() or hash_file(path) != digest:
            raise ToolError(f"Delivery file missing or changed: {name}")
    actual = {
        str(p.relative_to(directory)).replace("\\", "/")
        for p in directory.rglob("*")
        if p.is_file() and p != directory / "manifest.json"
    }
    if actual != set(manifest["files"]):
        raise ToolError("Delivery contains unlisted files")
    return {"verified": True, "files": len(actual)}
