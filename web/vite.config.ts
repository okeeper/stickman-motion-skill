import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  base: './',
  server: {
    fs: {
      allow: [
        fileURLToPath(new URL('./', import.meta.url)),
        fileURLToPath(new URL('../assets/fonts/', import.meta.url)),
      ],
    },
  },
  build: {
    rollupOptions: {
      input: {
        lab: fileURLToPath(new URL('./index.html', import.meta.url)),
        film: fileURLToPath(new URL('./film.html', import.meta.url)),
      },
    },
  },
});
