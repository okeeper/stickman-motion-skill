import { clamp, ease, easeVelocity, lerp, smooth, type Vec } from '../math.js';
import { createMotion, PRESETS } from '../physics.js';
import {
  cameraAt,
  inheritUpperBody,
  reach,
  rigError,
  standing,
  transfer,
  walkAt,
  walkContacts,
  type Walk,
} from '../performance.js';

export const FILM = { title: '借势', width: 1280, height: 720, duration: 28 };
export const TURN = 12,
  TURN_END = 13.4,
  BRAKE = 17.6,
  STOP = 18.4;
const V0 = -0.34,
  V1 = 0.92;
const integral = (u: number) => 2.5 * u ** 4 - 3 * u ** 5 + u ** 6;
/** d is a motor direction setting. It is deliberately distinct from instantaneous velocity. */
export function platformAt(t: number) {
  if (!Number.isFinite(t)) throw new Error('time must be finite');
  const xTurn = 7.9 + V0 * TURN;
  const xTurnEnd = xTurn + ((V0 + V1) * (TURN_END - TURN)) / 2;
  const xBrake = xTurnEnd + V1 * (BRAKE - TURN_END);
  let x: number,
    velocity: number,
    acceleration = 0;
  if (t < TURN) {
    x = 7.9 + V0 * t;
    velocity = V0;
  } else if (t < TURN_END) {
    const dt = t - TURN,
      length = TURN_END - TURN,
      u = dt / length;
    x = xTurn + V0 * dt + (V1 - V0) * length * integral(u);
    velocity = V0 + (V1 - V0) * ease(u);
    acceleration = ((V1 - V0) * easeVelocity(u)) / length;
  } else if (t < BRAKE) {
    x = xTurnEnd + V1 * (t - TURN_END);
    velocity = V1;
  } else if (t < STOP) {
    const dt = t - BRAKE,
      length = STOP - BRAKE,
      u = dt / length;
    x = xBrake + V1 * (dt - length * integral(u));
    velocity = V1 * (1 - ease(u));
    acceleration = (-V1 * easeVelocity(u)) / length;
  } else {
    x = xBrake + (V1 * (STOP - BRAKE)) / 2;
    velocity = 0;
  }
  return { x, velocity, acceleration, direction: t < TURN ? -1 : 1 };
}
export const APPROACH: Walk = { start: 4.4, end: 5.8, from: 1.8, to: 3.2 };
export const DEPART: Walk = { start: 23, end: 26, from: 10.25, to: 11.8 };
const jump = createMotion({ ...PRESETS.heroic, elasticity: 0.12 });
export const BOARD = transfer(jump, 5.8, 3.2, platformAt);
export const EXIT = transfer(jump, 15.4, platformAt, () => ({ x: 10.25, velocity: 0 }));
const cameraKeys = [
  { t: 0, x: 6.3, y: 1.6, width: 13.6 },
  { t: 1.7, x: 6.3, y: 1.6, width: 13.6 },
  { t: 2.8, x: 2.7, y: 1.12, width: 5.8 },
  { t: 4.4, x: 2.7, y: 1.12, width: 5.8 },
  { t: 6.6, x: 5.0, y: 1.75, width: 10.4 },
  { t: 9.8, x: 5.0, y: 1.75, width: 10.4 },
  { t: 11.2, x: platformAt(11.2).x + 0.2, y: 1.1, width: 5.8 },
  { t: 13.4, x: platformAt(13.4).x + 0.2, y: 1.1, width: 5.8 },
  { t: 16.2, x: 8.7, y: 1.7, width: 10.4 },
  { t: 19.6, x: 8.7, y: 1.7, width: 10.4 },
  { t: 21, x: 10.8, y: 1.0, width: 5.8 },
  { t: 23, x: 10.8, y: 1.0, width: 5.8 },
  { t: 26.2, x: 6.5, y: 1.5, width: 13.6 },
  { t: 28, x: 6.5, y: 1.5, width: 13.6 },
];
// A damped upper-body response follows support acceleration; head and shoulders do not move as a rigid icon.
const inertia: { angle: number; velocity: number }[] = [];
let angle = 0,
  angularVelocity = 0;
for (let i = 0; i <= FILM.duration * 480 + 1; i++) {
  const target = -platformAt(i / 480).acceleration * 0.12;
  angularVelocity += (105 * (target - angle) - 15 * angularVelocity) / 480;
  angle += angularVelocity / 480;
  inertia.push({ angle, velocity: angularVelocity });
}
export type CueKind = 'step' | 'grip' | 'takeoff' | 'impact' | 'rule' | 'motor';
export interface Cue {
  t: number;
  kind: CueKind;
  strength: number;
  x: number;
  duration?: number;
}
export const CUES: Cue[] = (
  [
    ...[APPROACH, DEPART].flatMap((w) =>
      walkContacts(w).map((t) => ({ t, kind: 'step' as const, strength: 0.22, x: walkAt(t, w).x })),
    ),
    { t: 3.4, kind: 'grip', strength: 0.45, x: 2.18 },
    { t: TURN, kind: 'rule', strength: 0.8, x: platformAt(TURN).x },
    { t: TURN, kind: 'motor', strength: 0.5, x: platformAt(TURN).x, duration: TURN_END - TURN },
    ...[BOARD, EXIT].flatMap((clip) =>
      clip.motion.events.map((e) => ({
        t: clip.start + e.t,
        kind: e.kind === 'impact' ? ('impact' as const) : ('takeoff' as const),
        strength: Math.min(1, e.speed / 6),
        x:
          e.kind === 'takeoff'
            ? clip === BOARD
              ? 3.2
              : platformAt(clip.takeoff).x
            : clip.destination,
      })),
    ),
  ] satisfies Cue[]
)
  .filter((e) => e.t < FILM.duration)
  .sort((a, b) => a.t - b.t);

