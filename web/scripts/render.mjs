import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { encodeVideo } from './video.mjs';
import { openLab } from './browser.mjs';
import { writeAudio } from './audio.mjs';
import { writeScore } from './score.mjs';
const args = process.argv.slice(2),
  options = {
    scene: 'weight',
    preset: 'all',
    out: '../demos/weight/weight-study.mp4',
    fps: '60',
    config: '',
    from: '0',
    to: '',
  };
try {
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !Object.hasOwn(options, key) || !args[i + 1])
      throw new Error(
        'Use --scene weight|adventure --preset natural|heroic|heavy|all --out file.mp4 --fps 30|60 [--config settings.json] [--from seconds --to seconds]',
      );
    options[key] = args[i + 1];
  }
  if (
    !['weight', 'adventure'].includes(options.scene) ||
    !['natural', 'heroic', 'heavy', 'all'].includes(options.preset) ||
    !['30', '60'].includes(options.fps) ||
    !options.out.endsWith('.mp4')
  )
    throw new Error('Invalid preset, fps or output extension');
  if (
    !Number.isFinite(Number(options.from)) ||
    Number(options.from) < 0 ||
    (options.to &&
      (!Number.isFinite(Number(options.to)) || Number(options.to) <= Number(options.from)))
  )
    throw new Error('Invalid render interval');
  if (options.scene === 'weight' && (options.from !== '0' || options.to))
    throw new Error('Intervals require --scene adventure');
  if (options.scene === 'adventure' && (options.config || options.preset !== 'all'))
    throw new Error('Weight presets/config do not apply to adventure');
  if (options.scene === 'adventure' && !args.includes('--out'))
    options.out = '../demos/adventure/reversal.mp4';
  const custom = options.config
    ? JSON.parse(await readFile(path.resolve(options.config), 'utf8'))
    : null;
  if (
    options.config &&
    (!custom ||
      typeof custom !== 'object' ||
      Array.isArray(custom) ||
      Object.keys(custom).some(
        (k) => !['mass', 'gravity', 'charge', 'effort', 'elasticity'].includes(k),
      ) ||
      ['mass', 'gravity', 'charge', 'effort', 'elasticity'].some(
        (k) => typeof custom[k] !== 'number' || !Number.isFinite(custom[k]),
      ))
  )
    throw new Error(
      'Config must contain exactly mass, gravity, charge, effort and elasticity as finite numbers',
    );
  const fps = Number(options.fps),
    output = path.resolve(options.out);
  let lab;
  try {
    lab = await openLab(options.scene === 'adventure' ? '/film.html' : '/');
    const errors = lab.errors;
    const presets = custom
        ? [options.preset === 'all' ? 'heroic' : options.preset]
        : options.preset === 'all'
          ? ['natural', 'heroic', 'heavy']
          : [options.preset],
      clips = [];
    if (options.scene === 'adventure') {
      const info = await lab.page.evaluate(() => window.__MOTION__.info());
      const from = Math.round(Number(options.from) * fps) / fps;
      const to = Math.round(Number(options.to || info.duration) * fps) / fps;
      if (to > info.duration || from >= to)
        throw new Error('Render interval exceeds scene duration');
      clips.push({
        ...info,
        sourceDuration: info.duration,
        from,
        to,
        duration: to - from,
        frames: Math.round((to - from) * fps),
      });
    } else
      for (const preset of presets) {
        let info = await lab.page.evaluate((p) => window.__MOTION__.setPreset(p), preset);
        if (custom) info = await lab.page.evaluate((s) => window.__MOTION__.configure(s), custom);
        clips.push({ ...info, preset, frames: Math.round(info.duration * fps) });
      }
    let activePreset;
    await encodeVideo({
      output,
      fps,
      clips,
      scene: options.scene,
      errors,
      audio: (file) =>
        options.scene === 'adventure'
          ? writeScore(file, clips[0].frames / fps, clips[0].cues, { from: clips[0].from })
          : writeAudio(file, clips, fps),
      frame: async (clip, t) => {
        if (options.scene === 'weight' && activePreset !== clip.preset) {
          await lab.page.evaluate((p) => window.__MOTION__.setPreset(p), clip.preset);
          if (custom) await lab.page.evaluate((s) => window.__MOTION__.configure(s), clip.settings);
          activePreset = clip.preset;
        }
        return lab.page.evaluate((t) => window.__MOTION__.png(t), t);
      },
    });
  } finally {
    await lab?.close();
  }
} catch (error) {
  console.error('Render failed:', error.message);
  process.exitCode = 1;
}
