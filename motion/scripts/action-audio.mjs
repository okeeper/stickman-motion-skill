import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readSample, renderActionAudio, pcmWav } from "../../web/src/foley.mjs";
export async function writeActionAudio(
  file,
  duration,
  cues,
  { from = 0 } = {},
) {
  const base = new URL("../public/audio/", import.meta.url),
    manifest = JSON.parse(await readFile(new URL("bank.json", base), "utf8")),
    bank = {};
  let local;
  try {
    local = JSON.parse(
      await readFile(new URL("bank-local.json", base), "utf8"),
    );
  } catch {
    throw new Error("Audio cache is missing; run npm run prepare:audio");
  }
  for (const [name, asset] of Object.entries(manifest.samples)) {
    const bytes = await readFile(new URL(asset.file, base));
    if (
      createHash("sha256").update(bytes).digest("hex") !==
      local.samples[name]?.sha256
    )
      throw new Error(`Audio asset checksum mismatch: ${name}`);
    bank[name] = readSample(bytes);
  }
  const pcm = renderActionAudio(duration, cues, bank, { from });
  await writeFile(file, pcmWav(pcm));
  return {
    sampleRate: pcm.sampleRate,
    channels: 2,
    ...pcm.stats,
    assetLicense: "CC0-1.0",
    preparedBankSHA256: createHash("sha256")
      .update(JSON.stringify(local))
      .digest("hex"),
    sampleBankSHA256: createHash("sha256")
      .update(JSON.stringify(manifest))
      .digest("hex"),
  };
}
