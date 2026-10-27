# 参与贡献

欢迎为火柴人概念冒险提供原创剧本、可编辑图形和动作、运行时改进及有证据的评价。先说明用户问题、改动、实际验证范围与未验证项目。

新故事按 [导演与剧本](references/concept-story-directing.md) 写具体角色、行动、知识反馈和后果；按 [知识机制](references/concept-scene-spec.md) 区分表达式编辑、求值、等价改写与空间隐喻，并说明必要的数学或物理假设。文字、分镜、编码成片、正常速度观片、听审和观众理解测试分别记录；技术检查不证明作品的表演或叙事质量。

改动运行时或其 JSON 接口前，读 [运行时说明](references/autopilot-runtime.md)，保持局部预览与未完成后段隔离、素材指纹与缓存有效性、实际输出保护和可选音轨/字幕。新增能力应以可运行的输入和失败案例验证；项目清单不能执行不可信代码或隐式访问远程地址。

```sh
npm ci
python scripts/validate.py
python -m unittest discover -s tests -p test_skill_validation.py -v
node scripts/autopilot.mjs doctor
npm test
```

运行时测试使用 FFmpeg/ffprobe 和本地合成素材；外部图像和语音适配器通过模拟服务测试，不消耗远程额度。改动可执行脚本时检查一个相关失败输入。改变项目 JSON 字段含义时更新版本策略、说明和测试；不要让旧的缓存或报告看起来像新产物。

修改入口时保持根目录 `SKILL.md` 和 `stickman-motion-skill` 名称；任务相关的详细步骤放在 `references/`。仅分发有权使用的原创或兼容素材，并保留第三方来源和许可证。`analysis/`、`skill-design/` 中的参考片、下载、抽帧、签名地址和本地账户信息不进入提交。
