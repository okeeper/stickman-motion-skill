import { defineConfig } from "vite";
import motionCanvas from "@motion-canvas/vite-plugin";
import { fileURLToPath } from "node:url";
export default defineConfig({
  base: "./",
  // The pinned plugin publishes CommonJS; native ESM exposes its default wrapper.
  plugins: [
    (typeof motionCanvas === "function"
      ? motionCanvas
      : motionCanvas.default)(),
    { name: "preview-target", config: () => ({ build: { target: "esnext" } }) },
  ],
  server: {
    fs: {
      allow: [
        fileURLToPath(new URL("./", import.meta.url)),
        fileURLToPath(new URL("../web/src/", import.meta.url)),
        fileURLToPath(new URL("../assets/fonts/", import.meta.url)),
      ],
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        preview: fileURLToPath(new URL("./preview.html", import.meta.url)),
      },
    },
  },
});
