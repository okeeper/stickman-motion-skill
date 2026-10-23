"""Shared media I/O, subprocesses, fingerprints and atomic output."""

from __future__ import annotations
import hashlib
import importlib.metadata
import json
import math
import os
import shutil
import subprocess
import tempfile
from contextlib import contextmanager
from fractions import Fraction
from pathlib import Path


class ToolError(ValueError):
    pass


# Adapted from alchaincyf/huashu-art-motion scripts/deliver.py (MIT).
# Upstream revision and original notice: docs/upstream-reuse.md, licenses/.
def hash_file(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def fingerprint(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, ensure_ascii=False).encode()
    ).hexdigest()


def tool(name):
    found = shutil.which(name)
    if not found:
        raise ToolError(f"Missing {name}; install it and put it on PATH.")
    return found


def run(args):
    result = subprocess.run([str(x) for x in args], capture_output=True)
    if result.returncode:
        raise ToolError(
            f"{Path(str(args[0])).name} failed: "
            + result.stderr.decode("utf-8", errors="replace")[-4000:]
        )
    return result.stdout


def ffmpeg(args):
    return run(
        [tool("ffmpeg"), "-hide_banner", "-loglevel", "error", "-nostdin", "-y", *args]
    )


def probe(path, count=False):
    path = Path(path)
    if not path.is_file():
        raise ToolError(f"Missing media: {path.name}")
    data = json.loads(
        run(
            [
                tool("ffprobe"),
                "-v",
                "error",
                *(["-count_frames"] if count else []),
                "-show_streams",
                "-show_format",
                "-of",
                "json",
                path,
            ]
        )
    )
    streams = data.get("streams", [])
    v = next(
        (
            s
            for s in streams
            if s["codec_type"] == "video"
            and not s.get("disposition", {}).get("attached_pic")
        ),
        None,
    )
    a = next((s for s in streams if s["codec_type"] == "audio"), None)

    def duration(s):
        try:
            return float((s or {}).get("duration", 0))
        except (ValueError, TypeError):
            return 0

    length = duration(v) or duration(data.get("format")) or duration(a)
    if not math.isfinite(length) or length <= 0:
        raise ToolError(f"Cannot determine positive duration: {path.name}")
    fps = 0.0
    if v:
        try:
            fps = float(Fraction(v.get("avg_frame_rate", "0/1")))
        except (ValueError, ZeroDivisionError):
            pass
    return {
        "duration": length,
        "video": v,
        "audio": a,
        "fps": fps,
        "format": data.get("format", {}),
    }


def load_json(path):
    try:
        data = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise ToolError(f"Cannot read JSON {Path(path).name}: {e}") from e
    if not isinstance(data, dict):
        raise ToolError("JSON root must be an object")
    return data


def fields(data, allowed, required=(), where="spec"):
    if not isinstance(data, dict):
        raise ToolError(f"{where} must be an object")
    unknown = set(data) - set(allowed)
    missing = set(required) - set(data)
    if unknown or missing:
        raise ToolError(
            f"{where}: unknown fields {sorted(unknown)}, missing fields {sorted(missing)}"
        )


def number(value, where, minimum=0, maximum=math.inf):
    if (
        isinstance(value, bool)
        or not isinstance(value, (float, int))
        or not math.isfinite(value)
        or not minimum <= value <= maximum
    ):
        raise ToolError(f"{where} must be finite in [{minimum}, {maximum}]")
    return value


def source_path(base, value):
    if (
        not isinstance(value, str)
        or not value.strip()
        or "\x00" in value
        or "://" in value
    ):
        raise ToolError("Media paths must name local files")
    path = (Path(base) / value).resolve()
    if not path.is_file():
        raise ToolError(f"Missing input: {value}")
    return path


def protect_output(output, inputs):
    if output.resolve() in {Path(x).resolve() for x in inputs}:
        raise ToolError("Output would overwrite an input")


@contextmanager
def atomic_path(destination):
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".motion-", dir=destination.parent) as temp:
        staged = Path(temp) / destination.name
        yield staged
        os.replace(staged, destination)


def write_json(path, data):
    with atomic_path(path) as target:
        target.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )


def encoding(crf=20):
    return [
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        str(crf),
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
    ]


def cache_signature():
    # Changes to tooling or FFmpeg invalidate cached normalizations.
    root = Path(__file__).parent
    return {
        "code": fingerprint({p.name: hash_file(p) for p in sorted(root.glob("*.py"))}),
        "ffmpeg": run([tool("ffmpeg"), "-version"]).decode().splitlines()[0],
        "libraries": {
            name: importlib.metadata.version(name) for name in ("Pillow", "numpy")
        },
    }


def valid_cache(movie, key):
    sidecar = movie.with_suffix(".cache.json")
    if not movie.is_file() or not sidecar.is_file():
        return False
    try:
        record = load_json(sidecar)
        return record.get("key") == key and record.get("sha256") == hash_file(movie)
    except ToolError:
        return False


def mark_cache(movie, key):
    write_json(
        movie.with_suffix(".cache.json"), {"key": key, "sha256": hash_file(movie)}
    )
