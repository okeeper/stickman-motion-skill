import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { openLab } from "./browser.mjs";
const lab = await openLab("action");
try {
  await mkdir("test-results/action", { recursive: true });
  const info = await lab.page.evaluate(() => window.__MOTION__.info());
  const states = await lab.page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 660; i++) {
      const s = await window.__MOTION__.frame(i / 60);
      const points = [
        s.rig.head,
        s.rig.hip,
        s.rig.shoulder,
        ...s.rig.legs.flatMap((l) => [l.hinge, l.b]),
        ...s.rig.arms.flatMap((l) => [l.hinge, l.b]),
      ];
      out.push({
        t: s.t,
        error: s.boneError,
        ground: s.groundMin,
        outside: points.some(
          (p) =>
            Math.abs((p.x - s.camera) * 190) > 600 ||
            210 - p.y * 190 < -325 ||
            210 - p.y * 190 > 325,
        ),
      });
    }
    return out;
  });
  assert.ok(
    states.every((s) => s.error < 1e-8 && s.ground >= -1e-8 && !s.outside),
  );
  const hash = async (t) =>
    createHash("sha256")
      .update(await lab.page.evaluate((t) => window.__MOTION__.png(t), t))
      .digest("hex");
  const hashes = {};
  for (const t of [
    0, 0.8, 1.3, 2.4, 3.4, 4.12, 4.5, 4.95, 5.45, 5.64, 5.85, 6, 6.25, 6.5, 7.8,
    8.7, 9.2, 10.7,
  ]) {
    hashes[t] = await hash(t);
    await lab.page
      .locator("canvas")
      .screenshot({ path: `test-results/action/${t}.png` });
  }
  for (const t of [6, 0, 8.7, 4.5, 5.64, 10.7])
    assert.equal(await hash(t), hashes[t]);
  assert.equal(await lab.page.locator("#speed").inputValue(), "1");
  await lab.page.evaluate(() => window.__MOTION__.frame(0));
  await lab.page.click("#play");
  await lab.page.waitForFunction(
    () =>
      window.__MOTION__.snapshot().audioReady &&
      window.__MOTION__.snapshot().time > 0.25,
  );
  const sound = await lab.page.evaluate(() => window.__MOTION__.snapshot());
  assert.equal(sound.sound, true);
  await lab.page.click("#play");
  await lab.page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await lab.page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  for (const t of [-1, NaN, Infinity, 12])
    await assert.rejects(
      lab.page.evaluate((t) => window.__MOTION__.frame(t), t),
      /time must/,
    );
  assert.ok(
    lab.requests.every(
      (url) => new URL(url).hostname === "127.0.0.1" || url.startsWith("data:"),
    ),
  );
  assert.deepEqual(lab.errors, []);
  const report = {
    engine: info.engine,
    frames: 660,
    cues: info.cues.length,
    maxBoneError: Math.max(...states.map((s) => s.error)),
    minGround: Math.min(...states.map((s) => s.ground)),
    outside: states.filter((s) => s.outside),
    deterministicSeeking: true,
    normalSpeedDefault: true,
    browserSoundReady: sound.audioReady,
    mobile: true,
    errors: lab.errors,
    hashes,
  };
  await writeFile(
    "test-results/action/browser-checks.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
} finally {
  await lab.close();
}
