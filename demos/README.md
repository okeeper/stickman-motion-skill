# Demo 制作与复现

原三个主题已在 0.8.0 重新设计并用 TypeScript / Motion Canvas 重拍。三支无台词成片共 53 秒，1280×720 / 60 fps，含接触拟音；任务、机制和动作路线各自独立。

| 场景名 | 新故事 | 片长 | 成片 / 规则 |
|---|---|---|---|
| `negative-ride` | 《逆向通行》：登台反向、伏身过梁、借速跳离 | 14 秒 | [MP4](videos/negative-ride.mp4) · [规则卡](../examples/negative-ride.yaml) |
| `binary-search` | 《最后一扇》：四次有依据的查询解锁升降台 | 18 秒 | [MP4](videos/binary-search.mp4) · [规则卡](../examples/binary-search.yaml) |
| `complex-rotation` | 《转过死角》：四次旋转取回电芯并恢复出口 | 21 秒 | [MP4](videos/complex-rotation.mp4) · [规则卡](../examples/complex-rotation.yaml) |

逐段剧本、数学假设和模块位置见 [PRODUCTION](PRODUCTION.md)，实际产物与检查范围见 [QA](QA.md)。规则卡记录手工编排的规格，渲染器不会把任意 YAML 或提示词自动变成动画。

## 复现三支视频

需要 Node.js 22.12+、Python 3.10+、FFmpeg / ffprobe 和 Chromium。先在仓库根目录操作：

```sh
npm --prefix motion ci
npm --prefix motion run prepare:audio
cd motion
npx playwright install chromium
npm run dev
```

在终端显示的地址打开 `/negative-ride.html`、`/binary-search.html`、`/complex-rotation.html`，点击播放启用声音。默认 1×，慢放和拖帧用于检查；根地址是 Motion Canvas 项目选择页。

```sh
# 在 motion/ 中，一条命令顺序重建全部三支 MP4
npm run render:series
# 单支、局部或低成本试做
npm run render -- --scene negative-ride --fps 30 --from 2.7 --to 4 --out ../renders/reversal.mp4
npm run render -- --scene binary-search
npm run render -- --scene complex-rotation
```

正式默认 60 fps、两倍画布缩至 720p，H.264 / yuv420p + 48 kHz 双声道 AAC / faststart。每支同名 JSON 记录声音、区间、编码规格和 SHA-256；单支编码和核验成功后才替换已有 MP4。可通过 `MOTION_BROWSER_EXECUTABLE` 指定已有 Chrome。

首次音效准备需要网络和 FFmpeg，后续复用经校验的本地缓存。仓库发布来源清单、CC0 许可和准备脚本，不发布下载的源素材；已发布 MP4 包含混音，不需要在线加载。

## 检查与生成预览

在仓库根目录建立 Python 环境并安装 `requirements-render.txt`，用于媒体核验与 Pillow 联系表：

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-render.txt
python scripts/validate.py
python scripts/check_demo_media.py --report demos/media-check.json
python scripts/series_previews.py
npm --prefix web test
npm --prefix motion run test:series
```

`series_previews.py` 从**已编码的视频**生成全长 640 px / 16 fps 无声 GIF、720p 封面和带时刻标记的关键帧图。片长或剧情变动后同步更新该脚本的取帧时刻。

## 改编与复用

```sh
python scripts/init_web.py output/my-concept --scene binary-search
npm --prefix output/my-concept/motion ci
npm --prefix output/my-concept/motion run prepare:audio
npm --prefix output/my-concept/motion run dev
```

复制工程保留三种主题、公共动作、声音、字体、锁文件和许可；它不含原参考视频、研究截图或已渲染成片。新任务改 [模型](../web/src/series/model.ts) 和 [场景](../motion/src/scenes/series.tsx)，更新目标、规则、时刻、镜头、音效及检查点。

历史 Python 引擎和测试继续保留。`python scripts/render_demo.py --scene all` 生成旧版 36 秒案例，默认写入 `output/legacy-demos/videos/`，避免覆盖新版。它不读取当前规则卡，不能用于复现 0.8.0。旧动作比较保留历史版本；剪辑示例已按新片段同步重建。
