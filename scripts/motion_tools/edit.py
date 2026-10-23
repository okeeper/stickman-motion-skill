"""Frame-aligned local editing: trims, speed, fit, transitions, sound and SRT."""

from __future__ import annotations
import re
from pathlib import Path
from .common import (
    ToolError,
    atomic_path,
    cache_signature,
    encoding,
    ffmpeg,
    fields,
    fingerprint,
    hash_file,
    load_json,
    mark_cache,
    number,
    probe,
    protect_output,
    source_path,
    valid_cache,
    write_json,
)


def canvas_spec(data):
    fields(
        data,
        ("width", "height", "fps", "fit", "background"),
        ("width", "height", "fps"),
        "canvas",
    )
    for key in ("width", "height"):
        v = number(data[key], key, 64, 4096)
        if not isinstance(v, int) or v % 2:
            raise ToolError(f"{key} must be an even integer")
    if isinstance(data["fps"], bool) or data["fps"] not in (15, 24, 25, 30, 50, 60):
        raise ToolError("fps must be 15, 24, 25, 30, 50 or 60")
    fit = data.get("fit", "contain")
    if fit not in ("contain", "cover"):
        raise ToolError("fit must be contain or cover")
    bg = data.get("background", "#10171c")
    if not isinstance(bg, str) or not re.fullmatch(r"#[0-9a-fA-F]{6}", bg):
        raise ToolError("background must be #RRGGBB")
    return dict(
        width=data["width"],
        height=data["height"],
        fps=int(data["fps"]),
        fit=fit,
        background=bg,
    )


def window(item, info, where):
    start = number(item.get("in", 0), f"{where}.in")
    end = number(item.get("out", info["duration"]), f"{where}.out")
    if end <= start or end > info["duration"] + 1e-6:
        raise ToolError(f"{where}: require 0 <= in < out <= media duration")
    return start, end


