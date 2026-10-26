# 留下弧线 · Motion Canvas 技术试片

18 秒，1280×720，60 fps，H.264 / AAC，含原创合成声音。人物蓄力越过一段距离，落地恢复后回看留下的轨迹；随后展示恒定重力模型中解出 g 的等价变形。

![重力轨迹与 LaTeX 子式动画](preview.gif)

[有声 MP4](trace.mp4) · [编码后关键帧](keyframes.jpg) · [实际 QA](QA.md) · [工程](../../motion/README.md) · [图形制作方法](../../references/math-graphics.md)

此片验证图形与已有模型的衔接：Spline/Knot 柔和轮廓、按物理秒数增长的精确 Bézier、LaTeX 子式动画、两倍尺寸绘制和共享音视频导出。它是技术试片，未把公式讲解包装成新的完整冒险故事，也没有把既有《借势》整体迁移到新框架。

数学前提：向上为正，τ 是从离地时刻起的时间，Δy 相对离地时的髋部高度，v₀ 为初始竖直速度；重力恒定向下，忽略空气阻力。整理为 `g = 2(v₀τ − Δy)/τ²` 时要求 τ > 0。模拟展示所设模型的推论，不能证明自然界的重力规律。

复现：

```sh
npm --prefix motion ci
cd motion
npx playwright install chromium
npm run render -- --fps 60
```

完整视频与声音直接从 Motion Canvas 场景导出，没有使用参考原片的画面或音轨。GIF 无声且降低采样率；检查运动与细线应以 MP4 为准。
