# 结构参考与复用记录

本轮参考 [huashu-art-motion](https://github.com/alchaincyf/huashu-art-motion) 的工程组织与维护方式，固定研究版本为 [8a0d7d72](https://github.com/alchaincyf/huashu-art-motion/tree/8a0d7d72ca65fcce6f8ba82c4a6c8dfe35b8422c)。参考范围由用户限定为项目结构、维护与脚手架。

| 上游做法 / 文件 | 本项目的落地 |
|---|---|
| SKILL.md 按任务指向对应 references | 在现有技能入口增加“渲染、剪辑、检查、交付”的按需工具入口 |
| scripts/engine 可复制为独立工程 | `motion.py init` 复制本项目的角色、几何、音频、工具与字体，生成可编辑 scene.py |
| engine/render.py 的局部渲染、静帧和帧数约定 | `motion.py render --start/--end/--stills`，按输出帧边界同步截取声音 |
| analyze/breakdown.py 的联系表、时间码与运动线索 | `motion.py inspect` 对实际媒体解码并输出联系表与采样变化记录 |
| deliver.py 的文件指纹和机器生成事实 | `motion.py deliver/verify` 生成交付目录、实际媒体事实及文件 SHA-256 清单 |
| CONTRIBUTING.md 的可复现测试和公共/项目数据分离 | 独立工程保留自己的素材与配置；真实 FFmpeg 集成测试进入 CI；脚本接口按版本维护 |

直接代码复用范围很小：`scripts/motion_tools/common.py` 中 `hash_file` 改编自上游 [scripts/deliver.py 的 sha256](https://github.com/alchaincyf/huashu-art-motion/blob/8a0d7d72ca65fcce6f8ba82c4a6c8dfe35b8422c/scripts/deliver.py)，保留了 [上游 MIT 许可证](../licenses/huashu-art-motion-MIT.txt)。其余工具针对本项目的 Pillow/FFmpeg 工程独立实现，借鉴了职责划分与交付方法，没有整包引入上游引擎。

本项目继续使用自己的火柴人、配色、空间留白与概念交互方式。没有引入上游风格卡、角色图像、配乐、色彩禁用规则、画面填充率要求或“快速运动占比”门禁；技术检查与创作判断分别记录。0.2 的 Python 场景继续保留；0.3 单独增加了下面的 TS 动作研究。

后续复用应记录具体上游版本、文件、许可与本项目改动，先验证接口，再维护回归用例。不要整份同步上游 SKILL.md：上游的视觉偏好与工具依赖不属于本项目的默认约束。

## anything2explainer：0.3 的工程研究

固定研究版本为 [735c79c8](https://github.com/Vincentwei1021/anything2explainer/tree/735c79c8724e897e8971cd59dde7e5aa11e4d6ce)。上游采用 [PolyForm Noncommercial 1.0.0](https://github.com/Vincentwei1021/anything2explainer/blob/735c79c8724e897e8971cd59dde7e5aa11e4d6ce/LICENSE)，不能把它当作 MIT 工具箱整段搬入本项目。本次没有复制该项目的实现、字体或媒体；仅参考高层组织方式。

| 研究的上游文件 | 借鉴的组织方法 | 独立实现 |
|---|---|---|
| `template/package.json`、`template/src/Main.tsx` | TS、场景组合、按绝对帧时间驱动画面 | 采用 TS / Canvas / Vite，拆为 physics、rig、render、main |
| `template/src/common/easing.ts` | 公共运动函数集中维护 | 飞行使用解析重力；落地与上身使用固定步长弹簧；缓动仅用于编排姿态和预备 |
| `template/scripts/render.sh` | 预览和成片共享场景，编码后导出检查资料 | 自有 Playwright 帧接口、流式 FFmpeg 编码、原子输出与参数指纹 |
| `template/scripts/motion_check.py` | 对实际渲染结果做检查 | 复用已有 `motion.py inspect`，另测能量、骨长、接触及浏览器；画面变化率不作为重量感证明 |

新网页的字体来自 Google Fonts 的 Noto Sans SC 子集，保留 SIL OFL 许可；来源与文件见 [第三方说明](../THIRD_PARTY_NOTICES.md)。
