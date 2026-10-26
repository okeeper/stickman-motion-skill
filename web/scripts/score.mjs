import { writeFile } from 'node:fs/promises';
const KINDS = ['step', 'grip', 'takeoff', 'impact', 'rule', 'motor'];
const noise = (seed, i) => {
  let v = (Math.imul(i + 1, 374761393) + Math.imul(seed + 1, 668265263)) | 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 2147483648 - 1;
};
/** Original, deterministic three-layer sound. Cue times are absolute, including partial-render tails. */
export async function writeScore(file, duration, cues, { from = 0 } = {}) {
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(from) ||
    from < 0 ||
    !Array.isArray(cues) ||
    cues.some(
      (c) =>
        !KINDS.includes(c.kind) ||
        !Number.isFinite(c.t) ||
        c.t < 0 ||
        !Number.isFinite(c.strength) ||
        c.strength < 0 ||
        c.strength > 1.5 ||
        !Number.isFinite(c.x) ||
        (c.pan !== undefined && (!Number.isFinite(c.pan) || Math.abs(c.pan) > 1)) ||
        (c.duration !== undefined && (!Number.isFinite(c.duration) || c.duration <= 0)),
    )
  )
    throw new Error('Invalid score duration, origin or cue');
  const rate = 48000,
    n = Math.round(duration * rate),
    originSample = Math.round(from * rate);
  const left = new Float64Array(n),
    right = new Float64Array(n);
  const sections = [
    { a: 0, b: 5.7, beat: 1.4, gain: 0.022, notes: [146.832, 220, 174.614, 164.814] },
    { a: 6.4, b: 9.3, beat: 0.35, gain: 0.028, notes: [146.832, 174.614, 220, 293.665] },
    { a: 9.8, b: 11.65, beat: 0.9, gain: 0.012, notes: [220, 174.614] },
    { a: 12, b: 14.4, beat: 0.6, gain: 0.024, notes: [146.832, 220, 293.665, 329.628] },
    { a: 15.8, b: 18.8, beat: 0.28, gain: 0.027, notes: [146.832, 164.814, 220, 293.665] },
    { a: 20.3, b: 27.6, beat: 1.5, gain: 0.018, notes: [146.832, 184.997, 220, 293.665] },
  ];
  for (let i = 0; i < n; i++) {
    const t = (originSample + i) / rate;
    let music = 0;
    for (const s of sections) {
      if (t < s.a || t >= s.b) continue;
      const note = Math.floor((t - s.a) / s.beat),
        local = (t - s.a) % s.beat;
      const hz = s.notes[note % s.notes.length];
      const envelope =
        Math.min(1, local / 0.018) * Math.exp(-local * 4.3) * Math.min(1, (s.b - t) / 0.25);
      music +=
        (Math.sin(2 * Math.PI * hz * local) + 0.25 * Math.sin(2 * Math.PI * hz * 2 * local)) *
        s.gain *
        envelope;
    }
    let duck = 1;
    for (const c of cues)
      if (c.kind === 'impact' || c.kind === 'rule') {
        const dt = t - c.t;
        if (dt >= -0.04 && dt < 0.35)
          duck = Math.min(
            duck,
            dt < 0 ? 1 - (0.52 * (dt + 0.04)) / 0.04 : 0.48 + (0.52 * dt) / 0.35,
          );
      }
    left[i] = music * duck;
    right[i] = music * duck;
  }
  for (let index = 0; index < cues.length; index++) {
    const c = cues[index];
    const length =
      c.duration ??
      (c.kind === 'impact' ? 0.6 : c.kind === 'rule' ? 0.75 : c.kind === 'step' ? 0.12 : 0.23);
    const start = Math.round(c.t * rate) - originSample;
    const pan = c.pan ?? 0;
    const l = Math.cos(((pan + 1) * Math.PI) / 4),
      r = Math.sin(((pan + 1) * Math.PI) / 4);
    for (let j = Math.max(0, -start); j < length * rate && start + j < n; j++) {
      const t = j / rate,
        u = t / length;
      const attack = Math.sin((Math.PI / 2) * Math.min(1, t / 0.004)) ** 2;
      const random = noise(index, j);
      let value = 0;
      if (c.kind === 'impact')
        value =
          (Math.sin(2 * Math.PI * (67 * t - 23 * t * t)) * 0.24 + random * 0.055) *
          Math.exp(-t * 13);
      if (c.kind === 'step')
        value = (Math.sin(2 * Math.PI * 115 * t) * 0.13 + random * 0.03) * Math.exp(-t * 55);
      if (c.kind === 'grip')
        value = (Math.sin(2 * Math.PI * 1250 * t) * 0.09 + random * 0.015) * Math.exp(-t * 65);
      if (c.kind === 'takeoff')
        value =
          (random * 0.065 + Math.sin(2 * Math.PI * (170 * t + 140 * t * t)) * 0.025) *
          Math.exp(-t * 17);
      if (c.kind === 'rule')
        value =
          (Math.sin(2 * Math.PI * 440 * t) +
            0.55 * Math.sin(2 * Math.PI * 660 * t) +
            0.25 * Math.sin(2 * Math.PI * 880 * t)) *
          Math.exp(-t * 6) *
          0.08;
      if (c.kind === 'motor')
        value =
          (Math.sin(2 * Math.PI * (85 * t + 55 * t * t)) * 0.04 + random * 0.012) *
          Math.sin(Math.PI * u) ** 2;
      value *= attack * c.strength;
      left[start + j] += value * l;
      right[start + j] += value * r;
    }
  }
  const pcm = Buffer.alloc(n * 4);
  let peak = 0,
    sum = 0,
    clippedSamples = 0;
  for (let i = 0; i < n; i++)
    for (let channel = 0; channel < 2; channel++) {
      const raw = channel ? right[i] : left[i];
      if (Math.abs(raw) >= 0.95) clippedSamples++;
      const value = Math.max(-0.95, Math.min(0.95, raw));
      peak = Math.max(peak, Math.abs(value));
      sum += value * value;
      pcm.writeInt16LE(Math.round(value * 32767), i * 4 + channel * 2);
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
  return {
    sampleRate: rate,
    channels: 2,
    peakDbfs: 20 * Math.log10(peak),
    rmsDbfs: 10 * Math.log10(sum / (n * 2)),
    clippedSamples,
    layers: ['contact', 'rule', 'score'],
    sourceFrom: originSample / rate,
  };
}
