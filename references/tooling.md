# 可复用制作工具

用户要求实际制作、剪辑或交付时读取本文件。只分析概念或写分镜时，无需安装或执行这些工具。统一入口是 `python <skill>/scripts/motion.py`；从任意工作目录使用时，传入项目或清单的真实路径。

## 选择入口

| 任务 | 命令 | 产物 |
|---|---|---|
| 检查本机依赖 | `motion.py doctor` | Python 包、FFmpeg/ffprobe、编码器的可用性；不会自动安装 |
| 新建制作工程 | `motion.py init 项目目录 --demo complex-rotation` | 可独立运行的项目、角色库、字体、默认清单 |
| 新建 TS 动作冒险工程 | `python scripts/init_web.py 项目目录 --scene adventure` | 独立 Web 源码、重量/接触/相机、声音、锁文件与字体许可 |
| 渲染 / 局部试做 | `motion.py render project.json` | 视频；也支持静帧、预览规格与缓存 |
| 裁切、变速、拼接、混音、软字幕 | `motion.py edit edit.json` | MP4 与实际剪辑计划记录 |
| 检查成片 | `motion.py inspect video.mp4 --out review` | 完整解码结果、音轨峰值、联系表与机器报告 |
| 打包交付 | `motion.py deliver video.mp4 --out delivery` | 成片、最新检查记录和 SHA-256 文件清单 |
| 检查交付文件是否变化 | `motion.py verify delivery` | 文件一致性结果 |

依赖：Python 3.10+、`requirements-render.txt`、带 libx264/AAC 的 FFmpeg 与 ffprobe。已在 macOS/FFmpeg 7.1.1 实测，CI 在 Ubuntu 执行真实 FFmpeg 用例；不承诺未经测试的平台兼容性。命令不联网、不读取供应商密钥、不自动调用配音或生图服务。

以上 Python 依赖用于原工具；TS 初始化本身仅用 Python 标准库，构建与导出依赖及接口见 [TS 制作与复用](ts-production.md)。`motion.py init` 不改变为 TS 入口，避免破坏旧工程。

## 新工程与局部渲染

```sh
python scripts/motion.py init output/my-film --demo negative-ride
python output/my-film/scripts/motion.py render output/my-film/project.json \
  --profile preview --start 10 --end 14 --out output/my-film/renders/preview.mp4
```

`init` 要求新目录，已有工程不会被覆盖。它复制工具与本项目的 demo_engine，不复制成片；scene.py 是可编辑的初始故事，修改其规则与动作后再生成新作品。

`project.json` 的 version 固定为 1；scene 指向本地 Python 文件，模块提供：

- `DURATION`：正数秒。
- `render_frame(t, scale)`：返回 Pillow Image，t 是原场景的绝对时间。
- 可选 `write_audio(path)`：写出与场景时间 0 对齐的 WAV；省略则导出无音轨视频。

scene.py 会执行本地 Python 代码，使用自己创建或已审阅的场景。支持在场景回调中延迟导入项目模块。

canvas 记录 width、height、fps，具体字段同剪辑清单；渲染始终等比容纳原始画面。scale 是绘制超采样系数（0.5–3）。output 指向 MP4；可选 inputs 是需要参与缓存指纹的额外本地文件列表，场景读取 assets/ 之外的文件时必须登记。

```sh
python scripts/motion.py render project.json --start 10 --end 14 --out renders/test.mp4
python scripts/motion.py render project.json --stills 10 11.5 13 --out review/stills
python scripts/motion.py render project.json --force
```

`preview` 使用 640×360、15 fps、scale=1；`final` 使用项目配置。窗口边界以 `round(t*fps)` 对齐，输出帧数为 end_frame-start_frame；声音按相同边界截取，输出时间从 0 开始。静帧按指定的原场景时刻输出原始图像，不套预览画幅；不把关键帧导出称为成片。

渲染缓存检查 project.json、scene.py、工程根部及 scripts/ 的 Python 文件、assets/、显式 inputs、依赖版本、FFmpeg 与参数，并核对已有视频指纹。外部模块或未登记资源不在保证范围内。修改故事时同步修改剪辑清单中的 in/out。

## 剪辑清单 v1

可运行实例：[edit-showcase.json](../examples/edit-showcase.json)。路径相对 JSON 所在目录解析；CLI 的 `--out` 则相对当前工作目录。所有输入都是本地文件。

