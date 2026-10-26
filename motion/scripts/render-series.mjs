import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
if (process.argv.length !== 2) {
  console.error(
    "Use npm run render:series; for partial exports use npm run render -- --scene SCENE --from A --to B --out FILE.mp4",
  );
  process.exitCode = 1;
} else {
  try {
    for (const scene of [
      "negative-ride",
      "binary-search",
      "complex-rotation",
    ]) {
      await new Promise((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            fileURLToPath(new URL("./render.mjs", import.meta.url)),
            "--scene",
            scene,
          ],
          {
            stdio: "inherit",
            cwd: fileURLToPath(new URL("../", import.meta.url)),
          },
        );
        child.on("error", reject);
        child.on("exit", (code) =>
          code === 0
            ? resolve()
            : reject(new Error(`${scene}: renderer exited ${code}`)),
        );
      });
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
