# 断点 · 正常速度连续动作与拟音

11 秒，1280×720，60 fps，H.264 / AAC，默认正常速度。人物察觉通道重置后加速，助跑跨越断面；突然翘起的地面边缘让他失衡，伸手保护、收身滚翻，起身继续冲过正在关闭的闸门，制动收步后回看。

![《断点》正常速度动作预览](preview.gif)

[有声 MP4](breakpoint.mp4) · [实际 QA](QA.md) · [关键帧](keyframes.jpg) · [动作与拟音方法](../../references/action-and-foley.md)

走、跑和冲刺有不同步态。最后一步准备约 0.18 秒，腾空约 0.685 秒；跌倒接滚翻约 0.97 秒，起身接跑约 0.36 秒。执行段没有故意放慢，慢放仅用于检查。

46 个声音事件与实际落脚、扶地、支撑变化和环境动作共用时间。脚步、布料与碰撞来自 Kenney CC0 素材，气流、呼吸与报警由程序合成；网页与导出共用 PCM 混音器。腾空不发脚步声。

```sh
npm --prefix motion ci
npm --prefix motion run prepare:audio
npm --prefix motion run dev
# 打开 /action.html，点击播放启用声音
cd motion
npx playwright install chromium
npm run render -- --scene action --fps 60
```

首次素材准备需要联网和 FFmpeg，之后校验复用本地缓存；音效源文件不随 Git 发布。完整 MP4 已包含声音，观看无需准备素材。新工程使用 `python scripts/init_web.py output/my-action --scene action`。

当前覆盖侧视、单人、指定路线的动作与拟音。跌滚采用编排姿态、接触约束和支撑转移，没有实现任意关节碰撞或双人武打。数字重置和闸门属于 `spatial_metaphor` 故事约定，不是数学推导；重力飞行假设 g 恒定且忽略空气阻力。
