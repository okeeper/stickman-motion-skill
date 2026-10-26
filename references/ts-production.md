# TS 概念冒险制作与复用

用于实际制作、改编和导出浏览器火柴人动画。新动作冒险优先从这里开始；Python 历史示例和剪辑工具继续可用。TS 便于参数、约束和即时预览，但动作质量取决于模型、接触和编排。

## 选择工程入口

连续动作与有声预览使用 `python scripts/init_web.py output/my-action --scene action`，在新工程执行 `npm --prefix motion ci`、`npm --prefix motion run prepare:audio`，打开 `/action.html`。导出加 `--scene action`。步态、跌滚与拟音细节见 [正常速度动作与拟音](action-and-foley.md)。

新数学图形与公式动画默认使用 Motion Canvas；已有《借势》故事和重量研究使用原 Canvas 工程。两者复用同一重量、骨架、接触、声音和编码能力；本次没有迁移《借势》整片。曲线和公式的具体做法先读 [数学图形与连续动画](math-graphics.md)。

在 skill 仓库根目录创建 Motion Canvas 工程：

```sh
python scripts/init_web.py output/my-film
npm --prefix output/my-film/motion ci
npm --prefix output/my-film/motion run prepare:audio
npm --prefix output/my-film/motion run dev
```

打开终端地址后的 `/preview.html`，根地址为官方编辑器。目标包含 `motion/`、共享 `web/` 和 `assets/fonts/`；只在 `motion/` 安装依赖。初始内容是《留下弧线》技术试片，需要新故事时重写人物目标、规则、行为和场景。目标目录必须不存在。

在目标工程 `motion/` 中：

```sh
npx playwright install chromium
npm run build
npm test
npm run test:browser
npm run render -- --fps 30 --from 8 --to 10 --out ../renders/formula.mp4
npm run render -- --fps 60 --out ../renders/final.mp4
```

支持 30/60 fps，两倍内部尺寸经 Lanczos 缩为 720p。生成器时间线与图形用 Motion Canvas，人体状态仍由已有物理与关节模型求值。`window.__MOTION__.frame(t)` 和 `png(t)` 是异步接口，调用方必须等待完成再读取画面。版本相关适配集中在 [preview.ts](../motion/src/preview.ts)，升级后需重跑真实导出。

## 从已有 Canvas 故事开始

在 skill 仓库根目录运行，目标必须是新目录：

```sh
python scripts/init_web.py output/my-film --engine canvas --scene adventure
npm --prefix output/my-film/web ci
npm --prefix output/my-film/web run dev
```

在终端显示的地址后打开 `/film.html`。`--scene weight` 为参数动作研究入口 `/`。工程复制源码、脚本、锁文件、字体和原始许可证，不复制依赖、成片、缓存或研究材料。目标工程包含 `web/` 和 `assets/fonts/`，保留两者的相对位置。

原 Canvas 入口继续独立工作，不依赖 Motion Canvas。兼容原有 `--scene adventure/weight` 调用；未指定引擎或场景时，0.6.0 的 CLI 默认创建 Motion Canvas 工程。库的接入解决具体图形与排版问题，不自动建立真实表演。

## 按职责修改

| 模块 | 已实现的能力 | 改编时关注什么 |
|---|---|---|
| [physics.ts](../web/src/physics.ts) | 做功驱动起跳、解析重力、480 Hz 接触弹簧和阻尼 | 质量、重力、蓄力、弹性；不要对飞行时间套 easing |
| [rig.ts](../web/src/rig.ts) | 固定骨长、脚跟和脚尖支撑、收腿及上身跟随 | 这是近侧面骨架，不是完整人体动力学 |
| [performance.ts](../web/src/performance.ts) | 承重脚步态、双骨段伸手、上身姿态继承、移动支撑转移、相机轨道 | 支撑坐标、实际腕部、交接速度和水平做功预算 |
| [model.ts](../web/src/adventure/model.ts) | 《借势》的对象、规则、平台运动、人物行为和事件 | 新主题必须重写因果、对象关系和动作，不只替换字 |
| [render.ts](../web/src/adventure/render.ts) | 极简场景、符号排版、曲线人物、事件点缀、独立相机 | 播放控件和诊断不进入成片，公式与对象保持身份 |
| [score.mjs](../web/scripts/score.mjs) | 接触/规则/音乐三层原创合成、声像、音乐让位、绝对时间裁切 | 新片传入 music 段落；声音材质仍需听审 |
| [video.mjs](../web/scripts/video.mjs) | 两种 TS 入口共用 PNG → FFmpeg 编码、帧数/尺寸与指纹检查 | 场景只提供求帧、声音和区间，避免复制编码器 |
| [render.mjs](../web/scripts/render.mjs) | Canvas 场景选择、配置、绝对时间求帧 | Motion Canvas 对应入口在 motion/scripts/ 中 |

