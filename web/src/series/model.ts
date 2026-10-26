import { add, type Vec } from '../math.js';
import { standing, reach, inheritUpperBody, cameraAt } from '../performance.js';
import { boneError, posePoints } from '../stunt.js';
import type { Rig } from '../rig.js';
import type { FoleyCue } from '../foley.mjs';
import {
  balance,
  clone,
  connect,
  hop,
  mirror,
  runClip,
  still,
  reachBeat,
  smooth,
  mix,
  clamp,
  offsetRig,
  type Support,
} from './motion.js';

export const IDS = ['negative-ride', 'binary-search', 'complex-rotation'] as const;
export type FilmId = (typeof IDS)[number];
const film = (title: string, duration: number) => ({
  title,
  duration,
  width: 1280,
  height: 720,
  fps: 60,
});
export const FILMS = {
  'negative-ride': film('逆向通行', 14),
  'binary-search': film('最后一扇', 18),
  'complex-rotation': film('转过死角', 21),
};
export type Camera = { x: number; y: number; width: number };
export interface State {
  t: number;
  rig: Rig;
  camera: Camera;
  phase: string;
  boneError: number;
  points: Vec[];
  cart?: { x: number; v: number; u: number };
  query?: ReturnType<typeof searchAt>;
  orbit?: ReturnType<typeof orbitAt>;
  cell?: Vec;
  exit: number;
}
const check = (id: FilmId, t: number) => {
  if (!Number.isFinite(t) || t < 0 || t > FILMS[id].duration)
    throw new Error('time must be within the film');
};
const cue = (
  id: string,
  t: number,
  kind: string,
  x: number,
  strength = 0.6,
  duration?: number,
): FoleyCue => ({ id, t, kind, x, strength, duration });

export function cartAt(t: number) {
  const a = 3,
    d = 0.8;
  if (t < a) return { x: 4.4 + 2 * t, v: 2, u: 2 };
  if (t < a + d) {
    const q = (t - a) / d;
    return {
      x: 10.4 + 2 * d * q - 4 * d * (q ** 3 - 0.5 * q ** 4),
      v: 2 - 4 * (3 * q * q - 2 * q ** 3),
      u: -2,
    };
  }
  if (t < 8) return { x: 10.4 - 2 * (t - 3.8), v: -2, u: -2 };
  if (t < 8.8) {
    const q = (t - 8) / 0.8;
    return {
      x: 2 - 1.6 * q + 1.6 * (q ** 3 - 0.5 * q ** 4),
      v: -2 + 2 * (3 * q * q - 2 * q ** 3),
      u: 0,
    };
  }
  return { x: 1.2, v: 0, u: 0 };
}
const carrier: Support = (t) => ({ ...cartAt(t), y: 0.1, vx: cartAt(t).v });
const N_RUN = runClip('n-entry', 0, 1.0, 11, 8.5);
const N_BOARD = hop('n-board', 1.2, still(8.5), carrier, 0.64, -1);
const N_EXIT = hop('n-exit', 8.12, carrier, still(-1.1), 0.66, -1);
const N_ESCAPE = runClip('n-escape', 9.5, 10.9, -1.1, -4.2);
export const NEGATIVE_TRANSFERS = [N_BOARD, N_EXIT].map((h) => ({
  takeoff: h.takeoff,
  land: h.land,
  vx: h.vx,
  vy: h.vy,
}));
function negative(t: number): State {
  const c = cartAt(t);
  let r: Rig, phase: string;
  if (t < 1.2) {
    r = N_RUN.at(t);
    phase = '赶上载台';
  } else if (t < N_BOARD.land + 0.22) {
    r = N_BOARD.at(t);
    phase = '登台承重';
  } else if (t < 8.12) {
    const acc = t > 3 && t < 3.8 ? (-4 * 6 * ((t - 3) / 0.8) * (1 - (t - 3) / 0.8)) / 0.8 : 0,
      duck = smooth(t, 5.95, 6.28) * (1 - smooth(t, 7.35, 7.62)),
      lean = clamp(-acc / 35, -0.18, 0.23) - 0.1 * smooth(t, 3.9, 4.3);
    r = mirror(standing(0, { x: 0 }), c.x, -1, 0.1);
    r = balance(
      r,
      lean,
      0.4 * duck + 0.06 * smooth(t, 2.55, 2.9) * (1 - smooth(t, 3.6, 4.0)),
      -0.28 + 0.45 * duck,
    );
    reachBeat(r, { x: c.x - 0.35, y: 1.12 }, t, 3, 0.15);
    if (duck > 0.01) {
      reach(r, 0, add(r.head, { x: 0.14, y: -0.18 }), duck * 0.8);
      reach(r, 1, add(r.head, { x: 0.2, y: -0.25 }), duck * 0.65);
    }
    phase = t < 3 ? '选择反向' : t < 3.8 ? '制动再反转' : duck > 0.1 ? '伏身过梁' : '穿越断面';
  } else if (t < 9.5) {
    r = N_EXIT.at(t);
    phase = '借速跳离';
  } else {
    r = N_ESCAPE.at(t);
    phase = t < 10.9 ? '离开轨道' : '回看';
    if (t > 11.2) {
      const base = clone(r);
      r = balance(r, -0.02, 0, 0.65 * smooth(t, 11.3, 11.65));
      inheritUpperBody(r, base, 1 - smooth(t, 11.1, 11.4));
    }
  }
  const camera = cameraAt(t, [
    { t: 0, x: 4.2, y: 1.65, width: 21 },
    { t: 0.95, x: 8.5, y: 1.65, width: 10 },
    { t: 2.3, x: 9.9, y: 1.65, width: 9.6 },
    { t: 4.4, x: 8.0, y: 1.65, width: 10.7 },
    { t: 7.4, x: 2.4, y: 1.65, width: 10.7 },
    { t: 10.7, x: -2.3, y: 1.65, width: 9.7 },
    { t: 14, x: -2.3, y: 1.65, width: 9.7 },
  ]);
  return {
    t,
    rig: r,
    camera,
    phase,
    cart: c,
    exit: smooth(t, 9.7, 10.25),
    boneError: boneError(r),
    points: posePoints(r),
  };
}

