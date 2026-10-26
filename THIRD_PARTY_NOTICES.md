# 第三方文件

## DejaVu Sans

- 文件：[DejaVuSans.ttf](assets/fonts/DejaVuSans.ttf)。
- 上游：[DejaVu Fonts](https://dejavu-fonts.github.io/)。
- 来源：本次制作环境中的 Matplotlib 随附 DejaVu Sans 字体；按原文件复制，未改字体内容。
- 许可：见随附的 [LICENSE_DEJAVU](assets/fonts/LICENSE_DEJAVU)，包括 Bitstream Vera 和相关字体许可说明。字体不重新授予 MIT 许可。
- 用途：可复现地排版示例中的英文标签与数学符号，不依赖操作系统默认字体。

三支 demo 的图形、动画代码、合成音乐和音效由本项目制作；没有使用参考视频的画面、截图、角色文件、配乐或音效采样。

## huashu-art-motion

通用工具中的流式文件指纹函数改编自 huashu-art-motion 的 deliver.py，采用 MIT 许可；原始版权及许可保存在 [许可证](licenses/huashu-art-motion-MIT.txt)，固定版本、直接复用范围和结构借鉴见 [复用记录](docs/upstream-reuse.md)。未引入其风格、角色或示范媒体。

## Noto Sans SC

- 文件：[motion-sans.ttf](web/assets/fonts/motion-sans.ttf)，网页与 Canvas 使用的字符子集。
- 来源：Google Fonts CSS API 返回的 Noto Sans SC 字符子集；见 [字体来源说明](web/assets/fonts/README.md)。
- 许可：[SIL Open Font License 1.1](web/assets/fonts/OFL.txt)，字体不重新授予 MIT 许可。Motion Sans 是 CSS 中的本地引用别名。
- 未从 anything2explainer 复制字体；其仓库的工程研究范围及非商业许可边界见 [复用记录](docs/upstream-reuse.md)。

`web/package-lock.json` 与 `motion/package-lock.json` 固定依赖版本，各 npm 包保留其自身许可证；本项目不把依赖重新授予 MIT 许可。Motion Canvas 3.17.2 使用 MIT，LaTeX 组件通过 MathJax 3.2.2（Apache-2.0）生成 SVG。依赖通过 npm 安装，未将其源代码或构建包复制入仓库；分发构建网页时应同时保留所含依赖的许可与通知。新动作视频的场景代码与合成音效由本项目制作。

0.5.0《借势》的图形、动画、程序合成音乐及音效同样为本项目原创，没有纳入参考片媒体。TS 工程引用仓库已有的 DejaVu Sans 排版数学符号；独立工程初始化保留该字体和 Noto Sans SC 的文件与原始许可。

## 动作拟音素材（0.7.0）

《断点》的脚步、碰撞、布料与闸门声音取自 Kenney 的 [Impact Sounds](https://kenney.nl/assets/impact-sounds) 和 [RPG Audio](https://kenney.nl/assets/rpg-audio)，许可 CC0-1.0。原始许可分别保留为 [Impact 许可](motion/public/audio/LICENSE-impact.txt) 与 [RPG 许可](motion/public/audio/LICENSE-rpg.txt)。

[来源清单](motion/public/audio/bank.json) 记录原始素材、来源与参考处理指纹；`scripts/prepare_audio.py` 校验固定来源，处理为本地单声道 48 kHz PCM。WAV、下载包和本地指纹不随 Git 发布。成片使用这些已许可声音；合成气流、呼吸与报警代码由本项目制作。它们不是原参考视频的音轨。