```json
{
  "version": 1,
  "canvas": {"width": 1280, "height": 720, "fps": 30, "fit": "contain"},
  "clips": [
    {"source": "shots/a.mp4", "in": 1, "out": 5, "speed": 1, "gain_db": -3},
    {"source": "shots/b.mp4", "in": 0, "out": 4, "speed": 2, "mute": true}
  ],
  "transition": {"type": "fade", "duration": 0.4},
  "audio": [
    {"source": "audio/voice.wav", "at": 0.5, "gain_db": 0, "fade_out": 0.2}
  ],
  "subtitles": "captions.srt",
  "output": "renders/final.mp4"
}
```

| 字段 | 约定 |
|---|---|
| canvas.width / height | 64–4096 的偶数；默认沿用本项目 16:9，按需设置其他画幅 |
| canvas.fps | 15、24、25、30、50、60 |
| canvas.fit | contain 等比留边；cover 等比裁切，需自行检查是否裁掉公式和角色 |
| canvas.background | 留边色，默认 `#10171c`；不自动重新设计画风 |
| clips[].in / out | 原素材秒数，默认 0 / 素材时长；左闭右开 |
| clips[].speed | 0.25–4，默认 1；视频变速，声音使用 atempo 保持音高 |
| clips[].gain_db / mute | 原声增益 -60–12 dB；静音开关；没有音轨的片段自动补静音以保持时间线 |
| transition | 全部片段边界使用 cut 或 fade；fade.duration 按目标帧率对齐，重叠时间会缩短总片长 |
| audio[] | 任意数量的声音层；in/out 为音源裁切，at 为成片入点，gain_db 调音量，fade_in/out 单位秒 |
| subtitles | 可选 UTF-8 SRT，时间针对剪辑后的最终时间线；封装为 mov_text 软字幕，由播放器选择显示 |
| output | MP4 输出，不得覆盖输入或剪辑清单 |

先运行 `edit edit.json --plan`，检查量化后的帧数、时长和缓存命中，再执行 `edit edit.json`。计划模式探查文件但不写媒体或缓存。未知字段、非有限数值、反向时间窗、越界、无效转场都会报错。

每个片段先标准化到相同画幅、帧率和 48 kHz 双声道。片段帧数为 `round((out-in)/speed*fps)`，淡化的总重叠帧数从总帧数扣除。声音按最终长度补齐或截断，混音采用不自动归一化的求和，再以 0.95 线性峰值限幅并补偿限幅器延迟；这是峰值控制，不是 LUFS 标准化或自动压低背景音乐。

缓存位于清单旁的 `.motion-cache/clips/`：按源文件内容、片段参数、工具代码与版本复用，损坏缓存会重建。改字幕、声音层或转场时可以复用未变的标准化片段；最终合成仍会执行。正常编码采用临时文件，验证后原子替换；失败不会把已有成片截成半个文件。允许重新输出到自己指定的成片路径。

## 检查与交付

```sh
python scripts/motion.py inspect renders/final.mp4 --out review
python scripts/motion.py deliver renders/final.mp4 --out delivery-v1
python scripts/motion.py verify delivery-v1
```

inspect 全量解码视频和音频；声音按块读取，不把长音轨一次装入内存；转为 48 kHz 双声道进行分析，同时记录原音轨参数。解码采样数可能包含 AAC 的少量尾部填充，明显的音画长度差会提示复核。默认 12 个均匀时刻生成联系表，`--samples` 可设 2–60。它记录采样差异、近乎纯色的采样时刻和峰值提示，**不按色彩、留白或运动面积给作品判定及格**。无音轨、低运动可能完全符合创作目标。

deliver 使用新目录，复制实际视频后重新检查，避免复用旧 QA；生成视频、联系表、QA 与清单。verify 能发现列入清单的文件变化、缺失和额外文件；指纹不是数字签名，也不能证明概念正确或人工审片完成。正常速度观片、听审、动作因果与数学规则仍由制作环节检查。

## 维护时复用什么

`motion_tools/common.py` 管媒体探查、进程、原子输出和指纹；`project.py` 管独立工程及帧渲染；`edit.py` 管清单与时间线；`review.py` 管实际成片事实与交付。保持这些层不含题材、配色偏好或上游的风格规则。

场景库继续提供人物、几何、公式状态和音效。新题材先修改场景，不重新复制 FFmpeg 命令；新剪辑功能在通用模块实现并加入真实媒体回归。JSON version 改变含义时递增版本并提供迁移说明；不悄悄改变旧字段语义。上游复用来源见 [结构与复用记录](../docs/upstream-reuse.md)。
