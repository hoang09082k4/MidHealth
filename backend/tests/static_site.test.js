import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { serveStaticSite } from '../src/static_site.js';

test('Node serves an SPA without exposing hidden files or missing assets', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'midhealth-static-'));
  await mkdir(path.join(root, 'assets'));
  await writeFile(path.join(root, 'index.html'), '<div id="root"></div>');
  await writeFile(path.join(root, 'assets', 'app-123.js'), 'export default 1');
  const server = http.createServer((request, response) => serveStaticSite(request, response, root));
  await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const admin = await fetch(`${base}/admin`);
    assert.equal(admin.status, 200);
    assert.match(admin.headers.get('content-type'), /text\/html/);
    assert.equal(admin.headers.get('cache-control'), 'no-store');
    assert.match(await admin.text(), /<div id="root"><\/div>/);

    const asset = await fetch(`${base}/assets/app-123.js`);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('cache-control'), /immutable/);

    assert.equal((await fetch(`${base}/.env`)).status, 404);
    assert.equal((await fetch(`${base}/danh-cho-bac-si/lich-lam-viec`)).status, 200);
    assert.equal((await fetch(`${base}/missing.css`)).status, 404);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
