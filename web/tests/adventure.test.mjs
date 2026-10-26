import test from 'node:test';
import assert from 'node:assert/strict';
import {
  storyAt,
  BOARD,
  EXIT,
  APPROACH,
  DEPART,
  FILM,
  TURN,
  TURN_END,
  BRAKE,
  STOP,
  platformAt,
  CUES,
} from '../.test-build/adventure/model.js';
import { cameraAt, transfer, walkAt, walkContacts } from '../.test-build/performance.js';
import { distance } from '../.test-build/math.js';
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('direction operation and continuous motor response are distinct, with finite acceleration', () => {
  assert.equal(platformAt(TURN - 1e-6).direction, -1);
  assert.equal(platformAt(TURN).direction, 1);
  assert.ok(platformAt(TURN + 0.05).velocity < 0);
  assert.ok(platformAt(TURN_END).velocity > 0);
  for (const t of [TURN, TURN_END, BRAKE, STOP]) {
    const a = platformAt(t - 1e-6),
      b = platformAt(t + 1e-6);
    near(a.x, b.x, 1e-5);
    near(a.velocity, b.velocity, 1e-5);
    near(a.acceleration, b.acceleration, 1e-4);
  }
  for (let t = 0.01; t < 27; t += 0.017) {
    const h = 1e-5,
      a = platformAt(t - h),
      b = platformAt(t + h),
      c = platformAt(t);
    near((b.x - a.x) / (2 * h), c.velocity);
    near((b.velocity - a.velocity) / (2 * h), c.acceleration);
  }
});
test('moving support transfers conserve airborne velocity and gravity; impact retains momentum', () => {
  for (const clip of [BOARD, EXIT]) {
    for (const t of [clip.takeoff, clip.land]) {
      const a = clip.at(t - 1e-6),
        b = clip.at(t + 1e-6);
      assert.ok(distance(a.rig.hip, b.rig.hip) < 0.0001);
      assert.ok(distance(a.state.velocity, b.state.velocity) < 0.05);
    }
    const midpoint = (clip.takeoff + clip.land) / 2,
      h = 1e-5;
    near(
      (clip.at(midpoint + h).state.velocity.y - clip.at(midpoint - h).state.velocity.y) / (2 * h),
      -9.81,
    );
    near(clip.at(midpoint).state.velocity.x, clip.vx);
    assert.ok(clip.at(clip.land + 0.001).state.velocity.y < -1);
    assert.ok(clip.at(clip.land + 0.07).rig.hip.y < 0.86);
  }
  assert.ok(EXIT.vx > platformAt(EXIT.takeoff).velocity);
  assert.ok(EXIT.destination > platformAt(STOP).x + 0.84);
});
test('stance anchors and foley touchdowns agree; moving-platform feet remain attached', () => {
  for (const w of [APPROACH, DEPART]) {
    for (let t = w.start + 0.001; t < w.end - 0.001; t += 0.001) {
      const a = walkAt(t, w),
        b = walkAt(t + 0.0001, w);
      for (let i = 0; i < 2; i++)
        if (a.feet[i].planted && b.feet[i].planted) near(a.feet[i].x, b.feet[i].x);
    }
    for (const t of walkContacts(w)) {
      const a = walkAt(t - 0.0001, w),
        b = walkAt(t + 0.0001, w);
      assert.ok(a.feet.some((f, i) => !f.planted && b.feet[i].planted));
      assert.ok(CUES.some((e) => e.kind === 'step' && Math.abs(e.t - t) < 1e-8));
    }
  }
  for (let t = 9.5; t < 16; t += 0.03) {
    const a = storyAt(t),
      b = storyAt(t + 0.0001);
    for (let i = 0; i < 2; i++)
      if (a.rig.feet[i].planted && b.rig.feet[i].planted)
        near(b.rig.feet[i].toe.x - a.rig.feet[i].toe.x, b.platform.x - a.platform.x, 1e-6);
  }
});
test('the carried symbol shares the actual wrist; full-film bones, ground and clip boundaries remain continuous', () => {
  let previous;
  for (let t = 0; t < FILM.duration; t += 1 / 240) {
    const f = storyAt(t),
      r = f.rig;
    assert.ok(f.maxIK < 0.001, `${t}: ${f.maxIK}`);
    for (const l of r.legs) {
      near(distance(l.a, l.hinge), 0.45);
      near(distance(l.hinge, l.b), 0.45);
    }
    for (const l of r.arms) {
      near(distance(l.a, l.hinge), 0.285);
      near(distance(l.hinge, l.b), 0.275);
    }
    for (const foot of r.feet) assert.ok(foot.toe.y >= -1e-5);
    if (f.tokenAttached) near(distance(f.token, r.arms[1].b), 0);
    if (previous)
      for (const key of ['head', 'hip', 'shoulder'])
        assert.ok(distance(previous.rig[key], r[key]) < 0.035, `${t} ${key}: discontinuous pose`);
    previous = f;
  }
  near(distance(storyAt(TURN - 1e-7).token, storyAt(TURN).token), 0, 1e-5);
});
test('random seeks are deterministic; bad tracks and unreachable transfers fail explicitly', () => {
  const saved = storyAt(12.8);
  for (const t of [27, 1, 18.3, 0, 9]) storyAt(t);
  assert.deepEqual(storyAt(12.8), saved);
  assert.throws(() => storyAt(NaN), /finite/);
  assert.throws(() => platformAt(Infinity), /finite/);
  assert.throws(() => walkAt(0, { start: 1, end: 0, from: 0, to: 1 }), /Invalid/);
  assert.throws(() => cameraAt(1, [{ t: 1, x: 0, y: 0, width: 0 }]), /Invalid/);
  assert.throws(
    () =>
      cameraAt(1, [
        { t: 1, x: 0, y: 0, width: 1 },
        { t: 0, x: 0, y: 0, width: 1 },
      ]),
    /Invalid/,
  );
  assert.throws(() => transfer(BOARD.motion, 0, 0, () => ({ x: 100, velocity: 0 })), /budget/);
});
