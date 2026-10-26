# 三支探索故事的连续合集

[249.4 秒 / 60 fps 有声合集](edited-showcase.mp4) · [剪辑清单](../../examples/edit-showcase.json) · [片名软字幕](../../examples/edit-showcase.srt) · [实际检查](review/QA.md)

0.9.0 合集使用当前三支完整影片，均按 1× 播放。源片为 75、85、90 秒，两次 0.3 秒淡化各占 18 帧，成片共 **14964 帧 / 249.4 秒，1280×720 / 60 fps**。

| 片段 | 源区间 | 倍速 | 合集起点 |
|---|---|---|---|
| 《别追，等它回来》 | 0–75 秒 | 1× | 0 秒 |
| 《谁在敲门》 | 0–85 秒 | 1× | 74.7 秒 |
| 《世界的侧面》 | 0–90 秒 | 1× | 159.4 秒 |

保留各片接触拟音与音乐，整体降低 1 dB。中文片名封装为可选择的软字幕，在支持字幕的播放器中开启；未叠加讲解配音。

![合集实际编码后的时间码联系表](review/contact-sheet.jpg)

```sh
python scripts/motion.py edit examples/edit-showcase.json --plan
python scripts/motion.py edit examples/edit-showcase.json
python scripts/motion.py inspect demos/tooling/edited-showcase.mp4 --out output/showcase-review
python scripts/motion.py deliver demos/tooling/edited-showcase.mp4 --out output/showcase-delivery
python scripts/motion.py verify output/showcase-delivery
```

交付目录需尚未存在。可重用剪辑、变速、混音、缓存与打包字段见 [工具说明](../../references/tooling.md)。

[实际媒体报告](review/qa.json) 记录时长、帧数、全部音视频解码、音轨峰值和 SHA-256；[缓存检查](cache-check.json) 记录再次剪辑的三段缓存复用及同环境的输出指纹；[验证汇总](validation.json) 记录交付打包检查。没有把机器解码或抽帧标记为完整人工观片、听审。
