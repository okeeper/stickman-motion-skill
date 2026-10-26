import path from "node:path";
import { openLab } from "./browser.mjs";
import { encodeVideo } from "../../web/scripts/video.mjs";
import { writeScore } from "../../web/scripts/score.mjs";
import { writeActionAudio } from "./action-audio.mjs";
const options = {
  scene: "trace",
  fps: "60",
  from: "0",
  to: "",
  out: "../demos/geometry/trace.mp4",
};
try {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, "");
    if (
      !args[i].startsWith("--") ||
      !Object.hasOwn(options, key) ||
      !args[i + 1]
    )
      throw new Error(
        "Use --scene trace|action|negative-ride|binary-search|complex-rotation --fps 30|60 --from seconds --to seconds --out file.mp4",
      );
    options[key] = args[i + 1];
  }
  if (
    ![
      "trace",
      "action",
      "negative-ride",
      "binary-search",
      "complex-rotation",
    ].includes(options.scene) ||
    !["30", "60"].includes(options.fps) ||
    !options.out.endsWith(".mp4") ||
    !Number.isFinite(Number(options.from)) ||
    Number(options.from) < 0 ||
    (options.to &&
      (!Number.isFinite(Number(options.to)) ||
        Number(options.to) <= Number(options.from)))
  )
    throw new Error("Invalid fps, output or interval");
  if (options.scene === "action" && !args.includes("--out"))
    options.out = "../demos/action/breakpoint.mp4";
  if (!["trace", "action"].includes(options.scene) && !args.includes("--out"))
    options.out = `../demos/videos/${options.scene}.mp4`;
  const lab = await openLab(options.scene);
  try {
    const info = await lab.page.evaluate(() => window.__MOTION__.info()),
      fps = Number(options.fps);
    const from = Math.round(Number(options.from) * fps) / fps,
      to = Math.round(Number(options.to || info.duration) * fps) / fps;
    if (from >= to || to > info.duration)
      throw new Error("Render interval exceeds scene duration");
    const clip = {
      ...info,
      sourceDuration: info.duration,
      from,
      to,
      duration: to - from,
      frames: Math.round((to - from) * fps),
    };
    await encodeVideo({
      output: path.resolve(options.out),
      fps,
      clips: [clip],
      scale: 2,
      scene: options.scene,
      errors: lab.errors,
      frame: (_, t) => lab.page.evaluate((t) => window.__MOTION__.png(t), t),
      audio: (file) =>
        options.scene !== "trace"
          ? writeActionAudio(file, clip.duration, info.cues, { from })
          : writeScore(file, clip.duration, info.cues, {
              from,
              music: [
                {
                  a: 0.5,
                  b: 5.8,
                  beat: 1.3,
                  gain: 0.014,
                  notes: [146.832, 220],
                },
                {
                  a: 7,
                  b: 17.6,
                  beat: 1.5,
                  gain: 0.012,
                  notes: [174.614, 220, 293.665],
                },
              ],
            }),
    });
  } finally {
    await lab.close();
  }
} catch (error) {
  console.error("Render failed:", error.message);
  process.exitCode = 1;
}
