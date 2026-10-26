import {
  add,
  clamp,
  distance,
  ease,
  lerp,
  mix,
  pendulum,
  smooth,
  twoBone,
  type Vec,
} from './math.js';
import { HIP, type Motion } from './physics.js';
import { skeleton, type Rig, type Limb } from './rig.js';

export interface Walk {
  start: number;
  end: number;
  from: number;
  to: number;
}
/** Foot anchors are held in world coordinates during stance; no pose crossfade slides them. */
export function walkAt(t: number, w: Walk) {
  if (![t, ...Object.values(w)].every(Number.isFinite) || w.end <= w.start)
    throw new Error('Invalid walk interval');
  const duration = w.end - w.start;
  const cycles = Math.max(1, Math.ceil(duration / 0.43));
  const period = duration / cycles;
  const direction = Math.sign(w.to - w.from) || 1;
  const pos = (at: number) => mix(w.from, w.to, smooth(at, w.start, w.end));
  const feet = [0, 0.5].map((offset, i) => {
    const phase = (t - w.start) / period + offset;
    const n = Math.floor(phase),
      f = phase - n;
    const dx = (i === 0 ? -0.14 : 0.13) * direction;
    const anchor = (step: number) =>
      (step <= 0
        ? w.from
        : step >= cycles
          ? w.to
          : pos(w.start + (step - offset + 0.33) * period)) + dx;
    const swing = smooth(f, 0.6, 1);
    return {
      x: mix(anchor(n), anchor(n + 1), swing),
      y: f < 0.6 ? 0 : Math.sin(Math.PI * swing) * 0.13,
      planted: f < 0.6 || t <= w.start || t >= w.end,
    };
  });
  const activity = smooth(t, w.start, w.start + 0.15) * (1 - smooth(t, w.end - 0.15, w.end));
  return {
    x: pos(t),
    feet,
    period,
    activity,
    crouch: activity * (0.065 + 0.02 * (1 - Math.cos(((t - w.start) * Math.PI * 4) / period))),
  };
}
export function walkContacts(w: Walk) {
  const r = walkAt(w.start, w);
  const times: number[] = [];
  for (const offset of [0, 0.5])
    for (let cycle = 0; ; cycle++) {
      const t = w.start + (cycle + 1 - offset) * r.period;
      if (t >= w.end - 1e-6) break;
      if (t > w.start) times.push(t);
    }
  return times.sort((a, b) => a - b);
}
export interface Pose {
  x: number;
  floor?: number;
  lean?: number;
  head?: number;
  crouch?: number;
  arm?: number;
  walk?: Walk;
}
function leg(hip: Vec, ankle: Vec): Limb {
  const k = twoBone(hip, ankle, 0.45, 0.45, 1);
  return { a: hip, hinge: k.joint, b: k.end, error: k.error };
}
export function standing(t: number, p: Pose): Rig {
  const floor = p.floor ?? 0;
  const walk = p.walk ? walkAt(t, p.walk) : null;
  const x = walk?.x ?? p.x;
  const lean = p.lean ?? 0.02;
  const hip = { x, y: floor + HIP - (p.crouch ?? 0) - (walk?.crouch ?? 0) };
  const shoulder = add(hip, { x: Math.sin(lean) * 0.43, y: Math.cos(lean) * 0.43 });
  const head = add(shoulder, {
    x: Math.sin(p.head ?? lean * 0.6) * 0.22,
    y: Math.cos(p.head ?? lean * 0.6) * 0.22,
  });
  const feet = (
    walk?.feet ?? [
      { x: x - 0.14, y: 0, planted: true },
      { x: x + 0.13, y: 0, planted: true },
    ]
  ).map((f) => ({
    ankle: { x: f.x, y: floor + f.y + 0.055 },
    toe: { x: f.x + Math.sqrt(0.165 ** 2 - 0.055 ** 2), y: floor + f.y },
    planted: f.planted,
  }));
  const cycle = walk
    ? Math.sin(((t - p.walk!.start) * Math.PI * 2) / walk.period) * 0.48 * walk.activity
    : 0;
  const arms = [0, 1].map((i) => {
    const upper = (p.arm ?? 0.08) + (i ? cycle : -cycle) + (i ? 0.13 : -0.13);
    const hinge = pendulum(shoulder, 0.285, upper);
    return { a: shoulder, hinge, b: pendulum(hinge, 0.275, upper + 0.22), error: 0 };
  });
  return {
    hip,
    shoulder,
    head,
    neck: lerp(shoulder, head, 0.42),
    spine: add(lerp(hip, shoulder, 0.48), { x: -0.025 * Math.sin(lean), y: 0 }),
    feet,
    legs: feet.map((f) => leg(hip, f.ankle)),
    arms,
  };
}
export function reach(r: Rig, side: 0 | 1, target: Vec, weight = 1) {
  if (!Number.isFinite(weight) || ![target.x, target.y].every(Number.isFinite))
    throw new Error('Invalid reach');
  const goal = lerp(r.arms[side].b, target, clamp(weight));
  const k = twoBone(r.shoulder, goal, 0.285, 0.275, side ? 1 : -1);
  r.arms[side] = { a: r.shoulder, hinge: k.joint, b: k.end, error: k.error };
  return r.arms[side].b;
}
/** Inherit upper-body angles at a clip boundary without blending planted foot positions. */
export function inheritUpperBody(r: Rig, previous: Rig, weight: number) {
  const angle = (a: Vec, b: Vec) => Math.atan2(b.x - a.x, b.y - a.y);
  const blend = (a: number, b: number) =>
    a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * clamp(weight);
  const torso = blend(angle(previous.hip, previous.shoulder), angle(r.hip, r.shoulder));
  const head = blend(angle(previous.shoulder, previous.head), angle(r.shoulder, r.head));
  const arms = r.arms.map((l, i) => ({
    upper: blend(angle(previous.arms[i].a, previous.arms[i].hinge), angle(l.a, l.hinge)),
    lower: blend(angle(previous.arms[i].hinge, previous.arms[i].b), angle(l.hinge, l.b)),
  }));
  const point = (origin: Vec, length: number, a: number) =>
    add(origin, { x: Math.sin(a) * length, y: Math.cos(a) * length });
  r.shoulder = point(r.hip, 0.43, torso);
  r.head = point(r.shoulder, 0.22, head);
  r.neck = lerp(r.shoulder, r.head, 0.42);
  r.spine = add(lerp(r.hip, r.shoulder, 0.48), { x: -0.025 * Math.sin(torso), y: 0 });
  r.arms = arms.map((a) => {
    const hinge = point(r.shoulder, 0.285, a.upper);
    return { a: r.shoulder, hinge, b: point(hinge, 0.275, a.lower), error: 0 };
  });
}
export type Carrier = (t: number) => { x: number; velocity: number };
/** A ballistic transfer with a moving landing anchor. Horizontal braking retains impact velocity. */
export function transfer(m: Motion, start: number, source: number | Carrier, carrier: Carrier) {
  if (!Number.isFinite(start) || (typeof source === 'number' && !Number.isFinite(source)))
    throw new Error('Invalid transfer origin');
  const sourceAt: Carrier =
    typeof source === 'number' ? () => ({ x: source, velocity: 0 }) : source;
  const land = start + m.land,
    takeoff = start + m.takeoff;
  const destination = carrier(land).x;
  const pushTime = m.takeoff - m.push;
  const sourceSpeed = sourceAt(takeoff).velocity;
  const vx =
    (destination - sourceAt(takeoff).x + 0.14 + 0.5 * sourceSpeed * pushTime) /
    (m.land - m.takeoff + pushTime * 0.5);
  if (!Number.isFinite(vx) || Math.abs(vx - sourceSpeed) > m.launch.x + 1e-6)
    throw new Error('Transfer exceeds horizontal work budget');
  const origin = sourceAt(takeoff).x - 0.14 + 0.5 * (vx - sourceSpeed) * pushTime;
  function at(t: number) {
    if (!Number.isFinite(t)) throw new Error('time must be finite');
    const local = t - start,
      s = m.at(local);
    const rig = skeleton(m, s);
    let x: number, velocity: number;
    if (local < m.push) {
      x = sourceAt(t).x + s.root.x - 1.6;
      velocity = sourceAt(t).velocity + s.velocity.x;
    } else if (local < m.takeoff) {
      const dt = local - m.push;
      x = sourceAt(t).x - 0.14 + ((0.5 * (vx - sourceSpeed)) / pushTime) * dt * dt;
      velocity = sourceAt(t).velocity + ((vx - sourceSpeed) / pushTime) * dt;
    } else if (local < m.land) {
      x = origin + vx * (local - m.takeoff);
      velocity = vx;
    } else {
      const dt = local - m.land,
        c = carrier(t),
        v0 = vx - carrier(land).velocity;
      const omega = 15,
        rest = 0,
        a = -rest,
        b = v0 + omega * a;
      x = c.x + rest + (a + b * dt) * Math.exp(-omega * dt);
      velocity = c.velocity + (b - omega * (a + b * dt)) * Math.exp(-omega * dt);
    }
    const dx = x - s.root.x;
    const point = (p: Vec) => ({ x: p.x + dx, y: p.y });
    rig.hip = point(rig.hip);
    rig.shoulder = point(rig.shoulder);
    rig.spine = point(rig.spine);
    rig.head = point(rig.head);
    rig.neck = point(rig.neck);
    rig.arms = rig.arms.map((l) => ({ ...l, a: point(l.a), hinge: point(l.hinge), b: point(l.b) }));
    rig.feet = rig.feet.map((f) => {
      const correction =
        0.5 * (m.launch.x - (vx - sourceSpeed)) * pushTime * (1 - smooth(s.flight, 0, 0.3));
      const anchor =
        local < m.takeoff
          ? sourceAt(t).x - 1.6
          : local >= m.land
            ? carrier(t).x - m.destination.x
            : dx + correction;
      const q = (p: Vec) => ({ x: p.x + anchor, y: p.y });
      return { ankle: q(f.ankle), toe: q(f.toe), planted: f.planted };
    });
    rig.legs = rig.feet.map((f) => leg(rig.hip, f.ankle));
    return { rig, state: { ...s, root: rig.hip, velocity: { x: velocity, y: s.velocity.y } } };
  }
  return { at, start, takeoff, land, vx, destination, source, motion: m };
}
export interface Keyframe {
  t: number;
  x: number;
  y: number;
  width: number;
}
export function cameraAt(t: number, keys: Keyframe[]) {
  if (
    !Number.isFinite(t) ||
    !keys.length ||
    keys.some(
      (k, i) =>
        !Object.values(k).every(Number.isFinite) || k.width <= 0 || (i > 0 && k.t <= keys[i - 1].t),
    )
  )
    throw new Error('Invalid camera track');
  let a = keys[0],
    b = a;
  for (let i = 1; i < keys.length; i++) {
    b = keys[i];
    if (t < b.t) break;
    a = b;
  }
  const u = b.t === a.t ? 0 : ease((t - a.t) / (b.t - a.t));
  return { x: mix(a.x, b.x, u), y: mix(a.y, b.y, u), width: mix(a.width, b.width, u) };
}
export function rigError(r: Rig) {
  return Math.max(
    ...r.legs.map((l) => l.error),
    ...r.arms.map((l) => l.error),
    ...r.legs.map((l, i) => distance(l.b, r.feet[i].ankle)),
  );
}
