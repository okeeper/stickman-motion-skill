import type { Rig } from '../rig.js';
import type { FoleyCue } from '../foley.mjs';
import { hop, still } from './motion.js';
import {
  H,
  add,
  clamp,
  mix,
  smooth,
  lerp,
  rotate,
  stand,
  gesture,
  freePose,
  planted,
  hang,
  seated,
  blend,
  runClip,
  cameraAt,
  event,
  pulse,
  inheritFreeLegs,
  gaze,
  twoBone,
  foot,
} from './acting.js';

export const RADIUS = 2.4 * H;
export const LEDGE = { x: RADIUS + 0.2 * H, y: -0.7 * H };
export const TURNS = [
  { a: 12.6, b: 13.9 },
  { a: 31.2, b: 32.5 },
  { a: 54.7, b: 56 },
  { a: 73, b: 74.3 },
];
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
    vx = -y * omega,
    vy = x * omega,
    ax = -x * omega ** 2 - y * alpha,
    ay = -y * omega ** 2 + x * alpha;
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
const xHome = LEDGE.x + 0.25;
const entry = runClip('c-approach', 0.8, 3.2, LEDGE.x + 1.1, xHome, LEDGE.y);
const run = runClip('c-run-bar', 75.9, 77.2, 0.25, RADIUS - 0.16, 0);
const exit = hop(
  'c-home',
  77.2,
  () => ({ x: RADIUS - 0.16, y: 0, vx: 1.4 }),
  still(LEDGE.x + 0.28, LEDGE.y),
  0.52,
  1,
);
export const COMPLEX_TRANSFERS = [
  { takeoff: exit.takeoff, land: exit.land, vx: exit.vx, vy: exit.vy },
];
function initial(t: number) {
  const r = stand(t, xHome, { floor: LEDGE.y, dir: -1, lean: 0.18, crouch: 0.06, head: -0.4 });
  gesture(r, 1, { x: RADIUS, y: 0.015 }, pulse(t, 4.2, 13.4, 0.4));
  gesture(r, 0, { x: RADIUS + 0.025, y: 0.035 }, pulse(t, 8.1, 13.4, 0.35));
  return r;
}
export function climbGrips(t: number) {
  const n = 12,
    step = (RADIUS - 0.55) / n,
    d = 10 / n;
  const radii = [RADIUS - 0.08, RADIUS + 0.08];
  for (let i = 0; i < n; i++) {
    const a = 39 + i * d,
      b = a + 0.64 * d,
      u = smooth(t, a, b);
    radii[i % 2] = mix(radii[i % 2], RADIUS - (i + 1) * step, u);
    if (t < b) break;
  }
  return radii.map((r) => ({ x: -r, y: 0 }));
}
function hanging(t: number) {
  const o = orbitAt(t);
  const radial = t < 39 ? RADIUS : t < 49 ? mix(RADIUS, 0.55, smooth(t, 39, 49)) : 0.55;
  let anchor = rotate({ x: radial, y: 0 }, o.theta);
  let r = hang(anchor, t, clamp(-o.ax * 0.015, -0.35, 0.35), 0.24 + 0.15 * pulse(t, 54.3, 57));
  if (t < 13.4) {
    const w = smooth(t, 12.6, 13.4),
      swing = mix(1.78, 0, w),
      lean = mix(-0.25, clamp(-o.ax * 0.015, -0.35, 0.35), w);
    const shoulder = add(anchor, {
      x: 0.45 * Math.sin(swing) - 0.18 * Math.sin(lean) * w,
      y: -mix(0.45, 0.43, w) * Math.cos(swing),
    });
    const hip = add(shoulder, { x: -0.43 * Math.sin(lean), y: -0.43 * Math.cos(lean) });
    r = freePose(
      hip,
      lean,
      mix(-0.3, -lean * 0.5 + 0.03 * Math.sin(t * 2), w),
      [
        [mix(0.4, 0.54, w), mix(-0.5, -0.74, w), mix(0, 0.12, w)],
        [mix(-0.4, -0.54, w), mix(0.6, 0.79, w), mix(-0.4, -0.22, w)],
      ],
      [
        [Math.PI, Math.PI],
        [Math.PI, Math.PI],
      ],
    );
    for (const i of [0, 1] as const)
      gesture(r, i, { x: anchor.x + mix(i ? 0.03 : 0, i ? 0.08 : -0.08, w), y: anchor.y }, 1, true);
    inheritFreeLegs(r, initial(12.6), smooth(t, 12.6, 12.95));
  }
  if (t >= 39 && t < 49.5) {
    const grips = climbGrips(Math.min(t, 49));
    anchor = { x: (grips[0].x + grips[1].x) / 2, y: 0 };
    r = hang(anchor, t, 0.08, 0.48);
    for (const i of [0, 1] as const) gesture(r, i, grips[i], 1, true);
  }
  if (t >= 49.5 && t < 54.7)
    r = blend(hang({ x: -0.55, y: 0 }, t, -0.04, 0.5), r, smooth(t, 53.8, 54.7));
  if (t > 16 && t < 27) {
    const wrap = pulse(t, 17, 27, 0.6);
    const target = { x: 0.1555634919, y: r.hip.y - 0.5 };
    const old = r.legs[1],
      angle = Math.atan2(r.feet[1].toe.y - r.feet[1].ankle.y, r.feet[1].toe.x - r.feet[1].ankle.x),
      cross =
        (old.b.x - old.a.x) * (old.hinge.y - old.a.y) -
        (old.b.y - old.a.y) * (old.hinge.x - old.a.x);
    const f = foot(lerp(r.feet[1].ankle, target, wrap), mix(angle, Math.PI - 0.34, wrap), false);
    const ik = twoBone(r.hip, f.ankle, 0.45, 0.45, cross < 0 ? -1 : 1);
    r.feet[1] = f;
    r.legs[1] = { a: r.hip, hinge: ik.joint, b: ik.end, error: ik.error };
    gaze(r, 0.95, pulse(t, 19, 23, 0.4));
    const handW = pulse(t, 24, 26.5, 0.35);
    gesture(r, 1, add(anchor, { x: 0.07, y: 0.08 }), handW, true);
  }
  if (t > 33.7 && t < 37.8) gaze(r, 0.8, pulse(t, 34, 37.5));
  const detach = Math.max(
    pulse(t, 29.8, 31.15, 0.2),
    pulse(t, 53.6, 54.65, 0.2),
    pulse(t, 71.8, 72.95, 0.2),
  );
  if (detach > 0) gesture(r, 1, add(anchor, { x: 0.04, y: 0.1 * detach }), detach, true);
  return { r, anchor };
}
export function complexRaw(t: number) {
  const orbit = orbitAt(t);
  let rig: Rig, phase: string;
  if (t < 0.8) {
    rig = stand(t, LEDGE.x + 1.1, { floor: LEDGE.y, dir: -1, head: -0.3 });
    phase = '近处只有白杆的一端';
  } else if (t < 3.2) {
    rig = entry.at(t);
    phase = '靠近触摸';
  } else if (t < 12.6) {
    rig = initial(t);
    phase = t < 8 ? '轻触，确认能承重' : '掀开夹片，查看i';
  } else if (t < 74.3) {
    rig = hanging(t).r;
    phase =
      t < 13.9
        ? '意外离地，本能抓紧'
        : t < 28
          ? '高处找支撑，观察原落脚处'
          : t < 31.2
            ? '确认夹片与结果，主动再试'
            : t < 32.5
              ? '有准备地转向左侧'
              : t < 39
                ? '确认同一支点和九十度'
                : t < 49.5
                  ? '带着夹片，交替换手内移'
                  : t < 54.7
                    ? '收紧身体，准备第三次'
                    : t < 56
                      ? '近支点抱紧，转到下方'
                      : t < 66
                        ? '恢复呼吸，看三段轨迹'
                        : t < 73
                          ? '看起点，换握，准备回程'
                          : '第四次转回右侧';
  } else if (t < 75.4) {
    const start = hang({ x: 0.55, y: 0 }, 74.3, 0, 0.4);
    const mid = freePose(
      { x: 0.35, y: -0.15 },
      1.15,
      0.7,
      [
        [2.2, -2.8, 0.5],
        [2.5, -2.1, 0.3],
      ],
      [
        [1, 2],
        [1, 2],
      ],
    );
    const end = planted({ x: -0.08, y: 0.265 }, 1.15, 0.25, stand(t, 0.25).feet);
    rig =
      t < 74.85
        ? blend(start, mid, smooth(t, 74.3, 74.85))
        : blend(mid, end, smooth(t, 74.85, 75.4));
    for (const i of [0, 1] as const)
      gesture(rig, i, { x: 0.55 + (i ? 0.06 : -0.06), y: 0 }, 1, true);
    phase = '借摆动翻身上杆';
  } else if (t < 75.9) {
    const w = smooth(t, 75.4, 75.9);
    rig = planted(
      { x: mix(-0.08, 0.25, w), y: mix(0.265, 0.9, w) },
      1.15 * (1 - w),
      0.25,
      stand(t, 0.25).feet,
    );
    phase = '脚接住重量，释放双手';
  } else if (t < 77.2) {
    rig = run.at(t);
    phase = '沿杆接跑';
  } else if (t < exit.land + 0.3) {
    rig = exit.at(t);
    phase = '跨过间隙，落回原处';
  } else if (t < 83) {
    const a = stand(t, LEDGE.x + 0.28, { floor: LEDGE.y, crouch: 0.12, lean: 0.1 });
    rig = blend(a, seated(t, LEDGE.x + 0.28, 1, LEDGE.y), smooth(t, 79, 80));
    gesture(rig, 1, add(rig.arms[0].b, { x: 0.05, y: 0.05 }), pulse(t, 80, 82.7));
    phase = '坐低喘息，舒展手指';
  } else {
    rig = blend(
      seated(t, LEDGE.x + 0.28, 1, LEDGE.y),
      stand(t, LEDGE.x + 0.28, { floor: LEDGE.y, dir: -1, head: -0.6 }),
      smooth(t, 83, 85),
    );
    gesture(rig, 1, { x: RADIUS, y: 0 }, pulse(t, 86, 90, 0.5));
    phase = '看见完整圆，再次主动张望';
  }
  const carried = pulse(t, 38.4, 50.1, 0.25);
  const clipPoint =
    carried > 0
      ? add(rig.arms[1].b, { x: 0.025, y: 0.035 })
      : rotate({ x: t < 39 ? RADIUS : 0.55, y: 0 }, orbit.theta);
  const detach = Math.max(
    pulse(t, 11.4, 12.55, 0.2),
    pulse(t, 29.8, 31.15, 0.2),
    pulse(t, 53.6, 54.65, 0.2),
    pulse(t, 71.8, 72.95, 0.2),
  );
  const clip = {
    x: mix(clipPoint.x, rig.arms[1].b.x, detach),
    y: mix(clipPoint.y, rig.arms[1].b.y + 0.02, detach),
    open: smooth(t, 8.3, 10),
    held: carried,
    detach,
  };
  const camera = cameraAt(t, [
    { t: 0, x: 4.25, y: -0.25, width: 8.5 },
    { t: 8, x: 4.2, y: -0.15, width: 7.8 },
    { t: 12.6, x: 2.6, y: 0.8, width: 10.8 },
    { t: 14, x: 0.6, y: 2.3, width: 12 },
    { t: 28, x: 0.6, y: 2.25, width: 12 },
    { t: 32.5, x: -1.8, y: 0.6, width: 12.5 },
    { t: 37, x: 0.2, y: 0.2, width: 17.5 },
    { t: 40, x: -2.9, y: -0.55, width: 9.4 },
    { t: 49, x: -0.5, y: -0.55, width: 8.5 },
    { t: 56, x: 0, y: -1.2, width: 10 },
    { t: 66, x: 0.8, y: -0.8, width: 12 },
    { t: 72.8, x: 1.2, y: -0.4, width: 12 },
    { t: 75, x: 1.5, y: 0.1, width: 11.5 },
    { t: 78.5, x: 4.3, y: -0.3, width: 9 },
    { t: 82, x: 4.2, y: -0.35, width: 9 },
    { t: 88, x: 0.4, y: 0, width: 18.2 },
    { t: 90, x: 0.4, y: 0, width: 18.2 },
  ]);
  return { rig, phase, orbit, clip, camera };
}
export const COMPLEX_CUTS = [0.8, 3.2, 12.6, 39, 49.5, 74.3, 75.4, 75.9, 77.2, exit.land + 0.3, 83];
export function complexEvents(): FoleyCue[] {
  const out = [...entry.cues, ...run.cues, ...exit.cues];
  out.push(
    event('c-tap', 5, 'hand', RADIUS, 0.25),
    event('c-open-clip', 9, 'latch', RADIUS, 0.3),
    event('c-first-slip', 12.82, 'shoe-grip', RADIUS, 0.45),
    event('c-first-gasp', 12.9, 'breath', RADIUS, 0.7, 0.25),
    event('c-first-cloth', 13.1, 'cloth', RADIUS * 0.8, 0.65),
  );
  for (const [i, q] of TURNS.entries())
    out.push(
      event(`c-grip-${i}`, q.a - 0.1, 'hand', orbitAt(q.a).x, 0.4),
      event(`c-click-${i}`, q.a, 'latch', orbitAt(q.a).x, 0.35),
      event(`c-turn-${i}`, q.a + 0.03, 'turn', orbitAt(q.a + 0.5).x, 0.5, q.b - q.a),
      event(`c-read-${i}`, q.b + 0.05, 'reveal', orbitAt(q.b).x, 0.18, 0.35),
      event(`c-breath-${i}`, q.b + 0.4, 'breath', orbitAt(q.b).x, 0.5, 0.55),
    );
  for (let i = 0; i < 12; i++) {
    const t = 39 + ((i + 0.64) * 10) / 12;
    out.push(
      event(`c-climb-grip-${i}`, t, 'hand', climbGrips(t)[i % 2].x, 0.28),
      event(`c-climb-cloth-${i}`, t - 0.2, 'cloth', climbGrips(t)[i % 2].x, 0.2),
    );
  }
  out.push(
    event('c-effort', 74.55, 'breath', 0.55, 0.75, 0.45),
    event('c-bar-body', 74.9, 'cloth', 0.55, 0.65),
    event('c-plant', 75.4, 'footstep', 0.55, 0.5),
    event('c-rest', 80, 'breath', LEDGE.x, 0.65, 0.8),
    event('c-final-touch', 87.2, 'hand', RADIUS, 0.22),
  );
  return out;
}
