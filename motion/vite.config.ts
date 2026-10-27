import { defineConfig } from "vite";
import motionCanvas from "@motion-canvas/vite-plugin";
import { fileURLToPath } from "node:url";
export default defineConfig({
  base: "./",
  // The pinned plugin publishes CommonJS; native ESM exposes its default wrapper.
  plugins: [
    (typeof motionCanvas === "function" ? motionCanvas : motionCanvas.default)({
      project: [
        "./src/project.ts",
        "./src/action-project.ts",
        "./src/newton-project.ts",
        "./src/negative-ride-project.ts",
        "./src/binary-search-project.ts",
        "./src/complex-rotation-project.ts",
      ],
    }),
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
        ...Object.fromEntries(
          ["negative-ride", "binary-search", "complex-rotation", "newton"].map(
            (id) => [
              id,
              fileURLToPath(new URL(`./${id}.html`, import.meta.url)),
            ],
          ),
        ),
        preview: fileURLToPath(new URL("./preview.html", import.meta.url)),
        action: fileURLToPath(new URL("./action.html", import.meta.url)),
      },
    },
  },
});
