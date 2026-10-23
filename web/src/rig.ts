import { add, clamp, distance, lerp, mix, pendulum, smooth, twoBone, type Vec } from './math.js';
import { ANKLE, HIP, type Motion, type State } from './physics.js';
export interface Limb {
  a: Vec;
  hinge: Vec;
  b: Vec;
  error: number;
}
export interface Rig {
  hip: Vec;
  shoulder: Vec;
  spine: Vec;
  head: Vec;
  neck: Vec;
  legs: Limb[];
  arms: Limb[];
  feet: { ankle: Vec; toe: Vec; planted: boolean }[];
}
const LEG = 0.45,
  UPPER = 0.285,
  LOWER = 0.275,
  FOOT = 0.165;
function anchoredFoot(x: number, heel: number) {
  const h = clamp(heel, ANKLE, FOOT - 0.005),
    toe = { x: x + Math.sqrt(FOOT ** 2 - ANKLE ** 2), y: 0 };
  return { toe, ankle: { x: toe.x - Math.sqrt(FOOT ** 2 - h * h), y: h }, planted: true };
}
function feet(m: Motion, s: State) {
  const offsets = [-0.14, 0.13];
  if (s.t < m.takeoff) {
    const heel = ANKLE + 0.06 * smooth(s.t, m.push, m.takeoff);
    return offsets.map((dx) => anchoredFoot(1.6 + dx, heel));
  }
  const landing = offsets.map((dx) => anchoredFoot(m.destination.x + dx, ANKLE));
  if (s.t < m.land) {
    const u = s.flight,
      fold = smooth(u, 0.015, 0.23),
      unfold = smooth(u, 0.56, 1);
    return offsets.map((dx, i) => {
      const initial = anchoredFoot(1.6 + dx, ANKLE + 0.06);
      const translated = add(initial.ankle, { x: s.root.x - m.origin.x, y: s.root.y - m.origin.y });
      const tucked = add(s.root, i === 0 ? { x: -0.26, y: -0.49 } : { x: 0.22, y: -0.58 });
      const landingRelative = add(s.root, {
        x: landing[i].ankle.x - m.destination.x,
        y: ANKLE - HIP,
      });
      const ankle = lerp(lerp(translated, tucked, fold), landingRelative, unfold);
      // The foot rotates around the ankle and unfolds before impact.
      const angle = mix(
        mix(-Math.asin((ANKLE + 0.06) / FOOT), -0.6, fold),
        -Math.asin(ANKLE / FOOT),
        unfold,
      );
      const toe = { x: ankle.x + FOOT * Math.cos(angle), y: ankle.y + FOOT * Math.sin(angle) };
      return { ankle, toe, planted: false };
    });
  }
  const lift = Math.max(0, s.root.y - HIP);
  if (s.contact) return offsets.map((dx) => anchoredFoot(s.supportX + dx, ANKLE + lift));
  // Passive rebound keeps the previous support geometry, translating it in flight.
  return offsets.map((dx) => {
    const a = anchoredFoot(s.supportX + dx, ANKLE + m.springRest - HIP);
    const rise = Math.max(0, s.root.y - m.springRest);
    return {
      ankle: add(a.ankle, { x: 0, y: rise }),
      toe: add(a.toe, { x: 0, y: rise }),
      planted: false,
    };
  });
}
export function skeleton(m: Motion, s: State): Rig {
  const hip = s.root,
    angle = s.lean;
  const shoulder = add(hip, { x: Math.sin(angle) * 0.43, y: Math.cos(angle) * 0.43 });
  const neckAngle = angle * 0.65 - s.leanVelocity * 0.022;
  const head = add(shoulder, { x: Math.sin(neckAngle) * 0.22, y: Math.cos(neckAngle) * 0.22 });
  const neck = lerp(shoulder, head, 0.42);
  const spine = add(lerp(hip, shoulder, 0.48), { x: -0.025 * Math.sin(angle), y: 0 });
  const contacts = feet(m, s);
  const legs = contacts.map((f) => {
    const ik = twoBone(hip, f.ankle, LEG, LEG, 1);
    return { a: hip, hinge: ik.joint, b: ik.end, error: ik.error };
  });
  let upper = -0.08,
    forearm = 0.1;
  if (s.t >= m.start && s.t < m.push) {
    upper = mix(-0.08, -1.2, s.charge);
    forearm = mix(0.1, -1.02, s.charge);
  }
  if (s.t >= m.push && s.t < m.takeoff) {
    const p = smooth(s.t, m.push, m.takeoff);
    upper = mix(-1.2, 2.25, p);
    forearm = mix(-1.02, 2.48, p);
  }
  if (s.t >= m.takeoff && s.t < m.land) {
    upper = mix(2.25, 0.58, smooth(s.flight, 0, 1));
    forearm = mix(2.48, 1.16, smooth(s.flight, 0.06, 1));
  }
  if (s.t >= m.land) {
    const dt = s.t - m.land,
      p = smooth(dt, 0.35, 1.4),
      decay = Math.exp(-3.8 * dt);
    upper = mix(0.58, -0.08, p) + 0.5 * decay * Math.sin(dt * 10);
    forearm = mix(1.16, 0.1, p) + 0.65 * decay * Math.sin(dt * 10 - 0.1) * smooth(dt, 0, 0.07);
  }
  const arms = [0, 1].map((i) => {
    const stagger = i === 0 ? -0.16 : 0.12;
    const elbow = pendulum(shoulder, UPPER, upper + stagger);
    const wrist = pendulum(elbow, LOWER, forearm - stagger * 0.5);
    return {
      a: shoulder,
      hinge: elbow,
      b: wrist,
      error: Math.abs(distance(shoulder, elbow) - UPPER),
    };
  });
  return { hip, shoulder, head, neck, spine, legs, arms, feet: contacts };
}
