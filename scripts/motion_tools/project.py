"""Self-contained starter projects and bounded, deterministic scene rendering."""

from __future__ import annotations
import importlib.util
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from PIL import Image, ImageOps
from .common import (
    ToolError,
    atomic_path,
    cache_signature,
    encoding,
    fields,
    fingerprint,
    hash_file,
    load_json,
    mark_cache,
    number,
    probe,
    protect_output,
    source_path,
    tool,
    valid_cache,
    write_json,
)
from .edit import canvas_spec

ROOT = Path(__file__).resolve().parents[2]


def initialize(destination, demo="complex-rotation"):
    from demo_engine.scenes import SCENES

    if demo not in SCENES:
        raise ToolError("Unknown starter scene")
    destination = Path(destination).resolve()
    if destination.exists():
        raise ToolError("Project directory already exists; choose a new directory")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".init-", dir=destination.parent) as temp:
        root = Path(temp) / "project"
        root.mkdir()
        for name in ("motion_tools", "demo_engine"):
            shutil.copytree(
                ROOT / "scripts" / name,
                root / "scripts" / name,
                ignore=shutil.ignore_patterns("__pycache__", "*.pyc"),
            )
        shutil.copy2(ROOT / "scripts/motion.py", root / "scripts/motion.py")
        shutil.copytree(ROOT / "assets/fonts", root / "assets/fonts")
        shutil.copytree(ROOT / "assets/project", root / "assets/project")
        shutil.copytree(ROOT / "licenses", root / "licenses")
        for name in (
            "LICENSE",
            "THIRD_PARTY_NOTICES.md",
            "requirements-render.txt",
            "requirements-dev.txt",
        ):
            shutil.copy2(ROOT / name, root / name)
        # Include the reuse note so notices stay meaningful outside this repository.
        if (ROOT / "docs/upstream-reuse.md").is_file():
            (root / "docs").mkdir()
            shutil.copy2(
                ROOT / "docs/upstream-reuse.md", root / "docs/upstream-reuse.md"
            )
        template = (ROOT / "assets/project/scene.py").read_text(encoding="utf-8")
        (root / "scene.py").write_text(
            template.replace("__DEMO__", demo), encoding="utf-8"
        )
        write_json(
            root / "project.json",
            {
                "version": 1,
                "scene": "scene.py",
                "canvas": {"width": 1280, "height": 720, "fps": 30},
                "scale": 1.5,
                "output": "renders/scene.mp4",
            },
        )
        write_json(
            root / "edit.json",
            {
                "version": 1,
                "canvas": {"width": 1280, "height": 720, "fps": 30},
                "clips": [{"source": "renders/scene.mp4", "in": 0, "out": 36}],
                "transition": {"type": "cut"},
                "output": "renders/final.mp4",
            },
        )
        (root / ".gitignore").write_text(
            ".venv/\n__pycache__/\n*.pyc\n.motion-cache/\nrenders/\nreview/\ndelivery/\n",
            encoding="utf-8",
        )
        (root / "README.md").write_text(
            """# 独立火柴人动画工程

修改 `scene.py` 的故事与动作，复用 `scripts/demo_engine/` 中的骨架与声音模块。工具和字体已复制到本工程，不依赖原 skill 安装路径。`scene.py` 是会执行的本地 Python 代码。

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-render.txt
python scripts/motion.py doctor
python scripts/motion.py render project.json --profile preview --start 10 --end 14 --out renders/preview.mp4
python scripts/motion.py render project.json
python scripts/motion.py edit edit.json --plan
python scripts/motion.py edit edit.json
python scripts/motion.py inspect renders/final.mp4 --out review
python scripts/motion.py deliver renders/final.mp4 --out delivery
python scripts/motion.py verify delivery
```

系统需要 FFmpeg/ffprobe。`preview` 默认 640×360/15fps，`final` 使用 project.json 的画幅和帧率。局部渲染使用场景绝对时间并同步截取音轨，输出的时间从 0 开始。新故事修改时长后，同步修改 edit.json 的 out。

剪辑清单可以设置 in/out、speed、gain_db、mute，转场支持 cut/fade，额外 audio 轨支持 at、in/out、gain_db、fade_in/out；subtitles 指向 UTF-8 SRT，输出软字幕。

缓存只复用输入、参数、工具版本和文件指纹都匹配的结果；删除 `.motion-cache/` 及 `*.cache.json` 可以重新计算。升级工具时比较 scripts/ 与 assets/ 的改动，不覆盖自己的 scene.py、project.json、edit.json 或素材。
""",
            encoding="utf-8",
        )
        root.rename(destination)
    return {"project": str(destination), "demo": demo, "standalone": True}


