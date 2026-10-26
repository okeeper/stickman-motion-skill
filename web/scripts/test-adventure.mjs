import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openLab } from './browser.mjs';
const folder = fileURLToPath(new URL('../test-results/adventure/', import.meta.url));
await mkdir(folder, { recursive: true });
await assert.rejects(openLab('/outside.html'), /Unknown/);
const lab = await openLab('/film.html');
try {
  const { page } = lab;
  const info = await page.evaluate(() => window.__MOTION__.info());
  const report = await page.evaluate((duration) => {
    let maxIK = 0,
      maxTokenError = 0;
    const outside = [];
    for (let t = 0; t <= duration; t += 1 / 60) {
      const f = window.__MOTION__.frame(t);
      maxIK = Math.max(maxIK, f.maxIK);
      maxTokenError = Math.max(maxTokenError, f.tokenError);
      if (!f.boundsOK || !f.formulaBoundsOK) outside.push(Number(t.toFixed(4)));
    }
    return {
      maxIK,
      maxTokenError,
      outside,
      fonts: [...document.fonts].map((f) => ({ family: f.family, status: f.status })),
    };
  }, info.duration);
  const times = [
    0.8, 3.2, 3.7, 5.7, 7.4, 8.2, 8.9, 9.05, 11.6, 12.05, 12.7, 14, 16.9, 17.7, 18.5, 18.65, 21.7,
    27,
  ];
  for (const t of times) {
    const png = await page.evaluate((t) => window.__MOTION__.png(t), t);
    await writeFile(`${folder}/frame-${t.toFixed(2)}.png`, Buffer.from(png, 'base64'));
  }
  const a = await page.evaluate(() => window.__MOTION__.png(12.7));
  await page.evaluate(() => window.__MOTION__.frame(1));
  assert.equal(await page.evaluate(() => window.__MOTION__.png(12.7)), a);
  await assert.rejects(
    page.evaluate(() => window.__MOTION__.frame(NaN)),
    /finite/,
  );
  await page.evaluate(() => window.__MOTION__.frame(12.7));
  await page.screenshot({ path: `${folder}/desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: `${folder}/mobile.png`, fullPage: true });
  await page.locator('#play').click();
  const before = await page.evaluate(() => window.__MOTION__.snapshot().time);
  await page.waitForFunction((t) => window.__MOTION__.snapshot().time > t + 0.08, before);
  await page.locator('#play').click();
  await page.locator('[data-time="16.1"]').click();
  assert.equal(await page.evaluate(() => window.__MOTION__.snapshot().time), 16.1);
  await page.locator('#speed').selectOption('0.25');
  await page.locator('#debug').check();
  assert.equal(await page.evaluate(() => window.__MOTION__.snapshot().debug), true);
  await page.locator('#restart').click();
  assert.equal(await page.evaluate(() => window.__MOTION__.snapshot().playing), true);
  assert.deepEqual(lab.errors, []);
  assert.ok(
    lab.requests.every((url) => new URL(url).hostname === '127.0.0.1' || url.startsWith('data:')),
  );
  await writeFile(
    `${folder}/browser-checks.json`,
    JSON.stringify(
      {
        ...report,
        info,
        errors: lab.errors,
        seeking: 'pixel-identical',
        controls: 'pass',
        mobileOverflow: false,
        externalRuntimeRequests: 0,
        humanPlaybackReview: 'not_recorded',
      },
      null,
      2,
    ) + '\n',
  );
  assert.ok(report.maxIK < 0.001, JSON.stringify(report));
  assert.ok(report.maxTokenError < 0.001);
  assert.deepEqual(report.outside, [], `Actor outside frame: ${report.outside.slice(0, 10)}`);
  assert.ok(report.fonts.every((f) => f.status === 'loaded'));
  console.log(
    JSON.stringify({
      maxIK: report.maxIK,
      maxTokenError: report.maxTokenError,
      outside: report.outside,
      stills: times.length,
      controls: 'pass',
      deterministicSeeking: 'pass',
    }),
  );
} finally {
  await lab.close();
}
