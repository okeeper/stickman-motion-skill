import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
test("bad concept film CLI options fail before replacing an existing output", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "stickman-series-cli-")),
    out = path.join(dir, "keep.mp4");
  writeFileSync(out, "keep");
  try {
    for (const args of [
      ["--scene", "unknown"],
      ["--scene", "binary-search", "--fps", "15"],
      ["--scene", "complex-rotation", "--from", "3", "--to", "2"],
      ["--scene", "negative-ride", "--from", "NaN"],
    ]) {
      assert.throws(
        () =>
          execFileSync(
            process.execPath,
            ["scripts/render.mjs", ...args, "--out", out],
            { stdio: "pipe" },
          ),
        /Command failed/,
      );
      assert.equal(readFileSync(out, "utf8"), "keep");
    }
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          ["scripts/render-series.mjs", "--unknown"],
          { stdio: "pipe" },
        ),
      /Command failed/,
    );
    assert.equal(readFileSync(out, "utf8"), "keep");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
