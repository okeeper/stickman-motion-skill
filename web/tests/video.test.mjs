import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { encodeVideo } from '../scripts/video.mjs';
import { writeScore } from '../scripts/score.mjs';
test('encoder frame failure preserves an existing movie and removes temporary output', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'motion-encoder-')),
    output = path.join(dir, 'keep.mp4');
  try {
    await writeFile(output, 'keep');
    const plan = {
      output,
      fps: 30,
      clips: [{ frames: 1 }],
      frame: async () => {
        throw new Error('injected frame failure');
      },
      audio: (f) => writeScore(f, 1 / 30, []),
      errors: [],
      scene: 'test',
    };
    await assert.rejects(encodeVideo({ ...plan, fps: 24 }), /Invalid encoding/);
    await assert.rejects(encodeVideo(plan), /injected frame failure/);
    assert.equal(await readFile(output, 'utf8'), 'keep');
    const { readdir } = await import('node:fs/promises');
    assert.deepEqual(await readdir(dir), ['keep.mp4']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
