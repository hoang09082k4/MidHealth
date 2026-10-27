import http from 'node:http';
import { performance } from 'node:perf_hooks';

// This benchmark deliberately binds only to loopback and disables external data sources.
process.env.NODE_ENV = 'test';
for (const key of Object.keys(process.env)) {
  if (/SUPABASE|FIREBASE|GMAIL|PAYPAL|GEMINI/.test(key)) delete process.env[key];
}

const { handleRequest } = await import('../backend/src/server.js');
const server = http.createServer((request, response) => {
  Promise.resolve(handleRequest(request, response)).catch(() => {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
});

const requests = 2000;
const concurrency = 50;
const paths = ['/api/catalog', '/api/reference-data', '/api/health/categories'];
await new Promise((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject));

const baseUrl = `http://127.0.0.1:${server.address().port}`;
const durations = [];
const statusCounts = new Map();
let nextRequest = 0;
const started = performance.now();

try {
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (nextRequest < requests) {
      const index = nextRequest++;
      const start = performance.now();
      try {
        const response = await fetch(baseUrl + paths[index % paths.length]);
        await response.arrayBuffer();
        durations.push(performance.now() - start);
        statusCounts.set(response.status, (statusCounts.get(response.status) || 0) + 1);
      } catch {
        statusCounts.set('network-error', (statusCounts.get('network-error') || 0) + 1);
      }
    }
  }));
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}

durations.sort((a, b) => a - b);
const elapsedSeconds = (performance.now() - started) / 1000;
const percentile = fraction => durations[Math.min(durations.length - 1, Math.ceil(durations.length * fraction) - 1)] || 0;
const summary = {
  scope: 'local API handler with external services disabled; not a production capacity test',
  requests,
  concurrency,
  statusCounts: Object.fromEntries(statusCounts),
  elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
  requestsPerSecond: Math.round(requests / elapsedSeconds),
  p50Ms: Math.round(percentile(0.5)),
  p95Ms: Math.round(percentile(0.95)),
  p99Ms: Math.round(percentile(0.99)),
};
console.log(JSON.stringify(summary, null, 2));
if (statusCounts.size !== 1 || statusCounts.get(200) !== requests) process.exitCode = 1;
