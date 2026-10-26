import { add, clamp, lerp, mix, smooth, twoBone, type Vec } from '../math.js';
import { inheritUpperBody, reach } from '../performance.js';
import type { Rig } from '../rig.js';
import {
  boneError,
  floorSupport,
  foot,
  inheritFreeLegs,
  limbs,
  locomotion,
  posePoints,
  speedTrack,
  tuckedPose,
  withHip,
} from '../stunt.js';

export const FILM = { title: '断点', duration: 11, width: 1280, height: 720, fps: 60 };
export const TAKEOFF = 4.18,
  GRAVITY = 9.81,
  VERTICAL_SPEED = 3.2;
const LAND_Y = 0.72,
  LAUNCH_Y = 0.83;
export const LAND =
  TAKEOFF +
  (VERTICAL_SPEED + Math.sqrt(VERTICAL_SPEED ** 2 + 2 * GRAVITY * (LAUNCH_Y - LAND_Y))) / GRAVITY;
export const TRIP = 5.35,
  ROLL = 5.72,
  RECOVER = 6.32,
  RESUME = 6.68;
export const TRAVEL = speedTrack(
  [
    { t: 0, v: 0 },
    { t: 0.32, v: 1.35 },
    { t: 1.5, v: 1.35 },
    { t: 1.9, v: 3.3 },
    { t: 2.5, v: 3.3 },
    { t: 2.9, v: 5.6 },
    { t: 5.35, v: 5.6 },
    { t: 5.84, v: 3.1 },
    { t: 6.32, v: 1.7 },
    { t: 6.68, v: 2.4 },
    { t: 7.4, v: 5.7 },
    { t: 8.7, v: 5.7 },
    { t: 9.45, v: 1.35 },
    { t: 9.7, v: 1.35 },
    { t: 10.35, v: 0 },
    { t: 11, v: 0 },
  ],
  0.5,
);
const cadence = (t: number) => (TRAVEL.at(t).v < 2 ? 0.44 : TRAVEL.at(t).v < 4.5 ? 0.29 : 0.22);
const BEFORE = locomotion(TRAVEL, 0, 4.0, cadence);
const AFTER = locomotion(TRAVEL, LAND, TRIP, cadence);
const ESCAPE = locomotion(TRAVEL, RESUME, 10.35, cadence);
const START_POSE = BEFORE.at(4.0),
  LAND_POSE = AFTER.at(LAND),
  TRIP_POSE = AFTER.at(TRIP);
const LAUNCH_X = TRAVEL.at(TAKEOFF).x;
const CAUGHT = (TRIP_POSE.feet[0].planted ? 0 : 1) as 0 | 1;
export const SHARD_X = TRIP_POSE.feet[CAUGHT].toe.x;
export const GAP = { from: LAUNCH_X + 0.43, to: TRAVEL.at(LAND).x - 0.68 };
export const GATE_X = TRAVEL.at(8.66).x;

