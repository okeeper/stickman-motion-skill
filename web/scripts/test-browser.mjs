import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { openLab } from './browser.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const result = path.join(root, 'test-results');
await mkdir(result, { recursive: true });
const lab = await openLab(),
  { page } = lab,
  checks = [];
const snapshot = () => page.evaluate(() => window.__MOTION__.snapshot());
const slider = async (id, value) =>
  page.locator('#' + id).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
try {
  assert.ok(
    await page.evaluate(() =>
      [...document.fonts].some((f) => f.family === 'Motion Sans' && f.status === 'loaded'),
    ),
  );
  assert.ok(
    lab.requests.every(
      (url) => url.startsWith(lab.server.resolvedUrls.local[0]) || url.startsWith('data:'),
    ),
  );
  checks.push('self-hosted Chinese font loaded; no external runtime requests');

  await page.locator('[data-preset=natural]').click();
  await page.locator('#play').click();
  const paused = await snapshot();
  assert.equal(paused.playing, false);
  assert.equal(paused.settings.mass, 70);
  await slider('timeline', 1.4);
  assert.equal((await snapshot()).phase, 'push');
  await page.locator('#debug').check();
  assert.equal(await page.locator('#debug').isChecked(), true);
  await page.locator('#speed').selectOption('0.5');
  await page.locator('#restart').click();
  const before = (await snapshot()).time;
  await page.waitForFunction((t) => window.__MOTION__.snapshot().time > t + 0.08, before);
  await page.locator('#play').click();
  checks.push('preset, pause, scrub, debug, speed and restart controls operate');

  await page.locator('[data-preset=heavy]').click();
  assert.equal((await snapshot()).settings.mass, 105);
  await slider('charge', 1);
  assert.equal((await snapshot()).settings.charge, 1);
  await page.locator('#reset').click();
  assert.equal((await snapshot()).settings.charge, 0.6);
  // A real failure path: not enough work to lift a heavy body against high gravity.
  await slider('charge', 0.5);
  await slider('effort', 0.55);
  await slider('mass', 120);
  const lastValid = await snapshot();
  await slider('gravity', 16);
  assert.match(await page.locator('#error').innerText(), /蓄力不足/);
  assert.deepEqual((await snapshot()).settings, lastValid.settings);
  await page.locator('#reset').click();
  assert.equal(await page.locator('#error').innerText(), '');
  checks.push(
    'parameter edits rebuild; impossible launch reports an error and preserves last valid motion',
  );

  await page.evaluate(() => window.__MOTION__.setPreset('heroic'));
  const png = await page.evaluate(() => window.__MOTION__.png(2.5));
  await page.evaluate(() => window.__MOTION__.png(4.2));
  assert.equal(await page.evaluate(() => window.__MOTION__.png(2.5)), png);
  await assert.rejects(
    page.evaluate(() => window.__MOTION__.setPreset('invalid')),
    /unknown preset/,
  );
  const custom = await page.evaluate(() =>
    window.__MOTION__.configure({
      mass: 80,
      gravity: 9.81,
      charge: 1.1,
      effort: 1.1,
      elasticity: 0.5,
    }),
  );
  assert.equal(custom.settings.mass, 80);
  assert.ok(custom.height > 0);
  await assert.rejects(
    page.evaluate(() => window.__MOTION__.configure({ mass: 70 })),
    /must be in/,
  );
  await assert.rejects(
    page.evaluate(() => window.__MOTION__.configure({ mass: 70, typo: 1 })),
    /unknown settings/,
  );
  await assert.rejects(
    page.evaluate(() => window.__MOTION__.frame(NaN)),
    /finite/,
  );
  // Recover from an invalid render timestamp and inspect actual output bounds.
  for (const preset of ['natural', 'heroic', 'heavy']) {
    const info = await page.evaluate((p) => window.__MOTION__.setPreset(p), preset);
    const bounds = await page.evaluate((duration) => {
      for (let t = 0; t < duration; t += 1 / 60) {
        const { rig, camera } = window.__MOTION__.frame(t);
        const points = [
          rig.hip,
          rig.shoulder,
          rig.head,
          ...rig.legs.flatMap((l) => [l.hinge, l.b]),
          ...rig.arms.flatMap((l) => [l.hinge, l.b]),
          ...rig.feet.map((f) => f.toe),
        ];
        if (
          points.some((p) => {
            const q = camera.point(p);
            return q.x < 70 || q.x > 1210 || q.y < 110 || q.y > 604;
          })
        )
          return false;
      }
      return true;
    }, info.duration);
    assert.equal(bounds, true, `${preset}: character outside frame`);
  }
  checks.push('pixel-identical random seeking; bad API inputs rejected; all presets fit the frame');

  await page.evaluate(() => {
    window.__MOTION__.setPreset('heroic');
    window.__MOTION__.frame(1.4);
  });
  await page.screenshot({ path: path.join(result, 'desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(result, 'mobile.png'), fullPage: true });
  await page.locator('#play').click();
  const start = (await snapshot()).time;
  await page.waitForFunction((t) => window.__MOTION__.snapshot().time > t + 0.05, start);
  checks.push(
    'mobile layout has no horizontal overflow; interactive playback resumes after frame export',
  );
  assert.deepEqual(lab.errors, []);
} finally {
  await lab.close();
}

const folder = await mkdtemp(path.join(tmpdir(), 'motion-cli-'));
try {
  const existing = path.join(folder, 'existing.mp4');
  await writeFile(existing, 'keep this output');
  for (const args of [['--preset', 'wrong'], ['--fps', '0'], ['--out'], ['--toString', 'x']]) {
    const r = spawnSync(
      process.execPath,
      [path.join(root, 'scripts/render.mjs'), '--out', existing, ...args],
      { encoding: 'utf8' },
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Render failed/);
    assert.equal(await readFile(existing, 'utf8'), 'keep this output');
  }
  const config = path.join(folder, 'bad.json');
  await writeFile(config, '{"mass":70,"typo":1}');
  const bad = spawnSync(
    process.execPath,
    [path.join(root, 'scripts/render.mjs'), '--config', config, '--out', existing],
    { encoding: 'utf8' },
  );
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /Config must/);
  assert.equal(await readFile(existing, 'utf8'), 'keep this output');
  checks.push('invalid render CLI arguments fail without overwriting output');
} finally {
  await rm(folder, { recursive: true, force: true });
}
await writeFile(
  path.join(result, 'browser-checks.json'),
  JSON.stringify({ checks }, null, 2) + '\n',
);
console.log(checks.map((c) => 'PASS: ' + c).join('\n'));