## 动作接口

以下为实际存在的接口，完整调用见样片 model.ts：

```ts
const motion = createMotion({ ...PRESETS.heroic, elasticity: 0.12 });
const carrier = (t: number) => ({ x: 5 - 0.2 * t, velocity: -0.2 });
const clip = transfer(motion, 2, 3.2, carrier);
const { rig, state } = clip.at(3);
const wrist = reach(rig, 1, { x: rig.hip.x + 0.29, y: rig.hip.y + 0.24 });
// 抓取之后，道具位置使用 wrist；不要另跑一个大致重合的动画。
```

`transfer(motion,start,source,carrier)` 的 source 可以是静止支撑横坐标，也可以是同样返回 x/velocity 的移动支撑函数。起跳支撑在蹬伸窗口内应保持匀速；目前源和目标的地面高度相同。系统求解可达的水平速度，继承载体速度；超过现有水平做功预算时报错。腾空仍是解析重力，落地后的水平阻尼保留撞击速度，脚绑定目标支撑。

它没有覆盖高低台阶、抓边、翻滚、双人承托或复杂障碍碰撞。需要这些动作时实现相应支撑和受力，再增加场景和测试。不能只换词就声明已有。

`standing` 和 `walkAt` 使用向上为正的世界坐标；绘制时统一换到屏幕坐标。`reach` 返回实际腕部，并在 rig 中记录不可达误差。`inheritUpperBody` 继承躯干、头与手臂的角度，保留骨长，不移动承重脚。`cameraAt` 对显式关键帧求值；镜头动机仍由剧本决定。

## 试做和导出

以下命令在目标工程的 `web/` 中运行；需要 FFmpeg / ffprobe、Chromium 或 `MOTION_BROWSER_EXECUTABLE` 指定的 Chrome：

```sh
npm run build
npm test
npm run test:adventure
npm run render -- --scene adventure --fps 30 --from 7 --to 9.5 --out ../renders/boarding.mp4
npm run render -- --scene adventure --fps 60 --out ../renders/final.mp4
```

`--from/--to` 用于 adventure 场景，边界四舍五入到输出帧；帧在原场景绝对时间求值，声音使用相同原点，保留越过裁切点的声音尾部。30/60 fps 共用状态模型。只有完整编码、核对帧数并确认页面无错误后替换已有 MP4；同名 JSON 记录实际参数、声音事件、区间和文件指纹。

`window.__MOTION__.info()` 返回片长和事件，`frame(t,debug)` 求帧并返回约束与画幅检查，`png(t)` 导出不带控件的画面。任意拖帧与连续导出应一致。`weight` 场景保留原 setPreset/configure 接口，与 adventure 的接口分开。

改场景后先跑浏览器关键帧检查，再导出。新主题应更新测试中的关键时刻和接触关系；现有测试通过不代表另一个故事已经验收。

## 编码之后

回到 skill 仓库使用通用检查、剪辑与交付工具：

```sh
python scripts/motion.py inspect output/my-film/renders/final.mp4 --out output/my-film/review
python scripts/motion.py deliver output/my-film/renders/final.mp4 --out output/my-film/delivery
python scripts/motion.py verify output/my-film/delivery
```

详细剪辑能力见 [可复用工具](tooling.md)。保存剧本、规则边界、检查记录和可编辑工程；正常速度观片、静音理解检查和完整听审的完成状态分别报告。无记录时不声称完成这些审看。


## 三种概念故事的完整 TS 起点

`init_web.py --scene negative-ride|binary-search|complex-rotation` 可复制三支重拍工程。分别打开同名 `.html`；`npm --prefix motion run render:series` 顺序导出三支，单支与局部仍用已有 `render`。规则、故事和假设见 [制作规格](../demos/PRODUCTION.md)，不要只换文字保留原剧情。

[series/motion.ts](../web/src/series/motion.ts) 提供双向跑步、短预备跳跃、移动支撑、保持骨长的平衡和腕部操作。动作连接可短暂释放并重置脚步，不属于全程脚底锁定的人体模拟；站稳后使用支撑局部锚点。新片启用连续步态高度，脚落地时不重置上身高度；旧动作试片保留原配置以避免无关画面变动。

[series/model.ts](../web/src/series/model.ts) 将负数控制值与实际速度分开、保留二分查找的原数组、用精确复数状态驱动圆周与四次求值。声音事件由这些状态与动作接触编排，沿用公共混音器、素材缓存、预览桥和视频编码，不另建导出流程。改变目标或时间后需要重新编排查询、镜头与接触事件。
