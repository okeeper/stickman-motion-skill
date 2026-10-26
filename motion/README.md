# Motion Canvas 数学动画工程

本工程是 0.6.0 的图形与公式制作入口；内置 18 秒技术试片《留下弧线》。复用 `../web/src/` 的重量、骨架和接触模型，使用 Motion Canvas 的 Spline / Bézier / LaTeX 绘制。它不是任意数学题的一键成片工具。

```sh
npm --prefix motion ci
npm --prefix motion run dev
```

在终端显示的地址后打开 `/preview.html`；根地址为官方编辑器。预览支持播放、0.5× / 0.25×、拖帧和窄屏，网页静音。需要 Node.js 22.12+。Vite 5 仅用于本工程，现有 `web/` 的 Vite 8 独立保留。

```sh
cd motion
npx playwright install chromium
npm run build
npm test
npm run test:browser
npm run render -- --fps 30 --from 8 --to 10 --out ../renders/formula.mp4
npm run render -- --fps 60 --out ../renders/trace.mp4
```

导出还需要 PATH 中的 FFmpeg / ffprobe，可通过 `MOTION_BROWSER_EXECUTABLE` 指定已有 Chrome。导出使用真实 Motion Canvas 场景、异步逐帧求值、两倍尺寸画布和共享编码器；不是录制网页控件。区间按输出帧对齐，声音保留原场景时间与跨入点尾音。只有成功编码并核对帧数后替换 MP4，同名 JSON 保存区间、声音和 SHA-256。

| 文件 | 用途 |
|---|---|
| [model.ts](src/model.ts) | 物理动作、事件与数学变量的来源 |
| [geometry.ts](src/geometry.ts) | 共同投影、精确抛物线、有限控制柄 |
| [actor.tsx](src/components/actor.tsx) | Rig 到曲线轮廓的适配，不改变接触端点 |
| [trace.tsx](src/scenes/trace.tsx) | 场景、曲线、LaTeX 子式变形与时间线 |
| [main.ts](src/main.ts) | 预览与异步 frame/png 接口，隔离版本相关的 seek 适配 |
| [render.mjs](scripts/render.mjs) | 调用共享声音与编码，支持局部导出 |

`Player.playback` 和 `Stage` 的适配与 Motion Canvas 3.17.2 绑定；升级要重新验证，不能假定其内部接口永久兼容。官方编辑器调整项目参数时，也应同步检查自定义预览的输出尺寸与时钟。

创建可独立改编的工程：`python scripts/init_web.py output/my-film`。复制后的工程只需在 `motion/` 安装依赖；保留共享 `web/` 与 `assets/fonts/` 的相对位置。详细方法见 [数学图形指南](../references/math-graphics.md)、[TS 制作](../references/ts-production.md) 与 [实际 QA](../demos/geometry/QA.md)。
