import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readSample, renderActionAudio } from "../../web/src/foley.mjs";
import { writeActionAudio } from "../scripts/action-audio.mjs";
const EVENTS = [
  { id: "step", t: 0.2, kind: "footstep", gait: "run", x: 0, strength: 0.7 },
  { id: "landing", t: 5.48, kind: "landing", x: 1, strength: 1 },
  { id: "body", t: 5.62, kind: "body", x: 1.1, strength: 0.7 },
  { id: "cloth", t: 5.71, kind: "cloth", x: 1.2, strength: 0.6 },
  {
    id: "breath",
    t: 5.75,
    kind: "breath",
    x: 1.3,
    strength: 0.4,
    duration: 0.4,
  },
];
async function loadBank() {
  const base = new URL("../public/audio/", import.meta.url),
    manifest = JSON.parse(await readFile(new URL("bank.json", base), "utf8")),
    bank = {};
  for (const [name, item] of Object.entries(manifest.samples))
    bank[name] = readSample(await readFile(new URL(item.file, base)));
  return bank;
}
test("real sample foley is deterministic, unclipped, and crop tails match the full mix", async () => {
  const bank = await loadBank(),
    full = renderActionAudio(11, EVENTS, bank),
    copy = renderActionAudio(11, EVENTS, bank),
    part = renderActionAudio(1.2, EVENTS, bank, { from: 5.7 });
  assert.deepEqual(full.left, copy.left);
  assert.equal(full.stats.clippedSamples, 0);
  assert.ok(full.stats.peakDbfs < -1);
  const offset = Math.round(5.7 * 48000);
  for (const channel of ["left", "right"])
    for (let i = 0; i < part[channel].length; i++)
      assert.ok(
        Math.abs(part[channel][i] - full[channel][offset + i]) < 1e-6,
        `${channel} ${i}`,
      );
  const isolated = renderActionAudio(
    1,
    [
      {
        id: "one",
        t: 0.2,
        kind: "footstep",
        gait: "walk",
        x: 0,
        strength: 0.8,
      },
    ],
    bank,
    { ambience: false },
  );
  assert.ok(isolated.left.subarray(0, 9600).every((v) => v === 0));
  assert.ok(
    isolated.left.subarray(9600, 10400).some((v) => Math.abs(v) > 0.005),
    "sample onset follows the touchdown",
  );
});
test("bad PCM, cue kinds and missing assets fail without replacing existing sound", async () => {
  assert.throws(() => readSample(new Uint8Array(44)), /Invalid PCM/);
  const bank = await loadBank();
  assert.throws(() => renderActionAudio(0, [], bank), /Invalid action/);
  assert.throws(
    () =>
      renderActionAudio(
        1,
        [{ id: "bad", t: 0, kind: "unknown", x: 0, strength: 1 }],
        bank,
      ),
    /Invalid action/,
  );
  assert.throws(
    () =>
      renderActionAudio(
        1,
        [{ id: "bad", t: 0, kind: "footstep", x: 0, strength: 1 }],
        {},
      ),
    /Missing audio/,
  );
  const dir = await mkdtemp(path.join(tmpdir(), "stickman-foley-")),
    file = path.join(dir, "keep.wav");
  try {
    await writeFile(file, "keep");
    await assert.rejects(writeActionAudio(file, 0, EVENTS), /Invalid action/);
    assert.equal(await readFile(file, "utf8"), "keep");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("discovery sounds keep exact crop tails and preserve a recognisable delayed knock", () => {
  const kinds = ["knock", "slide", "turn", "reveal", "music"];
  const cues = kinds.map((kind, i) => ({
    id: kind,
    t: 0.1 + i * 0.16,
    kind,
    x: 0,
    strength: 0.4,
    duration: 0.5,
    note: 220,
  }));
  const full = renderActionAudio(1.6, cues, {}, { ambience: false });
  const part = renderActionAudio(0.5, cues, {}, { from: 0.4, ambience: false });
  for (const ch of ["left", "right"])
    assert.deepEqual(part[ch], full[ch].slice(19200, 43200));
  assert.equal(full.stats.clippedSamples, 0);
  assert.ok(full.stats.layers.includes("original-score"));
  const knock = {
    id: "first",
    soundId: "same-hand",
    t: 0,
    kind: "knock",
    x: 0,
    strength: 0.5,
  };
  const a = renderActionAudio(0.3, [knock], {}, { ambience: false });
  const b = renderActionAudio(
    0.3,
    [{ ...knock, id: "echo", echo: true }],
    {},
    { ambience: false },
  );
  for (let i = 0; i < a.left.length; i++)
    assert.ok(Math.abs(b.left[i] - 0.65 * a.left[i]) < 1e-7);
  for (const patch of [
    { note: NaN },
    { note: 0 },
    { note: Infinity },
    { soundId: 42 },
    { echo: "yes" },
  ])
    assert.throws(
      () => renderActionAudio(0.3, [{ ...knock, ...patch }], {}),
      /Invalid action/,
    );
});
