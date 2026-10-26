import project from "./project?project";
import { CUES, FILM, JUMP, sample } from "./model";
import { mountPreview } from "./preview";
await mountPreview({
  project,
  film: FILM,
  sample,
  info: () => ({
    engine: "Motion Canvas 3.17.2",
    cues: CUES,
    transfers: [{ takeoff: JUMP.takeoff, land: JUMP.land, vx: JUMP.vx }],
  }),
  subtitle: "Motion Canvas · 曲线 / 公式 / 重量复用",
  note: "技术试片：人物沿解析重力轨迹运动，曲线记录髋部路径，恢复后回看。公式在恒定重力、无空气阻力的假设下作等价变形，τ > 0。它展示模型的推论，不能用来证明自然界的重力定律。网页静音，MP4 导出含原创合成声。",
});
