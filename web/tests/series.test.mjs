import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IDS,
  FILMS,
  sample,
  events,
  cartAt,
  searchSteps,
  VALUES,
  TARGET,
  QUERIES,
  orbitAt,
  NEGATIVE_TRANSFERS,
  COMPLEX_TRANSFERS,
} from '../.test-build/series/model.js';
import { hop, runClip, still } from '../.test-build/series/motion.js';
const near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
test('three redesigned stories preserve bones, finite framing, deterministic seeking and continuous action boundaries', () => {
  for (const id of IDS) {
    const duration = FILMS[id].duration;
    for (let i = 0; i <= duration * 240; i++) {
      const t = i / 240,
        s = sample(id, t);
      assert.ok(s.boneError < 1e-8, `${id} bones ${t}`);
      assert.ok(s.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
      assert.ok(
        s.points.every(
          (p) =>
            Math.abs(((p.x - s.camera.x) * 1280) / s.camera.width) < 610 &&
            Math.abs(((p.y - s.camera.y) * 1280) / s.camera.width) < 337,
        ),
        `${id} framing ${t}`,
      );
      if (t > 0.00001) {
        const p = sample(id, t - 1e-6);
        assert.ok(
          s.points.every((v, j) => Math.hypot(v.x - p.points[j].x, v.y - p.points[j].y) < 0.0001),
          `${id} discontinuity ${t}`,
        );
      }
    }
    for (const t of [duration * 0.7, 0, duration * 0.2, duration])
      assert.deepEqual(sample(id, t), sample(id, t));
    for (const t of [-1, NaN, Infinity, duration + 1])
      assert.throws(() => sample(id, t), /time must/);
  }
});
test('negative multiplication changes the command while the motor reverses continuously and brakes at its limit', () => {
  assert.equal(cartAt(3 - 1e-8).u, 2);
  assert.equal(cartAt(3).u, -2);
  assert.ok(cartAt(3.15).v > 0);
  near(cartAt(3.4).v, 0);
  near(cartAt(3.8).v, -2);
  near(cartAt(9).v, 0);
  near(cartAt(9).x, 1.2);
  for (const t of [3, 3.8, 8, 8.8]) {
    near(cartAt(t - 1e-7).x, cartAt(t + 1e-7).x, 1e-6);
    near(cartAt(t - 1e-7).v, cartAt(t + 1e-7).v, 1e-5);
  }
  for (let t = 3.1; t < 7.5; t += 0.02) {
    const s = sample('negative-ride', t);
    for (const f of s.rig.feet) near(f.toe.y, 0.1);
  }
  // A human head has radius .153 world units; it must clear the physical underside of the beam.
  for (let t = 6.3; t < 7.25; t += 0.01) {
    const s = sample('negative-ride', t);
    if (s.rig.head.x > 3.65 && s.rig.head.x < 5.25) assert.ok(s.rig.head.y + 0.153 < 1.43);
  }
});
test('binary search preserves the source array, chooses floor midpoints and never discards a present target', () => {
  assert.deepEqual(
    QUERIES.map((q) => q.index),
    [8, 12, 14, 13],
  );
  assert.deepEqual(
    QUERIES.map((q) => q.after[1] - q.after[0] + 1),
    [8, 4, 1, 1],
  );
  for (const target of VALUES) {
    let previous = [0, 15];
    const steps = searchSteps(VALUES, target);
    assert.ok(steps.length <= 5);
    for (const q of steps) {
      assert.equal(q.index, Math.floor((previous[0] + previous[1]) / 2) + 1);
      assert.ok(VALUES.indexOf(target) >= q.after[0] && VALUES.indexOf(target) <= q.after[1]);
      previous = q.after;
    }
    assert.equal(steps.at(-1).value, target);
  }
  const missing = searchSteps(VALUES, 64);
  assert.notEqual(missing.at(-1).comparison, '=');
  assert.ok(missing.at(-1).after[0] > missing.at(-1).after[1]);
  for (const a of [[], [3, 2], [1, 1], [NaN]])
    assert.throws(() => searchSteps(a, TARGET), /sorted unique/);
  for (const t of [0, 3, 6.5, 9, 11, 15])
    assert.deepEqual(sample('binary-search', t).query.original, VALUES);
  for (let t = 12.5; t < 14.2; t += 0.01) {
    const s = sample('binary-search', t),
      s2 = sample('binary-search', t + 0.001);
    near(s.rig.feet[0].toe.x, s2.rig.feet[0].toe.x);
    near(s.rig.feet[0].toe.y - s.rig.feet[1].toe.y, 0);
  }
});
test('four completed complex products have unit modulus and CCW orientation with positive support force', () => {
  for (const [t, x, y, z] of [
    [0, 1.6, 0, '1'],
    [4.65, 0, 1.6, 'i'],
    [7.65, -1.6, 0, '−1'],
    [11.15, 0, -1.6, '−i'],
    [14, 1.6, 0, '1'],
  ]) {
    const p = orbitAt(t);
    near(p.x, x);
    near(p.y, y);
    assert.equal(p.z, z);
    assert.equal(p.turning, false);
  }
  for (let t = 0; t <= 14; t += 0.01) {
    const p = orbitAt(t);
    near(p.x * p.x + p.y * p.y, 1.6 ** 2);
    assert.ok(9.81 + p.ay > 6);
  }
  assert.ok(orbitAt(3).x > 0 && orbitAt(3).y > 0);
  assert.equal(orbitAt(3).completed, 0);
  assert.equal(orbitAt(4.65).completed, 1);
});
test('airborne roots obey gravity, moving launch velocity enters the work budget and footsteps stay out of flight', () => {
  for (const [id, transfers] of [
    ['negative-ride', NEGATIVE_TRANSFERS],
    ['complex-rotation', COMPLEX_TRANSFERS],
  ]) {
    for (const h of transfers) {
      const t = (h.takeoff + h.land) / 2,
        dt = 0.001,
        a = sample(id, t - dt).rig.hip,
        b = sample(id, t).rig.hip,
        c = sample(id, t + dt).rig.hip;
      near((c.x - a.x) / (2 * dt), h.vx, 1e-6);
      near((c.y - 2 * b.y + a.y) / dt ** 2, -9.81, 1e-5);
      assert.ok(!events(id).some((e) => e.kind === 'footstep' && e.t > h.takeoff && e.t < h.land));
    }
  }
  for (const id of IDS) {
    const e = events(id);
    assert.equal(new Set(e.map((c) => c.id)).size, e.length);
    assert.ok(e.every((c) => c.t >= 0 && c.t < FILMS[id].duration));
  }
  assert.throws(() => hop('bad', 0, still(0), still(100)), /work budget/);
  assert.throws(() => runClip('bad', 0, 0.1, 0, 1), /Invalid run/);
});
