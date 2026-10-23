# Demo 制作与复现

三支样片用于检验同一套 skill 能否处理不同的概念机制。它们采用相同角色和视觉语言，但任务、规则反馈和动作路径不同。

| 选择值 | 主题 | 输入任务 | 完整成片 |
|---|---|---|---|
| `negative-ride` | 负数乘法与方向反转 | [规则卡](../examples/negative-ride.yaml) | [MP4](videos/negative-ride.mp4) |
| `binary-search` | 查询隐藏值、排除候选 | [规则卡](../examples/binary-search.yaml) | [MP4](videos/binary-search.mp4) |
| `complex-rotation` | 乘以 i、取物、返回起点 | [规则卡](../examples/complex-rotation.yaml) | [MP4](videos/complex-rotation.mp4) |

每份规则卡的 `prompt` 是代表性制作任务；`renderer_scene` 对应命令行中的场景名。YAML 记录故事规格，渲染器不读取它来生成任意场景。逐段分镜见 [PRODUCTION](PRODUCTION.md)，实际检查见 [QA](QA.md)。

## 环境与命令

在仓库根目录操作，需要 Python 3.10+ 和带有 libx264、AAC 编码支持的 FFmpeg；实际媒体检查还需要 ffprobe。安装 FFmpeg 后确认两个命令可运行：

```sh
ffmpeg -version
ffprobe -version
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-render.txt
```

先导出静态布局，再渲染完整场景：

```sh
python scripts/render_demo.py --scene all --stills-only
python scripts/render_demo.py --scene complex-rotation
python scripts/render_demo.py --scene all
python scripts/render_demo.py --gifs-only
```

`--stills-only` 生成每支的封面与六帧联系表；`--gifs-only` 从已有 MP4 生成 12 秒、640×360、10 fps 的无声摘录。摘录范围：反向车 20–32 秒，另外两支 10–22 秒。

低成本动作预览可用 15 fps 与较低超采样；输出到独立目录保留正式成片：

```sh
python scripts/render_demo.py --scene negative-ride --fps 15 --scale 1 \
  --out-dir output/preview/videos
```

正式默认值为 30 fps、1.5 倍超采样再缩至 1280×720。三个场景均为 36 秒，固定种子合成双声道声音；视频输出为 H.264 / yuv420p + AAC，支持 faststart。不同 FFmpeg 版本可能产生不同编码字节，确定性测试针对相同依赖环境下的画面像素和合成音频。

```sh
python scripts/validate.py
python -m unittest discover -s tests -v
python scripts/check_demo_media.py --report demos/media-check.json
```

## 工程分工

- [drawing.py](../scripts/demo_engine/drawing.py)：几何绘制、字体、人物骨架、步态和伸手动作。超出手臂长度的目标会被截在可达范围内，接触测试用于发现这种失配。
- [scenes.py](../scripts/demo_engine/scenes.py)：三份独立故事状态、关键时刻、道具及公式。使用绝对时间求状态，允许任意时刻直接取帧。
- [audio.py](../scripts/demo_engine/audio.py)：程序合成乐句、点击、反向、移动与完成音效，事件时间来自场景。
- [render_demo.py](../scripts/render_demo.py)：逐帧绘制、FFmpeg 编码、原子替换输出和静态/GIF 预览。
- [check_demo_media.py](../scripts/check_demo_media.py)：解码实际成片并核查时长、帧数、音轨和峰值。

新增题材时先写规则卡与角色目标，确定动作如何改变状态，再实现新的场景函数和音效 cue。复用骨架不代表复用整段故事；先让“为什么这么做、发生什么、如何改进”在静音画面中成立。

更改现有题材时，规则卡、分镜、代码、测试和视频需要一起更新。例如改变二分查找目标可能改变查询次数和节拍，当前时间线不能只改一个数字就自动适配。

## 已知制作边界

当前是三支手工编排的代码动画：固定广角构图、简化的身体表演、无配音，不具备通用物理模拟、自动分镜或任意提示词转视频能力。角色与道具接触采用解析几何；数学语义单独测试，不能用视觉效果替代正确性检查。
