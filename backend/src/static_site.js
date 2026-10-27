import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const distRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export async function serveStaticSite(request, response, root = distRoot) {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }
  if (pathname.split('/').some(part => part.startsWith('.'))) {
    response.writeHead(404);
    response.end();
    return;
  }

  const target = path.resolve(root, `.${pathname}`);
  if (target !== root && !target.startsWith(root + path.sep)) {
    response.writeHead(403);
    response.end();
    return;
  }

  let file = target;
  let fileStat;
  try { fileStat = await stat(file); } catch { /* SPA route or missing asset */ }
  if (!fileStat?.isFile()) {
    if (path.extname(pathname) || pathname.startsWith('/assets/')) {
      response.writeHead(404);
      response.end();
      return;
    }
    file = path.join(root, 'index.html');
    try { fileStat = await stat(file); } catch {
      response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Bản build giao diện chưa sẵn sàng. Chạy npm run build.');
      return;
    }
  }

  const extension = path.extname(file).toLowerCase();
  response.writeHead(200, {
    'Content-Type': contentTypes[extension] || 'application/octet-stream',
    'Content-Length': fileStat.size,
    'Cache-Control': pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  });
  if (request.method === 'HEAD') { response.end(); return; }
  createReadStream(file).pipe(response);
}
