import test from 'node:test';
import assert from 'node:assert/strict';
import { doctorReportRange } from '../src/doctor_service.js';

test('doctor report defaults to the latest 30 clinic days', () => {
  assert.deepEqual(doctorReportRange(null, null, '2026-10-04'), { from: '2026-09-05', to: '2026-10-04' });
});

test('doctor report validates real calendar dates and a bounded range', () => {
  assert.deepEqual(doctorReportRange('2024-02-29', '2025-02-28'), { from: '2024-02-29', to: '2025-02-28' });
  assert.equal(doctorReportRange('2026-02-29', '2026-03-01'), null);
  assert.equal(doctorReportRange('2026-10-05', '2026-10-04'), null);
  assert.equal(doctorReportRange('2024-02-29', '2025-03-01'), null);
});
