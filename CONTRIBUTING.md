# 参与贡献

欢迎提供概念机制、原创分镜、动作样片、渲染实现和已验证的改进。

## 提交内容

请在 Issue 或 Pull Request 中说明具体问题、预期结果、改动与验证方法。动画问题尽量提供时间戳和可公开的复现材料；数学问题需给出定义域、前提及正确推导。

提交样片时说明主题、受众、输入、生成方式和检查结果。区分可运行实现、未经验证的规格和未来计划；避免把样例中的偶然选择变成所有题材的硬性规则。

提交或重写剧本时，按 [电影式主角与因果剧本](references/cinematic-storytelling.md) 核对动机、信息与选择、铺垫回收、动作目的和持续后果。用具体身体行为说明无表情角色的心理，指出明显替代办法为何不可用。文字例稿、动态分镜与已渲染影片分别标注；没有重制媒体时保留旧片规格，不以新文案替换其验证记录。

## 开发检查

按 [README](README.md) 创建开发环境，然后运行：

```sh
python scripts/validate.py
python -m unittest discover -s tests -v
```

动画与音频测试需要 `requirements-render.txt`。改动场景后重新渲染对应成片、GIF 和联系表，并运行 `python scripts/check_demo_media.py --report demos/media-check.json`；同步更新规则卡、分镜与 QA 记录。

修改脚本时，请同时验证正常输入和一个相关失败输入。改动制作方法时，尽可能用真实分镜或样片说明改善，并标明未验证的范围。结构校验无法代替成片审看。

改动 TS 动作工程时，运行 `npm --prefix web ci`、`npm --prefix web run build`、`npm --prefix web test`、`npm --prefix web run test:browser`、`npm --prefix web run test:adventure` 和 `npm --prefix web run format:check`。浏览器配置见 [Web 工程说明](web/README.md)。改动运动模型需覆盖离地/触地边界、骨长、接触、极端参数和任意拖帧；更新对应的实际 MP4、GIF、联系表及 QA，不只提交能编译的动画代码。检查局部导出与声音时，验证原场景时间、裁切处尾音和失败时保留输出。

`SKILL.md` 保留任务入口、关键流程与验收；细节放到 `references/`，可复用的具体示例放到 `examples/`。修改文件位置后同步更新链接。

## 素材与许可

仅提交你有权按本项目 MIT 许可证提供的原创或兼容内容。第三方资料优先提供来源链接；需要纳入第三方文件时，保留来源、许可与必要署名。本地研究媒体、下载元数据、账户信息及机器路径不进入提交。

## 通用工具维护

公共制作工具放在 `scripts/motion_tools/`，命令行参数由 `scripts/motion.py` 路由；题材状态、人物与声音放在 `demo_engine/`。避免给通用模块加入某支影片的颜色、数学内容或质量阈值。

改动时间线、编码或混音时运行 `tests/test_tooling.py` 中的真实 FFmpeg 回归，覆盖混合画幅/帧率、静音片段、变速音高、音轨入点、多段转场、中文软字幕、损坏缓存与失败时的旧文件保留。`doctor` 与依赖缺失属于正常失败路径；CI 必须具备 FFmpeg，不能依靠跳过集成测试宣称通过。

改动 Motion Canvas 工程时，运行 `npm --prefix motion ci`、`npm --prefix motion run build`、`npm --prefix motion test`、`npm --prefix motion run test:browser` 和 `npm --prefix motion run format:check`。修改曲线、公式或求帧适配时核对中间帧、最终 MP4、任意拖帧与局部导出；新增主题说明数学假设。改动共享 `web/scripts/video.mjs` 或 `score.mjs` 时，同时检查原 Canvas 与 Motion Canvas 的实际导出和失败输出保护。

JSON 清单保留 version；改变字段含义时提供版本迁移，更新 references/tooling.md、样例及 CHANGELOG.md。迁移已有独立工程时比较工具目录，保留用户的场景、清单和素材。上游借鉴或复制代码时记录固定版本与许可；风格偏好不能随脚手架一起带入。
