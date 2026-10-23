import { writeFile } from 'node:fs/promises';
/** Original procedural movement cues. Event timing comes from the simulation. */
export async function writeAudio(file, clips, fps = 60) {
  const rate = 48000,
    duration = clips.reduce((sum, c) => sum + c.frames / fps, 0),
    n = Math.round(duration * rate),
    audio = new Float64Array(n);
  let seed = 314159;
  const noise = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 31 - 1;
  };
  let offset = 0;
  for (const clip of clips) {
    for (const event of clip.events) {
      const start = Math.round((offset + event.t) * rate),
        impact = event.kind === 'impact',
        length = impact ? 0.42 : 0.23;
      const amp = Math.min(0.28, 0.035 + event.speed * 0.026);
      for (let i = 0; i < Math.round(length * rate) && start + i < n; i++) {
        const t = i / rate,
          u = t / length,
          fade = Math.sin(Math.PI * 0.5 * Math.min(1, t / 0.008)) ** 2;
        const envelope = Math.exp(-u * (impact ? 8 : 4)) * fade;
        const tone = impact
          ? Math.sin(2 * Math.PI * (75 * t - 55 * t * t)) * 0.7
          : Math.sin(2 * Math.PI * (190 * t + 150 * t * t)) * 0.13;
        audio[start + i] += amp * envelope * (tone + noise() * (impact ? 0.25 : 0.45));
      }
    }
    offset += clip.frames / fps;
  }
  const pcm = Buffer.alloc(n * 4);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const value = Math.max(-0.94, Math.min(0.94, audio[i]));
    peak = Math.max(peak, Math.abs(value));
    const sample = Math.round(value * 32767);
    pcm.writeInt16LE(sample, i * 4);
    pcm.writeInt16LE(sample, i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  await writeFile(file, Buffer.concat([header, pcm]));
  return { sampleRate: rate, channels: 2, peakDbfs: 20 * Math.log10(peak) };
}
