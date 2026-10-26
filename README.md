# stickman-motion-skill

**让知识成为角色可以操作的世界规则。**

面向 Codex 等支持 Agent Skills 的工具，以有动机、有判断力的火柴人为主角，通过选择、动作与世界反馈，将数学、物理或算法概念组织成动作冒险动画。

An Agent Skill for wordless stick-figure adventures where knowledge becomes an interactive world, with a TypeScript action film, weighted motion tools and reusable video export.

[技能入口](SKILL.md) · [设计分析](docs/design-analysis.md) · [制作与复现](demos/README.md) · [验证记录](demos/QA.md) · [参与贡献](CONTRIBUTING.md)

## 0.5.0：让符号进入动作

新默认方向是极简黑色空间、白色知识对象、橙色主角与无台词行动叙事。人物直接拿取、组合和使用知识对象；规则反馈改变处境，镜头与声音跟随操作、受力和判断。详细制作判断见 [参考风格语法](references/reference-style.md)。

新增 **28 秒 / 60 fps 的 TS 原创短片《借势》**：拿取方向因子，登上移动支撑，装入乘法槽后承受反向加速，最后继承载体速度跳离。画内没有讲解面板，保留探索、执行、吸震与余波。

![《借势》：登台、反向与借已有速度跳离](demos/adventure/preview.gif)

[有声 MP4](demos/adventure/reversal.mp4) · [规则与剧本](examples/reversal-adventure.md) · [关键帧与实际 QA](demos/adventure/QA.md) · [TS 接口与复用](references/ts-production.md)

新增可复用的承重步态、移动支撑转移、腕部抓取、上身姿态继承、相机轨道和三层事件声音。预览与导出共用画面函数，局部试做保留原场景时间与声音尾部。创建独立工程：

```sh
python scripts/init_web.py output/my-film --scene adventure
npm --prefix output/my-film/web ci
npm --prefix output/my-film/web run dev
# 在终端显示的地址后打开 /film.html
```

这是单人、同高支撑、单机制短片的实际实现；尚未覆盖原片的大型对抗、复杂空间演化、翻滚和双人动作，也没有把旧三支影片迁移到 TS。检查记录分别说明数值约束、浏览器、编码和审看的范围，不宣称仅凭这些检查达到参考作品的表演水平。

## 新增：像电影主角一样行动

0.4.0 更新剧本与表演方法：主角有具体动机、判断力和身体边界；情节由选择、条件变化及后果推进。通过头部定向、肩髋关系、重心、接触和停顿表达心理，重点动作有清楚的目的、路线与代价。

[电影式主角与因果剧本](references/cinematic-storytelling.md) · [《折返》90 秒完整例稿](examples/return-crossing.md) · [表演与制作](references/production-guidance.md)

《折返》讲两名检修员借单人吊架撤离：主角先送腿伤同伴过岸，平台继续断裂后，必须按受伤后的身体条件改变登架方式。它包含完整场景稿、空间和设备规则、关键选择依据及待验证项；**目前是文字例稿，尚无对应分镜或成片**。现有三支概念片保留原有规格，主要验证机制和工具链，尚未按这套剧本方法重拍。

## 新增：重量与弹性动作研究

0.3.0 增加 **TypeScript + Canvas 网页动作引擎**。角色先下蹲蓄力，蹬地做功决定起跳速度；腾空使用重力轨迹，落地保留下落动量，通过压缩、回弹和阻尼恢复。固定骨长与脚尖支撑配合躯干、头和摆臂的跟随。

![蓄力大跳：预备、蹬地、腾空、吸震与回弹](demos/weight/heroic-preview.gif)

[15.583 秒 / 60 fps 完整对照视频](demos/weight/weight-study.mp4) · [网页工程与启动命令](web/README.md) · [原片动作研究](docs/weight-motion-study.md) · [模型与复用接口](references/weighted-motion.md) · [实际检查记录](demos/weight/QA.md)

三个预设比较自然跳跃、蓄力大跳和同样发力下更重的身体。网页可实时调参、慢放、拖帧与显示受力；同一套绘制函数导出视频，附参数和文件指纹。只启动预览需要 Node.js 22.12+：

```sh
npm --prefix web ci
npm --prefix web run dev
```

这是有效质量驱动、结合关节表演的动画模型，尚非完整人体物理模拟。下面三支概念故事仍使用 Python 引擎，本轮未迁移其全部镜头，也不把新模型的验证结论套到旧片上。

## 三支概念故事 Demo

每支 **36 秒，1280×720，30 fps，无台词，含原创合成音乐与音效**。下面是 12 秒无声 GIF 摘录，完整 MP4 包含开端、试探和结果。

### 01 · 反向才到达

角色要去左边，运载车却朝右。三次触碰 `×(-1)`，让“负数乘法”变成试错、观察和主动复用。

![反向才到达：主动反向、跳上运载车并跨越缺口](demos/previews/negative-ride.gif)

