import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
test('new scene and interval CLI failures preserve an existing movie before launching a browser', async () => {
  const folder = await mkdtemp(path.join(tmpdir(), 'stickman-render-'));
  try {
    const output = path.join(folder, 'existing.mp4');
    await writeFile(output, 'keep existing movie');
    const cases = [
      ['--scene', 'unknown'],
      ['--scene', 'adventure', '--from', '-1'],
      ['--scene', 'adventure', '--from', '2', '--to', '1'],
      ['--scene', 'adventure', '--from', 'NaN'],
      ['--scene', 'adventure', '--fps', '120'],
      ['--scene', 'adventure', '--preset', 'heroic'],
      ['--scene', 'weight', '--to', '1'],
      ['--scene', 'adventure', '--config', 'missing.json'],
    ];
    for (const args of cases) {
      const r = spawnSync(
        process.execPath,
        [
          fileURLToPath(new URL('../scripts/render.mjs', import.meta.url)),
          '--out',
          output,
          ...args,
        ],
        { encoding: 'utf8' },
      );
      assert.notEqual(r.status, 0, args.join(' '));
      assert.match(r.stderr, /Render failed/);
      assert.doesNotMatch(r.stderr, /required on PATH|executable doesn't exist/i);
      assert.equal(await readFile(output, 'utf8'), 'keep existing movie');
    }
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