def render(
    project_file,
    *,
    start=0,
    end=None,
    out=None,
    profile="final",
    force=False,
    stills=None,
):
    project_file = Path(project_file).resolve()
    root = project_file.parent
    spec = load_json(project_file)
    fields(
        spec,
        ("version", "scene", "canvas", "scale", "output", "inputs"),
        ("version", "scene", "canvas", "output"),
        "project",
    )
    if type(spec["version"]) is not int or spec["version"] != 1:
        raise ToolError("Unsupported project version")
    if not isinstance(spec["output"], str) or not spec["output"]:
        raise ToolError("output must name a local file")
    canvas = canvas_spec(spec["canvas"])
    scale = number(spec.get("scale", 1.5), "scale", 0.5, 3)
    if profile == "preview":
        canvas.update(width=640, height=360, fps=15)
        scale = 1
    elif profile != "final":
        raise ToolError("Unknown render profile")
    scene_file = source_path(root, spec["scene"])
    if scene_file.suffix != ".py":
        raise ToolError("scene must name a Python file")
    module_spec = importlib.util.spec_from_file_location(
        "_motion_scene_" + hash_file(scene_file)[:12], scene_file
    )
    module = importlib.util.module_from_spec(module_spec)
    sys.path[:0] = [str(root / "scripts"), str(scene_file.parent)]
    module_spec.loader.exec_module(module)
    # Keep project imports available for lazy imports inside frame/audio callbacks.
    duration = number(getattr(module, "DURATION", None), "scene DURATION", 0.01)
    if not callable(getattr(module, "render_frame", None)):
        raise ToolError("scene must define render_frame(t, scale)")
    start = number(start, "start", 0, duration)
    end = duration if end is None else number(end, "end", 0, duration)
    if end <= start:
        raise ToolError("end must be later than start")
    fps = canvas["fps"]
    n0, n1 = round(start * fps), round(end * fps)
    frames = n1 - n0
    if frames < 1:
        raise ToolError("Render window must contain at least one frame")
    destination = Path(out).resolve() if out else (root / spec["output"]).resolve()
    sources = [
        project_file,
        scene_file,
        *root.glob("*.py"),
        *(root / "scripts").rglob("*.py"),
        *(root / "assets").rglob("*"),
    ]
    sources = [p for p in sources if p.is_file() and "__pycache__" not in p.parts]
    if not isinstance(spec.get("inputs", []), list):
        raise ToolError("inputs must be a list of local file paths")
    sources += [source_path(root, name) for name in spec.get("inputs", [])]
    protect_output(destination, sources)
    protect_output(destination.with_suffix(".cache.json"), sources)
    if stills is not None:
        if destination.exists() and not destination.is_dir():
            raise ToolError("Stills output must be a directory")
        moments = [number(t, "still time", 0, duration) for t in stills]
        if not moments:
            raise ToolError("Provide at least one still time")
        destination.mkdir(parents=True, exist_ok=True)
        for t in moments:
            image = module.render_frame(t, scale)
            if not isinstance(image, Image.Image):
                raise ToolError("render_frame must return a Pillow image")
            image.save(destination / f"t{t:010.4f}.png")
        return {"stills": len(moments)}
    if destination.suffix.lower() != ".mp4":
        raise ToolError("Render output must be .mp4")
    settings = {"canvas": canvas, "scale": scale, "start_frame": n0, "end_frame": n1}
    key = fingerprint(
        {
            "files": [
                (
                    str(p.relative_to(root)) if p.is_relative_to(root) else str(p),
                    hash_file(p),
                )
                for p in sources
            ],
            "settings": settings,
            "tools": cache_signature(),
        }
    )
    if not force and valid_cache(destination, key):
        return {"cache_hit": True, "frames": frames, "duration": frames / fps}
    with atomic_path(destination) as target:
        audio = target.parent / "scene.wav"
        if callable(getattr(module, "write_audio", None)):
            module.write_audio(audio)
        command = [
            tool("ffmpeg"),
            "-y",
            "-v",
            "error",
            "-f",
            "rawvideo",
            "-pixel_format",
            "rgb24",
            "-video_size",
            f"{canvas['width']}x{canvas['height']}",
            "-framerate",
            str(fps),
            "-i",
            "pipe:0",
        ]
        if audio.is_file():
            command += [
                "-ss",
                str(n0 / fps),
                "-i",
                str(audio),
                "-map",
                "0:v:0",
                "-map",
                "1:a:0",
                "-af",
                f"apad,atrim=duration={frames / fps},asetpts=PTS-STARTPTS",
            ]
        else:
            command += ["-map", "0:v:0"]
        command += [*encoding(), "-t", str(frames / fps), str(target)]
        with (target.parent / "encoder.log").open("wb") as log:
            process = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=log)
            try:
                for index in range(n0, n1):
                    image = module.render_frame(index / fps, scale)
                    if not isinstance(image, Image.Image):
                        raise ToolError("render_frame must return a Pillow image")
                    image = ImageOps.pad(
                        image.convert("RGB"),
                        (canvas["width"], canvas["height"]),
                        method=Image.Resampling.LANCZOS,
                        color=canvas["background"],
                    )
                    process.stdin.write(image.tobytes())
                process.stdin.close()
                if process.wait():
                    raise ToolError((target.parent / "encoder.log").read_text()[-4000:])
            except BaseException:
                if process.poll() is None:
                    process.kill()
                process.wait()
                raise
        info = probe(target, count=True)
        if int(info["video"].get("nb_read_frames", 0)) != frames:
            raise ToolError("Rendered frame count mismatch")
    mark_cache(destination, key)
    return {
        "cache_hit": False,
        "frames": frames,
        "duration": frames / fps,
        "source_window": [n0 / fps, n1 / fps],
    }
