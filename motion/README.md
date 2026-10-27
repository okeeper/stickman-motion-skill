# Motion Canvas 数学动画工程

本工程包含 82 秒牛顿迭代故事《怎么又是这里》和三支概念动作短片《别追，等它回来》75 秒、《谁在敲门》85 秒、《世界的侧面》90 秒，以及《断点》11 秒连续动作与《留下弧线》18 秒图形/公式试片。复用 `../web/src/` 的重量、骨架和接触模型，使用 Motion Canvas 的 Spline / Bézier / LaTeX 绘制。它不是任意数学题的一键成片工具。

```sh
npm --prefix motion ci
npm --prefix motion run prepare:audio
npm --prefix motion run dev
```

打开 `/newton.html` 看新的牛顿迭代故事；打开 `/negative-ride.html`、`/binary-search.html`、`/complex-rotation.html` 看三个完整概念故事，页面内可切换。打开 `/action.html` 看有声动作，默认 1×，点击播放启用声音；`/preview.html` 是静音图形试片。根地址为编辑器项目选择。慢放和拖帧用于检查，支持窄屏。声音准备另需 Python 3.10+ 与 FFmpeg。需要 Node.js 22.12+。Vite 5 仅用于本工程，现有 `web/` 的 Vite 8 独立保留。

```sh
cd motion
npx playwright install chromium
npm run build
npm test
npm run test:browser
npm run test:action
npm run test:series
npm run render:series
npm run render -- --scene binary-search
npm run render -- --scene action --fps 30 --from 5.3 --to 6.8 --out ../renders/fall-roll.mp4
npm run render -- --scene action --fps 60 --out ../renders/action.mp4
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
| [preview.ts](src/preview.ts) | 共享预览、声音时钟与异步 frame/png 接口，隔离 seek 适配 |
| [render.mjs](scripts/render.mjs) | 调用共享声音与编码，支持局部导出 |

`Player.playback` 和 `Stage` 的适配与 Motion Canvas 3.17.2 绑定；升级要重新验证，不能假定其内部接口永久兼容。官方编辑器调整项目参数时，也应同步检查自定义预览的输出尺寸与时钟。

创建可独立改编的工程：`python scripts/init_web.py output/my-film`。复制后的工程只需在 `motion/` 安装依赖；保留共享 `web/` 与 `assets/fonts/` 的相对位置。详细方法见 [数学图形指南](../references/math-graphics.md)、[TS 制作](../references/ts-production.md) 与 [实际 QA](../demos/geometry/QA.md)。

动作与声音方法见 [正常速度动作与拟音](../references/action-and-foley.md)。求帧与声音时钟集中在 [preview.ts](src/preview.ts)。首次 `prepare:audio` 从固定且校验的 Kenney CC0 源准备本地素材，之后复用；WAV 和本地指纹被 git 忽略。仓库保留许可、来源与准备脚本，运行时不从外网播放音效。

三支概念片的规则、剧本和模块见 [制作规格](../demos/PRODUCTION.md)，实际成片检查见 [QA](../demos/QA.md)。独立改编用 `python scripts/init_web.py output/my-concept --scene complex-rotation`，只需在复制后的 motion/ 安装依赖。

牛顿迭代新片的规则、动作与镜头在 [model.ts](../web/src/newton/model.ts)，曲线与图形在 [newton.tsx](src/scenes/newton.tsx)。`npm run test:newton` 检查网页，`npm run render -- --scene newton` 导出 82 秒成片；独立复制用 `python scripts/init_web.py output/my-newton --scene newton`。数学假设与逐段脚本见 [制作说明](../examples/newton-guide.md)，实际检查见 [QA](../demos/newton/QA.md)。
