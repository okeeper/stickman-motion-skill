import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotion, PRESETS, HIP, DT } from '../.test-build/physics.js';
import { skeleton } from '../.test-build/rig.js';
import { distance } from '../.test-build/math.js';
const motions = Object.entries(PRESETS).map(([name, p]) => [name, createMotion(p)]);
const near = (a, b, tol = 1e-7) => assert.ok(Math.abs(a - b) < tol, `${a} != ${b} (tol ${tol})`);

test('airborne acceleration is gravity; apex slows naturally without eased time', () => {
  for (const [, m] of motions) {
    const apex = m.takeoff + m.launch.y / m.settings.gravity;
    near(m.at(apex).velocity.y, 0);
    near(m.at(apex).root.y, m.origin.y + m.height);
    for (let i = 1; i < 50; i++) {
      const t = m.takeoff + ((m.land - m.takeoff) * i) / 50,
        h = 0.00001;
      const a = m.at(t - h),
        b = m.at(t),
        c = m.at(t + h);
      near((c.velocity.y - a.velocity.y) / (2 * h), -m.settings.gravity, 1e-6);
      near((c.root.y - a.root.y) / (2 * h), b.velocity.y, 1e-6);
      near(b.force, 0);
      assert.equal(b.contact, false);
      const energy =
        0.5 * m.settings.mass * (b.velocity.x ** 2 + b.velocity.y ** 2) +
        m.settings.mass * m.settings.gravity * b.root.y;
      const launch =
        0.5 * m.settings.mass * (m.launch.x ** 2 + m.launch.y ** 2) +
        m.settings.mass * m.settings.gravity * m.origin.y;
      near(energy, launch, 1e-6);
    }
  }
});
test('charge and body mass determine power, with finite ground reaction', () => {
  const natural = createMotion(PRESETS.natural),
    heavy = createMotion(PRESETS.heavy),
    strong = createMotion({ ...PRESETS.natural, charge: 1.1 });
  assert.ok(heavy.height < natural.height);
  near(natural.work, heavy.work);
  assert.ok(strong.height > natural.height);
  for (const [, m] of motions) {
    const before = m.at(m.push - 0.001);
    assert.ok(before.root.y < HIP - 0.2);
    assert.equal(before.contact, true);
    for (let t = 0; t < m.takeoff; t += 0.001) assert.ok(m.at(t).force >= 0);
    const push = m.at(m.takeoff - 0.001);
    assert.ok(push.velocity.y > 1);
    assert.ok(push.force > m.settings.mass * m.settings.gravity);
    near(
      0.5 * m.settings.mass * (m.launch.x ** 2 + m.launch.y ** 2) +
        m.settings.mass * m.settings.gravity * (m.depth + 0.075),
      m.work,
      1e-6,
    );
  }
});
test('takeoff carries velocity into flight; collision does not reset velocity to zero', () => {
  for (const [, m] of motions) {
    for (const at of [m.push, m.takeoff, m.land]) {
      const a = m.at(at - 1e-6),
        b = m.at(at + 1e-6);
      assert.ok(distance(a.root, b.root) < 0.001, `${at}: root discontinuity`);
      assert.ok(distance(a.velocity, b.velocity) < 0.04, `${at}: velocity discontinuity`);
    }
    assert.ok(m.at(m.land + 0.001).velocity.y < -0.5);
    assert.ok(m.at(m.land + 0.06).root.y < HIP - 0.035);
  }
});
test('landing is dissipative and a rebound is smaller than the first flight', () => {
  for (const [, m] of motions) {
    const energy = (s) =>
      0.5 * m.settings.mass * s.velocity.y ** 2 + 0.5 * m.stiffness * (s.root.y - HIP) ** 2;
    const start = energy(m.at(m.land + 0.01)),
      end = energy(m.at(m.duration - 0.1));
    assert.ok(end < start * 0.005, `${start} -> ${end}`);
    const impacts = m.events.filter((e) => e.kind === 'impact');
    for (let i = 1; i < impacts.length; i++) assert.ok(impacts[i].speed < impacts[i - 1].speed);
    near(m.at(m.duration).root.y, HIP, 0.005);
    assert.ok(Math.abs(m.at(m.duration).velocity.y) < 0.02);
  }
  assert.ok(createMotion(PRESETS.heroic).events.some((e) => e.kind === 'bounce'));
});
test('limbs preserve lengths, ankles connect, and soles never penetrate the floor', () => {
  for (const [name, m] of motions) {
    let old;
    for (let t = 0; t < m.duration; t += 1 / 120) {
      const s = m.at(t),
        r = skeleton(m, s);
      for (const limb of r.legs) {
        near(distance(limb.a, limb.hinge), 0.45);
        near(distance(limb.hinge, limb.b), 0.45);
        assert.ok(limb.error < 0.001, `${name} ${t}: unreachable ${limb.error}`);
      }
      for (const limb of r.arms) {
        near(distance(limb.a, limb.hinge), 0.285);
        near(distance(limb.hinge, limb.b), 0.275);
      }
      for (let i = 0; i < 2; i++) {
        assert.ok(r.feet[i].toe.y >= -1e-5, `${name} ${t}: toe ${r.feet[i].toe.y}`);
        near(distance(r.feet[i].toe, r.feet[i].ankle), 0.165);
        near(distance(r.feet[i].ankle, r.legs[i].b), 0, 0.001);
        if (
          old &&
          old.state.contact &&
          s.contact &&
          old.state.t < m.takeoff === t < m.takeoff &&
          old.state.t < m.land === t < m.land
        ) {
          near(distance(old.rig.feet[i].toe, r.feet[i].toe), 0, 0.00001);
        }
      }
      old = { state: s, rig: r };
    }
  }
});
test('scrubbing and sampling at different video rates leave the same simulation state', () => {
  for (const [, m] of motions) {
    const saved = m.at(2);
    for (const t of [4, 0, 0.5, 1, 3]) m.at(t);
    assert.deepEqual(saved, m.at(2));
    for (let frame = 0; frame < 120; frame++)
      assert.deepEqual(m.at(frame / 30), m.at((frame * 2) / 60));
    assert.equal(m.samples[1].t - m.samples[0].t, DT);
  }
});
test('invalid and nonfinite controls fail clearly', () => {
  for (const value of [NaN, Infinity, -1, 0])
    assert.throws(() => createMotion({ ...PRESETS.natural, mass: value }));
  assert.throws(() => createMotion({ ...PRESETS.natural, elasticity: 2 }));
  assert.throws(
    () => createMotion({ ...PRESETS.natural, mass: 120, gravity: 16, charge: 0.5, effort: 0.55 }),
    /蓄力不足/,
  );
  assert.throws(() => motions[0][1].at(NaN));
});

