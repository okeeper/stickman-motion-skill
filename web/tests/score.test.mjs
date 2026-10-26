import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeScore } from '../scripts/score.mjs';
test('score is deterministic, unclipped and preserves absolute cue/music time in a partial render', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'stickman-score-'));
  try {
    const cues = [
      { t: 0.4, kind: 'motor', duration: 1.4, strength: 0.6, x: 1, pan: -0.5 },
      { t: 1.2, kind: 'impact', strength: 1, x: 1, pan: 0.5 },
    ];
    const a = path.join(folder, 'a.wav'),
      b = path.join(folder, 'b.wav'),
      c = path.join(folder, 'c.wav');
    const stats = await writeScore(a, 2, cues);
    await writeScore(b, 2, cues);
    await writeScore(c, 1, cues, { from: 0.5 });
    const full = await readFile(a),
      copy = await readFile(b),
      part = await readFile(c);
    assert.deepEqual(full, copy);
    assert.equal(stats.clippedSamples, 0);
    assert.ok(Number.isFinite(stats.peakDbfs) && stats.peakDbfs < -1);
    assert.equal(full.length, 44 + 2 * 48000 * 4);
    for (let i = 0; i < 48000 * 2; i++)
      assert.ok(
        Math.abs(part.readInt16LE(44 + 2 * i) - full.readInt16LE(44 + 24000 * 4 + 2 * i)) <= 1,
      );
    for (const args of [
      [0, cues],
      [NaN, cues],
      [1, [{ t: -1, kind: 'step', strength: 1, x: 0 }]],
      [1, [{ t: 0, kind: 'unknown', strength: 1, x: 0 }]],
      [1, cues, { from: -1 }],
    ])
      await assert.rejects(writeScore(a, ...args), /Invalid score/);
    assert.deepEqual(await readFile(a), full);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
