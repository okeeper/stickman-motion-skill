import { add, clamp, lerp, mix, pendulum, smooth, twoBone, type Vec } from '../math.js';
import { standing, reach, inheritUpperBody, cameraAt } from '../performance.js';
import {
  foot,
  limbs,
  inheritFreeLegs,
  offsetRig,
  floorSupport,
  tuckedPose,
  locomotion,
  speedTrack,
} from '../stunt.js';
import type { Rig } from '../rig.js';
import type { FoleyCue } from '../foley.mjs';
import { mirror, balance, connect, runClip } from './motion.js';

export const H = 1.66;
export const G = 9.81;
export const pulse = (t: number, a: number, b: number, edge = 0.22) =>
  smooth(t, a, a + edge) * (1 - smooth(t, b - edge, b));
export const point = (x: number, y: number): Vec => ({ x, y });
export const rotate = (p: Vec, a: number): Vec => ({
  x: p.x * Math.cos(a) - p.y * Math.sin(a),
  y: p.x * Math.sin(a) + p.y * Math.cos(a),
});
export function gesture(r: Rig, side: 0 | 1, target: Vec, weight = 1, contact = false) {
  const d = Math.hypot(target.x - r.shoulder.x, target.y - r.shoulder.y);
  const safe = d > 0.555 ? lerp(r.shoulder, target, 0.555 / d) : target;
  reach(r, side, contact ? target : safe, weight);
  return r;
}
export function gaze(r: Rig, angle: number, weight = 1) {
  const before = Math.atan2(r.head.x - r.shoulder.x, r.head.y - r.shoulder.y);
  const a = before + Math.atan2(Math.sin(angle - before), Math.cos(angle - before)) * clamp(weight);
  r.head = add(r.shoulder, { x: 0.22 * Math.sin(a), y: 0.22 * Math.cos(a) });
  r.neck = lerp(r.shoulder, r.head, 0.42);
  return r;
}
/** A planted acting pose: breathing never moves its support anchors. */
export function stand(
  t: number,
  x: number,
  opts: {
    floor?: number;
    dir?: number;
    crouch?: number;
    lean?: number;
    head?: number;
    breath?: number;
  } = {},
) {
  const dir = opts.dir ?? 1;
  const r = mirror(standing(0, { x: 0 }), x, dir, opts.floor ?? 0);
  const breath = (opts.breath ?? 1) * 0.006 * Math.sin(t * 2.7);
  return balance(r, (opts.lean ?? 0) * dir, (opts.crouch ?? 0) + breath, opts.head ?? dir * 0.06);
}
export function freePose(
  hip: Vec,
  lean: number,
  head: number,
  legs: number[][],
  arms: number[][],
): Rig {
  const shoulder = add(hip, { x: 0.43 * Math.sin(lean), y: 0.43 * Math.cos(lean) });
  const feet = legs.map(([a, b, f = 0]) => foot(pendulum(pendulum(hip, 0.45, a), 0.45, b), f));
  const r = limbs(hip, shoulder, feet, arms, head);
  r.legs = legs.map(([a, b]) => {
    const hinge = pendulum(hip, 0.45, a);
    return { a: hip, hinge, b: pendulum(hinge, 0.45, b), error: 0 };
  });
  return r;
}
export function planted(hip: Vec, lean: number, head: number, feet: Rig['feet']): Rig {
  return limbs(
    hip,
    add(hip, { x: 0.43 * Math.sin(lean), y: 0.43 * Math.cos(lean) }),
    feet,
    [
      [0.1, 0.2],
      [-0.1, 0.1],
    ],
    head,
  );
}
/** Both hands solve to the bar; the rest of the body hangs under gravity. */
export function hang(anchor: Vec, t: number, lean = 0, tuck = 0.2, spread = 0.08): Rig {
  const shoulder = { x: anchor.x - 0.18 * Math.sin(lean), y: anchor.y - 0.43 };
  const hip = { x: shoulder.x - 0.43 * Math.sin(lean), y: shoulder.y - 0.43 * Math.cos(lean) };
  const r = freePose(
    hip,
    lean,
    -lean * 0.5,
    [
      [0.3 + tuck, -0.5 - tuck, 0.12],
      [-0.3 - tuck, 0.55 + tuck, -0.22],
    ],
    [
      [Math.PI, Math.PI],
      [Math.PI, Math.PI],
    ],
  );
  for (const i of [0, 1] as const)
    gesture(r, i, { x: anchor.x + (i ? spread : -spread), y: anchor.y }, 1, true);
  r.head = add(r.shoulder, {
    x: 0.22 * Math.sin(-lean * 0.5 + 0.03 * Math.sin(t * 2)),
    y: 0.22 * Math.cos(-lean * 0.5 + 0.03 * Math.sin(t * 2)),
  });
  r.neck = lerp(r.shoulder, r.head, 0.42);
  return r;
}
export function seated(t: number, x: number, dir = 1, floor = 0) {
  const r = freePose(
    { x, y: floor + 0.28 },
    dir * 0.22,
    dir * 0.1,
    [
      [dir * 1.0, dir * 1.58, -0.12],
      [dir * -0.15, dir * 1.8, -0.15],
    ],
    [
      [dir * -0.25, dir * 0.2],
      [dir * 0.9, dir * 0.3],
    ],
  );
  return offsetRig(floorSupport(offsetRig(r, { x: 0, y: -floor })).rig, {
    x: 0,
    y: floor + 0.004 * Math.sin(t * 2),
  });
}
export function roll(t: number, a: number, b: number, from: number, to: number, dir = 1) {
  const u = clamp((t - a) / (b - a));
  return floorSupport(
    tuckedPose(
      mix(from, to, smooth(t, a, b)),
      dir * (-0.4 + u * Math.PI * 2),
      0.8 + 0.15 * Math.sin(Math.PI * u),
    ),
  ).rig;
}
export function withUpper(r: Rig, pose: Rig, w = 1) {
  inheritUpperBody(r, pose, 1 - w);
  return r;
}
export function blend(a: Rig, b: Rig, w: number) {
  return connect(b, a, clamp(w));
}
/** A steady following walk uses world-space stance anchors, never a sliding standing pose. */
export function follow(id: string, a: number, b: number, from: number, speed: number) {
  const dir = Math.sign(speed) || 1;
  const gait = locomotion(
    speedTrack([
      { t: 0, v: Math.abs(speed) },
      { t: b - a + 1, v: Math.abs(speed) },
    ]),
    0,
    b - a,
    () => 0.41,
    true,
  );
  return {
    a,
    b,
    at: (t: number) => mirror(gait.at(clamp(t - a, 0, b - a)), from, dir),
    cues: gait.contacts
      .filter((c) => c.t >= 0 && c.t < b - a)
      .map(
        (c, i) =>
          ({
            id: `${id}-${i}`,
            t: a + c.t,
            x: from + dir * c.x,
            kind: 'footstep',
            gait: 'walk',
            strength: 0.45,
            foot: c.foot,
          }) as FoleyCue,
      ),
  };
}
export const event = (
  id: string,
  t: number,
  kind: string,
  x: number,
  strength = 0.5,
  duration?: number,
): FoleyCue => ({ id, t, kind, x, strength, duration });
export {
  add,
  clamp,
  lerp,
  mix,
  smooth,
  mirror,
  balance,
  connect,
  runClip,
  offsetRig,
  cameraAt,
  foot,
  twoBone,
  inheritFreeLegs,
  inheritUpperBody,
};
