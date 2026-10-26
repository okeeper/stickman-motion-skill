import {
  readSample,
  renderActionAudio,
  type SampleBank,
  type FoleyCue,
} from "../../../web/src/foley.mjs";
export async function loadAudio(duration: number, cues: FoleyCue[]) {
  const base = new URL("audio/", document.baseURI),
    response = await fetch(new URL("bank.json", base));
  if (!response.ok) throw new Error("Cannot load sound bank");
  const manifest = (await response.json()) as {
      samples: Record<string, { file: string }>;
    },
    bank: SampleBank = {};
  await Promise.all(
    Object.entries(manifest.samples).map(async ([name, asset]) => {
      const res = await fetch(new URL(asset.file, base));
      if (!res.ok) throw new Error(`Cannot load audio: ${name}`);
      bank[name] = readSample(await res.arrayBuffer());
    }),
  );
  return renderActionAudio(duration, cues, bank);
}
