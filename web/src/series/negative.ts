import type { Rig } from '../rig.js';
import type { FoleyCue } from '../foley.mjs';
import { hop } from './motion.js';
import {
  G,
  add,
  mix,
  smooth,
  stand,
  gesture,
  freePose,
  seated,
  roll,
  blend,
  follow,
  runClip,
  balance,
  event,
  pulse,
  inheritFreeLegs,
  inheritUpperBody,
} from './acting.js';

export const SWITCHES = [13.2, 36.4, 61.14];
const SPEED = 0.9,
  REVERSAL = 0.6;
export const DECK = 0.28;
/** Signed speed integral: target units map to .45 metres per unit. */
export function cartAt(t: number) {
  let x = 1.2,
    v = SPEED,
    u = 2,
    last = 0;
  for (const a of SWITCHES) {
    if (t < a) return { x: x + v * (t - last), v, u };
    x += v * (a - last);
    u = -u;
    if (t < a + REVERSAL) {
      const q = (t - a) / REVERSAL;
      return {
        x: x + v * REVERSAL * (q - 2 * (q ** 3 - 0.5 * q ** 4)),
        v: v * (1 - 2 * (3 * q * q - 2 * q ** 3)),
        u,
      };
    }
    v = -v;
    last = a + REVERSAL;
  }
  return { x: x + v * (t - last), v, u };
}
const switchPoint = (t: number) => ({ x: cartAt(t).x - 0.35, y: 0.78 });
const entry = runClip('n-approach', 0.8, 3.2, -0.6, cartAt(3.2).x - 0.78);
const first = follow('n-follow', 3.2, 13.2, cartAt(3.2).x - 0.78, SPEED);
const fallX = cartAt(13.2).x - 0.6;
const catchup = runClip('n-catch', 23.2, 26.5, fallX + 1.8, cartAt(26.5).x + 0.25);
const left = follow('n-left', 26.5, 36.4, cartAt(26.5).x + 0.25, -SPEED);
const pivot = runClip('n-turn', 38.0, 40.0, cartAt(36.4).x + 0.25, cartAt(40).x - 0.7);
const right = follow('n-right', 40, 43, cartAt(40).x - 0.7, SPEED);
const carrier = (t: number) => ({ x: cartAt(t).x, y: DECK, vx: cartAt(t).v });
const board = hop(
  'n-board',
  43,
  (t) => ({ x: cartAt(t).x - 0.7, y: 0, vx: SPEED }),
  carrier,
  0.7,
  1,
);
const leave = hop(
  'n-leave',
  49,
  carrier,
  () => ({ x: cartAt(49.84).x + 1.8, y: 0, vx: 0 }),
  0.6,
  1,
);
export const JUMP = {
  takeoff: 61.06,
  touch: 61.14,
  land: 61.92,
  vx: -0.7,
  vy: (DECK + 0.5 * G * 0.86 ** 2) / 0.86,
};
const launchX = cartAt(JUMP.land).x - JUMP.vx * (JUMP.land - JUMP.takeoff);
const ahead = runClip('n-ahead', 50.2, 53.2, cartAt(49.84).x + 1.8, launchX);
export const NEGATIVE_TRANSFERS = [board, leave, JUMP].map((h) => ({
  takeoff: h.takeoff,
  land: h.land,
  vx: h.vx,
  vy: h.vy,
}));
function rider(t: number, land = false) {
  const d = Math.max(0, t - JUMP.land),
    impact = land ? 0.16 * Math.exp(-7 * d) * Math.sin(Math.min(Math.PI, d * 18)) : 0;
  let r = stand(t, cartAt(t).x, {
    floor: DECK,
    dir: -1,
    breath: 0,
    crouch: mix(0.14, 0.035, smooth(d, 0, 0.6)) + Math.max(0, impact),
    lean: land ? -0.2 * Math.exp(-5 * d) : -0.05,
    head: -0.12,
  });
  if (land && d < 0.28)
    gesture(r, 1, { x: cartAt(t).x - 0.3, y: DECK + 0.42 }, pulse(d, 0, 0.28, 0.08));
  gesture(r, 0, add(r.shoulder, { x: 0.05, y: -0.28 }), pulse(t, 67, 71));
  return r;
}
export function negativeRaw(t: number) {
  const c = cartAt(t);
  let rig: Rig, phase: string;
  if (t < 0.8) {
    rig = stand(t, -0.6, { head: 0.3 * smooth(t, 0.1, 0.7) });
    phase = '脚边的陌生箭头';
  } else if (t < 3.2) {
    rig = entry.at(t);
    phase = '靠近观察';
  } else if (t < 13.2) {
    rig = first.at(t);
    const inspect = pulse(t, 4.1, 6.5) + pulse(t, 10.8, 13.6);
    rig = balance(rig, 0.42 * inspect, 0.22 * inspect, 0.5 * inspect);
    gesture(rig, 1, switchPoint(t), (t > 10.8 ? 1 : 0.85) * inspect);
    gesture(rig, 0, add(rig.head, { x: 0.08, y: 0.02 }), pulse(t, 7.1, 9.5, 0.35) * 0.8);
    phase = t < 7 ? '伸手差一点' : '观察尾部，抓取';
  } else if (t < 13.56) {
    rig = stand(t, fallX + SPEED * (t - 13.2), {
      crouch: 0.27,
      lean: mix(0.5, -0.4, smooth(t, 13.2, 13.56)),
      head: 0.4,
    });
    gesture(rig, 1, switchPoint(t), 1, true);
    phase = '指令变号，身体仍向前';
  } else if (t < 14.85) {
    const start = stand(13.56, fallX + 0.324, { crouch: 0.27, lean: -0.4 });
    const r = roll(t, 13.56, 14.85, fallX + 0.324, fallX + 1.8, 1);
    rig = t < 13.7 ? blend(start, r, smooth(t, 13.56, 13.7)) : r;
    phase = '失衡，撑地护身滚开';
  } else if (t < 23.2) {
    const sit = seated(t, fallX + 1.8, 1);
    const up = stand(t, fallX + 1.8, {
      dir: -1,
      crouch: 0.2 * (1 - smooth(t, 20, 22)),
      head: -0.5,
    });
    rig = blend(sit, up, smooth(t, 19.5, 22));
    gesture(rig, 1, add(rig.arms[0].b, { x: 0.02, y: 0.06 }), pulse(t, 16, 18.8));
    phase = t < 19.5 ? '检查手腕，回看后果' : '起身，重新判断';
  } else if (t < 26.5) {
    rig = catchup.at(t);
    phase = '追上去确认';
  } else if (t < 36.4) {
    rig = left.at(t);
    const w = pulse(t, 33, 37, 0.4);
    rig = balance(rig, -0.5 * w, 0.24 * w, -0.35);
    gesture(rig, 1, switchPoint(t), w, true);
    phase = t < 32 ? '随行观察负号' : '有退路地再操作一次';
  } else if (t < 38) {
    rig = stand(t, cartAt(36.4).x + 0.25, { dir: -1, crouch: 0.24, lean: 0.5, head: -0.4 });
    gesture(rig, 1, switchPoint(t), 1 - smooth(t, 36.45, 36.7));
    phase = '看完减速、过零与反向';
  } else if (t < 40) {
    rig = pivot.at(t);
    phase = '让出路径，转身跟上';
  } else if (t < 43) {
    rig = right.at(t);
    phase = '顺着运动接近';
  } else if (t < board.land + 0.24) {
    rig = board.at(t);
    phase = '短预备，踏上箭身';
  } else if (t < 49) {
    rig = stand(t, c.x, { floor: DECK, crouch: 0.035, lean: 0.05, head: 0.2 });
    phase = '感受已有速度';
  } else if (t < 50.2) {
    rig = leave.at(t);
    phase = '带着速度离台';
  } else if (t < 53.2) {
    rig = ahead.at(t);
    phase = '跑到前侧，主动安排会合';
  } else if (t < JUMP.takeoff) {
    const charge = mix(0.04 + 0.21 * pulse(t, 60.45, 60.95, 0.12), 0.14, smooth(t, 60.9, 61.06));
    rig = stand(t, launchX, {
      dir: -1,
      breath: 0,
      crouch: charge,
      lean: mix(0.2, 1.55, smooth(t, 60.83, 61.06)),
      head: -0.55,
    });
    gesture(rig, 0, add(rig.shoulder, { x: -0.2, y: -0.22 }), pulse(t, 54.4, 56.3));
    phase = t < 58 ? '看路线，确认反向时差' : '脚下蓄力，等它靠近';
  } else if (t < JUMP.land) {
    const d = t - JUMP.takeoff,
      u = d / (JUMP.land - JUMP.takeoff),
      tuck = Math.sin(Math.PI * u);
    const hip = { x: launchX + JUMP.vx * d, y: 0.76 + JUMP.vy * d - 0.5 * G * d * d };
    rig = freePose(
      hip,
      -1.4 * (1 - smooth(u, 0.12, 0.55)) - 0.15,
      mix(-0.55, -0.4, smooth(u, 0.1, 0.8)),
      [
        [0.45 * tuck, -0.7 * tuck, -0.2],
        [-0.6 * tuck, 0.6 * tuck, -0.4],
      ],
      [
        [-0.8, -0.8],
        [-0.9, -0.3],
      ],
    );
    const launch = stand(JUMP.takeoff, launchX, {
      dir: -1,
      breath: 0,
      crouch: 0.14,
      lean: 1.55,
      head: -0.55,
    });
    gesture(launch, 0, add(launch.shoulder, { x: -0.2, y: -0.22 }), 0);
    if (d < 0.12) inheritFreeLegs(rig, launch, smooth(d, 0, 0.12));
    if (d < 0.16) inheritUpperBody(rig, launch, smooth(d, 0, 0.16));
    if (u > 0.65)
      inheritFreeLegs(
        rig,
        stand(JUMP.land, cartAt(JUMP.land).x, { floor: DECK, dir: -1, breath: 0, crouch: 0.14 }),
        1 - smooth(u, 0.65, 1),
      );

    phase = '拨片后放手，按重力下落，箭头返向会合';
  } else {
    rig = rider(t, true);
    phase = t < 65 ? '落地卸力与恢复' : '手腕记住代价，继续探索';
  }
  if (t > 60.76 && t < JUMP.land)
    gesture(
      rig,
      1,
      switchPoint(t),
      smooth(t, 60.76, 61.12) * (1 - smooth(t, 61.15, 61.35)),
      Math.abs(t - JUMP.touch) <= 0.008,
    );
  // Short joint-space connections preserve the previous silhouette at authored changes.
  const focus =
    t < 13.56
      ? { x: (rig.hip.x + c.x) / 2, y: 1.05, width: 9.3 }
      : t < 23.2
        ? { x: rig.hip.x - 0.2, y: 0.95, width: 8.6 }
        : t < 26.5
          ? { x: rig.hip.x - 1, y: 1.05, width: 11 }
          : t < 43
            ? { x: (rig.hip.x + c.x) / 2, y: 1.05, width: 9.6 }
            : t < 53.2
              ? { x: (rig.hip.x + c.x) / 2, y: 1.25, width: 10 }
              : t < 61.06
                ? { x: launchX - 1.1, y: 1.2, width: 11.5 }
                : t < 63
                  ? { x: launchX - 0.7, y: 1.7, width: 10.2 }
                  : { x: rig.hip.x + 0.2, y: 1.2, width: 9.8 };
  return {
    rig,
    phase,
    cart: {
      ...c,
      tab: smooth(t, 11.2, 12.7),
      equation: pulse(t, 37.3, 40.5, 0.4),
      readout: pulse(t, 13.2, 19, 0.2) + pulse(t, 36.4, 40.5, 0.2) + pulse(t, 61.14, 65, 0.15),
    },
    camera: focus,
  };
}
export const NEGATIVE_CUTS = [
  0.8,
  3.2,
  13.2,
  13.56,
  14.85,
  19.5,
  23.2,
  26.5,
  36.4,
  38,
  40,
  43,
  board.land + 0.24,
  49,
  50.2,
  53.2,
  JUMP.takeoff,
  JUMP.land,
];
export function negativeEvents(): FoleyCue[] {
  const out = [
    ...entry.cues,
    ...first.cues,
    ...catchup.cues,
    ...left.cues,
    ...pivot.cues,
    ...right.cues,
    ...board.cues,
    ...leave.cues,
    ...ahead.cues,
  ];
  for (const [i, t] of SWITCHES.entries())
    out.push(
      event(`n-hand-${i}`, t, 'hand', cartAt(t).x, 0.35),
      event(`n-tab-${i}`, t + 0.01, 'latch', cartAt(t).x, 0.4),
      event(`n-reverse-${i}`, t + 0.07, 'turn', cartAt(t).x, 0.35, 0.53),
    );
  out.push(
    event('n-palm', 13.7, 'hand', fallX + 0.5, 0.8),
    event('n-shoulder', 13.94, 'body', fallX + 1, 0.65),
    event('n-roll', 14.12, 'cloth', fallX + 1.3, 0.75, 0.65),
    event('n-exhale', 14.6, 'breath', fallX + 1.8, 0.65, 0.4),
    event('n-kneel', 20.4, 'cloth', fallX + 1.8, 0.35),
    event('n-rise', 21.7, 'shoe-grip', fallX + 1.8, 0.4),
  );
  out.push(
    event('n-final-push', JUMP.takeoff - 0.06, 'shoe-grip', launchX, 0.85),
    event('n-final-air', JUMP.takeoff, 'whoosh', launchX, 0.65, 0.33),
    event('n-final-land', JUMP.land, 'landing', cartAt(JUMP.land).x, 0.95),
    event('n-final-step', JUMP.land + 0.18, 'footstep', cartAt(JUMP.land + 0.18).x, 0.5),
    event('n-final-breath', JUMP.land + 0.4, 'breath', cartAt(JUMP.land + 0.4).x, 0.6, 0.55),
  );
  for (let t = 0; t < 75; t += 0.6)
    out.push(event(`n-glide-${t.toFixed(1)}`, t, 'slide', cartAt(t).x, 0.07, 0.65));
  return out;
}