def plan(spec_path, out=None):
    spec_path = Path(spec_path).resolve()
    base = spec_path.parent
    spec = load_json(spec_path)
    fields(
        spec,
        ("version", "canvas", "clips", "transition", "audio", "subtitles", "output"),
        ("version", "canvas", "clips", "output"),
        "edit",
    )
    if type(spec["version"]) is not int or spec["version"] != 1:
        raise ToolError("Unsupported edit version")
    if not isinstance(spec["output"], str) or not spec["output"]:
        raise ToolError("output must name an MP4 file")
    destination = (
        Path(out).resolve() if out is not None else (base / spec["output"]).resolve()
    )
    if destination.suffix.lower() != ".mp4":
        raise ToolError("Output must have .mp4 extension")
    canvas = canvas_spec(spec["canvas"])
    fps = canvas["fps"]
    if not isinstance(spec["clips"], list) or not spec["clips"]:
        raise ToolError("clips must be a nonempty list")
    signature = cache_signature()
    cache = base / ".motion-cache" / "clips"
    clips = []
    inputs = [spec_path]
    if destination.is_relative_to(cache):
        raise ToolError("Output cannot be inside the normalization cache")
    for i, item in enumerate(spec["clips"]):
        label = f"clips[{i}]"
        fields(
            item,
            ("source", "in", "out", "speed", "gain_db", "mute"),
            ("source",),
            label,
        )
        source = source_path(base, item["source"])
        info = probe(source)
        if not info["video"]:
            raise ToolError(f"{label}: input has no video")
        start, end = window(item, info, label)
        speed = number(item.get("speed", 1), f"{label}.speed", 0.25, 4)
        gain = number(item.get("gain_db", 0), f"{label}.gain_db", -60, 12)
        mute = item.get("mute", False)
        if not isinstance(mute, bool):
            raise ToolError(f"{label}.mute must be boolean")
        frames = round((end - start) / speed * fps)
        if frames < 1:
            raise ToolError(f"{label}: trimmed clip is shorter than one output frame")
        config = dict(
            start=start,
            end=end,
            speed=speed,
            gain_db=gain,
            mute=mute,
            frames=frames,
            canvas=canvas,
        )
        source_hash = hash_file(source)
        key = fingerprint(
            {"input": source_hash, "settings": config, "tools": signature}
        )
        cached = cache / (key + ".mp4")
        clips.append(
            dict(
                source=source,
                source_hash=source_hash,
                info=info,
                config=config,
                key=key,
                cache=cached,
                hit=valid_cache(cached, key),
            )
        )
        inputs.append(source)
    tr = spec.get("transition", {"type": "cut"})
    fields(tr, ("type", "duration"), ("type",), "transition")
    if tr["type"] not in ("cut", "fade"):
        raise ToolError("transition.type must be cut or fade")
    seconds = number(
        tr.get("duration", 0.4 if tr["type"] == "fade" else 0),
        "transition.duration",
        0,
        10,
    )
    overlap = round(seconds * fps) if tr["type"] == "fade" else 0
    if tr["type"] == "cut" and seconds:
        raise ToolError("Cut transition must have duration 0")
    if tr["type"] == "fade":
        if len(clips) < 2 or overlap < 1:
            raise ToolError("Fade needs at least two clips and one overlap frame")
        for i, clip in enumerate(clips):
            required = overlap * (2 if 0 < i < len(clips) - 1 else 1)
            if clip["config"]["frames"] <= required:
                raise ToolError("Transition overlaps consume a complete clip")
    frames = sum(c["config"]["frames"] for c in clips) - overlap * (len(clips) - 1)
    duration = frames / fps
    tracks = spec.get("audio", [])
    if not isinstance(tracks, list):
        raise ToolError("audio must be a list")
    audio = []
    for i, item in enumerate(tracks):
        label = f"audio[{i}]"
        fields(
            item,
            ("source", "in", "out", "at", "gain_db", "fade_in", "fade_out"),
            ("source",),
            label,
        )
        source = source_path(base, item["source"])
        info = probe(source)
        if not info["audio"]:
            raise ToolError(f"{label}: input has no audio")
        start, end = window(item, info, label)
        at = number(item.get("at", 0), f"{label}.at", 0, duration)
        length = min(end - start, duration - at)
        if length <= 0:
            raise ToolError("Audio track starts after the timeline")
        gain = number(item.get("gain_db", 0), f"{label}.gain_db", -60, 12)
        fin = number(item.get("fade_in", 0), f"{label}.fade_in", 0, length)
        fout = number(item.get("fade_out", 0), f"{label}.fade_out", 0, length)
        if fin + fout > length:
            raise ToolError("Audio fades overlap the entire track")
        audio.append(
            dict(
                source=source,
                start=start,
                length=length,
                at=at,
                gain=gain,
                fade_in=fin,
                fade_out=fout,
            )
        )
        inputs.append(source)
    subtitles = None
    if spec.get("subtitles") is not None:
        subtitles = source_path(base, spec["subtitles"])
        if subtitles.suffix.lower() != ".srt":
            raise ToolError("Subtitles must be a local UTF-8 SRT file")
        try:
            subtitles.read_text(encoding="utf-8")
        except UnicodeError as e:
            raise ToolError("SRT must be UTF-8") from e
        inputs.append(subtitles)
    protect_output(destination, inputs)
    protect_output(destination.with_suffix(".edit.json"), inputs)
    return dict(
        spec=spec_path,
        destination=destination,
        canvas=canvas,
        clips=clips,
        overlap=overlap,
        duration=duration,
        frames=frames,
        audio=audio,
        subtitles=subtitles,
    )


def summary(p):
    return {
        "duration": p["duration"],
        "frames": p["frames"],
        "canvas": p["canvas"],
        "clips": [
            {
                "source": c["source"].name,
                "frames": c["config"]["frames"],
                "cache_hit": c["hit"],
                "cache_key": c["key"],
            }
            for c in p["clips"]
        ],
        "transition_frames": p["overlap"],
        "audio_tracks": len(p["audio"]),
        "subtitles": p["subtitles"].name if p["subtitles"] else None,
    }


def tempo(speed):
    factors = []
    while speed > 2:
        factors.append(2)
        speed /= 2
    while speed < 0.5:
        factors.append(0.5)
        speed /= 0.5
    return ",".join(f"atempo={x:.10g}" for x in [*factors, speed])


def normalize(clip, canvas):
    q = clip["config"]
    fps = canvas["fps"]
    duration = q["frames"] / fps
    w, h = canvas["width"], canvas["height"]
    bg = canvas["background"].replace("#", "0x")
    size = (
        f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color={bg}"
        if canvas["fit"] == "contain"
        else f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}"
    )
    filters = [
        f"[0:v:0]trim=start={q['start']}:end={q['end']},setpts=(PTS-STARTPTS)/{q['speed']},{size},setsar=1,fps={fps},tpad=stop_mode=clone:stop_duration={duration},trim=end_frame={q['frames']},setpts=N/({fps}*TB),format=yuv420p[v]"
    ]
    if clip["info"]["audio"] and not q["mute"]:
        audio = f"[0:a:0]atrim=start={q['start']}:end={q['end']},asetpts=PTS-STARTPTS,{tempo(q['speed'])},volume={q['gain_db']}dB"
    else:
        audio = "anullsrc=r=48000:cl=stereo"
    filters.append(
        audio
        + f",aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration={duration},asetpts=N/SR/TB[a]"
    )
    with atomic_path(clip["cache"]) as dest:
        ffmpeg(
            [
                "-i",
                clip["source"],
                "-filter_complex_threads",
                "1",
                "-filter_complex",
                ";".join(filters),
                "-map",
                "[v]",
                "-map",
                "[a]",
                *encoding(18),
                "-r",
                str(fps),
                "-fps_mode",
                "cfr",
                "-t",
                str(duration),
                dest,
            ]
        )
    mark_cache(clip["cache"], clip["key"])


