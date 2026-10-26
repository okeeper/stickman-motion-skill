/** Pure geometry: no renderer, clock, or easing may change a physical trajectory. */
export type Point = { x: number; y: number };
export type Project = (p: Point) => [number, number];
export const project: Project = (p) => [(p.x - 3.1) * 150, 235 - p.y * 150];
/** Exact quadratic-to-cubic conversion, truncated at physical elapsed time. */
export function ballisticBezier(
  origin: Point,
  velocity: Point,
  gravity: number,
  seconds: number,
  map: Project = project,
) {
  if (
    ![origin.x, origin.y, velocity.x, velocity.y, gravity, seconds].every(
      Number.isFinite,
    ) ||
    gravity <= 0 ||
    seconds < 0
  )
    throw new Error("Invalid ballistic parameters");
  const end = {
    x: origin.x + velocity.x * seconds,
    y: origin.y + velocity.y * seconds - (gravity * seconds ** 2) / 2,
  };
  const control = {
    x: origin.x + (velocity.x * seconds) / 2,
    y: origin.y + (velocity.y * seconds) / 2,
  };
  const blend = (a: Point, b: Point, w: number) => ({
    x: a.x + (b.x - a.x) * w,
    y: a.y + (b.y - a.y) * w,
  });
  return {
    p0: map(origin),
    p1: map(blend(origin, control, 2 / 3)),
    p2: map(blend(end, control, 2 / 3)),
    p3: map(end),
  };
}
/** C1 at the hinge; bounded handles preserve fixed contact endpoints and avoid spline overshoot. */
export function jointKnots(a: Point, hinge: Point, b: Point) {
  const p = [a, hinge, b].map(project);
  const delta = (i: number, j: number) => [
    p[j][0] - p[i][0],
    p[j][1] - p[i][1],
  ];
  const u = delta(0, 1),
    v = delta(1, 2),
    l0 = Math.hypot(...u),
    l1 = Math.hypot(...v);
  const unit = (q: number[], l: number) => q.map((n) => n / Math.max(l, 1e-9));
  const q = unit(u, l0).map((n, i) => n + unit(v, l1)[i]);
  const tangent = unit(q, Math.hypot(...q));
  const radius = Math.min(l0, l1) * 0.16;
  const vec = (d: number[], scale: number): [number, number] => [
    d[0] * scale,
    d[1] * scale,
  ];
  return [
    { position: p[0], endHandle: vec(u, 0.3) },
    {
      position: p[1],
      startHandle: vec(tangent, -radius),
      endHandle: vec(tangent, radius),
    },
    { position: p[2], startHandle: vec(v, -0.3) },
  ];
}