function hermite(a: number, b: number, va: number, vb: number, u: number, duration: number) {
  return (
    (2 * u ** 3 - 3 * u * u + 1) * a +
    (u ** 3 - 2 * u * u + u) * duration * va +
    (-2 * u ** 3 + 3 * u * u) * b +
    (u ** 3 - u * u) * duration * vb
  );
}
const footAngle = (f: Rig['feet'][number]) => Math.atan2(f.toe.y - f.ankle.y, f.toe.x - f.ankle.x);
const flatAngle = -Math.asin(0.055 / 0.165);
function freeConstraints(r: Rig) {
  r.legs.forEach((l, i) => {
    if (!r.feet[i].planted && l.error > 0) {
      const delta = { x: l.b.x - r.feet[i].ankle.x, y: l.b.y - r.feet[i].ankle.y };
      r.feet[i].ankle = l.b;
      r.feet[i].toe = add(r.feet[i].toe, delta);
      l.error = 0;
    }
  });
  return r;
}
function preload(t: number) {
  const u = smooth(t, 4.0, 4.08),
    p = clamp((t - 4.055) / (TAKEOFF - 4.055));
  const y =
    t < 4.055
      ? mix(START_POSE.hip.y, 0.57, smooth(t, 4.0, 4.055))
      : hermite(0.57, LAUNCH_Y, 0, VERTICAL_SPEED, p, TAKEOFF - 4.055);
  const hip = { x: TRAVEL.at(t).x, y },
    lean = mix(0.42, 0.32, p);
  const shoulder = add(hip, { x: Math.sin(lean) * 0.43, y: Math.cos(lean) * 0.43 });
  const feet = [
    foot(
      lerp(START_POSE.feet[0].ankle, { x: LAUNCH_X - 0.1, y: 0.055 }, u),
      mix(footAngle(START_POSE.feet[0]), flatAngle, u),
      t >= 4.08,
    ),
    foot(
      lerp(START_POSE.feet[1].ankle, { x: hip.x + 0.18, y: hip.y - 0.48 }, smooth(t, 4.0, TAKEOFF)),
      mix(footAngle(START_POSE.feet[1]), flatAngle, smooth(t, 4.0, TAKEOFF)),
    ),
  ];
  const arm = mix(-0.8, 2.0, p);
  const r = limbs(
    hip,
    shoulder,
    feet,
    [
      [arm - 0.12, arm + 0.35],
      [arm + 0.12, arm + 0.6],
    ],
    lean * 0.5,
  );
  inheritUpperBody(r, START_POSE, smooth(t, 4.0, 4.05));
  return freeConstraints(r);
}
const LAUNCH_POSE = preload(TAKEOFF);
function flight(t: number) {
  const dt = t - TAKEOFF,
    u = dt / (LAND - TAKEOFF),
    rise = VERTICAL_SPEED * dt - (GRAVITY * dt * dt) / 2;
  const hip = { x: TRAVEL.at(t).x, y: LAUNCH_Y + rise };
  const feet = LAUNCH_POSE.feet.map((f, i) => {
    const carried = add(f.ankle, { x: hip.x - LAUNCH_X, y: rise });
    const tuck = add(hip, i ? { x: 0.28, y: -0.43 } : { x: -0.3, y: -0.51 });
    const final = add(hip, {
      x: LAND_POSE.feet[i].ankle.x - LAND_POSE.hip.x,
      y: LAND_POSE.feet[i].ankle.y - LAND_Y,
    });
    return foot(
      lerp(lerp(carried, tuck, smooth(u, 0, 0.26)), final, smooth(u, 0.55, 1)),
      mix(
        mix(-Math.asin(0.055 / 0.165), -0.6, smooth(u, 0, 0.22)),
        -Math.asin(0.055 / 0.165),
        smooth(u, 0.65, 1),
      ),
    );
  });
  const lean = mix(0.32, 0.48, smooth(u, 0.3, 1));
  const shoulder = add(hip, { x: Math.sin(lean) * 0.43, y: Math.cos(lean) * 0.43 });
  const r = limbs(
    hip,
    shoulder,
    feet,
    [
      [mix(1.88, 0.2, u), mix(2.35, 1.6, u)],
      [mix(2.12, -0.3, u), mix(2.6, 1.1, u)],
    ],
    lean * 0.5,
  );
  inheritUpperBody(r, LAND_POSE, 1 - smooth(u, 0.78, 1));
  return freeConstraints(r);
}
function landing(t: number) {
  const r = AFTER.at(t),
    dt = t - LAND,
    impact = VERTICAL_SPEED - GRAVITY * (LAND - TAKEOFF);
  const adjusted = withHip(r, { x: r.hip.x, y: r.hip.y + impact * dt * Math.exp(-26 * dt) });
  return freeConstraints(adjusted);
}
function tumble(t: number) {
  const dt = t - TRIP;
  const fall = t < ROLL;
  const turn = fall
    ? hermite(0.4, 2.25, 2.0, 4.5, clamp((t - TRIP) / (ROLL - TRIP)), ROLL - TRIP)
    : hermite(
        2.25,
        Math.PI * 2 - 0.06,
        4.5,
        4.0,
        clamp((t - ROLL) / (RECOVER - ROLL)),
        RECOVER - ROLL,
      );
  const tuck = smooth(t, TRIP + 0.025, ROLL - 0.03);
  const h = fall ? TRIP_POSE.hip.y + 0.4 * dt - (GRAVITY * dt * dt) / 2 : 0;
  let r = tuckedPose(TRAVEL.at(t).x, turn, tuck, h);
  if (fall) {
    inheritUpperBody(r, TRIP_POSE, smooth(t, TRIP, TRIP + 0.13));
    inheritFreeLegs(r, TRIP_POSE, smooth(t, TRIP, TRIP + 0.19));
    if (t < 5.45) {
      const f = TRIP_POSE.feet[CAUGHT];
      r.feet[CAUGHT] = { ...f, planted: true };
      const k = twoBone(r.hip, f.ankle, 0.45, 0.45, 1);
      r.legs[CAUGHT] = { a: r.hip, hinge: k.joint, b: k.end, error: k.error };
    }
  }
  const solved = floorSupport(r);
  r = solved.rig;
  if (t < 5.45) {
    const f = TRIP_POSE.feet[CAUGHT];
    r.feet[CAUGHT] = { ...f, planted: true };
    const k = twoBone(r.hip, f.ankle, 0.45, 0.45, 1);
    r.legs[CAUGHT] = { a: r.hip, hinge: k.joint, b: k.end, error: k.error };
  }
  if (t >= 5.6 && t < 5.8) {
    const target = { x: TRAVEL.at(5.64).x + 0.46, y: 0.025 };
    reach(r, 1, target, smooth(t, 5.6, 5.64));
  }
  return { rig: r, support: solved.support };
}
const ROLL_END = tumble(RECOVER).rig;
const RESUME_POSE = ESCAPE.at(RESUME);
function recover(t: number) {
  const u = smooth(t, RECOVER, RESUME);
  const x = TRAVEL.at(t).x,
    hip = { x, y: mix(ROLL_END.hip.y, RESUME_POSE.hip.y, u) };
  const theta = mix(0.9, 0.02 + 0.065 * TRAVEL.at(t).v, u);
  const shoulder = add(hip, { x: Math.sin(theta) * 0.43, y: Math.cos(theta) * 0.43 });
  const feet = RESUME_POSE.feet.map((f, i) => {
    const u = smooth(t, RECOVER, 6.5 + i * 0.03),
      a = footAngle(ROLL_END.feet[i]);
    return foot(
      lerp(ROLL_END.feet[i].ankle, f.ankle, u),
      a + Math.atan2(Math.sin(flatAngle - a), Math.cos(flatAngle - a)) * u,
      t >= 6.5 + i * 0.03,
    );
  });
  const r = limbs(
    hip,
    shoulder,
    feet,
    [
      [0.8, 1.5],
      [-0.3, 0.9],
    ],
    mix(0.7, 0.1, u),
  );
  inheritUpperBody(r, ROLL_END, smooth(t, RECOVER, 6.44));
  // The recovery ends in the next running pose; it does not reset to a neutral stand.
  inheritUpperBody(r, RESUME_POSE, 1 - smooth(t, 6.5, RESUME));
  return freeConstraints(r);
}
export interface ActionEvent {
  id: string;
  t: number;
  kind: string;
  x: number;
  strength: number;
  duration?: number;
  gait?: string;
  foot?: number;
}
export function sample(t: number) {
  if (!Number.isFinite(t) || t < 0 || t > FILM.duration)
    throw new Error('time must be finite and inside scene');
  let rig: Rig,
    phase: string,
    support: { part: string; point: Vec } | null = null;
  if (t < 4.0) {
    rig = BEFORE.at(t);
    phase = t < 1.5 ? 'walk' : t < 2.7 ? 'run' : 'sprint';
  } else if (t < TAKEOFF) {
    rig = preload(t);
    phase = 'running-takeoff';
  } else if (t < LAND) {
    rig = flight(t);
    phase = 'jump';
  } else if (t < TRIP) {
    rig = landing(t);
    phase = 'landing-run';
  } else if (t < RECOVER) {
    const r = tumble(t);
    rig = r.rig;
    support = r.support;
    phase = t < ROLL ? 'fall' : 'roll';
  } else if (t < RESUME) {
    rig = recover(t);
    phase = 'recover';
  } else {
    rig = ESCAPE.at(t);
    phase = t < 7.4 ? 'run' : t < 8.7 ? 'dash' : t < 9.45 ? 'brake' : 'walk';
  }
  if (t > 10.35) {
    rig = ESCAPE.at(10.35);
    phase = 'safe';
    const u = smooth(t, 10.35, 10.62);
    rig = withHip(rig, { x: rig.hip.x, y: mix(rig.hip.y, 0.86, u) });
    rig.feet[0] = foot(
      lerp(rig.feet[0].ankle, { x: rig.hip.x - 0.1, y: 0.055 }, u),
      mix(footAngle(rig.feet[0]), flatAngle, u),
      t >= 10.62,
    );
    const k = twoBone(rig.hip, rig.feet[0].ankle, 0.45, 0.45, 1);
    rig.legs[0] = { a: rig.hip, hinge: k.joint, b: k.end, error: k.error };
  }
  const glance = smooth(t, 1.15, 1.26) * (1 - smooth(t, 1.37, 1.6)) + smooth(t, 9.85, 10.35) * 0.65;
  if (glance > 0) {
    const angle = mix(
      Math.atan2(rig.head.x - rig.shoulder.x, rig.head.y - rig.shoulder.y),
      -0.75,
      glance,
    );
    rig.head = add(rig.shoulder, { x: Math.sin(angle) * 0.22, y: Math.cos(angle) * 0.22 });
    rig.neck = lerp(rig.shoulder, rig.head, 0.42);
  }
  const travel = TRAVEL.at(t);
  const camera = TRAVEL.at(Math.max(0, t - 0.055)).x + 1.45 - 3.05 * smooth(t, 9.0, 10.45);
  const points = posePoints(rig);
  return {
    t,
    rig,
    phase,
    support,
    velocity: travel.v,
    camera,
    boneError: boneError(rig),
    groundMin: Math.min(rig.head.y - 0.15, ...points.filter((p) => p !== rig.head).map((p) => p.y)),
    gap: GAP,
    shard: SHARD_X,
    gate: GATE_X,
  };
}
const footsteps = [...BEFORE.contacts, ...AFTER.contacts, ...ESCAPE.contacts].filter(
  (c) => c.t > 0.01 && Math.abs(c.t - LAND) > 1e-6 && Math.abs(c.t - RESUME) > 1e-6 && c.t < 10.35,
);
export const EVENTS: ActionEvent[] = [
  ...footsteps.map((c, i) => ({
    id: `foot-${i}`,
    t: c.t,
    kind: 'footstep',
    x: c.x,
    strength: 0.45 + 0.07 * c.speed,
    gait: c.mode,
    foot: c.foot,
  })),
  { id: 'alarm', t: 1.15, kind: 'alarm', x: TRAVEL.at(1.15).x - 2.5, strength: 0.6 },
  { id: 'push', t: 4.08, kind: 'shoe-grip', x: LAUNCH_X - 0.1, strength: 0.8 },
  { id: 'takeoff', t: TAKEOFF, kind: 'whoosh', x: LAUNCH_X, strength: 0.55, duration: 0.24 },
  { id: 'land', t: LAND, kind: 'landing', x: TRAVEL.at(LAND).x, strength: 1, foot: 0 },
  { id: 'tile', t: 5.26, kind: 'tile', x: SHARD_X, strength: 0.65 },
  { id: 'catch', t: TRIP, kind: 'shoe-grip', x: SHARD_X, strength: 0.8 },
  { id: 'hand', t: 5.64, kind: 'hand', x: TRAVEL.at(5.64).x + 0.46, strength: 0.7 },
  { id: 'roll-cloth', t: ROLL, kind: 'cloth', x: TRAVEL.at(ROLL).x, strength: 0.65, duration: 0.6 },
  { id: 'exhale', t: 5.7, kind: 'breath', x: TRAVEL.at(5.7).x, strength: 0.4, duration: 0.25 },
  {
    id: 'recover-shoe',
    t: 6.5,
    kind: 'shoe-grip',
    x: RESUME_POSE.feet[0].toe.x,
    strength: 0.6,
    foot: 0,
  },
  {
    id: 'recover-other-foot',
    t: 6.5 + 0.03,
    kind: 'footstep',
    x: RESUME_POSE.feet[1].ankle.x,
    strength: 0.4,
    gait: 'run',
    foot: 1,
  },
  { id: 'dash-air', t: 7.4, kind: 'whoosh', x: TRAVEL.at(7.4).x, strength: 0.5, duration: 0.24 },
  { id: 'brake', t: 8.83, kind: 'skid', x: TRAVEL.at(8.83).x, strength: 0.6, duration: 0.3 },
  { id: 'gate', t: 9.08, kind: 'gate', x: GATE_X, strength: 0.85 },
  { id: 'relief', t: 10.25, kind: 'breath', x: TRAVEL.at(10.25).x, strength: 0.25, duration: 0.45 },
  {
    id: 'last-step',
    t: 10.62,
    kind: 'footstep',
    x: TRAVEL.at(10.62).x - 0.1,
    strength: 0.28,
    gait: 'walk',
    foot: 0,
  },
];
// Body thumps are emitted by changes of actual support, rather than a separate guessed rhythm.
let lastPart = '',
  lastTime = -1;
for (let t = ROLL; t < RECOVER; t += 1 / 240) {
  const s = tumble(t).support;
  if (s.point.y < 0.04 && s.part !== lastPart && t - lastTime > 0.095) {
    if (['shoulder', 'hip', 'elbow', 'knee'].includes(s.part))
      EVENTS.push({
        id: `body-${EVENTS.length}`,
        t,
        kind: 'body',
        x: s.point.x,
        strength: s.part === 'shoulder' ? 0.8 : 0.5,
      });
    lastPart = s.part;
    lastTime = t;
  }
}
EVENTS.sort((a, b) => a.t - b.t);
