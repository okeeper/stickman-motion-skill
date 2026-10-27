# 《怎么又是这里》

牛顿迭代的无台词概念故事，82 秒 / 1280×720 / 60 fps，有接触拟音和原创程序音乐。

主角把切线当作向导，却被反复送回 0 和 1。摔落后，他发现曲线的另一支，带着从前面留下的短线回去，亲手把初始点移到 −2。

![完整影片的无声预览](../previews/newton.gif)

[完整有声 MP4](newton.mp4) · [逐段剧本与数学推导](../../examples/newton-guide.md) · [成片关键帧](../posters/newton-contact-sheet.jpg) · [摔落连续取帧](fall-sequence.jpg) · [实际检查](QA.md)

## 播放与复现

直接播放 MP4 无需依赖。网页预览和修改需要 Node.js 22.12+；导出另需 FFmpeg / ffprobe 与 Chromium：

```sh
npm --prefix motion ci
npm --prefix motion run prepare:audio
cd motion
npx playwright install chromium
npm run dev
# 打开终端地址的 /newton.html，点击播放启用声音，默认 1×
```

在 `motion/` 中导出：

```sh
npm run render -- --scene newton
# 检查关键动作的短片段
npm run render -- --scene newton --fps 30 --from 24.8 --to 27.8 --out ../renders/newton-fall.mp4
npm run test:newton
```

默认输出 `demos/newton/newton.mp4` 与同名 JSON。它复用现有求帧、骨架、步态、重力跳跃、拟音混音和编码器；没有新增一套录屏导出流程。

## 可编辑工程

- [model.ts](../../web/src/newton/model.ts)：真实函数和导数、迭代、角色时间线、支撑、镜头和声音事件。
- [newton.tsx](../../motion/src/scenes/newton.tsx)：精确三次 Bézier 曲线、切线、逐步展开的轴、人物与符号。
- [newton/main.ts](../../motion/src/newton/main.ts)：有声预览入口。
- [newton.test.mjs](../../web/tests/newton.test.mjs)：二周期、收敛序列、几何、握持、动作连续性和腾空检查。

独立复制可编辑工程，在仓库根目录运行：

```sh
python scripts/init_web.py output/my-newton --scene newton
npm --prefix output/my-newton/motion ci
npm --prefix output/my-newton/motion run prepare:audio
npm --prefix output/my-newton/motion run dev
```

从已编码 MP4 重新检查并生成预览，在仓库根目录运行：

```sh
python scripts/check_demo_media.py --video-dir demos/newton --scene newton --report demos/newton/media-check.json
python scripts/series_previews.py --video-dir demos/newton --scene newton
```

切换函数后必须重新检查故事、数学和全部接触时刻。本工程是已实现的手工编排样片，不是给任意数学公式换文字就能生成视频的通用工具。
