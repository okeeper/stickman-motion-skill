import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, writeFile, rename, rm, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { openLab } from './browser.mjs';
import { writeAudio } from './audio.mjs';
const args = process.argv.slice(2),
  options = { preset: 'all', out: '../demos/weight/weight-study.mp4', fps: '60', config: '' };
try {
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    if (!args[i].startsWith('--') || !Object.hasOwn(options, key) || !args[i + 1])
      throw new Error(
        'Use --preset natural|heroic|heavy|all --out file.mp4 --fps 30|60 [--config settings.json]',
      );
    options[key] = args[i + 1];
  }
  if (
    !['natural', 'heroic', 'heavy', 'all'].includes(options.preset) ||
    !['30', '60'].includes(options.fps) ||
    !options.out.endsWith('.mp4')
  )
    throw new Error('Invalid preset, fps or output extension');
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
    lab = await openLab();
    const errors = lab.errors;
    const presets = custom
        ? [options.preset === 'all' ? 'heroic' : options.preset]
        : options.preset === 'all'
          ? ['natural', 'heroic', 'heavy']
          : [options.preset],
      clips = [];
    for (const preset of presets) {
      let info = await lab.page.evaluate((p) => window.__MOTION__.setPreset(p), preset);
      if (custom) info = await lab.page.evaluate((s) => window.__MOTION__.configure(s), custom);
      clips.push({ ...info, preset, frames: Math.round(info.duration * fps) });
    }
    const sound = path.join(temp, 'events.wav'),
      audio = await writeAudio(sound, clips, fps),
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
      await lab.page.evaluate((p) => window.__MOTION__.setPreset(p), clip.preset);
      if (custom) await lab.page.evaluate((s) => window.__MOTION__.configure(s), clip.settings);
      for (let frame = 0; frame < clip.frames; frame++) {
        if (pipeError) throw pipeError;
        const data = await lab.page.evaluate((t) => window.__MOTION__.png(t), frame / fps);
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
