# stickman-motion-skill

让火柴人的行动带观众体验数学、物理和其他知识世界。这个 Agent Skill 提供从故事创作、分镜提示词到可编辑动画工程与本地视频导出的工作流程。

[技能入口](SKILL.md) · [两部参考片分析](docs/concept-film-analysis.md) · [导演与剧本](references/concept-story-directing.md) · [制作运行时](references/autopilot-runtime.md)

## 工作方式

**导演模式**将主题或已有故事发展为角色处境、知识关系、因果事件、声画分镜及按需提供的逐镜视频生成提示词。数学片启发同一对象的关系变化和不同表示，物理片启发由身体行动扩展尺度、再用新视角重看前面事件。

**自动制作模式**使用声明式项目、图层、人物关节关键帧、图形、音效和可选旁白/字幕，进行依赖检查、逐镜渲染、缓存、局部预览、混音和视频导出。剧本、人物动作、图形、音乐和声音需要创作者或 agent 准备；运行时不从一句话自动生成完整故事，也不自动保证真实人体动力学、科学正确性或原片的表演水准。

参考项目为 [stickman-video-director](https://github.com/kaomei/stickman-video-director)，本项目改编其 MIT 许可的自动制作脚本，具体文件与许可见 [复用记录](docs/upstream-reuse.md) 和 [第三方说明](THIRD_PARTY_NOTICES.md)。两部参考片的媒体及抽帧不随项目分发。

## 安装 Skill

```sh
mkdir -p "$HOME/.agents/skills"
git clone https://github.com/okeeper/stickman-motion-skill.git \
  "$HOME/.agents/skills/stickman-motion-skill"
```

技能入口是仓库根部 [SKILL.md](SKILL.md)，名称为 `stickman-motion-skill`。纯文字剧本任务无需安装视频渲染依赖。需要制作视频时，安装 Node.js 20+、FFmpeg/ffprobe，然后在技能目录执行：

```sh
npm ci
node scripts/autopilot.mjs doctor
node scripts/autopilot.mjs init /absolute/path/my-film
```

编辑新项目的 `project.json` 并准备实际素材，再按 [运行时说明](references/autopilot-runtime.md) 检查、预览和导出。模型或第三方服务的访问凭证、计费和内容制作能力独立于本地安装；没有配音或字幕需求时无需设置。

## 调用

```text
使用 $stickman-motion-skill，以【主题】创作一支约【时长】的无台词概念冒险。
先写完整故事，再写动作、知识变化、镜头和声音分镜；说明数学/物理前提。
```

```text
使用 $stickman-motion-skill，将【主题或剧本】制作成可播放视频。
先试做最不确定的动作，再按实际情况制作完整镜头、声音和工程；
交付成片、项目和实际检查记录。
```

## 检查与能力边界

```sh
python scripts/validate.py
npm test
```

`validate.py` 检查技能元数据、仓库内 Markdown 链接和规则卡结构；Node 测试使用合成工程检查运行时、预览、缓存、字幕、混音和失败路径。技术结果不等于数学证明、完整观片、听审或观众理解测试。旧版历史工程仍在仓库中供研究，当前技能入口使用本地自动制作运行时。

## 参考与许可

设计研究参考 Alan Becker 的 [《Animation vs. Math》](https://www.youtube.com/watch?v=B1J6Ou4q8vE) 与 [《Animation vs. Physics》](https://www.youtube.com/watch?v=ErMSHiQRnc8)。本项目与原作者无隶属关系；原创文档与代码采用 [MIT License](LICENSE)，第三方脚本与字体保留其各自许可，见 [第三方说明](THIRD_PARTY_NOTICES.md)。
