// Static server for the production static export (`out/`) mounted under the app's
// basePath `/wallpaper`. We serve the exported assets directly because `output:'export'`
// in next.config.ts makes `next start` fail — and serving the static export is the most
// faithful measurement of production client paint (zero dev/server instrumentation).
//
// The export hard-codes asset URLs as `/wallpaper/_next/...`, so a naive `serve out` 404s
// every asset. This server strips the `/wallpaper` prefix and maps the rest onto `out/`.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// No trailing slash — so the `ROOT + sep` traversal guard below compares cleanly.
const ROOT = normalize(fileURLToPath(new URL('../out', import.meta.url)));
const BASE = '/wallpaper';
const PORT = Number(process.env.BENCH_PORT || 3100);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};

const send = (res, code, body, type = 'text/plain') => {
  res.writeHead(code, { 'content-type': type });
  res.end(body);
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    let p = decodeURIComponent(url.pathname);
    if (p === '/') {
      res.writeHead(302, { location: `${BASE}/` });
      res.end();
      return;
    }
    if (p === BASE) p = `${BASE}/`;
    if (!p.startsWith(`${BASE}/`)) return send(res, 404, 'not found');

    let rel = p.slice(BASE.length); // leading '/...'
    if (rel.endsWith('/')) rel += 'index.html';

    const filePath = normalize(join(ROOT, rel));
    // Path-traversal guard: resolved path must stay inside ROOT.
    if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
      return send(res, 403, 'forbidden');
    }

    let data;
    let served = rel;
    try {
      data = await readFile(filePath);
    } catch {
      // Static export emits route pages as `<route>.html`.
      try {
        data = await readFile(`${filePath}.html`);
        served = `${rel}.html`;
      } catch {
        return send(res, 404, 'not found');
      }
    }
    const type = MIME[extname(served)] || 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(data);
  } catch (e) {
    send(res, 500, String(e));
  }
});

server.listen(PORT, () =>
  console.log(`[bench] serving ./out at http://localhost:${PORT}${BASE}/`),
);
