import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sample,
  EVENTS,
  TAKEOFF,
  LAND,
  TRIP,
  ROLL,
  RECOVER,
  RESUME,
  TRAVEL,
} from '../.test-build/action/model.js';
import { speedTrack, locomotion, posePoints } from '../.test-build/stunt.js';
test('walk, run, sprint, jump, fall, roll, recovery and braking keep bones and ground constraints', () => {
  const modes = new Set();
  for (let i = 0; i <= 11 * 240; i++) {
    const s = sample(i / 240);
    modes.add(s.phase);
    assert.ok(s.boneError < 1e-9, `${s.t}: bone ${s.boneError}`);
    assert.ok(s.groundMin >= -1e-8, `${s.t}: ground ${s.groundMin}`);
    assert.ok(posePoints(s.rig).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)));
    for (const f of s.rig.feet.filter((f) => f.planted))
      assert.ok(Math.abs(f.toe.y) < 1e-8, `${s.t}: floating support`);
    if (s.phase === 'roll')
      assert.ok(s.rig.head.y > 0.185, 'head must clear the ground during the roll');
  }
  for (const name of [
    'walk',
    'run',
    'sprint',
    'jump',
    'fall',
    'roll',
    'recover',
    'dash',
    'brake',
    'safe',
  ])
    assert.ok(modes.has(name), name);
});
test('clip boundaries inherit full poses, flight keeps gravity and forward speed', () => {
  for (const t of [4, TAKEOFF, LAND, TRIP, ROLL, RECOVER, RESUME, 10.35]) {
    const a = posePoints(sample(t - 1e-7).rig),
      b = posePoints(sample(t + 1e-7).rig);
    assert.ok(
      Math.max(...a.map((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y))) < 1e-4,
      `pose reset at ${t}`,
    );
  }
  const dt = 1e-3;
  for (let t = TAKEOFF + 0.03; t < LAND - 0.03; t += 0.04) {
    const a = sample(t - dt).rig.hip,
      b = sample(t).rig.hip,
      c = sample(t + dt).rig.hip;
    assert.ok(Math.abs((c.y - 2 * b.y + a.y) / dt ** 2 + 9.81) < 1e-6);
    assert.ok(Math.abs((c.x - a.x) / (2 * dt) - 5.6) < 1e-8);
  }
  assert.ok(TRAVEL.at(RESUME).v > 2, 'recovery must continue into a run');
});
test('footsteps are alternating actual touchdowns, with faster cadence and no airborne footfalls', () => {
  const steps = EVENTS.filter((e) => e.kind === 'footstep');
  for (const e of steps) {
    const f = sample(e.t).rig.feet[e.foot];
    assert.ok(f.planted, e.id);
    assert.ok(Math.abs(f.ankle.x - e.x) < 1e-8, e.id);
    assert.ok(!(e.t > TAKEOFF && e.t < LAND));
    assert.ok(!(e.t > TRIP && e.t < RECOVER));
    assert.ok(!sample(e.t - 1e-6).rig.feet[e.foot].planted, `no new touchdown: ${e.id}`);
    if (e.id !== 'last-step') {
      const later = sample(e.t + 0.015).rig.feet[e.foot];
      assert.ok(Math.abs(f.ankle.x - later.ankle.x) < 1e-8, `skating ${e.id}`);
    }
  }
  assert.ok(
    Math.abs(steps.find((e) => e.t > 3.1).t - steps.find((e) => e.t > 2.9).t - 0.22) < 1e-6,
  );
  const hand = EVENTS.find((e) => e.kind === 'hand'),
    wrist = sample(hand.t).rig.arms[1].b;
  assert.ok(Math.hypot(wrist.x - hand.x, wrist.y - 0.025) < 1e-8);
  for (const event of EVENTS.filter((e) => e.kind === 'body'))
    assert.ok(sample(event.t).support.point.y < 0.04);
});
test('invalid action inputs fail clearly and arbitrary seeking is deterministic', () => {
  for (const t of [-1, NaN, Infinity, 12]) assert.throws(() => sample(t), /time must/);
  for (const keys of [
    [{ t: 0, v: 1 }],
    [
      { t: 0, v: 1 },
      { t: 0, v: 2 },
    ],
    [
      { t: 0, v: -1 },
      { t: 1, v: 2 },
    ],
  ])
    assert.throws(() => speedTrack(keys), /Invalid speed/);
  assert.throws(() => locomotion(TRAVEL, 1, 0, () => 0.2), /Invalid locomotion/);
  assert.throws(() => locomotion(TRAVEL, 0, 1, () => 0), /Invalid step/);
  const original = sample(5.98);
  sample(0);
  sample(10);
  assert.deepEqual(sample(5.98), original);
});
