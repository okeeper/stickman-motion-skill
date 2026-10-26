import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { openLab } from "./browser.mjs";
const ids = ["negative-ride", "binary-search", "complex-rotation"];
const keytimes = {
  "negative-ride": [
    0, 0.65, 1.7, 2.6, 3.25, 3.65, 5.1, 6.7, 8.6, 9.2, 10.2, 12.5,
  ],
  "binary-search": [
    0.6, 2.65, 3.1, 4.7, 6.2, 7.4, 8.8, 10.8, 11.7, 13.5, 14.7, 16.8,
  ],
  "complex-rotation": [
    0.6, 1.7, 3.65, 4.9, 6.6, 7.9, 8.4, 10.4, 12.95, 14.2, 15.3, 17.35, 19.8,
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
      for (let i = 0; i < duration * 60; i++) {
        const s = await window.__MOTION__.frame(i / 60),
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
      frames: states.length,
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
      frames: report.frames,
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