test('supported parameter extremes keep feet connected and allow all rebounds to settle', () => {
  let valid = 0;
  for (const mass of [45, 70, 120])
    for (const gravity of [6, 9.81, 16])
      for (const charge of [0.5, 1.3])
        for (const effort of [0.55, 1.3])
          for (const elasticity of [0, 1]) {
            let m;
            try {
              m = createMotion({ mass, gravity, charge, effort, elasticity });
            } catch (error) {
              assert.match(error.message, /蓄力不足/);
              continue;
            }
            valid++;
            let previous;
            for (let t = 0; t < m.duration; t += 1 / 60) {
              const s = m.at(t),
                rig = skeleton(m, s);
              for (const leg of rig.legs)
                assert.ok(
                  leg.error < 0.001,
                  JSON.stringify({ mass, gravity, charge, effort, elasticity, t }),
                );
              for (const foot of rig.feet) assert.ok(foot.toe.y >= -1e-5);
              if (previous && previous.contact && s.contact && t > m.land && previous.t > m.land)
                near(previous.supportX, s.supportX, 0.00001);
              previous = s;
            }
            const end = m.at(m.duration);
            assert.equal(end.contact, true);
            near(end.root.y, HIP, 0.005);
            assert.ok(Math.abs(end.velocity.y) < 0.03);
          }
  assert.ok(valid > 50);
});
