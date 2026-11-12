// Tries the AI grade's vision model on a folder of photos in Edge or Chrome
// (WebGPU, as in the app's window) and prints what it saw in each.
//
//   node tools/vlm-try/try.mjs <model folder> <photo folder> [how many, default 8]
//
// The model folder is SmolVLM-500M-Instruct as on Hugging Face (config.json,
// tokenizer.json, onnx/*_q4f16.onnx). JPEG and PNG only (the app gives the
// model its own render, so raw decoding isn't needed here). Needs `npm install` and `npm install --no-save playwright` (no browser download: it uses Edge).
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [modelDir, photoDir, many = '8'] = process.argv.slice(2);
if (!modelDir || !photoDir) { console.error('usage: try.mjs <model folder> <photo folder> [count]'); process.exit(1); }

const photos = fs.readdirSync(photoDir).filter((n) => /\.(jpe?g|png)$/i.test(n));
const pick = photos.filter((_, i) => i % Math.max(1, Math.floor(photos.length / Number(many))) === 0).slice(0, Number(many));

const server = await createServer({
  root: process.cwd(),
  server: { port: 5299 },
  logLevel: 'error',
  plugins: [{
    name: 'vlm-try',
    configureServer(s) {
      s.middlewares.use((req, res, next) => {
        const url = decodeURIComponent(req.url.split('?')[0]);
        let file = null, body = null;
        if (url.startsWith('/ai/smolvlm/')) file = path.join(modelDir, url.slice('/ai/smolvlm/'.length));
        if (url.startsWith('/photos/')) {
          const p = path.join(photoDir, url.slice('/photos/'.length));
          body = fs.readFileSync(p);
        }
        if (file) { if (!fs.existsSync(file)) { res.statusCode = 404; return res.end(); } body = fs.readFileSync(file); }
        if (!body) return next();
        res.setHeader('content-type', file?.endsWith('.json') ? 'application/json' : url.startsWith('/photos/') ? 'image/jpeg' : 'application/octet-stream');
        res.end(body);
      });
    },
  }],
});
await server.listen();
let browser;
for (const channel of ['msedge', 'chrome', undefined]) {
  try { browser = await chromium.launch({ channel, headless: false, args: ['--enable-unsafe-webgpu'] }); console.log('browser:', channel || 'playwright chromium'); break; } catch {}
}
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
await page.goto('http://localhost:5299/tools/vlm-try/index.html');
await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
const out = await page.evaluate((names) => window.tryPhotos(names), pick);
console.log(JSON.stringify(out, null, 1));
await browser.close();
await server.close();
