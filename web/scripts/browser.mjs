import { createServer } from 'vite';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
export async function openLab(entry = '/') {
  if (!['/', '/film.html'].includes(entry)) throw new Error('Unknown local scene');
  const root = fileURLToPath(new URL('../', import.meta.url));
  const server = await createServer({
    root,
    logLevel: 'error',
    server: { host: '127.0.0.1', port: 0 },
  });
  await server.listen();
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.MOTION_BROWSER_EXECUTABLE
        ? { executablePath: process.env.MOTION_BROWSER_EXECUTABLE }
        : {}),
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1080 },
      deviceScaleFactor: 1,
    });
    const errors = [],
      requests = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => requests.push(r.url()));
    page.on('requestfailed', (r) => errors.push(`${r.url()}: ${r.failure()?.errorText}`));
    await page.goto(new URL(entry, server.resolvedUrls.local[0]).href);
    await page.waitForFunction(() => !!window.__MOTION__);
    await page.evaluate(async () => {
      await document.fonts.load("24px 'Motion Sans'");
      if ([...document.fonts].some((f) => f.family === 'Math Sans'))
        await document.fonts.load("24px 'Math Sans'");
      await document.fonts.ready;
    });
    return {
      page,
      browser,
      server,
      errors,
      requests,
      close: async () => {
        await browser.close();
        await server.close();
      },
    };
  } catch (error) {
    await browser?.close();
    await server.close();
    throw error;
  }
}
