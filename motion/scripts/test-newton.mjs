import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { openLab } from "./browser.mjs";
const lab = await openLab("newton");
try {
  const folder = "test-results/newton";
  await mkdir(folder, { recursive: true });
  const info = await lab.page.evaluate(() => window.__MOTION__.info());
  assert.equal(info.duration, 82);
  const states = await lab.page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 164; i++) {
      const s = await window.__MOTION__.frame(i / 2);
      out.push({
        t: s.t,
        error: s.boneError,
        outside: s.points.some(
          (p) =>
            (Math.abs(p.x - s.camera.x) * 1280) / s.camera.width > 610 ||
            (Math.abs(p.y - s.camera.y) * 1280) / s.camera.width > 337,
        ),
      });
    }
    return out;
  });
  assert.ok(states.every((s) => s.error < 2e-6 && !s.outside));
  const times = [
    0, 4, 7.5, 11, 12.7, 17.9, 21.8, 25.15, 25.65, 26.2, 26.7, 36, 43, 49.5,
    58.9, 62, 66.8, 68, 71, 74.7, 79,
  ];
  const hash = (x) => createHash("sha256").update(x).digest("hex"),
    hashes = {};
  for (const t of times) {
    const png = await lab.page.evaluate((t) => window.__MOTION__.png(t), t);
    hashes[t] = hash(png);
    await writeFile(`${folder}/${t}.png`, Buffer.from(png, "base64"));
  }
  for (const t of [79, 0, 43, 12.7])
    assert.equal(
      hash(await lab.page.evaluate((t) => window.__MOTION__.png(t), t)),
      hashes[t],
    );
  for (const t of [-1, 83]) {
    const message = await lab.page.evaluate(async (t) => {
      try {
        await window.__MOTION__.frame(t);
        return "";
      } catch (e) {
        return e.message;
      }
    }, t);
    assert.match(message, /time must/);
  }
  assert.equal(await lab.page.locator("#speed").inputValue(), "1");
  await lab.page.evaluate(() => window.__MOTION__.frame(24));
  await lab.page.click("#play");
  await lab.page.waitForFunction(
    () =>
      window.__MOTION__.snapshot().audioReady &&
      window.__MOTION__.snapshot().time > 25,
    {},
    { timeout: 60000 },
  );
  await lab.page.click("#play");
  assert.deepEqual(lab.errors, []);
  const report = {
    film: info.title,
    duration: info.duration,
    framesChecked: states.length,
    keyframes: times,
    deterministicSeeks: true,
    audioReady: true,
    defaultSpeed: 1,
    errors: lab.errors,
    externalRequests: lab.requests.filter(
      (u) => !u.startsWith("http://127.0.0.1:") && !u.startsWith("data:"),
    ),
  };
  assert.deepEqual(report.externalRequests, []);
  await writeFile(
    `${folder}/browser-report.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} finally {
  await lab.close();
}
