/** Shared, deterministic sample mixer. The browser and MP4 use these same PCM samples. */
export const AUDIO_RATE = 48000;
const KINDS = [
  'footstep',
  'shoe-grip',
  'whoosh',
  'landing',
  'tile',
  'hand',
  'cloth',
  'body',
  'breath',
  'skid',
  'gate',
  'alarm',
];
function seed(id) {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
const noise = (s, i) => {
  let n = (Math.imul(i + 1, 374761393) + Math.imul(s + 1, 668265263)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 2147483648 - 1;
};
export function readSample(bytes) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
    v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const str = (at, n) => String.fromCharCode(...data.subarray(at, at + n));
  if (data.length < 44 || str(0, 4) !== 'RIFF' || str(8, 4) !== 'WAVE')
    throw new Error('Invalid PCM WAV');
  let audio,
    valid = false;
  for (let at = 12; at + 8 <= data.length;) {
    const n = v.getUint32(at + 4, true),
      end = at + 8 + n;
    if (end > data.length) throw new Error('Truncated PCM WAV');
    if (str(at, 4) === 'fmt ')
      valid =
        n >= 16 &&
        v.getUint16(at + 8, true) === 1 &&
        v.getUint16(at + 10, true) === 1 &&
        v.getUint32(at + 12, true) === AUDIO_RATE &&
        v.getUint16(at + 22, true) === 16;
    if (str(at, 4) === 'data') audio = { at: at + 8, n };
    at = end + (n % 2);
  }
  if (!valid || !audio || audio.n % 2) throw new Error('Expected mono 48 kHz PCM16 WAV');
  const out = new Float32Array(audio.n / 2);
  for (let i = 0; i < out.length; i++) out[i] = v.getInt16(audio.at + 2 * i, true) / 32768;
  return out;
}
export function renderActionAudio(duration, cues, bank, { from = 0, ambience = true } = {}) {
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !Number.isFinite(from) ||
    from < 0 ||
    !Array.isArray(cues) ||
    cues.some(
      (c) =>
        !c ||
        typeof c.id !== 'string' ||
        !KINDS.includes(c.kind) ||
        ![c.t, c.x, c.strength].every(Number.isFinite) ||
        c.t < 0 ||
        c.strength < 0 ||
        c.strength > 1.5 ||
        (c.duration !== undefined && (!Number.isFinite(c.duration) || c.duration <= 0)) ||
        (c.pan !== undefined && (!Number.isFinite(c.pan) || Math.abs(c.pan) > 1)),
    )
  )
    throw new Error('Invalid action audio plan');
  const n = Math.round(duration * AUDIO_RATE),
    origin = Math.round(from * AUDIO_RATE),
    left = new Float32Array(n),
    right = new Float32Array(n);
  const mixSample = (name, c, gain = 1, rate = 1, delay = 0) => {
    const sample = bank[name];
    if (!(sample instanceof Float32Array) || !sample.length)
      throw new Error(`Missing audio sample: ${name}`);
    const start = Math.round((c.t + delay) * AUDIO_RATE) - origin;
    const pan = c.pan ?? 0,
      lg = Math.cos(((pan + 1) * Math.PI) / 4),
      rg = Math.sin(((pan + 1) * Math.PI) / 4);
    const frames = Math.ceil(sample.length / rate);
    for (let j = Math.max(0, -start); j < frames && start + j < n; j++) {
      const q = j * rate,
        k = Math.floor(q),
        s = (sample[k] ?? 0) * (1 - (q - k)) + (sample[k + 1] ?? 0) * (q - k);
      const value = s * c.strength * gain * 0.75;
      left[start + j] += value * lg;
      right[start + j] += value * rg;
      // Short, quiet early reflections. Absolute indices preserve partial-render tails.
      for (const [offset, amount] of [
        [1127, 0.07],
        [2351, 0.035],
      ])
        if (start + j + offset >= 0 && start + j + offset < n) {
          left[start + j + offset] += value * rg * amount;
          right[start + j + offset] += value * lg * amount;
        }
    }
    // Include reflection tails originating before an export cut.
    for (const [offset, amount] of [
      [1127, 0.07],
      [2351, 0.035],
    ]) {
      const begin = Math.max(0, -start - offset),
        end = Math.min(frames, -start);
      for (let j = begin; j < end; j++) {
        const q = j * rate,
          k = Math.floor(q),
          value =
            ((sample[k] ?? 0) * (1 - (q - k)) + (sample[k + 1] ?? 0) * (q - k)) *
            c.strength *
            gain *
            0.75 *
            amount;
        const at = start + j + offset;
        if (at >= 0 && at < n) {
          left[at] += value * rg;
          right[at] += value * lg;
        }
      }
    }
  };
  for (const c of cues) {
    const h = seed(c.id),
      variant = h % 5,
      pitch = 1 + (((h >>> 6) % 9) - 4) * 0.006;
    if (c.kind === 'footstep')
      mixSample(
        `footstep_concrete_${String(variant).padStart(3, '0')}`,
        c,
        c.gait === 'walk' ? 0.52 : c.gait === 'run' ? 0.74 : 0.88,
        pitch * (c.gait === 'walk' ? 0.98 : c.gait === 'run' ? 1.035 : 1.07),
      );
    if (c.kind === 'landing') {
      mixSample('impactSoft_heavy_000', c, 0.72, 0.94);
      mixSample(`footstep_concrete_${String(variant).padStart(3, '0')}`, c, 0.55, 0.96);
    }
    if (c.kind === 'body')
      mixSample(
        h % 2 ? 'impactSoft_medium_001' : 'impactSoft_heavy_000',
        c,
        0.75,
        0.91 + 0.04 * (h % 3),
      );
    if (c.kind === 'hand') mixSample('impactPunch_medium_000', c, 0.38, 1.08);
    if (c.kind === 'tile') mixSample('impactPlate_light_001', c, 0.4, 1.05);
    if (c.kind === 'gate') {
      mixSample('impactPlate_heavy_000', c, 0.45, 0.8);
      mixSample('metalLatch', c, 0.45, 0.9, 0.02);
    }
    if (c.kind === 'shoe-grip')
      mixSample(`footstep_concrete_${String(variant).padStart(3, '0')}`, c, 0.6, 0.83);
    if (c.kind === 'cloth' || c.kind === 'whoosh') {
      mixSample(
        `cloth${(h % 4) + 1}`,
        c,
        c.kind === 'cloth' ? 0.52 : 0.25,
        c.kind === 'cloth' ? 0.9 : 1.2,
      );
      if (c.kind === 'cloth') mixSample('dropLeather', c, 0.22, 0.8, 0.19);
    }
    if (['whoosh', 'breath', 'skid', 'alarm'].includes(c.kind)) {
      const length = c.duration ?? (c.kind === 'alarm' ? 0.44 : 0.25),
        start = Math.round(c.t * AUDIO_RATE) - origin,
        frames = Math.round(length * AUDIO_RATE);
      let low = 0;
      for (let j = 0; j < frames; j++) {
        const t = j / AUDIO_RATE,
          u = j / frames,
          white = noise(h, j);
        low += 0.1 * (white - low);
        const envelope = Math.sin(Math.PI * u) ** 1.6;
        let value =
          c.kind === 'alarm'
            ? Math.sin(2 * Math.PI * (640 * t + 500 * t * t)) * 0.06 * envelope
            : (c.kind === 'breath' ? low * 0.18 : (white - low) * 0.08) * envelope;
        value *= c.strength * 0.75;
        const at = start + j;
        if (at >= 0 && at < n) {
          const pan = c.pan ?? 0;
          left[at] += value * Math.sqrt((1 - pan) / 2);
          right[at] += value * Math.sqrt((1 + pan) / 2);
        }
      }
    }
  }
  let peak = 0,
    sum = 0,
    clippedSamples = 0;
  for (let i = 0; i < n; i++) {
    if (ambience) {
      const bed = noise(31, origin + i) * 0.00045;
      left[i] += bed;
      right[i] += bed;
    }
    for (const channel of [left, right]) {
      const raw = channel[i];
      if (!Number.isFinite(raw)) throw new Error('Non-finite audio sample');
      if (Math.abs(raw) > 0.98) clippedSamples++;
      channel[i] = Math.max(-0.98, Math.min(0.98, raw));
      peak = Math.max(peak, Math.abs(channel[i]));
      sum += channel[i] ** 2;
    }
  }
  return {
    left,
    right,
    sampleRate: AUDIO_RATE,
    stats: {
      peakDbfs: peak ? 20 * Math.log10(peak) : null,
      rmsDbfs: sum ? 10 * Math.log10(sum / (n * 2)) : null,
      clippedSamples,
      sourceFrom: origin / AUDIO_RATE,
      layers: ['licensed-foley', 'cloth-air-breath', 'world'],
      cues: cues.length,
    },
  };
}
export function pcmWav({ left, right }) {
  if (
    !(left instanceof Float32Array) ||
    !(right instanceof Float32Array) ||
    left.length !== right.length
  )
    throw new Error('Invalid stereo PCM');
  const data = new Uint8Array(44 + left.length * 4),
    view = new DataView(data.buffer),
    put = (at, s) => {
      for (let i = 0; i < s.length; i++) data[at + i] = s.charCodeAt(i);
    };
  put(0, 'RIFF');
  view.setUint32(4, data.length - 8, true);
  put(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, AUDIO_RATE, true);
  view.setUint32(28, AUDIO_RATE * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  put(36, 'data');
  view.setUint32(40, left.length * 4, true);
  for (let i = 0; i < left.length; i++) {
    view.setInt16(44 + 4 * i, Math.round(clampPCM(left[i]) * 32767), true);
    view.setInt16(46 + 4 * i, Math.round(clampPCM(right[i]) * 32767), true);
  }
  return data;
}
const clampPCM = (v) => Math.max(-1, Math.min(1, v));
