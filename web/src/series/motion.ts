import { add, clamp, ease, lerp, mix, smooth, twoBone, type Vec } from '../math.js';
import { inheritUpperBody, reach, standing } from '../performance.js';
import type { Rig } from '../rig.js';
import { foot, limbs, locomotion, offsetRig, speedTrack, inheritFreeLegs } from '../stunt.js';
import type { FoleyCue } from '../foley.mjs';

export const G = 9.81;
export const clone = (r: Rig): Rig => structuredClone(r);
export function mirror(r: Rig, x: number, direction: number, y = 0): Rig {
  const p = (v: Vec) => ({ x: x + direction * v.x, y: v.y + y });
  return {
    hip: p(r.hip),
    shoulder: p(r.shoulder),
    spine: p(r.spine),
    neck: p(r.neck),
    head: p(r.head),
    arms: r.arms.map((l) => ({ ...l, a: p(l.a), hinge: p(l.hinge), b: p(l.b) })),
    legs: r.legs.map((l) => ({ ...l, a: p(l.a), hinge: p(l.hinge), b: p(l.b) })),
    feet: r.feet.map((f) => ({ ankle: p(f.ankle), toe: p(f.toe), planted: f.planted })),
  };
}
export function constrain(r: Rig) {
  r.legs = r.feet.map((f, i) => {
    const old = r.legs[i],
      cross =
        (old.b.x - old.a.x) * (old.hinge.y - old.a.y) -
        (old.b.y - old.a.y) * (old.hinge.x - old.a.x);
    const k = twoBone(r.hip, f.ankle, 0.45, 0.45, cross < 0 ? -1 : 1);
    if (k.error > 1e-9 && !f.planted) {
      const d = { x: k.end.x - f.ankle.x, y: k.end.y - f.ankle.y };
      f.ankle = k.end;
      f.toe = add(f.toe, d);
    }
    return { a: r.hip, hinge: k.joint, b: k.end, error: f.planted ? k.error : 0, side: i };
  });
  return r;
}
/** Keep each existing support anchor. Change torso angles without changing bone lengths. */
export function balance(base: Rig, lean = 0, crouch = 0, head = lean * 0.6): Rig {
  const hip = { x: base.hip.x, y: base.hip.y - crouch };
  const r = limbs(
    hip,
    add(hip, { x: 0.43 * Math.sin(lean), y: 0.43 * Math.cos(lean) }),
    clone(base).feet,
    base.arms.map((l) => [
      Math.atan2(l.hinge.x - l.a.x, l.a.y - l.hinge.y),
      Math.atan2(l.b.x - l.hinge.x, l.hinge.y - l.b.y),
    ]),
    head,
  );
  r.legs = clone(base).legs;
  return constrain(r);
}
export function reachBeat(
  r: Rig,
  target: Vec,
  t: number,
  touch: number,
  hold = 0.12,
  side: 0 | 1 = 1,
) {
  const w = smooth(t, touch - 0.32, touch) * (1 - smooth(t, touch + hold, touch + hold + 0.32));
  reach(r, side, target, w);
  return r;
}
/** A compact speed profile, alternating world-space stance anchors and a short final foot settle. */
export function runClip(id: string, a: number, b: number, from: number, to: number, floor = 0) {
  if (![a, b, from, to, floor].every(Number.isFinite) || b - a < 0.5 || from === to)
    throw new Error('Invalid run clip');
  const d = b - a,
    ramp = Math.min(0.25, d * 0.22),
    direction = Math.sign(to - from),
    v = Math.abs(to - from) / (d - ramp),
    track = speedTrack([
      { t: 0, v: 0 },
      { t: ramp, v },
      { t: d - ramp, v },
      { t: d, v: 0 },
    ]),
    gait = locomotion(
      track,
      0,
      d,
      (t) =>
        track.at(Math.min(d, t + 0.22)).v < 2
          ? 0.34
          : track.at(Math.min(d, t + 0.22)).v < 4.5
            ? 0.25
            : 0.21,
      true,
    );
  const start = standing(0, { x: 0 });
  function at(t: number) {
    const u = clamp(t - a, 0, d),
      r = gait.at(u);
    if (u < 0.14) {
      const w = smooth(u, 0, 0.14);
      r.feet = r.feet.map((f, i) => ({
        ankle: lerp(start.feet[i].ankle, f.ankle, w),
        toe: lerp(start.feet[i].toe, f.toe, w),
        planted: w === 0 || (w === 1 && f.planted),
      }));
      inheritUpperBody(r, start, w);
      constrain(r);
    }
    if (t >= b) {
      const w = smooth(t, b, b + 0.22);
      r.feet = r.feet.map((f) => {
        if (f.planted) return f;
        const a = Math.atan2(f.toe.y - f.ankle.y, f.toe.x - f.ankle.x),
          b = -Math.asin(0.055 / 0.165);
        return foot({ x: f.ankle.x, y: mix(f.ankle.y, 0.055, w) }, mix(a, b, w), w === 1);
      });
      constrain(r);
    }
    return mirror(r, from, direction, floor);
  }
  const cues: FoleyCue[] = gait.contacts
    .filter((c) => c.t > 0.1 && c.t < d - 0.08 && c.speed > 0.35)
    .map((c, i) => ({
      id: `${id}-${i}`,
      t: a + c.t,
      kind: 'footstep',
      x: from + direction * c.x,
      strength: 0.7,
      gait: c.mode,
      foot: c.foot,
    }));
  const last = gait.at(d);
  if (last.feet.some((f) => !f.planted))
    cues.push({
      id: `${id}-settle`,
      t: b + 0.22,
      kind: 'footstep',
      x: to,
      strength: 0.35,
      gait: 'walk',
    });
  return { a, b, from, to, at, cues };
}
export type Support = (t: number) => { x: number; y: number; vx: number };
/** Short preload, analytic flight and damped landing. The moving source contributes launch velocity. */
export function hop(
  id: string,
  a: number,
  source: Support,
  target: Support,
  duration = 0.64,
  direction = 1,
) {
  const takeoff = a + 0.24,
    land = takeoff + duration,
    s = source(takeoff),
    dest = target(land),
    vx = (dest.x - s.x) / duration,
    vy = (dest.y - s.y - 0.11 + 0.5 * G * duration ** 2) / duration;
  if (
    ![a, duration, vx, vy].every(Number.isFinite) ||
    duration < 0.3 ||
    duration > 1.2 ||
    Math.abs(vx - s.vx) > 5
  )
    throw new Error('Invalid hop / work budget');
  const launch = balance(
    mirror(standing(0, { x: 0 }), s.x, direction, s.y),
    direction * 0.12,
    0,
    direction * 0.2,
  );
  function at(t: number) {
    if (t < takeoff) {
      const c = source(t),
        q = smooth(t, a, a + 0.13),
        push = smooth(t, a + 0.13, takeoff),
        base = mirror(standing(0, { x: 0 }), c.x, direction, c.y);
      return balance(base, direction * 0.12, 0.22 * q * (1 - push), direction * 0.2);
    }
    const dt = clamp(t - takeoff, 0, duration),
      u = dt / duration;
    const x = s.x + vx * dt,
      y = s.y + 0.86 + vy * dt - 0.5 * G * dt * dt;
    const r = offsetRig(launch, { x: x - s.x, y: y - (s.y + 0.86) });
    const tuck = Math.sin(Math.PI * u),
      landing = smooth(u, 0.66, 1);
    r.feet = r.feet.map((_, i) =>
      foot(
        {
          x: x + direction * mix((i ? -0.24 : 0.25) * tuck, i ? 0.13 : -0.14, landing),
          y: y - mix(0.67 - 0.22 * tuck, 0.695, landing),
        },
        direction < 0 ? -Math.PI + Math.asin(0.055 / 0.165) : -Math.asin(0.055 / 0.165),
        false,
      ),
    );
    const shape = balance(r, direction * (0.15 + 0.14 * tuck), 0, direction * 0.24);
    inheritUpperBody(shape, launch, smooth(u, 0, 0.15));
    if (dt < 0.12) inheritFreeLegs(shape, launch, smooth(dt, 0, 0.12));
    shape.feet.forEach((f) => {
      if (dt < 0.12 && f.toe.y < s.y) {
        const dy = s.y - f.toe.y;
        f.toe.y += dy;
        f.ankle.y += dy;
      }
    });
    constrain(shape);
    if (t < land) return shape;
    const c = target(t),
      d = t - land,
      settle = (vx - c.vx) * d * Math.exp(-18 * d);
    const base = mirror(standing(0, { x: 0 }), c.x, direction, c.y);
    base.hip.x += settle;
    const impact = 0.11 + 3 * d;
    const landed = balance(
      base,
      -direction * 0.17 * Math.exp(-9 * d),
      impact * Math.exp(-15 * d),
      direction * 0.1,
    );
    inheritUpperBody(landed, shape, smooth(d, 0, 0.22));
    return landed;
  }
  return {
    a,
    takeoff,
    land,
    vx,
    vy,
    at,
    cues: [
      { id: `${id}-grip`, t: takeoff - 0.09, kind: 'shoe-grip', x: s.x, strength: 0.65 },
      { id: `${id}-air`, t: takeoff, kind: 'whoosh', x: s.x, strength: 0.65, duration: 0.2 },
      { id: `${id}-land`, t: land, kind: 'landing', x: dest.x, strength: 0.8 },
    ] as FoleyCue[],
  };
}
export const still =
  (x: number, y = 0): Support =>
  () => ({ x, y, vx: 0 });
export { ease, smooth, mix, clamp, offsetRig };

/** Connect authored actions in joint space; release/replant feet only in this short transition. */
export function connect(current: Rig, previous: Rig, w: number): Rig {
  w = clamp(w);
  if (w === 1) return current;
  if (w === 0) return clone(previous);
  const r = clone(current),
    delta = {
      x: mix(previous.hip.x, r.hip.x, w) - r.hip.x,
      y: mix(previous.hip.y, r.hip.y, w) - r.hip.y,
    };
  const shifted = offsetRig(r, delta);
  inheritUpperBody(shifted, previous, w);
  inheritFreeLegs(shifted, previous, w);
  const floor = Math.min(
    ...previous.feet.flatMap((f) => [f.toe.y, f.ankle.y]),
    ...current.feet.flatMap((f) => [f.toe.y, f.ankle.y]),
  );
  const lowest = Math.min(...shifted.feet.flatMap((f) => [f.toe.y, f.ankle.y]));
  return lowest < floor ? offsetRig(shifted, { x: 0, y: floor - lowest }) : shifted;
}
