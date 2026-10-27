# 自动制作运行时

`node scripts/autopilot.mjs` 改编自 [stickman-video-director](../docs/upstream-reuse.md)，在本 skill 中独立运行：加载 JSON 清单、检查依赖及素材、按镜头渲染、缓存、混音、生成联系表和媒体报告。它是辅助工具，不是参考片级动画引擎：关节点独立插值，没有自动骨长保持、接触约束、动作规划或表演生成；默认合成音效也无法替代完整拟音和混音。agent 必须创作故事、对象、逐镜动作、图形和声画时间，并以实际试片判断是否适合该镜。普通文字任务无需运行或安装。

## 命令

```sh
npm ci
node scripts/autopilot.mjs doctor
node scripts/autopilot.mjs init /absolute/path/my-film
# 编辑 my-film/project.json，制作必要的素材
node scripts/autopilot.mjs validate /absolute/path/my-film/project.json --seconds 12
node scripts/autopilot.mjs preview /absolute/path/my-film/project.json --seconds 12
node scripts/autopilot.mjs validate /absolute/path/my-film/project.json
node scripts/autopilot.mjs render /absolute/path/my-film/project.json
node scripts/autopilot.mjs probe /absolute/path/my-film/output/film.mp4
```

需要 Node 20+、FFmpeg/ffprobe、npm 中的 `@napi-rs/canvas`。`doctor` 只检查本机依赖及密钥是否存在，不测试网络、配额或费用，也不显示密钥。`init` 创建全新、非覆盖的项目；项目放在 skill 目录之外。空清单不是可运行成片。

`validate` 检查清单、时间线、实际素材和采样绘制，不能证明数学、叙事或视觉质量。`--seconds` / `preview` 只加载该范围相关的镜头和素材，后续素材可以尚未制作。`render` 检查全片；未指定 reviewPolicy 时在用户已授权制作的范围内直接运行。用户明确要求先审预览时，可设 `"reviewPolicy":"required"`，提供实际预览并在用户批准后执行 `approve 项目 --note "实际批准说明"`；该记录绑定预览内容、实际文件、声音和全局设置，修改预览或全局设置会失效，单独补全后段不会自动失效。代理自身的技术检查不构成用户批准。

`output/` 内有 `preview.mp4` 或 `film.mp4`、逐镜缓存、checkpoint、联系表、SRT/VTT、媒体报告及 SHA-256。已有输出与指纹不一致时默认拒绝覆盖；明确指定 `--replace` 才替换。渲染失败不把未完成的最终文件当成成片。源素材不得放在渲染器管理的 `output/` 中。缓存命中不代表质量通过，联系表无法代替正常速度观片或听审。

## 项目清单 v1

以下是结构示意；缺少完整关节和镜头时不可直接运行。完整可运行的离线技术夹具见 [项目 JSON](../examples/concept/project.json)：它检验文字、关节关键帧及波形叠加，不是完整故事或表演质量样片。

```json
{
  "version": 1, "style": "concept", "width": 1280, "height": 720,
  "fps": 24, "duration": 10, "background": "#050505", "grid": false,
  "shots": [{"start": 0, "end": 10, "camera": {"x": 0, "y": 0, "zoom": 1},
    "layers": [{"id": "formula", "type": "text", "text": "1 + 1 = 2", "x": 600, "y": 200, "size": 52}]}],
  "sfx": [{"time": 1, "kind": "tap", "gain": 0.05}], "captions": []
}
```

