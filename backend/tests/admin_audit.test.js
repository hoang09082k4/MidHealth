import test from 'node:test';
import assert from 'node:assert/strict';
import { getAdminAuditEvents } from '../src/admin_service.js';

function createClient({ data = [], count = data.length, error = null } = {}) {
  const calls = [];
  const query = {
    select(...args) { calls.push(['select', ...args]); return this; },
    order(...args) { calls.push(['order', ...args]); return this; },
    eq(...args) { calls.push(['eq', ...args]); return this; },
    gte(...args) { calls.push(['gte', ...args]); return this; },
    lt(...args) { calls.push(['lt', ...args]); return this; },
    ilike(...args) { calls.push(['ilike', ...args]); return this; },
    or(...args) { calls.push(['or', ...args]); return this; },
    range(...args) { calls.push(['range', ...args]); return Promise.resolve({ data, error, count }); },
  };
  return { client: { from(table) { calls.push(['from', table]); return query; } }, calls };
}

const admin = async () => ({ ok: true, data: { id: 'admin-1' } });

test('admin audit query returns paged events and applies only requested filters', async () => {
  const { client, calls } = createClient({ data: [{ id: 'event-1' }], count: 76 });
  const result = await getAdminAuditEvents({}, {
    page: '2', pageSize: '50', eventType: 'user_password_reset', actorRole: 'admin',
    from: '2026-10-01', to: '2026-10-14', search: 'reset',
  }, { client, requireAdmin: admin });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, { events: [{ id: 'event-1' }], page: 2, pageSize: 50, total: 76, totalPages: 2 });
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'event_type' && call[2] === 'user_password_reset'));
  assert.ok(calls.some(call => call[0] === 'eq' && call[1] === 'actor_role' && call[2] === 'admin'));
  assert.ok(calls.some(call => call[0] === 'or' && call[1].includes('actor_email.ilike')));
  assert.ok(calls.some(call => call[0] === 'range' && call[1] === 50 && call[2] === 99));
});

test('admin audit query rejects invalid ranges and event values before querying', async () => {
  const { client, calls } = createClient();
  const invalidDates = await getAdminAuditEvents({}, { from: '2026-10-20', to: '2026-10-01' }, { client, requireAdmin: admin });
  const impossibleDate = await getAdminAuditEvents({}, { from: '2026-02-30' }, { client, requireAdmin: admin });
  const invalidType = await getAdminAuditEvents({}, { eventType: 'sql_injection' }, { client, requireAdmin: admin });
  assert.equal(invalidDates.status, 400);
  assert.equal(impossibleDate.status, 400);
  assert.equal(invalidType.status, 400);
  assert.equal(calls.length, 0);
});

test('non-admin cannot query the audit stream', async () => {
  const { client, calls } = createClient();
  const denied = await getAdminAuditEvents({}, {}, { client, requireAdmin: async () => ({ ok: false, status: 403, data: { message: 'forbidden' } }) });
  assert.equal(denied.status, 403);
  assert.equal(calls.length, 0);
});

test('audit database failures are returned as unavailable, not as an empty log', async () => {
  const { client } = createClient({ error: { code: '42501' } });
  const result = await getAdminAuditEvents({}, {}, { client, requireAdmin: admin });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
  assert.match(result.data.message, /Không thể tải nhật ký/);
});
