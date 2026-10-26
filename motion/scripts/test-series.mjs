import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { openLab } from "./browser.mjs";
const ids = ["negative-ride", "binary-search", "complex-rotation"];
const keytimes = {
  "negative-ride": [
    0, 4.8, 12.9, 13.35, 14, 17, 34.7, 37, 44.2, 60.7, 61.14, 61.5, 62.1, 70,
  ],
  "binary-search": [
    0, 5, 12, 16, 22.9, 28.6, 33.1, 38.5, 45.6, 51.3, 63.8, 68, 72, 77.2,
  ],
  "complex-rotation": [
    0, 6, 10, 12.8, 13.7, 20, 32.5, 41.5, 47.3, 55.4, 56, 73.8, 74.8, 75.4, 77,
    79, 88,
  ],
};
const reports = [];
for (const id of ids) {
  const lab = await openLab(id);
  try {
    const folder = `test-results/series/${id}`;
    await mkdir(folder, { recursive: true });
    const info = await lab.page.evaluate(() => window.__MOTION__.info());
    const states = await lab.page.evaluate(async () => {
      const duration = window.__MOTION__.info().duration,
        out = [];
      for (let i = 0; i < duration * 2; i++) {
        const s = await window.__MOTION__.frame(i / 2),
          scale = 1280 / s.camera.width;
        out.push({
          t: s.t,
          error: s.boneError,
          outside: s.points.some(
            (p) =>
              Math.abs((p.x - s.camera.x) * scale) > 610 ||
              Math.abs((p.y - s.camera.y) * scale) > 337,
          ),
        });
      }
      return out;
    });
    assert.ok(states.every((s) => s.error < 1e-8 && !s.outside));
    const hashes = {};
    const capture = async (t) => {
      const png = await lab.page.evaluate((t) => window.__MOTION__.png(t), t);
      return {
        bytes: Buffer.from(png, "base64"),
        hash: createHash("sha256").update(png).digest("hex"),
      };
    };
    for (const t of keytimes[id]) {
      const { bytes, hash } = await capture(t);
      hashes[t] = hash;
      await writeFile(`${folder}/${t}.png`, bytes);
    }
    for (const t of [...keytimes[id]].reverse().filter((_, i) => i % 3 === 0))
      assert.equal((await capture(t)).hash, hashes[t]);
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
    for (const t of [-1, NaN, Infinity, info.duration + 1])
      await assert.rejects(
        lab.page.evaluate((t) => window.__MOTION__.frame(t), t),
        /time must/,
      );
    assert.ok(
      lab.requests.every(
        (url) =>
          url.startsWith("data:") || new URL(url).hostname === "127.0.0.1",
      ),
    );
    assert.deepEqual(lab.errors, []);
    const report = {
      id,
      title: info.title,
      duration: info.duration,
      sampledFrames: states.length,
      samplingHz: 2,
      cues: info.cues.length,
      maxBoneError: Math.max(...states.map((s) => s.error)),
      outside: states.filter((s) => s.outside),
      randomSeek: true,
      defaultSpeed: 1,
      browserSoundReady: sound.audioReady,
      mobileWidth: 390,
      errors: lab.errors,
      hashes,
    };
    reports.push(report);
    await writeFile(
      `${folder}/browser-checks.json`,
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(id, {
      sampledFrames: report.sampledFrames,
      cues: report.cues,
      maxBoneError: report.maxBoneError,
      errors: report.errors,
    });
  } finally {
    await lab.close();
  }
}
await writeFile(
  "test-results/series/browser-checks.json",
  JSON.stringify(reports, null, 2) + "\n",
);
await assert.rejects(openLab("unknown"), /Unknown local scene/);
