import type { Rig } from '../rig.js';
import type { Vec } from '../math.js';
import type { FoleyCue } from '../foley.mjs';
import { boneError, posePoints, offsetRig } from '../stunt.js';
import { clamp, smooth, mix, connect } from './motion.js';
import { negativeRaw, negativeEvents, NEGATIVE_CUTS, NEGATIVE_TRANSFERS } from './negative.js';
import { binaryRaw, binaryEvents, BINARY_CUTS } from './binary.js';
import { complexRaw, complexEvents, COMPLEX_CUTS, COMPLEX_TRANSFERS } from './complex.js';
export { cartAt, SWITCHES, JUMP, DECK, NEGATIVE_TRANSFERS } from './negative.js';
export { VALUES, TARGET, QUERIES, doorX, searchSteps, searchAt } from './binary.js';
export { RADIUS, TURNS, LEDGE, orbitAt, climbGrips, COMPLEX_TRANSFERS } from './complex.js';
export const IDS = ['negative-ride', 'binary-search', 'complex-rotation'] as const;
export type FilmId = (typeof IDS)[number];
const film = (title: string, duration: number) => ({
  title,
  duration,
  width: 1280,
  height: 720,
  fps: 60,
});
export const FILMS = {
  'negative-ride': film('别追，等它回来', 75),
  'binary-search': film('谁在敲门', 85),
  'complex-rotation': film('世界的侧面', 90),
};
export type Camera = { x: number; y: number; width: number };
export interface State {
  t: number;
  rig: Rig;
  phase: string;
  camera: Camera;
  boneError: number;
  points: Vec[];
  cart?: ReturnType<typeof negativeRaw>['cart'];
  query?: ReturnType<typeof binaryRaw>['query'];
  frame?: ReturnType<typeof binaryRaw>['frame'];
  orbit?: ReturnType<typeof complexRaw>['orbit'];
  clip?: ReturnType<typeof complexRaw>['clip'];
}
const raws = {
  'negative-ride': negativeRaw,
  'binary-search': binaryRaw,
  'complex-rotation': complexRaw,
};
const cuts = {
  'negative-ride': NEGATIVE_CUTS,
  'binary-search': BINARY_CUTS,
  'complex-rotation': COMPLEX_CUTS,
};
export function sample(id: FilmId, t: number): State {
  if (!IDS.includes(id) || !Number.isFinite(t) || t < 0 || t > FILMS[id].duration)
    throw new Error('time must be within a known film');
  const raw = raws[id],
    s = raw(t),
    cut = [...cuts[id]].reverse().find((a) => t >= a && t < a + 0.18);
  if (cut !== undefined && !(id === 'negative-ride' && Math.abs(cut - 61.06) < 1e-6)) {
    const before = raw(cut - 1e-7),
      actual = s.rig;
    s.rig = connect(s.rig, before.rig, smooth(t, cut, cut + 0.18));
    const transfers =
      id === 'negative-ride'
        ? NEGATIVE_TRANSFERS
        : id === 'complex-rotation'
          ? COMPLEX_TRANSFERS
          : [];
    if (transfers.some((h) => t >= h.takeoff && t < h.land))
      s.rig = offsetRig(s.rig, { x: actual.hip.x - s.rig.hip.x, y: actual.hip.y - s.rig.hip.y });
  }
  const cameraCut = [...cuts[id]].reverse().find((a) => t >= a && t < a + 0.6);
  if (cameraCut !== undefined) {
    const prev = raw(cameraCut - 1e-7).camera,
      w = smooth(t, cameraCut, cameraCut + 0.6);
    s.camera = {
      x: mix(prev.x, s.camera.x, w),
      y: mix(prev.y, s.camera.y, w),
      width: mix(prev.width, s.camera.width, w),
    };
  }
  const points = posePoints(s.rig);
  // The actor is always readable; wide structure shots remain intentionally wider.
  const minWidth = Math.max(
    ...points.map((p) =>
      Math.max(Math.abs(p.x - s.camera.x) / 0.46, Math.abs(p.y - s.camera.y) / 0.245),
    ),
  );
  s.camera.width = Math.max(s.camera.width, minWidth);
  if ('frame' in s && t > 20.3) {
    s.frame.x = s.rig.arms[0].b.x - 0.11;
    s.frame.y = s.rig.arms[0].b.y + 0.14;
  }
  if ('clip' in s && s.clip.held > 0.01) {
    s.clip.x = s.rig.arms[1].b.x + 0.025;
    s.clip.y = s.rig.arms[1].b.y + 0.035;
  }
  return { ...s, t, boneError: boneError(s.rig), points };
}
const eventCache = new Map<FilmId, FoleyCue[]>();
function score(id: FilmId): FoleyCue[] {
  const segments =
    id === 'negative-ride'
      ? [
          [2, 11, 1.35, 0.24],
          [27, 34, 1.1, 0.2],
          [44, 51, 1.2, 0.21],
          [54, 60.4, 0.45, 0.2],
          [63.2, 72, 1.6, 0.2],
        ]
      : id === 'binary-search'
        ? [
            [1, 4.4, 1.8, 0.18],
            [10.8, 17.2, 0.7, 0.18],
            [24, 28, 1, 0.2],
            [35, 49, 0.55, 0.18],
            [51, 55, 1.4, 0.15],
            [80.5, 84.5, 1.6, 0.18],
          ]
        : [
            [2, 8, 1.5, 0.2],
            [14.5, 19, 1.8, 0.15],
            [26.5, 30, 1.2, 0.16],
            [39, 49, 0.55, 0.2],
            [64, 71, 1.2, 0.18],
            [74, 78.5, 0.38, 0.2],
            [84, 89, 1.6, 0.18],
          ];
  const notes = [146.832, 220, 174.614, 293.665, 261.626, 220, 164.814, 196];
  return segments
    .flatMap(([a, b, beat, strength], s) =>
      Array.from({ length: Math.ceil((b - a) / beat) }, (_, i) => ({
        id: `${id}-music-${s}-${i}`,
        t: a + i * beat,
        kind: 'music',
        x: 0,
        strength,
        note: notes[(i + s * 2) % notes.length],
        duration: Math.min(1.25, beat * 1.3),
        pan: 0,
      })),
    )
    .filter((c) => c.t < FILMS[id].duration);
}
export function events(id: FilmId): FoleyCue[] {
  if (!IDS.includes(id)) throw new Error('Unknown film');
  if (!eventCache.has(id)) {
    const cues = [
      ...(id === 'negative-ride'
        ? negativeEvents()
        : id === 'binary-search'
          ? binaryEvents()
          : complexEvents()),
      ...score(id),
    ];
    const result = cues
      .filter((e) => e.t >= 0 && e.t < FILMS[id].duration)
      .sort((a, b) => a.t - b.t)
      .map((e) => ({
        ...e,
        pan:
          e.pan ??
          clamp((e.x - sample(id, e.t).camera.x) / (sample(id, e.t).camera.width / 2), -0.85, 0.85),
      }));
    eventCache.set(id, result);
  }
  return eventCache.get(id)!.map((e) => ({ ...e }));
}