export const VALUES = [2, 5, 8, 12, 19, 24, 28, 31, 37, 42, 48, 55, 63, 70, 81, 96];
export const TARGET = 63;
export function searchSteps(values: number[], target: number) {
  if (
    !values.length ||
    !Number.isFinite(target) ||
    values.some((v, i) => !Number.isFinite(v) || (i > 0 && v <= values[i - 1]))
  )
    throw new Error('Search requires sorted unique finite values');
  let lo = 0,
    hi = values.length - 1;
  const steps = [];
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2),
      v = values[mid],
      before = [lo, hi];
    if (v < target) lo = mid + 1;
    else if (v > target) hi = mid - 1;
    steps.push({
      index: mid + 1,
      value: v,
      before,
      after: v === target ? [mid, mid] : [lo, hi],
      comparison: v < target ? '<' : v > target ? '>' : '=',
    });
    if (v === target) break;
  }
  return steps;
}
export const QUERIES = searchSteps(VALUES, TARGET).map((s, i) => ({
  ...s,
  t: [2.65, 6.0, 8.6, 10.8][i],
}));
export const doorX = (index: number) => (index - 8) * 0.78;
export function searchAt(t: number) {
  const done = QUERIES.filter((q) => q.t <= t),
    last = done.at(-1),
    range = last?.after ?? [0, 15];
  return {
    queries: done,
    range,
    found: last?.comparison === '=',
    active: done.length < 4 ? QUERIES[done.length].index : 13,
    original: VALUES,
  };
}
const B_RUNS = [
  runClip('b-entry', 0, 1.6, -4.1, doorX(8) - 0.32),
  runClip('b-12', 3.65, 5.35, doorX(8) - 0.32, doorX(12) - 0.32),
  runClip('b-14', 6.9, 7.95, doorX(12) - 0.32, doorX(14) - 0.32),
  runClip('b-13', 9.5, 10.1, doorX(14) - 0.32, doorX(13) - 0.32),
  runClip('b-exit', 14.45, 16.3, doorX(13) - 0.32, 8.2, 2.45),
];
function binary(t: number): State {
  let run = B_RUNS[0];
  for (const b of B_RUNS) if (t >= b.a) run = b;
  let r = run.at(t),
    q = searchAt(t);
  const rise = 2.45 * smooth(t, 12.45, 14.25);
  if (t < 14.45 && t > 10.1) r = offsetRig(r, { x: 0, y: rise });
  for (const query of QUERIES)
    reachBeat(r, { x: doorX(query.index) + 0.04, y: 1.13 }, t, query.t, 0.2);
  // The held key is a target label, never a claim that all hidden values are visible.
  reach(r, 0, add(r.shoulder, { x: 0.18, y: -0.22 }), 0.9 * (1 - smooth(t, 11.7, 12.35)));
  if (t > 11.15 && t < 12.3) reachBeat(r, { x: doorX(13) + 0.08, y: 1.06 }, t, 11.7, 0.15, 0);
  const cell = t < 11.7 ? clone(r).arms[0].b : { x: doorX(13) + 0.08, y: 1.06 + rise };
  const camera = cameraAt(t, [
    { t: 0, x: 0, y: 1.8, width: 14.8 },
    { t: 3.4, x: 1.0, y: 1.8, width: 14.0 },
    { t: 6.5, x: 3.1, y: 1.8, width: 10.5 },
    { t: 9.4, x: 4.0, y: 1.8, width: 8.8 },
    { t: 12.2, x: 4.0, y: 1.8, width: 8.8 },
    { t: 14.4, x: 5.7, y: 3.1, width: 10.5 },
    { t: 18, x: 6.4, y: 3.1, width: 10.5 },
  ]);
  const phase =
    t < 2.65
      ? '按中点查询'
      : t < 10.8
        ? '比较并保留一侧'
        : t < 12.45
          ? '匹配目标'
          : t < 14.45
            ? '登上正确升降台'
            : t < 16.3
              ? '抵达上层'
              : '出口';
  return {
    t,
    rig: r,
    camera,
    query: q,
    cell,
    phase,
    exit: smooth(t, 11.9, 12.3),
    boneError: boneError(r),
    points: posePoints(r),
  };
}

