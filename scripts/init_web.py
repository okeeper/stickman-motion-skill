#!/usr/bin/env python3
"""Create a standalone TS animation project without dependencies, media or local research."""
from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import sys
import tempfile


def initialize(destination: Path, scene: str = "adventure", engine: str = "canvas") -> Path:
    if engine not in {"canvas", "motion-canvas"}:
        raise ValueError("engine must be canvas or motion-canvas")
    if (engine == "canvas" and scene not in {"adventure", "weight"}) or (engine == "motion-canvas" and scene not in {"trace", "action", "negative-ride", "binary-search", "complex-rotation"}):
        raise ValueError("canvas supports adventure/weight; motion-canvas supports trace/action/negative-ride/binary-search/complex-rotation")
    destination = destination.expanduser().resolve()
    if destination.exists():
        raise ValueError(f"Destination already exists: {destination}")
    source = Path(__file__).resolve().parents[1]
    destination.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".stickman-web-", dir=destination.parent))
    try:
        web = staging / "web"
        web.mkdir()
        if engine == "canvas":
            for folder in ("src", "scripts", "tests", "assets"):
                shutil.copytree(source / "web" / folder, web / folder,
                                ignore=shutil.ignore_patterns("__pycache__", ".DS_Store"))
            for name in ("package.json", "package-lock.json", "tsconfig.json", "tsconfig.test.json", "vite.config.ts", "index.html", "film.html"):
                shutil.copy2(source / "web" / name, web / name)
        else:
            # Copy only shared capabilities; the new project needs npm ci in motion/ alone.
            for folder, names in (("src", ("math.ts", "physics.ts", "rig.ts", "performance.ts", "stunt.ts", "foley.mjs", "foley.d.mts")),
                                  ("scripts", ("video.mjs", "score.mjs"))):
                (web / folder).mkdir()
                for name in names:
                    shutil.copy2(source / "web" / folder / name, web / folder / name)
            shutil.copytree(source / "web" / "src" / "action", web / "src" / "action")
            shutil.copytree(source / "web" / "src" / "series", web / "src" / "series")
            motion = staging / "motion"
            motion.mkdir()
            for folder in ("src", "scripts", "tests", "public"):
                shutil.copytree(source / "motion" / folder, motion / folder)
            for name in ("package.json", "package-lock.json", "tsconfig.json", "tsconfig.test.json", "vite.config.ts", "preview.html", "action.html", "negative-ride.html", "binary-search.html", "complex-rotation.html"):
                shutil.copy2(source / "motion" / name, motion / name)
            (staging / "scripts").mkdir()
            shutil.copy2(source / "scripts/prepare_audio.py", staging / "scripts/prepare_audio.py")
            (staging / ".gitignore").write_text(".motion-cache/\nmotion/node_modules/\nmotion/dist/\nmotion/.test-build/\nmotion/test-results/\nmotion/public/audio/*.wav\nmotion/public/audio/bank-local.json\nrenders/\n")
        fonts = staging / "assets" / "fonts"
        fonts.mkdir(parents=True)
        for name in ("DejaVuSans.ttf", "LICENSE_DEJAVU"):
            shutil.copy2(source / "assets" / "fonts" / name, fonts / name)
        shutil.copy2(source / "LICENSE", staging / "LICENSE")
        (staging / "demos" / "adventure").mkdir(parents=True)
        (staging / "demos" / "weight").mkdir(parents=True)
        (staging / "demos" / "geometry").mkdir(parents=True)
        (staging / "demos" / "action").mkdir(parents=True)
        url = "/film.html" if scene == "adventure" else "/"
        (staging / "README.md").write_text(f"""# 火柴人 TS 动画工程

初始场景：`{scene}`。这是可编辑的已有故事起点；新主题需要改规则、动作与镜头。

```sh
npm --prefix web ci
npm --prefix web run dev
npm --prefix web run build
npm --prefix web test
```

在终端显示的本地地址后打开 `{url}`。网页支持慢放和拖帧；成片声音由导出脚本合成。

导出需要 Node.js 22.12+、FFmpeg/ffprobe 与 Chromium：

```sh
cd web
npx playwright install chromium
npm run render -- --scene {scene}
```

已有 Chrome 可通过 `MOTION_BROWSER_EXECUTABLE` 指定可执行文件，不必重复下载浏览器。
`adventure` 的场景在 `web/src/adventure/`，可复用动作在 `web/src/performance.ts`；
重量模型在 `web/src/physics.ts`，骨架在 `web/src/rig.ts`，分层声音在 `web/scripts/score.mjs`。
`adventure` 支持 `--from 7 --to 9.5 --out ../renders/preview.mp4` 局部试做。

源代码许可见 [LICENSE](LICENSE)。字体分别保留 `assets/fonts/LICENSE_DEJAVU`
和 `web/assets/fonts/OFL.txt`，不重新授予 MIT 许可。
本工程不包含参考视频、研究截图、依赖目录或已有成片。
""", encoding="utf-8")
        if engine == "motion-canvas":
            (staging / "README.md").write_text("""# Motion Canvas 火柴人动画

包含三支概念动作短片《逆向通行》《最后一扇》《转过死角》，以及《断点》的连续动作与《留下弧线》的曲线/公式试片；新故事需要重新编写规则和行动。

```sh
npm --prefix motion ci
npm --prefix motion run prepare:audio
npm --prefix motion run dev
npm --prefix motion run build
npm --prefix motion test
```

`/negative-ride.html`、`/binary-search.html`、`/complex-rotation.html` 是三个概念故事；`/action.html` 是走跑跳摔滚与有声预览，`/preview.html` 是曲线/公式试片；根地址是 Motion Canvas 编辑器项目选择。
`motion/src/scenes/trace.tsx` 编排场景，`geometry.ts` 和 `components/actor.tsx` 处理曲线与轮廓。
`web/` 仅提供共享物理、骨架、表演、声音和编码模块，不需要在其中安装 npm 依赖。
请保留 `motion/`、`web/`、`assets/fonts/` 的相对位置。

导出需要 Node.js 22.12+、FFmpeg/ffprobe 和 Chromium：

```sh
cd motion
npx playwright install chromium
npm run test:browser
npm run test:action
npm run test:series
npm run render:series
npm run render -- --scene action --fps 30 --from 5.3 --to 6.8 --out ../renders/preview.mp4
npm run render -- --scene action --fps 60 --out ../renders/final.mp4
```

也可通过 `MOTION_BROWSER_EXECUTABLE` 指定已有 Chrome。源码许可见 [LICENSE](LICENSE)，
字体保留 `assets/fonts/LICENSE_DEJAVU`，拟音素材保留 `motion/public/audio/LICENSE-*.txt`（Kenney CC0）；
npm 依赖保留各自许可。音效缓存可重建，git 忽略本地 WAV 和缓存指纹；本工程不含参考原片、研究截图或已安装依赖。
""", encoding="utf-8")
            with (staging / "README.md").open("a", encoding="utf-8") as handle:
                handle.write(f"\n初始任务入口：`{'/preview.html' if scene == 'trace' else '/' + scene + '.html'}`。\n")
        if destination.exists():
            raise ValueError(f"Destination already exists: {destination}")
        staging.rename(destination)
        return destination
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--engine", choices=("canvas", "motion-canvas"))
    parser.add_argument("--scene", choices=("adventure", "weight", "trace", "action", "negative-ride", "binary-search", "complex-rotation"))
    args = parser.parse_args()
    try:
        # Existing explicit --scene adventure/weight invocations remain compatible.
        engine = args.engine or ("canvas" if args.scene in {"adventure", "weight"} else "motion-canvas")
        scene = args.scene or ("trace" if engine == "motion-canvas" else "adventure")
        print(initialize(args.directory, scene, engine))
        return 0
    except (OSError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
