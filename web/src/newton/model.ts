import type { Rig } from '../rig.js';
import type { Vec } from '../math.js';
import type { FoleyCue } from '../foley.mjs';
import { easeVelocity, easeAcceleration } from '../math.js';
import { boneError, posePoints } from '../stunt.js';
import { hop, still } from '../series/motion.js';
import {
  add,
  clamp,
  lerp,
  mix,
  smooth,
  pulse,
  stand,
  gesture,
  gaze,
  seated,
  roll,
  blend,
  runClip,
  offsetRig,
  cameraAt,
} from '../series/acting.js';

export const FILM = { title: '怎么又是这里', duration: 82, width: 1280, height: 720, fps: 60 };
export const SX = 3,
  SY = 0.5,
  FLOOR = -2,
  STAFF = 0.9;
export function f(x: number) {
  return x * x * x - 2 * x + 2;
}
export function df(x: number) {
  return 3 * x * x - 2;
}
export function next(x: number) {
  if (!Number.isFinite(x) || Math.abs(df(x)) < 1e-9)
    throw new Error('Newton step requires finite input and nonzero derivative');
  const out = x - f(x) / df(x);
  if (!Number.isFinite(out)) throw new Error('Non-finite Newton step');
  return out;
}
export function iterate(x: number, n: number) {
  if (!Number.isFinite(x) || !Number.isInteger(n) || n < 0 || n > 100)
    throw new Error('Invalid Newton sequence');
  const out = [x];
  for (let i = 0; i < n; i++) out.push(next(out.at(-1)!));
  return out;
}
export const ROOT_SEQUENCE = iterate(-2, 4),
  ROOT = ROOT_SEQUENCE[3];
export const point = (x: number): Vec => ({ x: SX * x, y: SY * f(x) });
/** Exact cubic Bezier representation of the polynomial, not a sampled polyline. */
export function curveBezier(a: number, b: number) {
  if (![a, b].every(Number.isFinite) || a >= b) throw new Error('Invalid curve interval');
  const h = b - a,
    p0 = point(a),
    p3 = point(b);
  return {
    p0,
    p1: add(p0, { x: (SX * h) / 3, y: (SY * df(a) * h) / 3 }),
    p2: add(p3, { x: (-SX * h) / 3, y: (-SY * df(b) * h) / 3 }),
    p3,
  };
}
interface Step {
  seed: number;
  map: number;
  ride: number;
  end: number;
  first?: boolean;
}
export const STEPS: Step[] = [
  { seed: 0, map: 0, ride: 12, end: 13.5, first: true },
  { seed: 1, map: 16.2, ride: 17.2, end: 18.55 },
  { seed: 0, map: 23.2, ride: 24.2, end: 25.55 },
  { seed: 1, map: 26.4, ride: 27.4, end: 28.75 },
  { seed: 0, map: 29.4, ride: 30.4, end: 31.75 },
];
for (let i = 0; i < 9; i++)
  STEPS.push({ seed: i % 2 ? 0 : 1, map: 32.4 + i * 3, ride: 33.4 + i * 3, end: 34.75 + i * 3 });
const STOP = 58.9,
  COMMIT = 64.9;
