# stickman-motion-skill

**让知识成为角色可以操作的世界规则。**

面向 Codex 等支持 Agent Skills 的工具，用火柴人的操作、试错与发现，将数学、物理或算法概念组织成动作冒险动画。

An instruction-first Agent Skill for turning concepts into stick-figure adventures through interaction, experimentation, and discovery.

[技能入口](SKILL.md) · [设计分析](docs/design-analysis.md) · [场景示例](examples/direction-reversal.yaml) · [参与贡献](CONTRIBUTING.md)

## 当前状态

这是早期的制作方法与规格项目。已包含技能指令、概念规则卡、表演与制作指南，以及一个原创故事规格示例；尚未附带专用渲染引擎或经过成片验证的动画样片。仓库校验只能确认文件结构、引用与示例数据完整，不能证明动画质量或所有知识结论正确。

## 核心方法

角色目标 → 操作对象 → 规则反馈 → 意外或误判 → 理解 → 主动复用。

- **概念机制**：把知识写成可操作的规则，并说明前提和隐喻边界。
- **动作表演**：通过姿态、接触、发力和反应表达角色心理。
- **符号与空间**：区分表达式编辑、求值、等价变形和空间隐喻。
- **制作与验收**：用统一时间线组织画面与声音，同时核验因果、数学与可读性。

适用于概念冒险、无台词叙事、知识关卡和对应的视频制作；普通口播配图或纯公式推导可以采用更简单的流程。

## 在 Codex 中安装

将仓库克隆到用户技能目录：

```sh
mkdir -p "$HOME/.agents/skills"
git clone https://github.com/okeeper/stickman-motion-skill.git \
  "$HOME/.agents/skills/stickman-motion-skill"
```

项目内使用时，也可以克隆到该项目的 `.agents/skills/stickman-motion-skill`。目录已存在时请更新已有安装，避免重复克隆。Codex 会发现技能变化；未显示时重启 Codex。路径及发现规则见 [OpenAI 官方技能文档](https://learn.chatgpt.com/docs/build-skills)。

更新已有安装：

```sh
git -C "$HOME/.agents/skills/stickman-motion-skill" pull --ff-only
```

本项目安装步骤仅下载技能文件。具体制作时，代理按现有环境与任务需要选择动画、排版和音频工具。

## 使用示例

```text
使用 $stickman-motion-skill，把“负数乘法与方向反转”设计成一个 45 秒的
无台词火柴人故事。面向初中生，先交付规则卡、故事节拍和动作分镜。
```

```text
使用 $stickman-motion-skill，分析我提供的视频：提取角色表演、概念交互、
镜头和节奏规则，区分实际观察与实现建议，并标出无法验证的部分。
```

```text
使用 $stickman-motion-skill，根据已经确定的分镜制作 15 秒交互原型。
验证抓取、规则反馈和反应姿态，交付视频、可编辑工程及检查记录。
```

制作请求需要实际可用的渲染和音频能力。技能要求按任务完成制作，并如实报告实际产物与验证范围。

## 文件结构

```text
SKILL.md                         技能指令入口
references/concept-scene-spec.md  规则卡和场景规格
references/production-guidance.md 表演、工程与验证方法
examples/direction-reversal.yaml  原创方向反转故事规格
docs/design-analysis.md           参考作品的设计分析
scripts/validate.py               仓库结构、链接和示例校验
.github/workflows/validate.yml    推送与 PR 自动校验
```

## 本地校验

需要 Python 3.10 或更高版本：

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-dev.txt
python scripts/validate.py
```

校验不调用外部模型，不下载参考视频，也不执行渲染。

## 下一步

- [ ] 完成一个 10–20 秒的接触与规则反馈原型。
- [ ] 用 30–60 秒原创故事验证完整因果回路。
- [ ] 用第二个题材验证方法迁移，并记录问题时间戳。
- [ ] 根据实测结果沉淀角色、符号和时间线的复用模块。

## 参考与许可

设计研究参考 [Alan Becker 的《Animation vs. Math》](https://www.youtube.com/watch?v=B1J6Ou4q8vE)。本项目与原作者无隶属关系；研究重点是叙事与交互机制，新作品应重新设计主题、角色和场景。

本仓库原创文档、规格与代码采用 [MIT License](LICENSE)。参考视频、角色素材、截图、音轨及第三方工具各自遵循其权利和许可证，未随仓库分发，也不在本项目许可范围内。
