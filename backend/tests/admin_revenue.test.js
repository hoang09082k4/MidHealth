import test from 'node:test';
import assert from 'node:assert/strict';
import { sumPaidRevenuePages } from '../src/admin_revenue.js';

test('admin revenue includes payments beyond the API page limit', async () => {
  const payments = Array.from({ length: 1201 }, (_, index) => ({
    id: String(index + 1).padStart(4, '0'), amount: 10,
  }));
  const cursors = [];
  const total = await sumPaidRevenuePages(async (lastId, size) => {
    cursors.push(lastId);
    return payments.filter(item => !lastId || item.id > lastId).slice(0, size);
  }, 500);
  assert.equal(total, 12010);
  assert.deepEqual(cursors, [null, '0500', '1000']);
});
