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

test('Vercel API entrypoints include backend runtime dependencies', () => {
  const repoRoot = path.resolve(process.cwd(), '..');
  const rootPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const frontendPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'frontend', 'package.json'), 'utf8'));
  const rootApi = fs.readFileSync(path.join(repoRoot, 'api', '[...path].js'), 'utf8');
  const frontendApi = fs.readFileSync(path.join(repoRoot, 'frontend', 'api', '[...path].js'), 'utf8');

  for (const packageJson of [rootPackage, frontendPackage]) {
    assert.ok(packageJson.dependencies?.['@supabase/supabase-js']);
    assert.ok(packageJson.dependencies?.nodemailer);
  }

  for (const apiSource of [rootApi, frontendApi]) {
    assert.match(apiSource, /require\.resolve\('@supabase\/supabase-js'\)/);
    assert.match(apiSource, /require\.resolve\('nodemailer'\)/);
  }
});
