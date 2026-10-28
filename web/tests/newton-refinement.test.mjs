import test from 'node:test';
import assert from 'node:assert/strict';
import { FILM, sample, events, openingTip } from '../.test-build/newton/refinement.js';
const near = (a, b, e = 1e-5) => assert.ok(Math.abs(a - b) < e, `${a} ≈ ${b}`);
test('touch precedes line response, and pulling follows the actual hand', () => {
  near(openingTip(3.45), 0.18);
  assert.ok(openingTip(3.6) > 0.18);
  for (let t = 6.45; t <= 7.8; t += 0.025) {
    const s = sample(t),
      hand = s.rig.arms[1].b,
      x = openingTip(t);
    near(hand.x, x);
    near(hand.y, 1 - x / 3);
    assert.equal(s.reveal, 0);
  }
  assert.equal(sample(8.12).reveal, 0);
  assert.ok(sample(9).reveal > 0);
  const e = events(),
    time = (id) => e.find((c) => c.id === id).t;
  assert.ok(time('v2-first-touch') < time('v2-response'));
  assert.ok(time('v2-pull') < time('v2-release'));
});
test('landing compresses after contact and keeps edited grips on their actual targets', () => {
  const before = sample(26.2),
    after = sample(26.38);
  assert.ok(after.rig.hip.y < before.rig.hip.y - 0.1);
  for (let t = 58.9; t < 64.8; t += 0.02) {
    let s = sample(t);
    near(s.poleA.x, s.rig.arms[1].b.x);
    near(s.poleA.y, s.rig.arms[1].b.y);
    near(s.poleB.x, s.cursor.x);
    near(s.poleB.y, 0);
  }
  const probe = sample(49.5);
  near(probe.poleB.x, -6);
  near(probe.poleB.y, -1);
});
test('performance remains continuous and framed at all centisecond boundaries', () => {
  for (let i = 0; i <= FILM.duration * 120; i++) {
    const s = sample(i / 120);
    assert.ok(s.boneError < 2e-6);
    assert.ok(
      s.points.every(
        (p) =>
          (Math.abs(p.x - s.camera.x) * 1280) / s.camera.width < 610 &&
          (Math.abs(p.y - s.camera.y) * 1280) / s.camera.width < 337,
      ),
    );
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
  assert.throws(() => sample(-1), /time must/);
});
test('fragment is on the existing tangent before release and remains continuous at separation', () => {
  for (const t of [24.8, 25, 25.149]) {
    const s = sample(t);
    near(s.poleA.y, 1 - s.poleA.x / 3);
    near(s.poleB.y, 1 - s.poleB.x / 3);
    near(Math.hypot(s.poleB.x - s.poleA.x, s.poleB.y - s.poleA.y), 0.9);
  }
  for (const t of [25.15, 26.2]) {
    const a = sample(t - 1e-7),
      b = sample(t + 1e-7);
    assert.ok(Math.hypot(a.poleA.x - b.poleA.x, a.poleA.y - b.poleA.y) < 1e-4);
    assert.ok(Math.hypot(a.poleB.x - b.poleB.x, a.poleB.y - b.poleB.y) < 1e-4);
  }
});
