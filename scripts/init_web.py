#!/usr/bin/env python3
"""Create a standalone TS animation project without dependencies, media or local research."""
from __future__ import annotations

import argparse
from pathlib import Path
import shutil
import sys
import tempfile


def initialize(destination: Path, scene: str = "adventure") -> Path:
    if scene not in {"adventure", "weight"}:
        raise ValueError("scene must be adventure or weight")
    destination = destination.expanduser().resolve()
    if destination.exists():
        raise ValueError(f"Destination already exists: {destination}")
    source = Path(__file__).resolve().parents[1]
    destination.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(prefix=".stickman-web-", dir=destination.parent))
    try:
        web = staging / "web"
        web.mkdir()
        for folder in ("src", "scripts", "tests", "assets"):
            shutil.copytree(source / "web" / folder, web / folder,
                            ignore=shutil.ignore_patterns("__pycache__", ".DS_Store"))
        for name in ("package.json", "package-lock.json", "tsconfig.json", "tsconfig.test.json", "vite.config.ts", "index.html", "film.html"):
            shutil.copy2(source / "web" / name, web / name)
        fonts = staging / "assets" / "fonts"
        fonts.mkdir(parents=True)
        for name in ("DejaVuSans.ttf", "LICENSE_DEJAVU"):
            shutil.copy2(source / "assets" / "fonts" / name, fonts / name)
        shutil.copy2(source / "LICENSE", staging / "LICENSE")
        (staging / "demos" / "adventure").mkdir(parents=True)
        (staging / "demos" / "weight").mkdir(parents=True)
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
    parser.add_argument("--scene", choices=("adventure", "weight"), default="adventure")
    args = parser.parse_args()
    try:
        print(initialize(args.directory, args.scene))
        return 0
    except (OSError, ValueError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
