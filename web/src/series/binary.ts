import type { Rig } from '../rig.js';
import type { FoleyCue } from '../foley.mjs';
import {
  add,
  clamp,
  mix,
  smooth,
  stand,
  gaze,
  gesture,
  runClip,
  cameraAt,
  event,
  pulse,
} from './acting.js';

export const VALUES = [2, 5, 8, 12, 19, 24, 28, 31, 37, 42, 48, 55, 63, 70, 81, 96];
export const TARGET = 63;
export const doorX = (index: number) => (index - 1) * 0.72;
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
export const QUERIES = searchSteps(VALUES, TARGET).map((q, i) => ({
  ...q,
  t: [28.1, 38, 45.2, 50.8][i],
}));
export function searchAt(t: number) {
  const queries = QUERIES.filter((q) => q.t <= t),
    last = queries.at(-1);
  return {
    queries,
    range: last?.after ?? [0, 15],
    found: last?.comparison === '=',
    original: VALUES,
    unfold: smooth(t, 10.8, 17.1),
    close: smooth(t, 17.4, 18.4),
    target: smooth(t, 22.4, 23.4),
    inner: smooth(t, 60, 61.1),
    insert: smooth(t, 65.2, 68),
    withdraw: smooth(t, 79, 80.8),
    finger: 0.5 + 0.5 * Math.sin((t - 70) * 5),
  };
}
const entry = runClip('b-approach', 0.7, 3, -1.8, -0.42);
const retreat = runClip('b-retreat', 11.1, 12.4, -0.42, -1.4);
const returnFrame = runClip('b-return', 15.8, 17.8, -1.4, -0.42);
const runs = [
  runClip('b-mid8', 24.2, 27.2, -0.42, doorX(8) - 0.43),
  runClip('b-mid12', 35.2, 37, doorX(8) - 0.43, doorX(12) - 0.43),
  runClip('b-mid14', 43.2, 44.4, doorX(12) - 0.43, doorX(14) - 0.43),
  runClip('b-mid13', 49, 49.8, doorX(14) - 0.43, doorX(13) - 0.43),
];
function held(r: Rig, t: number) {
  const w = smooth(t, 19.0, 20.3);
  const lift = Math.max(
    pulse(t, 21, 24.2, 0.3),
    pulse(t, 29, 33, 0.3),
    pulse(t, 39, 42, 0.3),
    pulse(t, 46, 48.5, 0.2),
    pulse(t, 51.5, 54, 0.3),
    pulse(t, 62, 81, 0.4),
  );
  gesture(r, 0, add(r.shoulder, { x: mix(-0.27, -0.4, lift), y: mix(-0.23, 0.2, lift) }), w);
  return r;
}
export function binaryRaw(t: number) {
  const q = searchAt(t);
  let rig: Rig, phase: string;
  if (t < 0.7) {
    rig = stand(t, -1.8, { head: 0.25 });
    phase = '发现小白框';
  } else if (t < 3) {
    rig = entry.at(t);
    phase = '靠近';
  } else if (t < 11.1) {
    rig = stand(t, -0.42, {
      lean: 0.2 * pulse(t, 3.4, 10),
      crouch: 0.08 * pulse(t, 4, 7),
      head: mix(0.35, 1.0, pulse(t, 7, 9.3)),
    });
    for (const at of [5, 5.28])
      gesture(rig, 1, { x: 0, y: 0.97 }, pulse(t, at - 0.19, at + 0.13, 0.1));
    gesture(rig, 0, add(rig.head, { x: -0.1, y: -0.04 }), pulse(t, 7.3, 9.2, 0.3));
    gesture(rig, 1, { x: 0, y: 0.88 }, pulse(t, 9.7, 11.4, 0.3));
    phase = t < 6.3 ? '敲两下，听见回应' : t < 9.5 ? '贴近听，查看背面' : '沿接缝拉开外壳';
  } else if (t < 12.4) {
    rig = retreat.at(t);
    phase = '展开的结构需要让路';
  } else if (t < 15.8) {
    rig = stand(t, -1.4, { head: 0.5 });
    gesture(rig, 1, add(rig.shoulder, { x: 0.25, y: 0.12 }), pulse(t, 12.3, 14.4));
    phase = '地址从小到大展开';
  } else if (t < 17.8) {
    rig = returnFrame.at(t);
    phase = '回到最初的框';
  } else if (t < 24.2) {
    rig = stand(t, -0.42, {
      crouch: 0.08 * (1 - smooth(t, 19.5, 21)),
      lean: 0.1,
      head: mix(0.15, -0.45, smooth(t, 21, 23)),
    });
    gesture(rig, 0, { x: -0.14, y: 0.76 }, pulse(t, 18, 20.3, 0.3));
    held(rig, t);
    phase = t < 20.3 ? '从内侧提起薄框' : '翻转查看，发现地址63';
  } else {
    let clip = runs[0];
    for (const r of runs) if (t >= r.a) clip = r;
    rig = clip.at(t);
    held(rig, t);
    for (const query of QUERIES)
      gesture(
        rig,
        1,
        { x: doorX(query.index) - 0.12, y: 1.05 },
        pulse(t, query.t - 0.4, query.t + 0.55, 0.22),
      );
    const read =
      pulse(t, 29.2, 31.2) + pulse(t, 39.2, 41.1) + pulse(t, 46, 47.7) + pulse(t, 51.7, 53.4);
    if (read > 0.01) gaze(rig, -0.6, read);
    if (t >= 32 && t < 34.7)
      gesture(rig, 1, add(rig.shoulder, { x: -0.38, y: 0.04 }), pulse(t, 32, 34.7));
    if (t > 54) {
      const close = 0.1 * smooth(t, 64.2, 66.4);
      rig = stand(t, doorX(13) - 0.43 + close, {
        lean: 0.09,
        head: mix(0.45, -0.75, smooth(t, 66, 69)),
      });
      held(rig, t);
      for (const at of [57.2, 57.48])
        gesture(rig, 1, { x: doorX(13) - 0.12, y: 1.05 }, pulse(t, at - 0.2, at + 0.13, 0.12));
      const reachIn = smooth(t, 62, 65.5) * (1 - smooth(t, 79, 80.8));
      gesture(rig, 1, { x: doorX(13) - 0.09, y: 1.04 }, reachIn, true);
      if (t > 68 && t < 70) {
        // A startle is a shoulder/neck response; the occupied wrists stay bound.
        const startle = 0.06 * Math.sin(Math.PI * clamp((t - 68) / 0.5)) * pulse(t, 68, 69);
        rig.head.y += startle;
        rig.head.x -= startle * 0.7;
        const dx = rig.head.x - rig.shoulder.x,
          dy = rig.head.y - rig.shoulder.y,
          l = Math.hypot(dx, dy);
        rig.head = { x: rig.shoulder.x + (dx * 0.22) / l, y: rig.shoulder.y + (dy * 0.22) / l };
      }
      if (t > 81) gaze(rig, 0.75, pulse(t, 82, 85, 0.5));
    }
    phase =
      t < 28.1
        ? '从整排中点开始'
        : t < 35.2
          ? '31小于63，左半不可能'
          : t < 38
            ? '跑向右半中点'
            : t < 43.2
              ? '55仍小，继续缩小'
              : t < 45.2
                ? '再查右侧中点'
                : t < 49
                  ? '70过大，收步折返'
                  : t < 50.8
                    ? '只剩中间一处'
                    : t < 57
                      ? '匹配63，疑问还在'
                      : t < 62
                        ? '敲击，拉开内盖'
                        : t < 68
                          ? '试探空间通路'
                          : t < 79
                            ? '同一只手，回声的来源'
                            : '抽回手，继续张望';
  }
  const hand = rig.arms[0].b;
  const w = smooth(t, 18.4, 20.3);
  const frame = {
    x: mix(0, hand.x - 0.11, w),
    y: mix(0.96, hand.y + 0.14, w),
    rotation: 0.08 * pulse(t, 21, 24) - 0.07 * pulse(t, 69, 72),
    held: w,
  };
  const camera = cameraAt(t, [
    { t: 0, x: -0.5, y: 0.95, width: 8 },
    { t: 9.8, x: -0.25, y: 1.05, width: 7.6 },
    { t: 12.5, x: 3.4, y: 1.1, width: 15.4 },
    { t: 18, x: 4.8, y: 1.1, width: 15.4 },
    { t: 21, x: -0.1, y: 1.05, width: 7.6 },
    { t: 24.2, x: 2.5, y: 1.1, width: 12.5 },
    { t: 28.1, x: 5.1, y: 1.12, width: 11.8 },
    { t: 33.5, x: 6.8, y: 1.12, width: 13.8 },
    { t: 38, x: 7.6, y: 1.12, width: 10.5 },
    { t: 45.2, x: 8.8, y: 1.12, width: 8.8 },
    { t: 53.3, x: 8.4, y: 1.12, width: 7.6 },
    { t: 63, x: 8.2, y: 1.12, width: 6.8 },
    { t: 70, x: 8.1, y: 1.15, width: 6.2 },
    { t: 79, x: 8.1, y: 1.15, width: 6.2 },
    { t: 85, x: 6, y: 1.15, width: 13.5 },
  ]);
  return { rig, phase, query: q, frame, camera };
}
export const BINARY_CUTS = [
  0.7,
  3,
  11.1,
  12.4,
  15.8,
  17.8,
  24.2,
  ...runs.slice(1).map((r) => r.a),
  54,
];
export function binaryEvents(): FoleyCue[] {
  const out = [...entry.cues, ...retreat.cues, ...returnFrame.cues, ...runs.flatMap((r) => r.cues)];
  for (const [n, t] of [5, 5.28, 57.2, 57.48, 77.2, 77.48].entries()) {
    out.push({
      ...event(`b-knock-${n}`, t, 'knock', t < 10 ? 0 : doorX(13), 0.65),
      soundId: `knock-${n % 2}`,
    });
    out.push({
      ...event(`b-echo-${n}`, t + 0.58, 'knock', t < 10 ? 0.2 : doorX(13), 0.27),
      soundId: `knock-${n % 2}`,
      echo: true,
    });
  }
  for (let i = 0; i < 16; i++)
    out.push(
      event(`b-unfold-${i}`, 10.8 + i * 0.36, 'latch', doorX(i + 1), 0.2),
      event(`b-close-${i}`, 17.4 + i * 0.05, 'tile', doorX(i + 1), 0.14),
    );
  for (const [i, q] of QUERIES.entries())
    out.push(
      event(`b-cover-${i}`, q.t, 'latch', doorX(q.index), 0.4),
      event(`b-read-${i}`, q.t + 0.27, 'reveal', doorX(q.index), 0.16, 0.24),
    );
  out.push(
    event('b-pull', 10.7, 'hand', 0, 0.4),
    event('b-hinge', 11, 'slide', 2, 0.15, 3.5),
    event('b-lift', 18.5, 'hand', 0, 0.3),
    event('b-address', 22.7, 'reveal', 0, 0.2, 0.4),
    event('b-brake', 48.2, 'skid', doorX(14), 0.35, 0.22),
    event('b-inner', 60.1, 'slide', doorX(13), 0.24, 0.8),
    event('b-touch-dark', 64.3, 'hand', doorX(13), 0.22),
    event('b-space', 67, 'reveal', doorX(13), 0.25, 0.7),
    event('b-startle', 68.2, 'breath', doorX(13), 0.45, 0.25),
    event('b-out', 80, 'cloth', doorX(13), 0.3),
  );
  return out;
}