def execute(p):
    for index, c in enumerate(p["clips"]):
        if hash_file(c["source"]) != c["source_hash"]:
            raise ToolError("Source changed since planning; repeat the plan")
        c["hit"] = valid_cache(c["cache"], c["key"])
        if not c["hit"]:
            normalize(c, p["canvas"])
        print(
            f"clip {index + 1}/{len(p['clips'])}: {'cache' if c['hit'] else 'rendered'}",
            flush=True,
        )
    n = len(p["clips"])
    fps = p["canvas"]["fps"]
    duration = p["duration"]
    args = []
    filters = []
    for i, c in enumerate(p["clips"]):
        args += ["-i", c["cache"]]
        filters += [
            f"[{i}:v]settb=AVTB,setpts=PTS-STARTPTS,fps={fps}[v{i}]",
            f"[{i}:a]atrim=duration={c['config']['frames'] / fps},asetpts=PTS-STARTPTS[a{i}]",
        ]
    if n == 1:
        v, a = "v0", "a0"
    elif not p["overlap"]:
        inputs = "".join(f"[v{i}][a{i}]" for i in range(n))
        filters.append(f"{inputs}concat=n={n}:v=1:a=1[cutv][cuta]")
        v, a = "cutv", "cuta"
    else:
        v, a = "v0", "a0"
        elapsed = p["clips"][0]["config"]["frames"] / fps
        overlap = p["overlap"] / fps
        for i in range(1, n):
            filters.append(
                f"[{v}][v{i}]xfade=transition=fade:duration={overlap}:offset={elapsed - overlap},fps={fps}[xv{i}]"
            )
            filters.append(f"[{a}][a{i}]acrossfade=d={overlap}:c1=tri:c2=tri[xa{i}]")
            v, a = f"xv{i}", f"xa{i}"
            elapsed += p["clips"][i]["config"]["frames"] / fps - overlap
    mixes = [a]
    for i, track in enumerate(p["audio"], n):
        args += ["-i", track["source"]]
        expr = f"[{i}:a:0]atrim=start={track['start']}:duration={track['length']},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume={track['gain']}dB"
        if track["fade_in"]:
            expr += f",afade=t=in:d={track['fade_in']}"
        if track["fade_out"]:
            expr += f",afade=t=out:st={track['length'] - track['fade_out']}:d={track['fade_out']}"
        expr += f",adelay=delays={round(track['at'] * 48000)}S:all=1[extra{i}]"
        filters.append(expr)
        mixes.append(f"extra{i}")
    filters.append(
        "".join(f"[{m}]" for m in mixes)
        + f"amix=inputs={len(mixes)}:duration=longest:normalize=0,alimiter=limit=0.95:level=0:latency=1,apad,atrim=duration={duration}[sound]"
    )
    filters.append(
        f"[{v}]fps={fps},trim=end_frame={p['frames']},setpts=N/({fps}*TB)[picture]"
    )
    maps = ["-map", "[picture]", "-map", "[sound]"]
    if p["subtitles"]:
        idx = n + len(p["audio"])
        args += ["-i", p["subtitles"]]
        maps += ["-map", f"{idx}:s:0", "-c:s", "mov_text"]
    with atomic_path(p["destination"]) as dest:
        ffmpeg(
            [
                *args,
                "-filter_complex_threads",
                "1",
                "-filter_complex",
                ";".join(filters),
                *maps,
                *encoding(),
                "-r",
                str(fps),
                "-fps_mode",
                "cfr",
                "-t",
                str(duration),
                dest,
            ]
        )
        info = probe(dest, count=True)
        if int(info["video"].get("nb_read_frames", 0)) != p["frames"]:
            raise ToolError("Encoded edit frame count differs from plan")
    result = summary(p)
    result["output_sha256"] = hash_file(p["destination"])
    write_json(p["destination"].with_suffix(".edit.json"), result)
    return result
