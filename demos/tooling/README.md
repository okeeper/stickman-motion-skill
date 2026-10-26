# 通用剪辑工具实测：新版三片合集

[52.4 秒 / 60 fps 合集](edited-showcase.mp4) · [剪辑清单](../../examples/edit-showcase.json) · [中文字幕](../../examples/edit-showcase.srt) · [实际检查](review/QA.md)

0.8.0 已将旧剪辑示例同步改为三支 TS 重拍成片，全部按正常速度连续播放。源片分别为 14、18、21 秒；两次 0.3 秒淡化各占 18 帧，最终为 **3144 帧 / 52.4 秒，1280×720 / 60 fps**。

| 片段 | 源区间 | 倍速 | 合集起点 |
|---|---|---|---|
| 《逆向通行》 | 0–14 秒 | 1× | 0 秒 |
| 《最后一扇》 | 0–18 秒 | 1× | 13.7 秒 |
| 《转过死角》 | 0–21 秒 | 1× | 31.4 秒 |

原声降低 1 dB，不另叠与动作不对应的音效。中文 SRT 封装为可选择的软字幕，可在支持字幕的播放器中开启。

![从合集抽取的时间码联系表](review/contact-sheet.jpg)

```sh
python scripts/motion.py edit examples/edit-showcase.json --plan
python scripts/motion.py edit examples/edit-showcase.json
python scripts/motion.py inspect demos/tooling/edited-showcase.mp4 --out output/showcase-review
python scripts/motion.py deliver demos/tooling/edited-showcase.mp4 --out output/showcase-delivery
python scripts/motion.py verify output/showcase-delivery
```

交付目录需尚未存在。具体剪辑、变速、混音和独立工程字段见 [工具说明](../../references/tooling.md)；这些通用能力继续由集成测试覆盖，此合集优先保留正常动作节奏。

实际 MP4 完整解码通过，音轨峰值 −8.343 dBFS；[媒体报告](review/qa.json) 记录 SHA-256 和 16 个采样点。复跑三个标准化片段全部命中缓存，输出指纹保持一致，见 [缓存结果](cache-check.json)；这不保证不同 FFmpeg 版本编码字节相同。交付复制后的 5 个文件通过 verify，见 [汇总](validation.json)。未把完整人工观片或听审标记为完成。
