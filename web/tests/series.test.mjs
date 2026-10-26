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
  SWITCHES,
  JUMP,
  DECK,
  TURNS,
  RADIUS,
  searchAt,
  climbGrips,
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
      // twoBone reserves 1e-6 at fully extended limbs to avoid a singularity.
      assert.ok(s.boneError < 2e-6, `${id} IK residual ${t}`);
      for (const [chains, lengths] of [
        [s.rig.arms, [0.285, 0.275]],
        [s.rig.legs, [0.45, 0.45]],
      ])
        for (const l of chains) {
          near(Math.hypot(l.hinge.x - l.a.x, l.hinge.y - l.a.y), lengths[0], 1e-8);
          near(Math.hypot(l.b.x - l.hinge.x, l.b.y - l.hinge.y), lengths[1], 1e-8);
        }
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
test('reversal is a command, grip is real, and the returning arrow meets ballistic descent', () => {
  for (const [i, t] of SWITCHES.entries()) {
    const sign = i % 2 === 0 ? 1 : -1;
    assert.equal(cartAt(t - 1e-8).u, sign * 2);
    assert.equal(cartAt(t).u, -sign * 2);
    near(cartAt(t + 0.3).v, 0);
    near(cartAt(t + 0.6).v, -sign * 0.9);
    const hand = sample('negative-ride', t).rig.arms[1].b;
    near(hand.x, cartAt(t).x - 0.35, 1e-5);
    near(hand.y, 0.78, 1e-5);
    for (const at of [t, t + 0.6]) {
      near(cartAt(at - 1e-7).x, cartAt(at + 1e-7).x, 1e-6);
      near(cartAt(at - 1e-7).v, cartAt(at + 1e-7).v, 1e-5);
    }
  }
  const landing = sample('negative-ride', JUMP.land - 1e-7).rig;
  near(landing.hip.x, cartAt(JUMP.land).x, 1e-5);
  for (const foot of landing.feet) near(foot.toe.y, DECK, 1e-5);
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
  assert.equal(searchAt(0).unfold, 0);
  assert.equal(searchAt(21).target, 0);
  assert.equal(searchAt(24).target, 1);
  assert.equal(searchAt(51).found, true);
  assert.equal(searchAt(59).inner, 0);
  assert.equal(searchAt(69).insert, 1);
  const end = sample('binary-search', 72);
  near(end.frame.x, end.rig.arms[0].b.x - 0.11);
  near(end.frame.y, end.rig.arms[0].b.y + 0.14);
  near(end.rig.arms[1].b.y, 1.04);
});
test('the fixed-origin complex vector completes four CCW products while the climber changes grip radius', () => {
  for (const [n, t] of [0, ...TURNS.map((q) => q.b)].entries()) {
    const p = orbitAt(t);
    near(p.x, RADIUS * Math.cos((n * Math.PI) / 2));
    near(p.y, RADIUS * Math.sin((n * Math.PI) / 2));
    assert.equal(p.z, ['1', 'i', '−1', '−i', '1'][n]);
    assert.equal(p.completed, n);
    assert.equal(p.turning, false);
  }
  for (let t = 0; t <= 90; t += 0.01) {
    const p = orbitAt(t);
    near(p.x * p.x + p.y * p.y, RADIUS ** 2);
    assert.ok(p.theta >= 0 && p.theta <= 2 * Math.PI);
  }
  assert.ok(orbitAt(13).x > 0 && orbitAt(13).y > 0);
  assert.ok(Math.abs(climbGrips(48.99)[0].x) < Math.abs(climbGrips(39)[0].x));
  for (let t = 39.2; t < 49; t += 0.01) {
    const s = sample('complex-rotation', t),
      g = climbGrips(t);
    for (const i of [0, 1]) {
      near(s.rig.arms[i].b.x, g[i].x);
      near(s.rig.arms[i].b.y, 0);
    }
  }
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

test('both sides of authored centisecond boundaries remain continuous, including zero-weight gestures', () => {
  for (const id of IDS)
    for (let i = 1; i < FILMS[id].duration * 100; i++) {
      const t = i / 100,
        a = sample(id, t - 1e-6),
        b = sample(id, t + 1e-6);
      assert.ok(
        a.points.every((p, j) => Math.hypot(p.x - b.points[j].x, p.y - b.points[j].y) < 0.0002),
        `${id} boundary ${t}`,
      );
    }
});
