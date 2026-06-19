import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

test('Vercel routes API requests before the SPA fallback', () => {
  const configPath = path.resolve(process.cwd(), '..', 'vercel.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const routes = config.routes || [];

  const apiRouteIndex = routes.findIndex((route) => route.src === '/api/(.*)');
  const spaFallbackIndex = routes.findIndex((route) => route.src === '/(.*)' && route.dest === '/index.html');

  assert.notEqual(apiRouteIndex, -1);
  assert.notEqual(spaFallbackIndex, -1);
  assert.equal(routes[apiRouteIndex].dest, '/api/[...path].js');
  assert.ok(apiRouteIndex < spaFallbackIndex);
});