export const ROOT_STEPS: Step[] = [
  { seed: -2, map: 65.1, ride: 67.5, end: 68.85 },
  { seed: ROOT_SEQUENCE[1], map: 69.05, ride: 69.7, end: 70.45 },
  { seed: ROOT_SEQUENCE[2], map: 70.7, ride: 71.15, end: 71.7 },
];
function stepAt(q: Step, t: number) {
  const p = point(q.seed),
    n = next(q.seed),
    target = { x: SX * n, y: 0 };
  let carrier: Vec,
    v = { x: 0, y: 0 },
    acc = { x: 0, y: 0 };
  const phase = t < q.ride ? 'map' : t < q.end ? 'ride' : 'hold';
  const a = phase === 'map' ? q.map : q.ride,
    b = phase === 'map' ? Math.min(q.ride, q.map + 1) : q.end;
  const from = phase === 'map' ? { x: SX * q.seed, y: 0 } : p,
    to = phase === 'map' ? p : target;
  if (q.first && t < q.ride) carrier = p;
  else if (phase === 'hold') carrier = target;
  else {
    const u = clamp((t - a) / (b - a)),
      w = smooth(t, a, b);
    carrier = lerp(from, to, w);
    v = {
      x: ((to.x - from.x) * easeVelocity(u)) / (b - a),
      y: ((to.y - from.y) * easeVelocity(u)) / (b - a),
    };
    acc = {
      x: ((to.x - from.x) * easeAcceleration(u)) / (b - a) ** 2,
      y: ((to.y - from.y) * easeAcceleration(u)) / (b - a) ** 2,
    };
  }
  return { seed: q.seed, next: n, p, target, carrier, v, acc, phase, step: q };
}
export function guideAt(t: number) {
  if (!Number.isFinite(t) || t < 0 || t > FILM.duration)
    throw new Error('time must be within Newton film');
  if (t < STOP) {
    let q = STEPS[0];
    for (const s of STEPS) if (t >= s.map) q = s;
    return { ...stepAt(q, t), editing: false };
  }
  if (t < 65.1) {
    const s = stepAt(STEPS.at(-1)!, STOP);
    return {
      ...s,
      carrier: { x: 0, y: 0 },
      v: { x: 0, y: 0 },
      acc: { x: 0, y: 0 },
      phase: 'edit',
      seed: 0,
      next: 1,
      editing: true,
    };
  }
  let q = ROOT_STEPS[0];
  for (const s of ROOT_STEPS) if (t >= s.map) q = s;
  return { ...stepAt(q, t), editing: false };
}
const fromFall = guideAt(25.15).carrier;
const FALL_X = fromFall.x + 2.4;
const escape = hop(
  'newton-escape',
  24.91,
  (t) => {
    const g = guideAt(t);
    return { ...g.carrier, vx: g.v.x };
  },
  still(FALL_X, FLOOR),
  1.05,
  1,
);
const pickupRun = runClip('newton-pickup', 32, 34.1, FALL_X + 0.55, 4.4, FLOOR);
const unfoldRun = runClip('newton-unfold', 38, 46.5, 4.4, -5.7, FLOOR);
const returnRun = runClip('newton-return', 55.4, 58.2, -5.7, -0.6, FLOOR);
const dragRun = runClip('newton-drag', 59.4, 64.5, -0.6, -6.6, FLOOR);
const board = hop('newton-board', 66.2, still(-6.6, FLOOR), still(-6, -1), 0.7, 1);
export const FLIGHTS = [
  { takeoff: escape.takeoff, land: escape.land, vx: escape.vx, vy: escape.vy },
  { takeoff: board.takeoff, land: board.land, vx: board.vx, vy: board.vy },
];
export const CUTS = [
  2.3, 10, 12, 13.5, 16.2, 18.55, 23.2, 24.91, 26.4, 27.7, 32, 34.1, 36.4, 38, 46.5, 53.5, 55.4,
  58.2, 58.9, 59.4, 64.5, 64.9, 66.2, 67.4, 72.3, 77,
];
function crouchAt(t: number, x: number, floor: number, amount = 0.52, lean = 0.7) {
  return stand(t, x, { floor, dir: 1, crouch: amount, lean, head: -0.35, breath: 0 });
}
function rider(t: number) {
  const g = guideAt(t),
    lean = clamp((-g.acc.x / (9.81 + g.acc.y)) * 0.3, -0.52, 0.52);
  const impact = 0.12 * pulse(t, 13.5, 14.2, 0.25) + 0.14 * pulse(t, 18.55, 19.3, 0.22);
  const r = stand(t, g.carrier.x, {
    floor: g.carrier.y,
    lean,
    crouch: 0.06 + impact + 0.11 * clamp(Math.abs(g.acc.x) / 10),
    head: clamp(g.v.x * 0.1, -0.4, 0.4),
    breath: 0,
  });
  gesture(r, 0, add(r.shoulder, { x: -0.27, y: 0.1 }), 0.6);
  gesture(r, 1, add(r.shoulder, { x: 0.3, y: 0.05 }), 0.6);
  return r;
}
function raw(t: number) {
  const guide = guideAt(t);
  let rig: Rig, phase: string;
  if (t < 2.3) {
    rig = stand(t, 0, {
      floor: 1,
      crouch: 0.15 * (1 - smooth(t, 0, 1.5)),
      lean: 0.2 * (1 - smooth(t, 0, 2)),
      head: -0.3,
    });
    gesture(rig, 1, add(rig.arms[0].b, { x: 0.03, y: 0.05 }), pulse(t, 0.1, 2.3, 0.35));
    phase = '撑住，检查手，注意脚边短线';
  } else if (t < 10) {
    const w = pulse(t, 2.3, 9.7, 0.65);
    rig = stand(t, -0.03, {
      floor: 1,
      crouch: 0.66 * w,
      lean: 1.02 * w,
      head: -0.6 * w,
      breath: 0,
    });
    gesture(rig, 1, { x: mix(0.05, 0.36, smooth(t, 5.7, 8.8)), y: 1.04 }, w);
    gesture(rig, 0, { x: -0.17, y: 1.1 }, w * 0.8);
    phase = t < 6 ? '摸到一笔，把短线拉长' : '沿这条线看见新的落点';
  } else if (t < 24.91) {
    rig = rider(t);
    if (t < 12) gaze(rig, 0.55, pulse(t, 10, 12));
    if (t > 18.55 && t < 23.2) {
      const w = pulse(t, 19, 23.15, 0.45);
      rig = stand(t, 0, { floor: 0, crouch: 0.66 * w, lean: 1.02 * w, head: -0.5 * w, breath: 0 });
      gesture(rig, 1, { x: 0.1, y: 0.05 }, w);
      gesture(rig, 0, add(rig.head, { x: 0.08, y: 0 }), pulse(t, 19, 20.5));
    }
    phase =
      t < 13.5
        ? '第一次借切线滑过去'
        : t < 16.2
          ? '站稳，以为找到了向导'
          : t < 18.55
            ? '向导主动取下一条切线，带回去'
            : '认出同一条刻痕，按住起点时它停了一下';
  } else if (t < 26.4) {
    rig = escape.at(t);
    phase = '借移动速度起跳，切线收回，落向下方';
  } else if (t < 27.7) {
    rig = offsetRig(roll(t, 26.4, 27.7, FALL_X + 0.08, FALL_X + 0.55, 1), { x: 0, y: FLOOR });
    phase = '扶地，护头，滚开卸力';
  } else if (t < 32) {
    rig = blend(
      seated(t, FALL_X + 0.55, 1, FLOOR),
      stand(t, FALL_X + 0.55, { floor: FLOOR, dir: -1, head: -0.65 }),
      smooth(t, 29, 31.8),
    );
    gesture(rig, 1, add(rig.arms[0].b, { x: 0.03, y: 0.04 }), pulse(t, 28.3, 30));
    phase = '揉手腕，看它离开自己仍在循环';
  } else if (t < 34.1) {
    rig = pickupRun.at(t);
    phase = '跑向掉下的短线';
  } else if (t < 38) {
    const w = pulse(t, 34.1, 37, 0.4);
    rig = crouchAt(t, 4.4, FLOOR, 0.66 * w, 1.02 * w);
    gesture(rig, 1, { x: 4.38, y: FLOOR + 0.1 }, pulse(t, 34.3, 36.3, 0.5));
    phase = '捡起刚才扯下的一段，用它够住轴的末端';
  } else if (t < 46.5) {
    rig = unfoldRun.at(t);
    phase = '拖着轴向左走，曲线从同一坐标展开';
  } else if (t < 55.4) {
    const w = pulse(t, 47.3, 54.6, 0.6);
    rig = stand(t, -5.7, {
      floor: FLOOR,
      dir: -1,
      crouch: 0.64 * w,
      lean: 0.35 * w,
      head: -0.2 + 0.7 * pulse(t, 52, 55),
      breath: 0,
    });
    phase = '沿曲线试一次切线，看见左边还有一个过零位置';
  } else if (t < 58.2) {
    rig = returnRun.at(t);
    phase = '带着刚才的发现跑回正在循环的起点';
  } else if (t < 59.4) {
    rig = stand(t, -0.6, {
      floor: FLOOR,
      lean: 0.12,
      crouch: 0.12 * pulse(t, 58.2, 59.1, 0.15),
      head: 0.5,
      breath: 0,
    });
    phase = '避开导线的摆动，钩住刚到零的输入点';
  } else if (t < 64.5) {
    rig = dragRun.at(t);
    phase = '按住输入，拖到另一支曲线附近；编辑中不求值';
  } else if (t < 66.2) {
    rig = stand(t, -6.6, { floor: FLOOR, head: 0.5 });
    phase = '放开起点，看它在新位置重新生成切线';
  } else if (t < 67.4) {
    rig = board.at(t);
    phase = '短蓄力，跳上这次主动选择的支撑';
  } else if (t < 72.3) {
    rig = rider(t);
    phase = '上升，收步，切线越来越短；没有再次返回右侧';
  } else if (t < 77) {
    const g = guide.carrier,
      w = pulse(t, 72.3, 77, 0.6);
    rig = stand(t, g.x + 0.04, {
      floor: g.y,
      crouch: 0.66 * w,
      lean: 1.02 * w,
      head: -0.6 * w,
      breath: 0,
    });
    gesture(rig, 1, { x: g.x + 0.12, y: g.y + 0.07 }, w);
    gesture(rig, 0, { x: g.x - 0.18, y: g.y + 0.15 }, w * 0.8);
    phase = '把短线还回去，再轻轻碰一次同一个点';
  } else {
    rig = rider(t);
    gaze(rig, -0.35, pulse(t, 77, 79.5, 0.5));
    phase = '这次不再防备；曲线仍向画外延伸';
  }
  const polePicked = smooth(t, 35.0, 36.4),
    returned = smooth(t, 74.7, 75.3);
  let poleAngle = mix(0, 1.95, smooth(t, 35, 38.2));
  if (t >= 55.4) poleAngle = mix(1.95, 1.22, smooth(t, 55.4, 56));
  if (t >= 46.5 && t < 55.4) poleAngle = 1.95;
  if (t >= 72.3) poleAngle = mix(1.22, Math.atan2(SY * df(ROOT), SX), smooth(t, 72.3, 75.7));
  let cursor = { x: 0, y: 0 };
  if (t >= 59.4 && t < 64.5) cursor = { x: rig.hip.x + 0.6, y: 0 };
  else if (t >= 64.5) cursor = { x: -6, y: 0 };
  const probe = pulse(t, 48.2, 53.5, 0.6);
  const axisWeight = smooth(t, 37.3, 38.3) * (1 - smooth(t, 46.5, 47.1));
  const bound = t >= 58.65 && t < 64.9;
  const offset = { x: STAFF * Math.cos(poleAngle), y: STAFF * Math.sin(poleAngle) };
  if (t >= 36.4 && t < 55.4) {
    const target = lerp(
      add(rig.shoulder, { x: 0.18, y: -0.1 }),
      { x: -6 - offset.x, y: -1 - offset.y },
      probe,
    );
    gesture(rig, 1, target, 1);
  }
  if (axisWeight > 0) gesture(rig, 1, { x: rig.hip.x - 0.3 - offset.x, y: -offset.y }, axisWeight);
  if (t >= 55.4 && t < 64.9) {
    const w = t < 58.65 ? smooth(t, 58.2, 58.65) : 1;
    gesture(rig, 1, { x: cursor.x - offset.x, y: -offset.y }, w, bound);
  }
  let camera = cameraAt(t, [
    { t: 0, x: 0.5, y: 1.95, width: 7.2 },
    { t: 9, x: 1.1, y: 1.45, width: 9 },
    { t: 12, x: 1.5, y: 1.25, width: 10 },
    { t: 18.55, x: 1.25, y: 1.2, width: 10 },
    { t: 23.2, x: 1.5, y: 1.2, width: 10.5 },
    { t: 26.2, x: 3.2, y: 0.2, width: 12 },
    { t: 32, x: 3.1, y: 0.05, width: 12 },
    { t: 38, x: 3.1, y: 0.05, width: 12 },
    { t: 46.5, x: -1.5, y: 0.15, width: 16.5 },
    { t: 53, x: -4.6, y: 0.1, width: 11.5 },
    { t: 58.2, x: 0.65, y: 0.1, width: 11.8 },
    { t: 64.5, x: -4.3, y: 0.2, width: 12.5 },
    { t: 68.9, x: -5.1, y: 0.3, width: 10.5 },
    { t: 73, x: -5.15, y: 0.65, width: 9.4 },
    { t: 78, x: -5.1, y: 0.7, width: 9.4 },
    { t: 82, x: -1.6, y: 0.5, width: 16.5 },
  ]);
  return {
    rig,
    phase,
    camera,
    guide,
    cursor,
    poleAngle,
    polePicked,
    poleReturned: returned,
    probe,
    staffBound: bound,
    reveal: smooth(t, 5.7, 10),
    left:
      t < 38
        ? -0.12
        : t < 46.5
          ? Math.min(-0.12, (rig.hip.x - 0.3) / SX)
          : mix(-2, -2.28, smooth(t, 46.5, 47.5)),
    right: mix(0.16, 1.23, smooth(t, 5.7, 11)),
    label: smooth(t, 45.5, 48),
    formula: pulse(t, 51.5, 58, 0.8),
    final: smooth(t, 76.5, 78),
    scratch: smooth(t, 0.3, 1.2),
  };
}
export function sample(t: number) {
  if (!Number.isFinite(t) || t < 0 || t > FILM.duration)
    throw new Error('time must be within Newton film');
  const s = raw(t),
    cut = [...CUTS].reverse().find((a) => t >= a && t < a + 0.18);
  if (cut !== undefined) {
    const actual = s.rig,
      pre = raw(cut - 1e-7);
    s.rig = blend(pre.rig, s.rig, smooth(t, cut, cut + 0.18));
    if (FLIGHTS.some((h) => t >= h.takeoff && t < h.land))
      s.rig = offsetRig(s.rig, { x: actual.hip.x - s.rig.hip.x, y: actual.hip.y - s.rig.hip.y });
  }
  const offset = { x: STAFF * Math.cos(s.poleAngle), y: STAFF * Math.sin(s.poleAngle) };
  if (s.staffBound) gesture(s.rig, 1, { x: s.cursor.x - offset.x, y: -offset.y }, 1, true);
  if (t >= 38.3 && t < 46.5)
    gesture(s.rig, 1, { x: s.rig.hip.x - 0.3 - offset.x, y: -offset.y }, 1);
  const held = s.rig.arms[1].b;
  const u = clamp((t - 25.15) / 1.05),
    start = guideAt(25.15).carrier;
  const loose = { x: mix(start.x, 4.38, u), y: mix(start.y, FLOOR + 0.1, u) + 2.25 * u * (1 - u) };
  const a = lerp(loose, held, s.polePicked);
  const phi = Math.atan2(SY * df(ROOT), SX);
  const returnedA = { x: SX * ROOT + 0.12, y: SY * f(ROOT) + (0.12 * SY * df(ROOT)) / SX };
  const poleA = lerp(a, returnedA, s.poleReturned);
  const theta = mix(s.poleAngle, phi, s.poleReturned);
  const poleB = add(poleA, { x: STAFF * Math.cos(theta), y: STAFF * Math.sin(theta) });
  const points = posePoints(s.rig),
    minimum = Math.max(
      ...points.map((p) =>
        Math.max(Math.abs(p.x - s.camera.x) / 0.455, Math.abs(p.y - s.camera.y) / 0.245),
      ),
    );
  s.camera.width = Math.max(s.camera.width, minimum);
  return { ...s, t, poleA, poleB, points, boneError: boneError(s.rig) };
}
export type State = ReturnType<typeof sample>;
let cached: FoleyCue[] | undefined;
export function events() {
  if (cached) return cached.map((x) => ({ ...x }));
  const out: FoleyCue[] = [
    ...escape.cues,
    ...board.cues,
    ...pickupRun.cues,
    ...unfoldRun.cues,
    ...returnRun.cues,
    ...dragRun.cues,
  ];
  const cue = (id: string, t: number, kind: string, strength = 0.5, duration?: number) =>
    out.push({ id, t, kind, strength, duration, x: sample(t).rig.hip.x });
  cue('n-first-scrape', 0.55, 'shoe-grip', 0.4);
  cue('n-first-hand', 3.7, 'hand', 0.25);
  cue('n-pull', 6.3, 'slide', 0.18, 0.7);
  cue('n-unfold', 8, 'reveal', 0.2, 0.5);
  for (const [i, q] of [...STEPS, ...ROOT_STEPS].entries()) {
    if (q.map >= STOP && q.map < 65) continue;
    if (!q.first) cue(`n-lift-${i}`, q.map, 'turn', 0.23, Math.min(1, q.ride - q.map));
    cue(`n-rail-${i}`, q.ride, 'slide', 0.22, q.end - q.ride);
    cue(`n-click-${i}`, q.end, 'latch', 0.28);
    if (q.end < 24 || q.map >= 65) cue(`n-stop-${i}`, q.end + 0.035, 'footstep', 0.4);
  }
  cue('n-recognize', 19.7, 'breath', 0.4, 0.4);
  cue('n-mark', 21.8, 'knock', 0.45);
  cue('n-push-back', 24.6, 'cloth', 0.65, 0.45);
  cue('n-fall-palm', 26.45, 'hand', 0.65);
  cue('n-fall-body', 26.65, 'body', 0.65);
  cue('n-roll-cloth', 26.8, 'cloth', 0.6, 0.6);
  cue('n-recover', 28, 'breath', 0.6, 0.5);
  cue('n-pick-piece', 35.1, 'hand', 0.3);
  cue('n-hook-axis', 37.8, 'latch', 0.3);
  cue('n-space-unroll', 40, 'slide', 0.18, 5);
  cue('n-left-branch', 47.8, 'reveal', 0.2, 0.5);
  cue('n-probe', 49.5, 'hand', 0.3);
  cue('n-small-answer', 51, 'reveal', 0.2, 0.3);
  cue('n-catch-seed', STOP, 'hand', 0.5);
  cue('n-pause-seed', STOP + 0.03, 'latch', 0.35);
  cue('n-drag-setting', 60, 'slide', 0.16, 4.5);
  cue('n-commit', COMMIT, 'latch', 0.45);
  cue('n-final-restore', 74.7, 'hand', 0.25);
  cue('n-final-touch', 76, 'knock', 0.18);
  cue('n-relax', 77.3, 'breath', 0.35, 0.65);
  const sections = [
    [1, 9, 1.3, 0.2],
    [13.7, 16.1, 0.7, 0.17],
    [17, 23, 0.55, 0.16],
    [24, 27, 0.32, 0.23],
    [34, 46, 0.8, 0.2],
    [48, 54, 1.1, 0.16],
    [55.4, 58.9, 0.35, 0.22],
    [60, 64, 0.7, 0.17],
    [67, 72, 0.42, 0.2],
    [76.8, 81.3, 1.2, 0.17],
  ];
  const notes = [146.832, 220, 174.614, 293.665, 261.626, 196, 164.814, 220];
  for (const [j, [a, b, beat, strength]] of sections.entries())
    for (let t = a, i = 0; t < b; t += beat, i++)
      out.push({
        id: `n-music-${j}-${i}`,
        t,
        kind: 'music',
        x: 0,
        pan: 0,
        note: notes[(i + j) % notes.length],
        strength,
        duration: Math.min(1.5, beat * 1.4),
      });
  cached = out
    .filter((c) => c.t < FILM.duration)
    .sort((a, b) => a.t - b.t)
    .map((c) => ({
      ...c,
      pan:
        c.pan ?? clamp((c.x - sample(c.t).camera.x) / (sample(c.t).camera.width / 2), -0.85, 0.85),
    }));
  return cached.map((x) => ({ ...x }));
}
