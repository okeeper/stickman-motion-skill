export interface FoleyCue {
  id: string;
  t: number;
  kind: string;
  x: number;
  strength: number;
  duration?: number;
  gait?: string;
  foot?: number;
  pan?: number;
  soundId?: string;
  echo?: boolean;
  note?: number;
}
export type SampleBank = Record<string, Float32Array>;
export const AUDIO_RATE: number;
export function readSample(bytes: ArrayBuffer | Uint8Array): Float32Array;
export function renderActionAudio(
  duration: number,
  cues: FoleyCue[],
  bank: SampleBank,
  options?: { from?: number; ambience?: boolean },
): {
  left: Float32Array<ArrayBuffer>;
  right: Float32Array<ArrayBuffer>;
  sampleRate: number;
  stats: Record<string, unknown>;
};
export function pcmWav(pcm: { left: Float32Array; right: Float32Array }): Uint8Array;
