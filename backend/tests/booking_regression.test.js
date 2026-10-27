import test from 'node:test';
import assert from 'node:assert/strict';
import { nextQueueNumber } from '../src/queue_number_service.js';
import { formatQueueTicketCode } from '../src/queue_service.js';
import { appointmentMailHtml, mapAppointmentResponse } from '../src/appointment_service.js';

test('no-show status remains distinct from cancellation on the patient ticket', () => {
  const appointment = { id: 'a', status: 'no_show', appointment_type: 'doctor', patient_name: 'Test' };
  assert.equal(mapAppointmentResponse(appointment, { status: 'cancelled' }).status, 'Không đến khám');
});

test('queue allocation uses the database result and propagates failures', async () => {
  assert.equal(await nextQueueNumber({ rpc: async name => {
    assert.equal(name, 'allocate_queue_number');
    return { data: 10001, error: null };
  } }), 10001);
  const error = new Error('Database unavailable');
  await assert.rejects(nextQueueNumber({ rpc: async () => ({ error }) }), error);
  for (const data of [null, 0, -1, 1.5, '12', undefined]) {
    await assert.rejects(nextQueueNumber({ rpc: async () => ({ data }) }));
  }
});

test('ticket codes do not wrap or collide after ten thousand allocations', () => {
  const codes = Array.from({ length: 20001 }, (_, index) => formatQueueTicketCode(index + 1));
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(formatQueueTicketCode(9000), 'MH-10000');
});

test('appointment emails escape user content and use the saved clinic name', () => {
  const html = appointmentMailHtml({
    title: '<b>Title</b>',
    appointment: { patient_name: '<img src=x onerror=alert(1)>', appointment_date: '2026-09-15', clinic_snapshot: { name: 'Clinic & Care' } },
    ticket: { appointment_code: '<a>code</a>' },
    input: { doctorName: 'Doctor name', facilityName: 'Changed clinic', time: '<script>bad</script>' },
  });
  assert.ok(html.includes('Clinic &amp; Care'));
  assert.ok(html.includes('&lt;img'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('Changed clinic'));
});
