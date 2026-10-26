# Stickman Motion Lab

TypeScript + Canvas 动作工程，包含 `/` 重量实验室和 `/film.html` 概念冒险《借势》两种入口。两者共用重量模型和骨架，故事增加移动支撑、符号抓取、相机与分层声音。

## 概念冒险《借势》

[28 秒有声成片](../demos/adventure/reversal.mp4) · [规则与剧本](../examples/reversal-adventure.md) · [实际 QA](../demos/adventure/QA.md) · [制作接口](../references/ts-production.md)

运行下面的开发命令后，在本地地址打开 `/film.html`。构建输出保留 `index.html` 和 `film.html` 两个入口。影片画面与播放控件分开；网页静音，MP4 含三层原创合成声音。

```sh
npm --prefix web run render -- --scene adventure --fps 60
npm --prefix web run render -- --scene adventure --fps 30 --from 7 --to 9.5 --out ../output/boarding.mp4
npm --prefix web run test:adventure
```

方向设置与实际速度分离，平台连续制动后反向；两次跳跃使用同一竖直模型，水平速度按支撑关系求解。符号跟随实际腕部，脚随移动支撑，关节和头部保留不同的受力响应。当前只覆盖近侧面、同高支撑、单人单机制，不包含翻滚、双人承托或完整刚体碰撞。

![网页动作研究界面](../demos/weight/web-preview.png)

## 启动与构建

需要 Node.js 22.12+。以下命令在仓库根目录执行：

```sh
npm --prefix web ci
npm --prefix web run dev
npm --prefix web run build
```

打开终端显示的本地地址。预览支持质量、重力、发力、蓄力和弹性调节，以及播放、慢放、拖帧与受力显示。`web/dist/` 是可独立部署的静态网站；字体随工程提供，浏览器运行时不请求外部服务，无需 API key。

## 导出实际视频

另需 PATH 中的 FFmpeg / ffprobe，以及 Playwright Chromium。安装浏览器后导出：

```sh
cd web
npx playwright install chromium
npm run render -- --preset all --out ../output/weight-study.mp4
npm run render -- --preset heroic --fps 60 --out ../output/heroic.mp4
npm run render -- --config ../examples/weight-jump.json --fps 30 --out ../output/custom.mp4
```

`--config` 接受包含五个参数的 JSON；见 [可运行配置](../examples/weight-jump.json)。它导出单个自定义动作；默认以“大跳”作为画面标签，可配合 `--preset natural|heroic|heavy` 选择已有标签。自定义故事需要修改绘制与场景代码，不能只换参数冒充新故事。

如使用已安装的 Chrome，可设置 `MOTION_BROWSER_EXECUTABLE` 为浏览器可执行文件的绝对路径，例如 macOS 的 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，无需再下载 Chromium。跨机器要得到一致的像素，须固定浏览器、字体及编码器版本；时间与物理状态本身不依赖渲染帧率。

导出使用与预览相同的绘制函数，支持 30/60 fps、1280×720，生成事件驱动的原创音效、H.264/AAC MP4 和同名 JSON 事实记录。失败时保留已有视频，成功后原子替换。JSON 记录参数、时刻、帧数、音频合成峰值和文件指纹；它不是视觉质量证书。

导出后继续复用原有剪辑与交付工具：

```sh
python scripts/motion.py inspect output/weight-study.mp4 --out output/review
python scripts/motion.py deliver output/weight-study.mp4 --out output/delivery
```

上面两条 Python 命令在仓库根目录执行。`motion.py init` 仍生成 Python 工程；TS 使用 `python scripts/init_web.py output/my-film --scene adventure`。它保留 `web/` 与 `assets/fonts/` 的相对位置、源码、锁文件及许可证，排除依赖、成片和缓存，再在目标工程安装依赖。任务内容不写回 skill 安装目录。

## 模块与检查

| 文件 | 职责 |
|---|---|
| `src/physics.ts` | 蓄力做功、重力飞行、接触弹簧、固定步长状态与事件 |
| `src/rig.ts` | 固定骨长、脚尖支撑、脚跟转动、收腿、摆臂与头部跟随 |
| `src/performance.ts` | 世界坐标步态、接触时刻、抓取、姿态继承、移动支撑与相机 |
| `src/adventure/` | 《借势》的对象和行为模型、画面与独立播放器 |
| `src/render.ts` | Canvas 画面、相机、阴影、冲击点缀、调试信息 |
| `src/main.ts` | 调参、播放、时间轴和自动化帧接口 |
| `scripts/browser.mjs` | 启动本地网页与受控浏览器，收集资源与页面错误 |
| `scripts/audio.mjs` | 按起跳/碰撞事件生成确定性音效 |
| `scripts/score.mjs` | 故事接触、规则反馈、段落音乐、声像与局部渲染声音 |
| `scripts/render.mjs` | 逐帧导出、音画编码、验证帧数与输出指纹 |

```sh
npm --prefix web test
npm --prefix web run test:browser
npm --prefix web run format:check
```

浏览器检查需要上述 Chromium 或 Chrome 配置，截图和记录输出到忽略版本控制的 `web/test-results/`。物理回归检查和画面判断的边界见 [重量与弹性说明](../references/weighted-motion.md)。原片观察、工程参考与未覆盖的全身物理见 [研究记录](../docs/weight-motion-study.md)。
