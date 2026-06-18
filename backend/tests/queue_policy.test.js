import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatAppointmentCode,
  formatPatientCode,
  formatQueueTicketCode,
  mapQueueTicketResponse,
  normalizeQueueStatus,
  normalizeTicketCode,
  optionalUuid,
  queueEtaText,
  queueStatusLabel,
  toSafeNumber,
} from '../src/queue_service.js';

test('normalizes queue identifiers and status values', () => {
  assert.equal(normalizeTicketCode(' mh-1025 '), 'MH-1025');
  assert.equal(normalizeQueueStatus('Đang chờ'), 'waiting');
  assert.equal(normalizeQueueStatus('den luot'), 'called');
  assert.equal(normalizeQueueStatus('Hoàn tất'), 'done');
  assert.equal(normalizeQueueStatus('unknown'), null);
});

test('guards queue payload values before database writes', () => {
  assert.equal(optionalUuid('not-a-uuid'), null);
  assert.equal(optionalUuid('550e8400-e29b-41d4-a716-446655440000'), '550e8400-e29b-41d4-a716-446655440000');
  assert.equal(toSafeNumber('12', 5), 12);
  assert.equal(toSafeNumber('-1', 5), 5);
  assert.equal(toSafeNumber('abc', 5), 5);
});

test('formats queue, appointment, and patient codes consistently', () => {
  const fixedDate = new Date('2026-06-19T08:00:00.000Z');
  assert.equal(formatQueueTicketCode(25), 'MH-1025');
  assert.equal(formatPatientCode(25), 'BN100025');
  assert.equal(formatAppointmentCode(25, fixedDate), 'YMA26061950025');
});

test('maps queue rows into frontend-safe response shape', () => {
  const response = mapQueueTicketResponse({
    ticket_code: 'MH-1025',
    appointment_code: 'YMA26061950025',
    patient_code: 'BN100025',
    queue_number: 25,
    current_number: 20,
    room: 'P.203',
    status: 'waiting',
    estimated_minutes: 15,
    created_at: '2026-06-19T08:00:00.000Z',
    appointments: {
      patient_name: 'Nguyễn Văn A',
      clinic_specialties: { name: 'Nhi khoa' },
      doctors: { full_name: 'BS. Lê Minh' },
    },
  });

  assert.equal(response.ticket, 'MH-1025');
  assert.equal(response.patient, 'Nguyễn Văn A');
  assert.equal(response.department, 'Nhi khoa');
  assert.equal(response.doctor, 'BS. Lê Minh');
  assert.equal(response.status, queueStatusLabel('waiting'));
  assert.equal(response.eta, queueEtaText({ status: 'waiting', estimated_minutes: 15 }));
});