export function storyAt(time: number) {
  if (!Number.isFinite(time)) throw new Error('time must be finite');
  const t = clamp(time, 0, FILM.duration),
    platform = platformAt(t);
  let rig;
  let phase = '观察路线';
  if (t < APPROACH.start) {
    rig = standing(t, {
      x: 1.8,
      lean: 0.04 + 0.06 * smooth(t, 2.1, 2.8),
      head: 0.12 + 0.3 * smooth(t, 2.1, 2.8),
    });
    if (t >= 2.8) phase = '拿取方向因子';
  } else if (t < APPROACH.end) {
    rig = standing(t, { x: 1.8, lean: 0.12, walk: APPROACH });
    phase = '接近起跳点';
  } else if (t < 11.4) {
    const frame = BOARD.at(t);
    rig = frame.rig;
    phase = frame.state.phase;
  } else if (t < 15.4) {
    const lag = inertia[Math.min(inertia.length - 1, Math.floor(t * 480))];
    rig = standing(t, {
      x: platform.x,
      crouch: Math.abs(lag.angle) * 0.15,
      lean: 0.04 + lag.angle,
      head: 0.12 + lag.angle * 0.65 - lag.velocity * 0.025,
    });
    phase = t < TURN ? '把因子装入运算槽' : '承受反向后的加速';
  } else if (t < 21) {
    const frame = EXIT.at(t);
    rig = frame.rig;
    phase = frame.state.phase;
  } else {
    const back = smooth(t, 21.2, 21.7) * (1 - smooth(t, 22.1, 22.7));
    rig = standing(t, {
      x: 10.25,
      lean: 0.025,
      head: -0.5 * back,
      crouch: 0.014 * smooth(t, 21, 21.8) * (1 - smooth(t, 22.5, 23)),
      ...(t >= 23 ? { walk: DEPART } : {}),
    });
    phase = t < 23 ? '站稳后回望' : '继续前行';
  }
  if (t >= 4.4 && t < 4.85)
    inheritUpperBody(rig, standing(4.4, { x: 1.8, lean: 0.1, head: 0.42 }), smooth(t, 4.4, 4.85));
  if (t >= 5.8 && t < 6.3)
    inheritUpperBody(
      rig,
      standing(5.8, { x: 3.2, lean: 0.12, walk: APPROACH }),
      smooth(t, 5.8, 6.3),
    );
  if (t >= 11.4 && t < 11.9) inheritUpperBody(rig, BOARD.at(11.4).rig, smooth(t, 11.4, 11.9));
  if (t >= 15.4 && t < 15.9)
    inheritUpperBody(
      rig,
      standing(15.4, { x: platform.x, lean: 0.04, head: 0.12 }),
      smooth(t, 15.4, 15.9),
    );
  if (t >= 21 && t < 21.5) inheritUpperBody(rig, EXIT.at(21).rig, smooth(t, 21, 21.5));
  const initial = { x: 2.18, y: 1.14 },
    slot = { x: platform.x + 0.48, y: 1.12 };
  let token: Vec = initial;
  if (t >= 2.8 && t < 3.4) reach(rig, 1, initial, smooth(t, 2.8, 3.4));
  if (t >= 3.4 && t < TURN) {
    const carry = { x: rig.hip.x + 0.29, y: rig.hip.y + 0.24 };
    const target = lerp(lerp(initial, carry, smooth(t, 3.4, 4.2)), slot, smooth(t, 11.2, TURN));
    token = reach(rig, 1, target);
  } else if (t >= TURN) {
    token = slot;
    if (t < 13.5) reach(rig, 1, slot, 1 - smooth(t, 12.3, 13.5));
  }
  const camera = cameraAt(t, cameraKeys);
  let shake = 0;
  for (const e of CUES)
    if (e.kind === 'impact') {
      const dt = t - e.t;
      if (dt >= 0 && dt < 0.4) shake += Math.sin(dt * 76) * Math.exp(-dt * 14) * 0.018 * e.strength;
    }
  return {
    t,
    rig,
    token,
    slot,
    tokenAttached: t >= 3.4 && t < TURN,
    platform,
    camera: { ...camera, y: camera.y + shake },
    phase,
    maxIK: rigError(rig),
  };
}
