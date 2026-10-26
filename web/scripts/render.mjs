import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, writeFile, rename, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
    output = path.resolve(options.out),
    folder = path.dirname(output);
  for (const command of ['ffmpeg', 'ffprobe'])
    if (spawnSync(command, ['-version'], { stdio: 'ignore' }).status !== 0)
      throw new Error(`${command} is required on PATH`);
  await mkdir(folder, { recursive: true });
  const temp = await mkdtemp(path.join(folder, '.weight-render-'));
  let lab, encoder;
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
    const sound = path.join(temp, 'events.wav'),
      audio =
        options.scene === 'adventure'
          ? await writeScore(sound, clips[0].frames / fps, clips[0].cues, { from: clips[0].from })
          : await writeAudio(sound, clips, fps),
      part = path.join(temp, 'movie.mp4');
    const total = clips.reduce((n, c) => n + c.frames, 0);
    encoder = spawn(
      'ffmpeg',
      [
        '-v',
        'error',
        '-y',
        '-f',
        'image2pipe',
        '-framerate',
        String(fps),
        '-vcodec',
        'png',
        '-i',
        'pipe:0',
        '-i',
        sound,
        '-map',
        '0:v:0',
        '-map',
        '1:a:0',
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '19',
        '-pix_fmt',
        'yuv420p',
        '-r',
        String(fps),
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        '-t',
        String(total / fps),
        '-movflags',
        '+faststart',
        part,
      ],
      { stdio: ['pipe', 'ignore', 'pipe'] },
    );
    let log = '';
    encoder.stderr.on('data', (d) => {
      log += d.toString();
    });
    let pipeError;
    encoder.stdin.on('error', (e) => {
      pipeError = e;
    });
    const completion = new Promise((resolve, reject) => {
      encoder.once('error', reject);
      encoder.once('close', (code) =>
        code === 0 ? resolve() : reject(new Error(log || `FFmpeg exited ${code}`)),
      );
    });
    completion.catch(() => {});
    let count = 0;
    for (const clip of clips) {
      if (options.scene === 'weight') {
        await lab.page.evaluate((p) => window.__MOTION__.setPreset(p), clip.preset);
        if (custom) await lab.page.evaluate((s) => window.__MOTION__.configure(s), clip.settings);
      }
      for (let frame = 0; frame < clip.frames; frame++) {
        if (pipeError) throw pipeError;
        const data = await lab.page.evaluate(
          (t) => window.__MOTION__.png(t),
          (clip.from ?? 0) + frame / fps,
        );
        if (!encoder.stdin.write(Buffer.from(data, 'base64')))
          await Promise.race([
            once(encoder.stdin, 'drain'),
            completion.then(() => {
              throw new Error('Encoder closed early');
            }),
          ]);
        count++;
        if (count % 180 === 0) console.log(`${count}/${total} frames`);
      }
    }
    encoder.stdin.end();
    await completion;
    if (errors.length) throw new Error(errors.join('\n'));
    const probe = spawnSync(
      'ffprobe',
      [
        '-v',
        'error',
        '-count_frames',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=nb_read_frames,width,height,avg_frame_rate',
        '-of',
        'json',
        part,
      ],
      { encoding: 'utf8' },
    );
    if (probe.status !== 0) throw new Error(probe.stderr);
    const stream = JSON.parse(probe.stdout).streams[0];
    if (Number(stream.nb_read_frames) !== total)
      throw new Error('Encoded frame count does not match plan');
    await rename(part, output);
    const report = {
      file: path.basename(output),
      scene: options.scene,
      fps,
      frames: total,
      duration: total / fps,
      width: 1280,
      height: 720,
      audio,
      clips,
      sha256: createHash('sha256')
        .update(await readFile(output))
        .digest('hex'),
    };
    await writeFile(output.replace(/\.mp4$/, '.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ output, frames: total, duration: total / fps }));
  } finally {
    if (encoder && encoder.exitCode === null) encoder.kill();
    await lab?.close();
    await rm(temp, { recursive: true, force: true });
  }
} catch (error) {
  console.error('Render failed:', error.message);
  process.exitCode = 1;
}
