import { add, clamp, distance, lerp, mix, pendulum, twoBone, type Vec } from './math.js';
import type { Rig, Limb } from './rig.js';

export interface SpeedKey {
  t: number;
  v: number;
}
export interface Travel {
  at(t: number): { x: number; v: number; a: number };
}
/** Integrate velocity analytically. Changing gait never resets momentum or position. */
export function speedTrack(keys: SpeedKey[], start = 0): Travel {
  if (
    !Number.isFinite(start) ||
    keys.length < 2 ||
    keys[0].t !== 0 ||
    keys.some(
      (k, i) =>
        !Number.isFinite(k.t) ||
        !Number.isFinite(k.v) ||
        k.v < 0 ||
        (i > 0 && k.t <= keys[i - 1].t),
    )
  )
    throw new Error('Invalid speed track');
  const origins = [start];
  for (let i = 1; i < keys.length; i++)
    origins.push(origins[i - 1] + ((keys[i].t - keys[i - 1].t) * (keys[i].v + keys[i - 1].v)) / 2);
  return {
    at(t: number) {
      if (!Number.isFinite(t)) throw new Error('time must be finite');
      if (t <= 0) return { x: start, v: keys[0].v, a: 0 };
      for (let i = 1; i < keys.length; i++)
        if (t < keys[i].t) {
          const a = keys[i - 1],
            b = keys[i],
            d = b.t - a.t,
            u = (t - a.t) / d,
            dv = b.v - a.v;
          return {
            x: origins[i - 1] + a.v * d * u + dv * d * (u ** 3 - u ** 4 / 2),
            v: a.v + dv * (3 * u * u - 2 * u ** 3),
            a: (dv * 6 * u * (1 - u)) / d,
          };
        }
      const k = keys.at(-1)!;
      return { x: origins.at(-1)! + (t - k.t) * k.v, v: k.v, a: 0 };
    },
  };
}
export type GaitMode = 'walk' | 'run' | 'sprint';
export interface FootContact {
  t: number;
  end: number;
  foot: 0 | 1;
  x: number;
  mode: GaitMode;
  speed: number;
}
export interface Gait {
  contacts: FootContact[];
  at(t: number): Rig;
}
export function limbs(
  hip: Vec,
  shoulder: Vec,
  feet: Rig['feet'],
  angles: number[][],
  headAngle: number,
): Rig {
  const head = add(shoulder, { x: Math.sin(headAngle) * 0.22, y: Math.cos(headAngle) * 0.22 });
  const arms = angles.map(([upper, lower]) => {
    const hinge = pendulum(shoulder, 0.285, upper);
    return { a: shoulder, hinge, b: pendulum(hinge, 0.275, lower), error: 0 };
  });
  const legs = feet.map((f) => {
    const k = twoBone(hip, f.ankle, 0.45, 0.45, 1);
    return { a: hip, hinge: k.joint, b: k.end, error: k.error };
  });
  return {
    hip,
    shoulder,
    head,
    neck: lerp(shoulder, head, 0.42),
    spine: lerp(hip, shoulder, 0.48),
    arms,
    legs,
    feet,
  };
}
export function foot(ankle: Vec, angle = -Math.asin(0.055 / 0.165), planted = false) {
  return {
    ankle,
    toe: add(ankle, { x: 0.165 * Math.cos(angle), y: 0.165 * Math.sin(angle) }),
    planted,
  };
}
/** Per-foot world anchors, alternating contacts and an actual aerial interval when running. */
export function locomotion(
  track: Travel,
  from: number,
  to: number,
  interval: (t: number) => number,
  continuous = false,
): Gait {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from)
    throw new Error('Invalid locomotion interval');
  const contacts: FootContact[] = [];
  let side: 0 | 1 = 0;
  for (let t = from; t < to + 1; t += interval(t)) {
    const step = interval(t),
      speed = track.at(t).v,
      mode: GaitMode = speed < 2 ? 'walk' : speed < 4.5 ? 'run' : 'sprint';
    if (!Number.isFinite(step) || step < 0.15 || step > 0.7)
      throw new Error('Invalid step interval');
    const duration = 2 * step * (mode === 'walk' ? 0.6 : mode === 'run' ? 0.36 : 0.34);
    contacts.push({
      t,
      end: t + duration,
      foot: side,
      x: track.at(t + duration / 2).x + 0.045,
      mode,
      speed,
    });
    side = side === 0 ? 1 : 0;
  }
  const seeds = [0, 1].map((i) => ({
    t: from - 1,
    end: from,
    foot: i as 0 | 1,
    x: track.at(from).x + (i ? -0.1 : 0.12),
    mode: 'walk' as const,
    speed: 0,
  }));
  function at(t: number): Rig {
    if (!Number.isFinite(t)) throw new Error('time must be finite');
    const root = track.at(t);
    const feet = [0, 1].map((i) => {
      const list = contacts.filter((c) => c.foot === i);
      let prev: FootContact = seeds[i],
        next = list[0];
      for (const c of list) {
        if (c.t <= t) prev = c;
        else {
          next = c;
          break;
        }
      }
      if (t <= prev.end) return foot({ x: prev.x, y: 0.055 }, undefined, true);
      if (next.t <= prev.t) return foot({ x: prev.x, y: 0.055 }, undefined, true);
      const u = clamp((t - prev.end) / (next.t - prev.end)),
        q = u * u * (3 - 2 * u);
      const lift = mix(0.1, 0.3, clamp(root.v / 5.6));
      return foot(
        { x: mix(prev.x, next.x, q), y: 0.055 + lift * Math.sin(Math.PI * u) },
        -Math.asin(0.055 / 0.165) + 0.8 * Math.sin(Math.PI * u) * (1 - 2 * u),
      );
    });
    const latest = contacts.filter((c) => c.t <= t).at(-1);
    const next = contacts.find((c) => c.t > t);
    let y = 0.86 - 0.025 * Math.min(root.v, 6);
    if (latest) {
      const dt = t - latest.t,
        contact = latest.end - latest.t;
      if (dt < contact) y -= 0.035 * Math.sin((Math.PI * dt) / contact);
      else if (next) {
        const d = next.t - latest.end,
          s = t - latest.end;
        y += 4.905 * s * (d - s);
      }
    }
    if (continuous) {
      const a = latest?.t ?? from,
        b = next?.t ?? a + interval(a),
        phase = (Math.PI * (t - a)) / (b - a);
      y = 0.84 - 0.018 * Math.min(root.v, 6) - 0.025 * Math.sin(phase) ** 2;
      if (latest && next && t > latest.end) {
        const d = next.t - latest.end,
          s = t - latest.end;
        y += 4.905 * s * (d - s);
      }
    }
    for (const f of feet.filter((f) => f.planted)) {
      const dx = Math.abs(root.x - f.ankle.x);
      if (dx > 0.86) throw new Error('Stride exceeds leg reach');
      y = Math.min(y, f.ankle.y + Math.sqrt(0.895 ** 2 - dx ** 2));
    }
    const hip = { x: root.x, y },
      lean = clamp(0.02 + 0.065 * root.v + 0.04 * root.a, -0.35, 0.5);
    const shoulder = add(hip, { x: Math.sin(lean) * 0.43, y: Math.cos(lean) * 0.43 });
    const c = latest ?? contacts[0],
      phase =
        ((t - c.t) / Math.max(0.15, (next?.t ?? c.t + interval(c.t)) - c.t)) * Math.PI +
        (c.foot ? Math.PI : 0);
    const amplitude = mix(0.24, 0.9, clamp(root.v / 5.6));
    const arm = [0, 1].map((i) => {
      const upper = 0.08 + (i ? -1 : 1) * Math.cos(phase) * amplitude;
      return [upper, upper + mix(0.2, 1.7, clamp(root.v / 3.5))];
    });
    const rig = limbs(hip, shoulder, feet, arm, lean * 0.55);
    // Free feet may be constrained by the leg; planted feet may not move.
    rig.legs.forEach((l, i) => {
      if (!feet[i].planted && l.error > 0) {
        const delta = { x: l.b.x - feet[i].ankle.x, y: l.b.y - feet[i].ankle.y };
        feet[i].ankle = l.b;
        feet[i].toe = add(feet[i].toe, delta);
        l.error = 0;
      }
      if (feet[i].toe.y < 0 && feet[i].ankle.y >= 0 && feet[i].ankle.y < 0.165) {
        feet[i].toe = { x: feet[i].ankle.x + Math.sqrt(0.165 ** 2 - feet[i].ankle.y ** 2), y: 0 };
      }
    });
    return rig;
  }
  return { contacts: contacts.filter((c) => c.t < to), at };
}
export function offsetRig(r: Rig, delta: Vec): Rig {
  const p = (v: Vec) => add(v, delta),
    l = (v: Limb) => ({ ...v, a: p(v.a), hinge: p(v.hinge), b: p(v.b) });
  return {
    ...r,
    hip: p(r.hip),
    shoulder: p(r.shoulder),
    spine: p(r.spine),
    head: p(r.head),
    neck: p(r.neck),
    legs: r.legs.map(l),
    arms: r.arms.map(l),
    feet: r.feet.map((f) => ({ ...f, ankle: p(f.ankle), toe: p(f.toe) })),
  };
}
export function withHip(r: Rig, hip: Vec): Rig {
  const delta = { x: hip.x - r.hip.x, y: hip.y - r.hip.y },
    shifted = offsetRig(r, delta);
  return limbs(
    hip,
    shifted.shoulder,
    r.feet,
    shifted.arms.map((a) => [
      Math.atan2(a.hinge.x - a.a.x, a.a.y - a.hinge.y),
      Math.atan2(a.b.x - a.hinge.x, a.hinge.y - a.b.y),
    ]),
    Math.atan2(shifted.head.x - shifted.shoulder.x, shifted.head.y - shifted.shoulder.y),
  );
}
/** FK tumble: the body folds before rotation. No rigid upright-stick rotation. */
export function tuckedPose(x: number, angle: number, tuck: number, height = 0): Rig {
  const hip = { x, y: height },
    shoulder = add(hip, { x: Math.sin(angle) * 0.43, y: Math.cos(angle) * 0.43 });
  const legs = [0, 1].map((i) => {
    const upper = mix(i ? -0.3 : 0.5, i ? 1.0 : 0.65, tuck) - angle;
    const lower = mix(i ? 0.25 : -0.15, i ? -1.65 : -1.95, tuck) - angle;
    const hinge = pendulum(hip, 0.45, upper),
      b = pendulum(hinge, 0.45, lower);
    return { a: hip, hinge, b, error: 0 };
  });
  const feet = legs.map((l) => foot(l.b, -0.3 - angle));
  const arms = [0, 1].map((i) => {
    const upper = mix(i ? 0.9 : -0.8, i ? 2.4 : 2.0, tuck) - angle;
    const lower = mix(i ? 1.6 : 0.1, i ? 0.25 : 0.15, tuck) - angle;
    const hinge = pendulum(shoulder, 0.285, upper);
    return { a: shoulder, hinge, b: pendulum(hinge, 0.275, lower), error: 0 };
  });
  const headAngle = angle + Math.PI * tuck;
  const head = add(shoulder, { x: Math.sin(headAngle) * 0.22, y: Math.cos(headAngle) * 0.22 });
  return {
    hip,
    shoulder,
    head,
    neck: lerp(shoulder, head, 0.42),
    spine: lerp(hip, shoulder, 0.48),
    arms,
    legs,
    feet,
  };
}
export function floorSupport(r: Rig) {
  const points = [
    { part: 'hip', p: r.hip, r: 0.025 },
    { part: 'shoulder', p: r.shoulder, r: 0.03 },
    ...r.arms.flatMap((a) => [
      { part: 'hand', p: a.b, r: 0.02 },
      { part: 'elbow', p: a.hinge, r: 0.025 },
    ]),
    ...r.legs.flatMap((a) => [
      { part: 'knee', p: a.hinge, r: 0.025 },
      { part: 'foot', p: a.b, r: 0.025 },
    ]),
    ...r.feet.map((f) => ({ part: 'foot', p: f.toe, r: 0 })),
  ];
  const lowest = points.reduce((a, b) => (a.p.y - a.r < b.p.y - b.r ? a : b));
  const correction = Math.max(0, lowest.r - lowest.p.y, 0.19 - r.head.y);
  return {
    rig: offsetRig(r, { x: 0, y: correction }),
    support: { part: lowest.part, point: { x: lowest.p.x, y: lowest.p.y + correction - lowest.r } },
    correction,
  };
}
export function boneError(r: Rig) {
  return Math.max(
    Math.abs(distance(r.hip, r.shoulder) - 0.43),
    Math.abs(distance(r.shoulder, r.head) - 0.22),
    ...r.legs.flatMap((l) => [
      Math.abs(distance(l.a, l.hinge) - 0.45),
      Math.abs(distance(l.hinge, l.b) - 0.45),
      l.error,
    ]),
    ...r.arms.flatMap((l) => [
      Math.abs(distance(l.a, l.hinge) - 0.285),
      Math.abs(distance(l.hinge, l.b) - 0.275),
      l.error,
    ]),
  );
}
export function posePoints(r: Rig) {
  return [
    r.hip,
    r.shoulder,
    r.head,
    ...r.legs.flatMap((l) => [l.hinge, l.b]),
    ...r.arms.flatMap((l) => [l.hinge, l.b]),
    ...r.feet.map((f) => f.toe),
  ];
}

export function inheritFreeLegs(r: Rig, previous: Rig, weight: number) {
  const angle = (a: Vec, b: Vec) => Math.atan2(b.x - a.x, a.y - b.y);
  const blend = (a: number, b: number) =>
    a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * clamp(weight);
  const footAngles = r.feet.map((f, i) =>
    blend(
      Math.atan2(
        previous.feet[i].toe.y - previous.feet[i].ankle.y,
        previous.feet[i].toe.x - previous.feet[i].ankle.x,
      ),
      Math.atan2(f.toe.y - f.ankle.y, f.toe.x - f.ankle.x),
    ),
  );
  r.legs = r.legs.map((l, i) => {
    const old = previous.legs[i],
      upper = blend(angle(old.a, old.hinge), angle(l.a, l.hinge)),
      lower = blend(angle(old.hinge, old.b), angle(l.hinge, l.b));
    const hinge = pendulum(r.hip, 0.45, upper),
      b = pendulum(hinge, 0.45, lower);
    return { a: r.hip, hinge, b, error: 0 };
  });
  r.feet = r.legs.map((l, i) => foot(l.b, footAngles[i]));
}
