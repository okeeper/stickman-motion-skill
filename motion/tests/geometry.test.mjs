import test from "node:test";
import assert from "node:assert/strict";
import {
  ballisticBezier,
  jointKnots,
  project,
} from "../.test-build/geometry.js";
test("a truncated cubic matches analytic gravity at every parameter, not arc-length easing", () => {
  const origin = { x: 1.7, y: 0.9 },
    velocity = { x: 2.2, y: 5.6 },
    g = 9.81;
  for (const seconds of [0, 0.13, 0.5, 1.1]) {
    const { p0, p1, p2, p3 } = ballisticBezier(
      origin,
      velocity,
      g,
      seconds,
      (p) => [p.x, p.y],
    );
    for (let i = 0; i <= 50; i++) {
      const u = i / 50,
        t = u * seconds;
      const point = p0.map(
        (n, j) =>
          n * (1 - u) ** 3 +
          3 * p1[j] * u * (1 - u) ** 2 +
          3 * p2[j] * u * u * (1 - u) +
          p3[j] * u ** 3,
      );
      assert.ok(Math.abs(point[0] - (origin.x + velocity.x * t)) < 1e-12);
      assert.ok(
        Math.abs(point[1] - (origin.y + velocity.y * t - (g * t * t) / 2)) <
          1e-12,
      );
    }
  }
  for (const [gravity, seconds] of [
    [0, 1],
    [9.81, -1],
    [NaN, 1],
    [9.81, Infinity],
  ])
    assert.throws(
      () => ballisticBezier(origin, velocity, gravity, seconds),
      /Invalid ballistic/,
    );
});
test("joint skin has matching hinge tangents and keeps both contact endpoints fixed", () => {
  for (let i = 0; i < 100; i++) {
    const a = { x: 0, y: 1 },
      h = { x: 0.3 * Math.sin(i / 20), y: 0.6 },
      b = { x: 0.1, y: 0.2 };
    const knots = jointKnots(a, h, b);
    assert.deepEqual(knots[0].position, project(a));
    assert.deepEqual(knots[2].position, project(b));
    for (let j = 0; j < 2; j++)
      assert.equal(knots[1].startHandle[j], -knots[1].endHandle[j]);
    assert.ok(
      knots
        .flatMap((k) => [
          ...k.position,
          ...(k.startHandle ?? []),
          ...(k.endHandle ?? []),
        ])
        .every(Number.isFinite),
    );
  }
});
