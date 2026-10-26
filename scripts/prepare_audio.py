#!/usr/bin/env python3
"""Prepare the licensed production sound cache; never download reference-video media."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from urllib.request import urlopen
import zipfile

PACKS = {
    "impact": ("https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip",
               "029d734af1582474edf3a694d1b0cebc97c1c152f2f39fa34d4c2bafc5de77f8"),
    "rpg": ("https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip",
            "6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b"),
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def prepare(root: Path, offline: bool = False) -> int:
    root = root.resolve()
    folder = root / "motion/public/audio"
    manifest = json.loads((folder / "bank.json").read_text())
    samples = manifest["samples"]
    state_file = folder / "bank-local.json"
    if state_file.exists():
        state = json.loads(state_file.read_text())
        if all((folder / item["file"]).is_file() and
               digest((folder / item["file"]).read_bytes()) == state.get("samples", {}).get(name, {}).get("sha256")
               for name, item in samples.items()):
            return len(samples)
    if not shutil.which("ffmpeg"):
        raise ValueError("FFmpeg is required to prepare the audio cache")
    cache = root / ".motion-cache/audio"
    cache.mkdir(parents=True, exist_ok=True)
    archives: dict[str, bytes] = {}
    for pack, (url, expected) in PACKS.items():
        target = cache / f"{pack}.zip"
        data = target.read_bytes() if target.exists() else b""
        if digest(data) != expected:
            if offline:
                raise ValueError(f"No valid cached {pack} pack; run prepare:audio with network access")
            with urlopen(url, timeout=30) as response:
                data = response.read(16 * 1024 * 1024)
            if digest(data) != expected:
                raise ValueError(f"Source checksum mismatch: {pack}; existing sounds were preserved")
            target.write_bytes(data)
        archives[pack] = data
    with tempfile.TemporaryDirectory(prefix=".audio-prepare-", dir=folder) as temporary:
        staging = Path(temporary)
        prepared: dict[str, dict] = {}
        for name, item in samples.items():
            if Path(item["file"]).name != item["file"]:
                raise ValueError("Invalid sound-bank destination")
            with zipfile.ZipFile(io.BytesIO(archives[item["pack"]])) as archive:
                source = archive.read("Audio/" + item["sourceFile"])
            if digest(source) != item["sourceSHA256"]:
                raise ValueError(f"Sample source checksum mismatch: {name}")
            original = staging / (name + ".ogg")
            original.write_bytes(source)
            output = staging / item["file"]
            subprocess.run([
                "ffmpeg", "-v", "error", "-y", "-i", str(original), "-af",
                "silenceremove=start_periods=1:start_threshold=-48dB:start_duration=0.001,"
                "areverse,silenceremove=start_periods=1:start_threshold=-52dB:start_duration=0.005,"
                "areverse,alimiter=limit=0.92:level=false",
                "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", str(output),
            ], check=True, capture_output=True)
            prepared[name] = {"file": item["file"], "sha256": digest(output.read_bytes())}
        for item in prepared.values():
            (staging / item["file"]).replace(folder / item["file"])
        state = {"version": 1, "samples": prepared, "sourcePacks": {key: value[1] for key, value in PACKS.items()}}
        state_file.write_text(json.dumps(state, indent=2) + "\n")
    return len(samples)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    try:
        print(f"Ready: {prepare(args.project, args.offline)} licensed audio samples (local cache)")
        return 0
    except (OSError, ValueError, KeyError, zipfile.BadZipFile, subprocess.CalledProcessError) as error:
        print(f"Audio preparation failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
