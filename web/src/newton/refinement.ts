/** A second, authored performance for the Newton story. The mathematical state remains in model.ts. */
import {
  sample as base,
  events as baseEvents,
  FILM as BASE,
  STAFF,
  FLIGHTS,
  guideAt,
} from './model.js';
import { smooth, mix, clamp, add } from '../math.js';
import { stand, gesture, blend, pulse } from '../series/acting.js';
import { balance, runClip } from '../series/motion.js';
import { boneError, posePoints } from '../stunt.js';
import type { FoleyCue } from '../foley.mjs';

export const FILM = { ...BASE, title: '怎么又是这里 · 重新探索' };
export { FLIGHTS };
function track(t: number, keys: [number, number][]) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++)
    if (t < keys[i][0])
      return mix(keys[i - 1][1], keys[i][1], smooth(t, keys[i - 1][0], keys[i][0]));
  return keys.at(-1)![1];
}
const entry = runClip('v2-entry', 0, 2.3, -1.3, 0, 1);
/** The fingertip remains on this segment while pulling it. */
export const openingPull = (t: number) => smooth(t, 6.45, 7.85);
export const openingTip = (t: number) => {
  const handx = mix(0.18, 0.52, openingPull(t));
  return t < 6.45
    ? 0.18 + 0.09 * pulse(t, 3.45, 4.05, 0.12)
    : t < 7.85
      ? handx
      : mix(0.52, 3, smooth(t, 8.12, 9.7));
};
function opening(t: number) {
  const crouch = track(t, [
    [0, 0.18],
    [0.7, 0.09],
    [1.5, 0.06],
    [2.1, 0.12],
    [2.8, 0.62],
    [3.25, 0.69],
    [3.9, 0.69],
    [4.4, 0.3],
    [4.85, 0.1],
    [5.35, 0.13],
    [6.25, 0.69],
    [7.9, 0.69],
    [8.3, 0.3],
    [9.25, 0.08],
    [10.9, 0.08],
    [11.8, 0.06],
    [12, 0.06],
  ]);
  const lean = track(t, [
    [0, 0.18],
    [1, -0.12],
    [2.15, 0.12],
    [3.15, 1.1],
    [3.9, 1.1],
    [4.5, -0.45],
    [5.3, -0.05],
    [6.25, 1.35],
    [7.9, 1.35],
    [8.3, -0.28],
    [9.3, 0.14],
    [11.2, 0.12],
    [12, 0],
  ]);
  const head = track(t, [
    [0, -0.3],
    [1.3, -0.1],
    [2.2, -0.55],
    [3.3, -0.65],
    [4.2, -0.25],
    [4.6, 0.5],
    [5.4, -0.55],
    [6.3, -0.65],
    [7.8, -0.65],
    [8.25, 0.5],
    [9.3, 0.6],
    [11, 0.1],
    [12, 0],
  ]);
  const r = stand(t, 0, { floor: 1, crouch, lean, head, breath: 0 });
  const touch = pulse(t, 2.95, 4.08, 0.3) + pulse(t, 5.9, 8.18, 0.3);
  const x = t < 5 ? 0.18 : mix(0.18, 0.52, openingPull(t));
  gesture(r, 1, { x, y: 1 - x / 3 }, clamp(touch));
  gesture(r, 0, add(r.shoulder, { x: -0.23, y: -0.07 }), 0.22 + 0.28 * pulse(t, 4.05, 5.0, 0.2));
  return t < 2.3 ? blend(entry.at(t), r, smooth(t, 2.0, 2.3)) : r;
}
function recognition(t: number) {
  const crouch = track(t, [
    [18.55, 0.06],
    [19.15, 0.58],
    [19.6, 0.65],
    [20, 0.58],
    [20.5, 0.23],
    [20.95, 0.12],
    [21.35, 0.28],
    [21.8, 0.65],
    [22.15, 0.65],
    [22.65, 0.24],
    [23.2, 0.06],
  ]);
  const lean = track(t, [
    [18.55, 0],
    [19.4, 1.02],
    [20.15, 0.8],
    [20.7, -0.18],
    [21.25, 0.15],
    [21.8, 1.02],
    [22.15, 1.02],
    [22.65, 0.18],
    [23.2, 0],
  ]);
  const head = track(t, [
    [18.55, 0],
    [19.5, -0.65],
    [20.1, -0.4],
    [20.6, 0.55],
    [21.3, 0.2],
    [21.8, -0.6],
    [22.4, -0.5],
    [22.9, 0.25],
    [23.2, 0],
  ]);
  const r = stand(t, 0, { floor: 0, crouch, lean, head, breath: 0 });
  const w = pulse(t, 19.15, 20.05, 0.23) + pulse(t, 21.55, 22.3, 0.2);
  gesture(r, 1, { x: 0.1, y: 0.05 }, clamp(w));
  gesture(r, 0, add(r.head, { x: 0.08, y: 0 }), pulse(t, 20.05, 21.0, 0.25));
  return r;
}
function fallCompression(t: number) {
  const at = base(Math.min(t, 26.4 - 1e-8)).rig;
  const posed = balance(at, 0.18 * smooth(t, 26.2, 26.38), 0.25 * smooth(t, 26.2, 26.38), -0.08);
  return blend(at, posed, smooth(t, 26.2, 26.28));
}
export function sample(t: number) {
  const s = base(t);
  let r = s.rig;
  if (t < 12) {
    const custom = opening(t),
      w = 1 - smooth(t, 11.55, 12);
    r = blend(r, custom, w);
  }
  if (t >= 13.75 && t < 15.8) {
    const w = pulse(t, 13.75, 15.8, 0.35);
    const touched = stand(t, s.guide.carrier.x, {
      floor: s.guide.carrier.y,
      crouch: 0.69,
      lean: 1.1,
      head: -0.6,
      breath: 0,
    });
    gesture(touched, 1, { x: s.guide.carrier.x + 0.1, y: s.guide.carrier.y + 0.05 }, 1);
    r = blend(r, touched, w);
  }
  if (t >= 18.55 && t < 23.2) {
    const w = smooth(t, 18.55, 18.85) * (1 - smooth(t, 22.9, 23.2));
    r = blend(r, recognition(t), w);
  }
  if (t >= 26.2 && t < 26.4) r = fallCompression(t);
  if (t >= 26.4 && t < 26.58) r = blend(fallCompression(26.4), r, smooth(t, 26.4, 26.58));
  // Re-test the left branch with two deliberate changes of reach instead of a frozen crouch.
  if (t >= 48.8 && t < 52.9) {
    const shift = 0.13 * pulse(t, 49.5, 51.1, 0.3) - 0.07 * pulse(t, 51.4, 52.8, 0.3);
    const c = 0.09 * pulse(t, 50.4, 51.8, 0.4);
    const acted = balance(r, 0.35 + shift, c, -0.25 + shift);
    r = blend(r, acted, pulse(t, 48.8, 52.9, 0.22));
    const offset = { x: STAFF * Math.cos(s.poleAngle), y: STAFF * Math.sin(s.poleAngle) };
    const retract = 0.16 * pulse(t, 50.8, 51.4, 0.17);
    gesture(r, 1, { x: -6 - offset.x + retract, y: -1 - offset.y - retract * 0.5 }, 1);
    s.poleA = r.arms[1].b;
    s.poleB = add(s.poleA, offset);
  }
  s.rig = r;
  // The fragment is visibly part of the same tangent until takeoff; then falls to the floor.
  if (t >= 24 && t < 26.2) {
    const unit = { x: 3 / Math.sqrt(10), y: -1 / Math.sqrt(10) };
    const center = guideAt(25.15).carrier;
    const start = { x: center.x - 0.45 * unit.x, y: center.y - 0.45 * unit.y };
    const c = guideAt(t).carrier;
    const u = smooth(t, 25.15, 26.2),
      angle = mix(-Math.atan(1 / 3), 0, u);
    s.poleA =
      t < 25.15
        ? { x: c.x - 0.45 * unit.x, y: c.y - 0.45 * unit.y }
        : { x: mix(start.x, 4.38, u), y: mix(start.y, -1.9, u) + 2.25 * u * (1 - u) };
    s.poleB = add(s.poleA, { x: STAFF * Math.cos(angle), y: STAFF * Math.sin(angle) });
  }
  s.reveal = smooth(t, 8.12, 9.7);
  if (t >= 12) s.reveal = 1;
  s.right = t < 12 ? mix(0.06, 1.23, s.reveal) : s.right;
  s.label = smooth(t, 49.1, 49.8);
  s.formula = pulse(t, 52.4, 58, 0.8);
  // Closer staging prioritizes the character; later wide shots still expose the changing graph.
  const zoom = track(t, [
    [0, 0.66],
    [7.8, 0.66],
    [10, 0.82],
    [16, 0.82],
    [23, 0.82],
    [27, 0.82],
    [35, 0.76],
    [45, 0.84],
    [52, 0.84],
    [59, 0.84],
    [68, 0.84],
    [76, 0.82],
    [82, 1],
  ]);
  s.camera.width *= zoom;
  const points = posePoints(r);
  const minimum = Math.max(
    ...points.map((p) =>
      Math.max(Math.abs(p.x - s.camera.x) / 0.455, Math.abs(p.y - s.camera.y) / 0.245),
    ),
  );
  s.camera.width = Math.max(s.camera.width, minimum);
  return { ...s, t, points, boneError: boneError(r) };
}
let cached: FoleyCue[] | undefined;
export function events() {
  if (cached) return cached.map((c) => ({ ...c }));
  const out = [
    ...entry.cues,
    ...baseEvents().filter(
      (c) =>
        !['n-first-hand', 'n-pull', 'n-unfold', 'n-mark', 'n-fall-palm', 'n-fall-body'].includes(
          c.id,
        ),
    ),
  ];
  const cue = (id: string, t: number, kind: string, strength: number, duration?: number) => {
    const s = sample(t);
    out.push({
      id,
      t,
      kind,
      strength,
      duration,
      x: s.rig.hip.x,
      pan: clamp((s.rig.hip.x - s.camera.x) / (s.camera.width / 2), -0.85, 0.85),
    });
  };
  cue('v2-first-touch', 3.45, 'hand', 0.38);
  cue('v2-response', 3.48, 'turn', 0.22, 0.22);
  cue('v2-recoil', 4.25, 'cloth', 0.25, 0.3);
  cue('v2-second-touch', 6.35, 'hand', 0.3);
  cue('v2-pull', 6.45, 'slide', 0.25, 1.4);
  cue('v2-release', 8.12, 'reveal', 0.34, 0.45);
  cue('v2-arrival-touch', 14.35, 'hand', 0.28);
  cue('v2-first-mark-touch', 19.6, 'hand', 0.26);
  cue('v2-mark-again', 21.8, 'knock', 0.4);
  cue('v2-fragment-release', 25.15, 'cloth', 0.35, 0.2);
  cue('v2-fall-palm', 26.5, 'hand', 0.65);
  cue('v2-fall-body', 26.7, 'body', 0.65);
  cue('v2-retest', 51.6, 'hand', 0.23);
  cached = out.sort((a, b) => a.t - b.t);
  return cached.map((c) => ({ ...c }));
}
