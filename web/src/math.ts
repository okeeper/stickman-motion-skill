export type Vec = { x: number; y: number };
export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const mix = (a: number, b: number, u: number) => a + (b - a) * u;
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const lerp = (a: Vec, b: Vec, u: number): Vec => ({
  x: mix(a.x, b.x, u),
  y: mix(a.y, b.y, u),
});
export const distance = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
export const ease = (q: number) => {
  const u = clamp(q);
  return u * u * u * (10 + u * (-15 + 6 * u));
};
export const smooth = (t: number, a: number, b: number) => ease((t - a) / (b - a));
export const easeVelocity = (u: number) => (u > 0 && u < 1 ? 30 * u * u * (1 - u) * (1 - u) : 0);
export const easeAcceleration = (u: number) =>
  u > 0 && u < 1 ? 60 * u * (1 - u) * (1 - 2 * u) : 0;
export const radians = (deg: number) => (deg * Math.PI) / 180;
/** World y points up. +bend chooses the joint on the left of the endpoint ray. */
export function twoBone(origin: Vec, goal: Vec, a: number, b: number, bend = 1) {
  const dx = goal.x - origin.x,
    dy = goal.y - origin.y;
  const raw = Math.hypot(dx, dy),
    d = clamp(raw, Math.abs(a - b) + 1e-6, a + b - 1e-6);
  const ux = raw > 1e-9 ? dx / raw : 0,
    uy = raw > 1e-9 ? dy / raw : -1;
  const along = (a * a + d * d - b * b) / (2 * d),
    height = Math.sqrt(Math.max(0, a * a - along * along));
  return {
    joint: {
      x: origin.x + ux * along - uy * height * bend,
      y: origin.y + uy * along + ux * height * bend,
    },
    end: { x: origin.x + ux * d, y: origin.y + uy * d },
    error: Math.abs(raw - d),
  };
}
export function pendulum(origin: Vec, length: number, angle: number): Vec {
  return { x: origin.x + length * Math.sin(angle), y: origin.y - length * Math.cos(angle) };
}
