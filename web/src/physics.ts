import { clamp, ease, easeAcceleration, easeVelocity, mix, type Vec } from './math.js';
export type Preset = 'natural' | 'heroic' | 'heavy';
export interface Settings {
  mass: number;
  gravity: number;
  charge: number;
  effort: number;
  elasticity: number;
}
export const PRESETS: Record<Preset, Settings> = {
  natural: { mass: 70, gravity: 9.81, charge: 0.6, effort: 0.65, elasticity: 0.26 },
  heroic: { mass: 70, gravity: 9.81, charge: 1.05, effort: 1.1, elasticity: 0.78 },
  heavy: { mass: 105, gravity: 9.81, charge: 0.6, effort: 0.65, elasticity: 0.12 },
};
export const DT = 1 / 480;
export const HIP = 0.9,
  ANKLE = 0.055;
export type Phase = 'ready' | 'charge' | 'push' | 'flight' | 'absorb' | 'rebound' | 'settle';
export interface State {
  t: number;
  root: Vec;
  velocity: Vec;
  acceleration: Vec;
  force: number;
  phase: Phase;
  contact: boolean;
  supportX: number;
  charge: number;
  flight: number;
  lean: number;
  leanVelocity: number;
}
export interface Event {
  t: number;
  kind: 'takeoff' | 'impact' | 'bounce';
  speed: number;
  x: number;
}
export interface Motion {
  settings: Settings;
  duration: number;
  start: number;
  push: number;
  takeoff: number;
  land: number;
  depth: number;
  work: number;
  launch: Vec;
  origin: Vec;
  destination: Vec;
  height: number;
  springRest: number;
  stiffness: number;
  damping: number;
  samples: State[];
  events: Event[];
  at: (t: number) => State;
}
function validate(s: Settings) {
  for (const [k, a, b] of [
    ['mass', 45, 120],
    ['gravity', 6, 16],
    ['charge', 0.5, 1.3],
    ['effort', 0.55, 1.3],
    ['elasticity', 0, 1],
  ] as const) {
    if (!Number.isFinite(s[k]) || s[k] < a || s[k] > b)
      throw new Error(`${k} must be in [${a}, ${b}]`);
  }
}
/** Authored anticipation; powered extension; analytic ballistic flight; passive landing.
 * The root is an effective body mass, not a full articulated rigid-body simulation.
 * No ease function is applied to elapsed airborne time or to an impact velocity.
 */
