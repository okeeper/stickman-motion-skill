import project from "../action-project?project";
import {
  FILM,
  EVENTS,
  TAKEOFF,
  LAND,
  sample,
} from "../../../web/src/action/model";
import { mountPreview } from "../preview";
import { loadAudio } from "./audio";
const cues = EVENTS.map((e) => ({
  ...e,
  pan: Math.max(-0.85, Math.min(0.85, (e.x - sample(e.t).camera) / 3.4)),
}));
await mountPreview({
  project,
  film: FILM,
  sample,
  info: () => ({
    cues,
    engine: "Motion Canvas 3.17.2",
    transfers: [{ takeoff: TAKEOFF, land: LAND }],
  }),
  subtitle: "正常速度 · 走 / 跑 / 跳 / 摔倒 / 翻滚 / 冲刺",
  note: "动作与拟音试片：听到空间重置后加速，跨越断面，地面边缘突然翘起导致失衡，收身翻滚卸力后起跑穿门。默认 1×，声音跟实际落脚与支撑事件；耳机可听出轻重与左右位置。脚步、布料和碰撞使用 Kenney CC0 素材，气流与呼吸层为程序合成。",
  audio: () => loadAudio(FILM.duration, cues),
});