export const TURNS = [
  { a: 2.65, b: 4.65 },
  { a: 5.65, b: 7.65 },
  { a: 9.15, b: 11.15 },
  { a: 12.0, b: 14.0 },
];
export const RADIUS = 1.6;
export function orbitAt(t: number) {
  let theta = 0,
    omega = 0,
    alpha = 0,
    completed = 0,
    turning = false;
  for (const turn of TURNS) {
    if (t >= turn.b) {
      theta += Math.PI / 2;
      completed++;
    } else if (t >= turn.a) {
      const d = turn.b - turn.a,
        u = (t - turn.a) / d;
      theta += (Math.PI / 2) * smooth(t, turn.a, turn.b);
      omega = ((Math.PI / 2) * 30 * u * u * (1 - u) * (1 - u)) / d;
      alpha = ((Math.PI / 2) * 60 * u * (1 - u) * (1 - 2 * u)) / (d * d);
      turning = true;
      break;
    }
  }
  const x = RADIUS * Math.cos(theta),
    y = RADIUS * Math.sin(theta),
    vx = -RADIUS * Math.sin(theta) * omega,
    vy = RADIUS * Math.cos(theta) * omega,
    ax = -RADIUS * (Math.cos(theta) * omega ** 2 + Math.sin(theta) * alpha),
    ay = RADIUS * (-Math.sin(theta) * omega ** 2 + Math.cos(theta) * alpha);
  return {
    x,
    y,
    vx,
    vy,
    ax,
    ay,
    theta,
    completed,
    turning,
    z: ['1', 'i', '−1', '−i', '1'][completed],
  };
}
const orbitSupport: Support = (t) => orbitAt(t);
const C_ENTRY = runClip('c-entry', 0, 1.0, 4.4, 2.5);
const C_BOARD = hop('c-board', 1.2, still(2.5), orbitSupport, 0.61, -1);
const C_EXIT = hop('c-exit', 14.85, orbitSupport, still(2.7), 0.57, 1);
const C_ESCAPE = runClip('c-escape', 15.9, 17.0, 2.7, 4.6);
const C_LEAVE = runClip('c-leave', 17.85, 19.3, 4.6, 6.4);
export const COMPLEX_TRANSFERS = [C_BOARD, C_EXIT].map((h) => ({
  takeoff: h.takeoff,
  land: h.land,
  vx: h.vx,
  vy: h.vy,
}));
function complex(t: number): State {
  const o = orbitAt(t);
  let r: Rig;
  if (t < 1.2) r = C_ENTRY.at(t);
  else if (t < C_BOARD.land + 0.22) r = C_BOARD.at(t);
  else if (t < 14.85) {
    const lean = clamp(-Math.atan2(o.ax, 9.81 + o.ay), -0.38, 0.38),
      compression = (0.045 * Math.max(0, o.ay)) / 9.81;
    r = standing(0, { x: o.x, floor: o.y, lean, head: -0.15, crouch: compression });
    for (const turn of TURNS) reachBeat(r, { x: o.x + 0.38, y: o.y + 1.08 }, t, turn.a, 0.08);
    reachBeat(r, { x: -1.97, y: 1.08 }, t, 8.25, 0.23, 0);
    if (t > 8.55) reach(r, 0, add(r.shoulder, { x: 0.18, y: -0.22 }), smooth(t, 8.55, 8.85));
  } else if (t < 15.9) r = C_EXIT.at(t);
  else r = t < 17.85 ? C_ESCAPE.at(t) : C_LEAVE.at(t);
  if (t >= 8.55 && t < 17.8)
    reach(
      r,
      0,
      add(r.shoulder, { x: 0.18, y: -0.22 }),
      smooth(t, 8.55, 8.85) * (1 - smooth(t, 17.35, 17.8)),
    );
  if (t > 17.0 && t < 17.8) reachBeat(r, { x: 5.03, y: 1.08 }, t, 17.35, 0.12, 0);
  const cell =
    t < 8.25
      ? { x: -1.97, y: 1.08 }
      : t < 8.55
        ? {
            x: mix(-1.97, r.arms[0].b.x, smooth(t, 8.25, 8.55)),
            y: mix(1.08, r.arms[0].b.y, smooth(t, 8.25, 8.55)),
          }
        : t < 17.35
          ? r.arms[0].b
          : { x: 5.03, y: 1.08 };
  const camera = cameraAt(t, [
    { t: 0, x: 1.0, y: 1.15, width: 10.5 },
    { t: 2.5, x: 0.2, y: 0.85, width: 10.2 },
    { t: 5, x: -0.2, y: 0.7, width: 10.2 },
    { t: 9, x: -0.2, y: 0.3, width: 10.2 },
    { t: 12, x: 0.2, y: 0.3, width: 10.2 },
    { t: 14.4, x: 0.8, y: 0.7, width: 10.2 },
    { t: 18, x: 4.0, y: 1.25, width: 9.0 },
    { t: 21, x: 4.0, y: 1.25, width: 9.0 },
  ]);
  return {
    t,
    rig: r,
    camera,
    phase:
      t < 2.65
        ? '寻找电芯'
        : t < 7.65
          ? '沿四分之一圈转移'
          : t < 9.15
            ? '取回电芯'
            : t < 14
              ? '携带返回'
              : t < 17.35
                ? '恢复出口'
                : '离开',
    orbit: o,
    cell,
    exit: smooth(t, 17.35, 17.75),
    boneError: boneError(r),
    points: posePoints(r),
  };
}
export function sample(id: FilmId, t: number): State {
  check(id, t);
  const raw = id === 'negative-ride' ? negative : id === 'binary-search' ? binary : complex;
  const cuts =
    id === 'negative-ride'
      ? [1.2, N_BOARD.land + 0.22, 8.12, 9.5]
      : id === 'binary-search'
        ? [3.65, 6.9, 9.5, 14.45]
        : [1.2, C_BOARD.land + 0.22, 14.85, 15.9, 17.85];
  const state = raw(t),
    cut = cuts.find((a) => t >= a && t < a + 0.18);
  if (cut !== undefined)
    state.rig = connect(state.rig, raw(cut - 1e-7).rig, smooth(t, cut, cut + 0.18));
  state.boneError = boneError(state.rig);
  state.points = posePoints(state.rig);
  if (state.cell) {
    if (id === 'binary-search' && t < 11.7) state.cell = state.rig.arms[0].b;
    if (id === 'complex-rotation' && t >= 8.55 && t < 17.35) state.cell = state.rig.arms[0].b;
  }
  return state;
}
const EVENTS: Record<FilmId, FoleyCue[]> = {
  'negative-ride': [
    ...N_RUN.cues,
    ...N_BOARD.cues,
    ...N_EXIT.cues,
    ...N_ESCAPE.cues,
    cue('n-switch', 3, 'hand', 10.4, 0.48),
    cue('n-latch', 3.05, 'gate', 10.4, 0.25),
    cue('n-brake', 3.1, 'skid', 10.4, 0.35, 0.65),
    cue('n-rail', 2.1, 'whoosh', 8.6, 0.16, 6.2),
    cue('n-limit', 8, 'skid', 2, 0.28, 0.75),
    cue('n-duck', 6.1, 'cloth', 5.8, 0.5),
    cue('n-breath', 7.7, 'breath', 2.6, 0.4),
    cue('n-endgate', 10.2, 'gate', -3.4, 0.55),
  ],
  'binary-search': [
    ...B_RUNS.flatMap((r) => r.cues),
    ...QUERIES.flatMap((q, i) => [
      cue(`b-query-${i}`, q.t, 'hand', doorX(q.index), 0.38),
      cue(`b-latch-${i}`, q.t + 0.13, 'gate', doorX(q.index), 0.2),
    ]),
    cue('b-key', 11.7, 'hand', doorX(13), 0.45),
    cue('b-open', 12.2, 'gate', doorX(13), 0.4),
    cue('b-lift', 12.5, 'whoosh', doorX(13), 0.3, 1.6),
    cue('b-lock', 14.25, 'gate', doorX(13), 0.35),
    cue('b-release', 16.5, 'breath', 8.2, 0.3),
  ],
  'complex-rotation': [
    ...C_ENTRY.cues,
    ...C_BOARD.cues,
    ...C_EXIT.cues,
    ...C_ESCAPE.cues,
    ...C_LEAVE.cues,
    ...TURNS.flatMap((q, i) => [
      cue(`c-touch-${i}`, q.a, 'hand', orbitAt(q.a).x, 0.4),
      cue(`c-start-${i}`, q.a + 0.04, 'gate', orbitAt(q.a).x, 0.18),
      cue(`c-move-${i}`, q.a + 0.1, 'whoosh', orbitAt(q.a + 0.5).x, 0.35, 1.65),
      cue(`c-lock-${i}`, q.b, 'gate', orbitAt(q.b).x, 0.2),
    ]),
    cue('c-pickup', 8.25, 'hand', -1.97, 0.3),
    cue('c-cloth', 9.4, 'cloth', -1.6, 0.35),
    cue('c-power', 17.35, 'gate', 5, 0.45),
    cue('c-breath', 19.6, 'breath', 5.8, 0.3),
  ],
};
export function events(id: FilmId) {
  return EVENTS[id]
    .sort((a, b) => a.t - b.t)
    .map((e) => ({
      ...e,
      pan: clamp(
        (e.x - sample(id, e.t).camera.x) / (sample(id, e.t).camera.width / 2),
        -0.85,
        0.85,
      ),
    }));
}
