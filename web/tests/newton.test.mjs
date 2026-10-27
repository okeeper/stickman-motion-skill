import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FILM,
  STAFF,
  f,
  df,
  next,
  iterate,
  ROOT_SEQUENCE,
  ROOT,
  curveBezier,
  point,
  guideAt,
  sample,
  FLIGHTS,
  events,
} from '../.test-build/newton/model.js';
const near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
test('Newton guide follows true tangent intersections, a two-cycle and a distinct convergent initial value', () => {
  assert.deepEqual(iterate(0, 8), [0, 1, 0, 1, 0, 1, 0, 1, 0]);
  assert.ok(Math.abs(f(ROOT)) < 0.000003);
  near(ROOT, -1.769292662905941, 1e-12);
  for (const x of [0, 1, ...ROOT_SEQUENCE]) {
    const y = next(x);
    near(f(x) + df(x) * (y - x), 0, 1e-12);
  }
  for (const x of [NaN, Infinity, Math.sqrt(2 / 3), -Math.sqrt(2 / 3)])
    assert.throws(() => next(x), /Newton step/);
  for (const [x, n] of [
    [0, -1],
    [0, 0.5],
    [0, 101],
    [NaN, 2],
  ])
    assert.throws(() => iterate(x, n), /Invalid Newton/);
  assert.equal(guideAt(58.9).phase, 'edit');
  // Drag crosses horizontal tangencies without invoking Newton at the edited candidate.
  for (let t = 58.9; t < 65.1; t += 0.005) assert.equal(guideAt(t).phase, 'edit');
  assert.equal(guideAt(65.1).seed, -2);
  near(guideAt(68.85).carrier.x, -5.4);
  near(guideAt(71.7).carrier.x, 3 * ROOT);
});
test('cubic geometry is exact, and invalid curve/time inputs fail', () => {
  for (const [a, b] of [
    [-0.12, 1.23],
    [-2.28, 1.23],
    [-2, -1.5],
  ]) {
    const q = curveBezier(a, b);
    for (let i = 0; i <= 30; i++) {
      const u = i / 30,
        w = [(1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3],
        v = [q.p0, q.p1, q.p2, q.p3];
      const p = point(a + (b - a) * u);
      near(
        w.reduce((z, k, j) => z + k * v[j].x, 0),
        p.x,
      );
      near(
        w.reduce((z, k, j) => z + k * v[j].y, 0),
        p.y,
      );
    }
  }
  for (const p of [
    [1, 1],
    [2, 1],
    [NaN, 1],
  ])
    assert.throws(() => curveBezier(...p), /Invalid curve/);
  for (const t of [NaN, -1, Infinity, FILM.duration + 1]) {
    assert.throws(() => sample(t), /time must/);
    assert.throws(() => guideAt(t), /time must/);
  }
});
test('whole film keeps bone lengths, framing and both sides of action boundaries continuous', () => {
  for (let i = 0; i <= FILM.duration * 120; i++) {
    const t = i / 120,
      s = sample(t);
    assert.ok(s.boneError < 2e-6, `IK at ${t}: ${s.boneError}`);
    assert.ok(s.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
    assert.ok(
      s.points.every(
        (p) =>
          (Math.abs(p.x - s.camera.x) * 1280) / s.camera.width < 610 &&
          (Math.abs(p.y - s.camera.y) * 1280) / s.camera.width < 337,
      ),
    );
    near(Math.hypot(s.poleB.x - s.poleA.x, s.poleB.y - s.poleA.y), STAFF, 1e-10);
  }
  for (let i = 1; i < FILM.duration * 100; i++)
    for (const side of [-1e-6, 0, 1e-6]) {
      const t = i / 100 + side,
        a = sample(t - 1e-7),
        b = sample(t);
      assert.ok(
        b.points.every((p, j) => Math.hypot(p.x - a.points[j].x, p.y - a.points[j].y) < 0.0001),
        `jump at ${t}`,
      );
    }
  for (const t of [72, 0, 49.5, 12, 82]) assert.deepEqual(sample(t), sample(t));
});
test('free flight has real gravitational acceleration and contact sounds stay out of airborne intervals', () => {
  const cues = events();
  assert.equal(new Set(cues.map((c) => c.id)).size, cues.length);
  for (const h of FLIGHTS) {
    for (let t = h.takeoff + 0.03; t < h.land - 0.03; t += 0.025) {
      const d = 0.001,
        a = sample(t - d).rig.hip,
        b = sample(t).rig.hip,
        c = sample(t + d).rig.hip;
      near((c.y - 2 * b.y + a.y) / (d * d), -9.81, 1e-6);
      near((c.x - a.x) / (2 * d), h.vx, 1e-7);
    }
    assert.ok(
      !cues.some(
        (c) =>
          ['footstep', 'landing'].includes(c.kind) && c.t > h.takeoff + 1e-6 && c.t < h.land - 1e-6,
      ),
    );
  }
  for (const c of cues) {
    assert.ok(Number.isFinite(c.pan) && Math.abs(c.pan) <= 1);
    assert.ok(c.t >= 0 && c.t < FILM.duration);
  }
});
test('the held fragment reaches the real graph and editable starting point', () => {
  const probe = sample(49.5);
  near(probe.poleB.x, -6);
  near(probe.poleB.y, -1);
  for (let t = 58.9; t < 64.8; t += 0.02) {
    const s = sample(t);
    near(s.poleA.x, s.rig.arms[1].b.x);
    near(s.poleA.y, s.rig.arms[1].b.y);
    near(s.poleB.x, s.cursor.x);
    near(s.poleB.y, 0);
  }
  for (let t = 38.4; t < 46.4; t += 0.02) {
    const s = sample(t);
    near(s.poleB.y, 0);
    near(s.poleB.x, s.rig.hip.x - 0.3);
  }
});
