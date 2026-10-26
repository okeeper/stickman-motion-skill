import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { openLab } from "./browser.mjs";
const lab = await openLab();
try {
  await mkdir("test-results", { recursive: true });
  const info = await lab.page.evaluate(() => window.__MOTION__.info());
  let error = 0,
    traceError = 0;
  const states = await lab.page.evaluate(async () => {
    const results = [];
    for (let i = 0; i < 18 * 60; i++) {
      const s = await window.__MOTION__.frame(i / 60);
      results.push({ t: s.t, error: s.error, traceError: s.traceError });
    }
    return results;
  });
  for (const s of states) {
    error = Math.max(error, s.error);
    traceError = Math.max(traceError, s.traceError);
  }
  assert.ok(error < 1e-8);
  assert.ok(traceError < 1e-10);
  const hash = async (t) =>
    createHash("sha256")
      .update(await lab.page.evaluate((t) => window.__MOTION__.png(t), t))
      .digest("hex");
  const hashes = {};
  for (const t of [
    0, 2.4, 3.4, 4.2, 8, 8.7, 10.8, 11.6, 13.7, 14.5, 16, 17.9,
  ]) {
    hashes[t] = await hash(t);
    await lab.page
      .locator("canvas")
      .screenshot({ path: `test-results/frame-${t}.png` });
  }
  for (const t of [14.5, 3.4, 11.6, 0, 17.9, 8.7])
    assert.equal(await hash(t), hashes[t], `seek ${t}`);
  for (const t of [-1, Infinity, NaN, 19])
    await assert.rejects(
      lab.page.evaluate((t) => window.__MOTION__.frame(t), t),
      /time must/,
    );
  await lab.page.evaluate(() => window.__MOTION__.frame(0));
  await lab.page.selectOption("#speed", "0.25");
  await lab.page.click("#play");
  await lab.page.waitForFunction(
    () => Number(document.querySelector("#timeline").value) > 0.1,
  );
  await lab.page.click("#play");
  await lab.page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await lab.page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  assert.ok(
    lab.requests.every(
      (url) => new URL(url).hostname === "127.0.0.1" || url.startsWith("data:"),
    ),
  );
  assert.deepEqual(lab.errors, []);
  for (const args of [
    ["--fps", "24"],
    ["--from", "NaN"],
    ["--to", "-1"],
    ["--out", "bad.gif"],
    ["--unknown", "x"],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/render.mjs", ...args],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Render failed/);
  }
  const report = {
    engine: info.engine,
    frames: states.length,
    maxRigError: error,
    maxTraceError: traceError,
    repeatableSeeks: true,
    slowPlayback: true,
    mobile: true,
    network: "local only",
    errors: lab.errors,
    hashes,
  };
  await writeFile(
    "test-results/browser-checks.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(report);
} finally {
  await lab.close();
}