- 固定字段 `version: 1`、`style: concept`；`width/height` 为 256–3840 的偶数，`fps` 为 12–60 的整数；正的 `duration` 和所有镜头边界必须落在输出帧上。镜头从 0 开始、连续无缝覆盖全片；局部预览仅需覆盖范围。
- 设计坐标统一宽 1280，高度按画幅等比计算；竖屏需要重新安排，不拉伸角色。镜头可以有 `camera: {x,y,zoom,keys}`，相机 `x/y` 是中心偏移、`zoom` 是倍率；关键帧相对镜头起点。
- `layers` 从后到前绘制。支持 `text`、`line`、`arrow`、`circle`、`image`、`stick`、`graph`。坐标、宽高、角度、透明度、描绘进度、缩放和半径可在 `keys` 中按镜头局部秒数关键帧化；数值采用平滑插值。`from/to` 控制镜头内可见区间。图层 ID 在同一镜头内必须唯一；相邻镜中同一对象的语义身份、位置和持有关系由作者核对，渲染器不会自动匹配。
- `text` 使用可编辑 Unicode 原文：默认在包含中日韩汉字时选 Noto Sans SC，否则用 DejaVu Sans；`font: "cjk"` 或 `"math"` 可明确选择。`font`、`captionFont` 项目属性可指向自有本地字体。长文本需要检查实际字形、换行和最终分辨率；复杂公式不由此自动排版或计算。
- `stick` 用 `joints` 指定 `head`、`neck`、`hip`、`leftElbow`、`leftHand`、`rightElbow`、`rightHand`、`leftKnee`、`leftFoot`、`rightKnee`、`rightFoot` 各自的 `[x,y]`；头、躯干与四肢按这些点连接。`jointsKeys: [{t,joints},…]` 需要每个关键帧都提供完整点集；默认平滑插值，`jointInterpolation: "linear"` 线性插值。默认角色颜色为黄色 `#ffd43b`；`contour: "curved"` 让肘膝折点有圆滑过渡，`headFill` 可设头圈内底色，头部最后绘制；`spineBend` 可关键帧控制躯干曲线，关节点约束与绘制轮廓分别处理。所有点是图层局部坐标，`x/y/scale` 管图层整体。原始模式不自动保持骨长、足部支撑或手与道具的接触；可用 [动作约束工具](character-performance-tools.md) 按最终输出帧率求解并烘焙完整姿态，再逐帧审看。
- `graph` 是可视化一维高斯波：指定 `domain: [min,max]`、`w`、`yScale`，及 `components: [{kind:"gaussian", amplitude, center, velocity, sigma}]`。每个分量按镜头局部秒数 `t` 计算 `A·exp(-0.5·((x-center-velocity·t)/sigma)²)`，画出所有分量的和；`showComponents: true` 可附各分量的曲线。不同镜头如果代表同一物理过程，作者须为下一镜计算并填入承接的初始状态。它只是一种预设模型，并不是通用公式、物理求解器或证明。
- `image` 的 `path` 仅接受本地 PNG/JPEG/WebP。图片动画只变换图层，不会自动补齐肢体动作。公式、数值、图表的科学含义由创作者核验；不得把表达式编辑说成等价变换。

## 可选声音与字幕

默认无旁白、无字幕；即使无任何声音，也会输出一条静音音轨。可选 `voice: {path, lead}` 使用本地音频，原速放置并在结尾填静音；音频不能超出片长。如果旁白已经混入事件音效，可标 `contains_sfx: true` 防止重复添加事件音效。`sfx` 支持原有合成的 `tap/paper/pop/chime`，也可使用 `{time,path,gain}` 插入本地音频；`music: {path,gain}` 将本地音乐循环混入。增益是 0–1 的线性值；需要手工听审，不保证主观平衡。

`captions: [{start,end,text}]` 可选，时间不交叠且在片长内，最多两行；生成烧录画面与 SRT/VTT。`node scripts/autopilot.mjs captions WORDS.json OUTPUT.json` 将已有词级时间草拟为字幕；`scripts/align_captions.py` 可选使用已经缓存的 Whisper 模型，模型下载须显式选择。对中文、断句、专有名词和时间做人工核验。

## 外部图像和语音

`scripts/gemini-media.mjs` 保留上游的可选一次性 Gemini 适配器：使用 `image` 或 `speech`、本地提示词/台词文件、用户选择的可用模型及 `--allow-network`。它需要环境变量中的 API key，检查密钥是否存在不代表额度可用；不要要求用户粘贴密钥到对话。语音还需 `--voice`，可选的图片参考需明确传入 `--reference`。每次请求写收据，不自动重试；超时先检查服务状态。调用第三方服务可能产生费用，必须符合当前任务授权。用户已提供媒体或其他可用工具时可以直接采用，不强制使用这一适配器。