[完整 MP4](demos/videos/negative-ride.mp4) · [任务与规则卡](examples/negative-ride.yaml) · [关键帧](demos/posters/negative-ride-contact-sheet.jpg)

### 02 · 只留下一半

十六扇门的值按升序排列，需要查询后才揭晓。角色寻找 63，候选区间随着比较从 16 缩至 8、4、1，展示算法如何改变下一步行动。

![二分查找：揭晓中点值，排除不可能的一侧](demos/previews/binary-search.gif)

[完整 MP4](demos/videos/binary-search.mp4) · [任务与规则卡](examples/binary-search.yaml) · [关键帧](demos/posters/binary-search-contact-sheet.jpg)

### 03 · 四分之一圈

角色乘坐 `×i` 载台，沿单位圆取物并回家。四次逆时针转动留下完整轨迹，最后得到 `i⁴ = 1`。

![复数旋转：第二次乘以 i，到达对侧取物，再继续返回](demos/previews/complex-rotation.gif)

[完整 MP4](demos/videos/complex-rotation.mp4) · [任务与规则卡](examples/complex-rotation.yaml) · [关键帧](demos/posters/complex-rotation-contact-sheet.jpg)

## 这些示例验证什么

| 示例 | 核心能力 | 必须保持的边界 |
|---|---|---|
| 反向才到达 | 符号操作、预备动作、接触、试错和复用 | 面板是下一次运行的速度设置，停车时不代表实际速度 |
| 只留下一半 | 算法状态、候选范围、比较后的方向决策 | 门退场表示排除候选，不删除或重排原数组 |
| 四分之一圈 | 参数化几何、空间路径、携带与闭环 | 中间旋转是展示插值，完成后才显示乘法结果 |

三支样片共用曲线骨架、连续姿态、脚部承重、手部接触、绝对时间求帧和音效模块。0.2.1 修正了交叉腿、折角关节和突然换姿势；[查看新旧动作对比](demos/motion/README.md)与[可复用动作接口](references/character-motion.md)。它们是专门编写的参考实现；新增题材仍需要规则卡、分镜与场景代码，当前不支持把任意提示词或 YAML 直接变成视频。

自动检查、关键帧及连续抽帧的检查范围见 [QA 记录](demos/QA.md)。这些早期样片尚未经过观众理解度测试，不能据此声称达到参考作品的表演或叙事水平。

## 核心方法

角色处境与动机 → 观察和选择 → 行动与世界反馈 → 条件变化或新的发现 → 调整 → 回收与余波。具体结构按题材选择，不强制角色先误操作再学习。

- **概念机制**：把知识写成可操作的规则，并说明前提和隐喻边界。
- **人物与剧本**：关键选择符合已知信息、性格和能力，失败有原因，高潮有铺垫。
- **动作表演**：通过注意、重心、接触、发力和反应表达心理；帅感来自动作目的、时机与控制。
- **符号与空间**：区分表达式编辑、求值、等价变形和空间隐喻。
- **制作与验收**：用统一时间线组织画面与声音，同时核验因果、数学与可读性。

适用于概念冒险、无台词叙事、知识关卡和对应的视频制作；普通口播配图或纯公式推导可以采用更简单的流程。

## 在 Codex 中安装

```sh
mkdir -p "$HOME/.agents/skills"
git clone https://github.com/okeeper/stickman-motion-skill.git \
  "$HOME/.agents/skills/stickman-motion-skill"
```

