import { PRESETS, createMotion } from "../../web/src/physics";
import {
  transfer,
  standing,
  inheritUpperBody,
  rigError,
} from "../../web/src/performance";
import { smooth, distance } from "../../web/src/math";
import { ballisticBezier } from "./geometry";
export const FILM = {
  title: "留下弧线",
  width: 1280,
  height: 720,
  duration: 18,
  fps: 60,
};
export const MOTION = createMotion({ ...PRESETS.heroic, elasticity: 0.12 });
export const JUMP = transfer(MOTION, 1, 1.8, () => ({ x: 4.05, velocity: 0 }));
export const CUES = [
  { t: JUMP.takeoff, kind: "takeoff", strength: 0.8, pan: -0.3, x: 1.8 },
  { t: JUMP.land, kind: "impact", strength: 0.9, pan: 0.25, x: 4.05 },
  { t: 8.2, kind: "rule", strength: 0.35, pan: 0.1, x: 3.1 },
  { t: 11, kind: "rule", strength: 0.4, pan: 0.1, x: 3.1 },
  { t: 13.8, kind: "rule", strength: 0.5, pan: 0.1, x: 3.1 },
];
export function sample(t: number) {
  if (!Number.isFinite(t)) throw new Error("time must be finite");
  const clamped = Math.max(0, Math.min(FILM.duration, t));
  const state = JUMP.at(clamped);
  let rig = state.rig;
  if (clamped > 6.4) {
    const attention = smooth(clamped, 6.4, 7.6);
    rig = standing(clamped, {
      x: 4.05,
      lean: -0.07 * attention,
      head: -0.6 * attention,
      arm: 0.15,
    });
    inheritUpperBody(rig, JUMP.at(6.4).rig, smooth(clamped, 6.4, 7));
  }
  const initial = JUMP.at(JUMP.takeoff).state;
  const seconds = Math.max(
    0,
    Math.min(clamped - JUMP.takeoff, JUMP.land - JUMP.takeoff),
  );
  const arc = ballisticBezier(
    initial.root,
    { x: JUMP.vx, y: MOTION.launch.y },
    MOTION.settings.gravity,
    seconds,
  );
  const endpoint = {
    x: initial.root.x + JUMP.vx * seconds,
    y:
      initial.root.y +
      MOTION.launch.y * seconds -
      (MOTION.settings.gravity * seconds ** 2) / 2,
  };
  return {
    t: clamped,
    rig,
    arc,
    seconds,
    error: rigError(rig),
    traceError:
      clamped >= JUMP.takeoff && clamped <= JUMP.land
        ? distance(endpoint, state.state.root)
        : 0,
    phase:
      clamped < JUMP.takeoff
        ? "蓄力与蹬伸"
        : clamped < JUMP.land
          ? "重力飞行"
          : clamped < 6.4
            ? "卸力与恢复"
            : "回看轨迹与等价变形",
  };
}
