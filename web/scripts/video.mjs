import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, rename, rm, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
/** Shared PNG → H.264/AAC pipeline. The engine supplies an absolute-time frame callback. */
export async function encodeVideo({ output, fps, clips, frame, audio, errors, scene, scale = 1 }) {
  if (
    ![30, 60].includes(fps) ||
    !output.endsWith('.mp4') ||
    ![1, 2].includes(scale) ||
    !clips.length ||
    clips.some((c) => !Number.isInteger(c.frames) || c.frames <= 0 || !Number.isFinite(c.from ?? 0))
  )
    throw new Error('Invalid encoding plan');
  for (const command of ['ffmpeg', 'ffprobe'])
    if (spawnSync(command, ['-version'], { stdio: 'ignore' }).status !== 0)
      throw new Error(`${command} is required on PATH`);
  await mkdir(path.dirname(output), { recursive: true });
  const temp = await mkdtemp(path.join(path.dirname(output), '.motion-render-'));
  let encoder;
  try {
    const sound = path.join(temp, 'events.wav');
    const audioReport = await audio(sound);
    const part = path.join(temp, 'movie.mp4'),
      total = clips.reduce((n, c) => n + c.frames, 0);
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
        ...(scale === 2 ? ['-vf', 'scale=1280:720:flags=lanczos'] : []),
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
    let log = '',
      pipeError;
    encoder.stderr.on('data', (d) => {
      log += d.toString();
    });
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
    for (const clip of clips)
      for (let i = 0; i < clip.frames; i++) {
        if (pipeError) throw pipeError;
        const png = await frame(clip, (clip.from ?? 0) + i / fps);
        if (!encoder.stdin.write(Buffer.from(png, 'base64')))
          await Promise.race([
            once(encoder.stdin, 'drain'),
            completion.then(() => {
              throw new Error('Encoder closed early');
            }),
          ]);
        count++;
        if (count % 180 === 0) console.log(`${count}/${total} frames`);
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
    if (Number(stream.nb_read_frames) !== total || stream.width !== 1280 || stream.height !== 720)
      throw new Error('Encoded frame count or size does not match plan');
    const report = {
      file: path.basename(output),
      scene,
      fps,
      frames: total,
      duration: total / fps,
      width: 1280,
      height: 720,
      resolutionScale: scale,
      audio: audioReport,
      clips,
      sha256: createHash('sha256')
        .update(await readFile(part))
        .digest('hex'),
    };
    // No old movie is touched on a frame, browser, audio, or encoder failure.
    await writeFile(path.join(temp, 'movie.json'), JSON.stringify(report, null, 2) + '\n');
    await rename(part, output);
    await rename(path.join(temp, 'movie.json'), output.replace(/\.mp4$/, '.json'));
    console.log(JSON.stringify({ output, frames: total, duration: total / fps }));
    return report;
  } finally {
    if (encoder && encoder.exitCode === null) encoder.kill();
    await rm(temp, { recursive: true, force: true });
  }
}