export function createMotion(settings: Settings): Motion {
  validate(settings);
  const s = { ...settings },
    start = 0.7,
    depth = 0.24 + 0.13 * s.effort;
  // Keep downwards anticipation acceleration below gravity: contact cannot pull.
  const charge = Math.max(s.charge, Math.sqrt((5.78 * depth) / (0.82 * s.gravity)));
  const push = start + charge,
    work = 1400 * s.charge * s.effort;
  const stroke = depth + 0.075;
  const kinetic = work - s.mass * s.gravity * stroke;
  if (kinetic <= 0) throw new Error('蓄力不足以完成蹬伸：增加蓄力时间或发力强度。');
  // Share the work budget between forward and vertical motion.
  const speedSquared = (2 * kinetic) / s.mass,
    uncappedY = Math.sqrt(speedSquared / (1 + 0.42 ** 2));
  const vx = Math.min(2.7, uncappedY * 0.42),
    vy = Math.sqrt(speedSquared - vx * vx),
    pushTime = (2 * stroke) / vy;
  const takeoff = push + pushTime,
    flightTime = (vy + Math.sqrt(vy * vy + 2 * s.gravity * 0.075)) / s.gravity;
  const land = takeoff + flightTime;
  const origin = { x: 1.6 - 0.14 + 0.5 * vx * pushTime, y: HIP + 0.075 };
  const destination = { x: origin.x + vx * flightTime, y: HIP };
  // Keep static compression within the foot/leg's available extension range.
  const stiffness = Math.max(10000, (s.mass * s.gravity) / 0.08),
    ratio = 0.82 - 0.66 * s.elasticity;
  const damping = 2 * ratio * Math.sqrt(stiffness * s.mass),
    springRest = HIP + (s.mass * s.gravity) / stiffness;
  const minimumDuration = Math.max(5, land + 2.5);
  let duration = Math.ceil(Math.max(5, land + 14) * 60) / 60;
  let stableTime = 0,
    finished = false;
  const events: Event[] = [
    { t: takeoff, kind: 'takeoff', speed: vy, x: origin.x },
    { t: land, kind: 'impact', speed: vy, x: destination.x },
  ];
  const samples: State[] = [];
  const impactSpeed = Math.sqrt(vy * vy + 2 * s.gravity * 0.075);
  events[1].speed = impactSpeed;
  let x = destination.x,
    y = HIP,
    vxi = vx,
    vyi = -impactSpeed;
  let lean = 0,
    leanVelocity = 0,
    contact = true,
    elapsed = 0;
  function forceAt(py: number, pv: number) {
    return Math.max(0, stiffness * (springRest - py) - damping * pv);
  }
  // A passive horizontal spring/damper absorbs momentum through planted feet.
  let supportX = destination.x,
    targetX = supportX + 0.09;
  const horizontalOmega = 13;
  function supportStep(dt: number, t: number) {
    const force = contact ? forceAt(y, vyi) : 0;
    const ax = contact ? -2 * horizontalOmega * vxi - horizontalOmega ** 2 * (x - targetX) : 0;
    vxi += ax * dt;
    x += vxi * dt;
    // Airborne feet travel with the body; their new world contact freezes on impact.
    if (!contact) supportX += vxi * dt;
    vyi += (force / s.mass - s.gravity) * dt;
    y += vyi * dt;
    if (contact && y >= springRest && vyi > 0) {
      contact = false;
      events.push({ t, kind: 'bounce', speed: vyi, x });
    } else if (!contact && y <= springRest && vyi < 0) {
      contact = true;
      targetX = supportX + 0.09;
      events.push({ t, kind: 'impact', speed: -vyi, x });
    }
  }
  function base(t: number): Omit<State, 'lean' | 'leanVelocity'> {
    if (t < push) {
      const u = clamp((t - start) / charge),
        q = ease(u),
        dq = easeVelocity(u) / charge,
        ddq = easeAcceleration(u) / charge ** 2;
      return {
        t,
        root: { x: 1.6 - 0.14 * q, y: HIP - depth * q },
        velocity: { x: -0.14 * dq, y: -depth * dq },
        acceleration: { x: -0.14 * ddq, y: -depth * ddq },
        force: s.mass * (s.gravity - depth * ddq),
        phase: t < start ? 'ready' : 'charge',
        contact: true,
        supportX: 1.6,
        charge: q,
        flight: 0,
      };
    }
    if (t < takeoff) {
      const u = t - push,
        ax = vx / pushTime,
        ay = vy / pushTime;
      return {
        t,
        root: { x: 1.46 + 0.5 * ax * u * u, y: HIP - depth + 0.5 * ay * u * u },
        velocity: { x: ax * u, y: ay * u },
        acceleration: { x: ax, y: ay },
        force: s.mass * (s.gravity + ay),
        phase: 'push',
        contact: true,
        supportX: 1.6,
        charge: 1 - u / pushTime,
        flight: 0,
      };
    }
    if (t < land) {
      const u = t - takeoff;
      return {
        t,
        root: { x: origin.x + vx * u, y: origin.y + vy * u - 0.5 * s.gravity * u * u },
        velocity: { x: vx, y: vy - s.gravity * u },
        acceleration: { x: 0, y: -s.gravity },
        force: 0,
        phase: 'flight',
        contact: false,
        supportX: destination.x,
        charge: 0,
        flight: u / flightTime,
      };
    }
    const targetElapsed = t - land;
    while (elapsed < targetElapsed - 1e-10) {
      const dt = Math.min(DT, targetElapsed - elapsed);
      elapsed += dt;
      supportStep(dt, land + elapsed);
    }
    const force = contact ? forceAt(y, vyi) : 0;
    const phase: Phase = !contact
      ? 'rebound'
      : t < land + 0.18
        ? 'absorb'
        : Math.abs(vyi) > 0.06
          ? 'rebound'
          : 'settle';
    return {
      t,
      root: { x, y },
      velocity: { x: vxi, y: vyi },
      acceleration: {
        x: contact ? -2 * horizontalOmega * vxi - horizontalOmega ** 2 * (x - targetX) : 0,
        y: force / s.mass - s.gravity,
      },
      force,
      phase,
      contact,
      supportX,
      charge: 0,
      flight: 1,
    };
  }
  for (let i = 0; i <= Math.ceil(duration / DT); i++) {
    const t = i * DT,
      b = base(t);
    // A driven angular spring produces upper-body lag and follow-through.
    let target = 0.03;
    if (b.phase === 'charge') target = 0.68 * b.charge;
    if (b.phase === 'push') target = mix(0.68, 0.08, 1 - b.charge);
    if (b.phase === 'flight') target = mix(-0.2, 0.25, ease(b.flight));
    if (t >= land) target = 0.06 + Math.max(0, HIP - b.root.y) * 1.8;
    const inertia = s.mass / 70;
    const angularAcceleration = (110 * (target - lean) - 14 * leanVelocity) / inertia;
    leanVelocity += angularAcceleration * DT;
    lean += leanVelocity * DT;
    samples.push({ ...b, lean, leanVelocity });
    const stable =
      t > land &&
      b.contact &&
      Math.abs(b.root.y - HIP) < 0.005 &&
      Math.abs(b.velocity.y) < 0.02 &&
      Math.abs(b.velocity.x) < 0.02 &&
      Math.abs(leanVelocity) < 0.03;
    stableTime = stable ? stableTime + DT : 0;
    if (!finished && t >= minimumDuration && stableTime >= 0.15) {
      duration = Math.ceil(t * 60) / 60;
      finished = true;
    }
  }
  if (!finished) throw new Error('Motion did not settle within the supported recovery window');
  const motion: Motion = {
    settings: s,
    duration,
    start,
    push,
    takeoff,
    land,
    depth,
    work,
    launch: { x: vx, y: vy },
    origin,
    destination,
    height: (vy * vy) / (2 * s.gravity),
    springRest,
    stiffness,
    damping,
    samples,
    events,
    at(t: number) {
      if (!Number.isFinite(t)) throw new Error('time must be finite');
      t = clamp(t, 0, duration);
      // Preserve the exact analytic airborne trajectory at arbitrary frame rates.
      const index = Math.min(samples.length - 2, Math.floor(t / DT)),
        a = samples[index],
        b = samples[index + 1],
        u = (t - a.t) / DT;
      const state: State = {
        ...a,
        t,
        root: { x: mix(a.root.x, b.root.x, u), y: mix(a.root.y, b.root.y, u) },
        velocity: { x: mix(a.velocity.x, b.velocity.x, u), y: mix(a.velocity.y, b.velocity.y, u) },
        acceleration: {
          x: mix(a.acceleration.x, b.acceleration.x, u),
          y: mix(a.acceleration.y, b.acceleration.y, u),
        },
        force: mix(a.force, b.force, u),
        supportX: mix(a.supportX, b.supportX, u),
        charge: mix(a.charge, b.charge, u),
        flight: mix(a.flight, b.flight, u),
        lean: mix(a.lean, b.lean, u),
        leanVelocity: mix(a.leanVelocity, b.leanVelocity, u),
      };
      if (t < land) Object.assign(state, base(t));
      else if (a.t < land) {
        state.contact = true;
        state.phase = 'absorb';
        state.force = forceAt(state.root.y, state.velocity.y);
      }
      if (t >= takeoff && t < land) {
        const dt = t - takeoff;
        Object.assign(state, {
          root: { x: origin.x + vx * dt, y: origin.y + vy * dt - 0.5 * s.gravity * dt * dt },
          velocity: { x: vx, y: vy - s.gravity * dt },
          acceleration: { x: 0, y: -s.gravity },
          phase: 'flight',
          contact: false,
          force: 0,
          flight: dt / flightTime,
          charge: 0,
        });
      }
      return state;
    },
  };
  return motion;
}