项目内使用时，也可以克隆到该项目的 `.agents/skills/stickman-motion-skill`。目录已存在时请更新已有安装，避免重复克隆。Codex 会发现技能变化；未显示时重启 Codex。路径及发现规则见 [OpenAI 官方技能文档](https://learn.chatgpt.com/docs/build-skills)。

```sh
git -C "$HOME/.agents/skills/stickman-motion-skill" pull --ff-only
```

安装技能不需要渲染依赖。需要重新渲染示例时，按下面的命令配置环境。

## 复现视频

需要 Python 3.10+，以及 PATH 中的 `ffmpeg` 和 `ffprobe`。渲染不调用外部模型或网络，不需要 API key。

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-render.txt
python scripts/render_demo.py --scene all
python scripts/render_demo.py --gifs-only
python scripts/check_demo_media.py --report demos/media-check.json
```

只渲染一支：`python scripts/render_demo.py --scene complex-rotation`。文件输出到 `demos/videos/`，海报与关键帧输出到 `demos/posters/`。更多预览命令、场景结构与改编步骤见 [制作与复现](demos/README.md)。

## 可复用制作与剪辑工具

新增统一 CLI，将工程初始化、局部渲染、剪辑、检查与交付串起来：

```sh
python scripts/motion.py doctor
python scripts/motion.py init output/my-film --demo complex-rotation
python output/my-film/scripts/motion.py render output/my-film/project.json \
  --profile preview --start 10 --end 14 --out output/my-film/renders/preview.mp4
python scripts/motion.py edit examples/edit-showcase.json --plan
python scripts/motion.py edit examples/edit-showcase.json
python scripts/motion.py inspect demos/tooling/edited-showcase.mp4 --out output/review
python scripts/motion.py deliver demos/tooling/edited-showcase.mp4 --out output/delivery
python scripts/motion.py verify output/delivery
```

支持裁切、变速且保持音高、统一画幅和帧率、硬切/淡化、原声增益、多音轨混音与 SRT 软字幕。按内容指纹复用未改片段，编码成功后原子替换成片；新工程复制所需工具与字体，可以独立运行。

[完整工具说明](references/tooling.md) · [剪辑示例](examples/edit-showcase.json) · [剪辑成片与实测记录](demos/tooling/README.md) · [更新记录](CHANGELOG.md)

工程分层、联系表与交付记录参考了 huashu-art-motion；直接复用范围与许可见 [复用记录](docs/upstream-reuse.md)。视觉设计继续使用本项目自己的火柴人和概念交互方式。

## 使用 Skill

```text
使用 $stickman-motion-skill，先写一个 90 秒无台词动作剧本：两个人要穿过
一处正在失稳的空间，主角有身手，也会谨慎判断、保护同伴和承担代价。
让重点动作服务于脱困，用身体行为表达心理。交付完整场景、关键选择
依据和动作路线；此轮只写剧本，不把文字例稿当成已经制作的视频。
```

```text
使用 $stickman-motion-skill，把“负数乘法与方向反转”做成 36 秒的无台词
火柴人故事。让角色先误判、再验证规则，最后通过同一规则完成目标。
交付可播放视频、可编辑工程、规则卡和实际检查记录。
```

```text
使用 $stickman-motion-skill，参考仓库的二分查找 demo，设计一个关于
“栈的后进先出”的新故事。先确定角色目标、错误尝试和可见反馈，
再实现一个完整的短片；不要只替换标题或把现成视频当作新产物。
```

```text
使用 $stickman-motion-skill，分析我提供的视频：提取角色表演、概念交互、
镜头和节奏规则，区分实际观察与实现建议，并标出无法验证的部分。
```

## 开发与检查

```sh
python scripts/validate.py
python -m unittest discover -s tests -v
npm --prefix web ci
npm --prefix web run build
npm --prefix web test
# 浏览器检查另需安装 Chromium：cd web && npx playwright install chromium
npm --prefix web run test:browser
npm --prefix web run test:adventure
```

文档与规则卡检查仅需要 `requirements-dev.txt`；Python 动画、音频测试需要 `requirements-render.txt`。CI 执行结构检查、Python 行为和真实 FFmpeg 回归，以及 TS 构建、物理和浏览器交互检查，不重复渲染三支完整概念片。

```text
SKILL.md                         技能入口
web/                             TS 重量、连续表演、概念冒险与视频导出
references/                      规则卡、表演与制作指南
examples/                        规则卡与剧本，含各 demo 的输入任务
demos/                           MP4、GIF、分镜与验证记录
scripts/demo_engine/             人物、几何、场景状态与原创声音
scripts/render_demo.py           确定性渲染与预览导出
scripts/check_demo_media.py      三支原始 demo 的规格检查
scripts/motion.py                可复用工具入口
scripts/init_web.py              独立 TS 工程初始化
scripts/motion_tools/            工程、剪辑、媒体与交付模块
assets/project/                  独立工程的场景入口模板
tests/                           概念、接触、确定性和失败输入检查
assets/fonts/                    字体与原始许可证
```

## 后续方向

- [x] 用三支原创短片验证符号操作、算法决策和空间变换。
- [x] 提供可复现工程、原始任务、规则卡、关键帧和成片检查。
- [x] 提炼可复用的人物、接触、时间线与声音模块。
- [x] 增加重量、蓄力、重力轨迹与弹性落地的 TS 动作研究及浏览器调参。
- [x] 更新电影式主角、合理决策与无表情表演方法，完成《折返》文字例稿。
- [x] 把参考片语法落实到 TS《借势》：直接符号操作、移动支撑、连续动作、相机与事件声音。
- [ ] 用动态分镜和实际影片验证《折返》的双人判断、肢体可读性和动作节奏。
- [ ] 把新的重量模型扩展到概念故事中的搬运、失衡、翻滚与多处支撑。
- [ ] 增加更丰富的身体表演、动作过渡与镜头尺度变化。
- [ ] 增加非数学题材，并进行静音理解度测试。
- [ ] 根据更多实测场景决定哪些参数值得形成稳定配置接口。

## 参考与许可

设计研究参考 [Alan Becker 的《Animation vs. Math》](https://www.youtube.com/watch?v=B1J6Ou4q8vE)。本项目与原作者无隶属关系；新示例为独立设计，没有分发原片画面、角色素材、截图或音轨。

原创文档、规格、代码和 demo 媒体采用 [MIT License](LICENSE)。字体保留独立许可证，见 [第三方说明](THIRD_PARTY_NOTICES.md)。
