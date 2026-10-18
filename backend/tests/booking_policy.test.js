import test from 'node:test';
import assert from 'node:assert/strict';
import { clinicDateTime, validDate, isFutureBooking, resolveConsultationFee, validateBookingPatient } from '../src/booking_policy.js';
import { demoClinicCatalog, emptyClinicCatalog, getCatalog } from '../src/catalog_service.js';
test('production without database does not publish fictional doctors', async () => {
  const previous = process.env.NODE_ENV;
  try {
    for (const mode of ['', 'production']) {
      process.env.NODE_ENV = mode;
      const result = await getCatalog();
      assert.equal(result.data.source, 'unavailable');
      assert.deepEqual(result.data.doctors, []);
    }
  } finally {
    process.env.NODE_ENV = previous;
  }
});
test('clinic time crosses midnight at UTC+7', () => {
  assert.deepEqual(clinicDateTime(new Date('2026-09-14T17:01:00Z')), { date: '2026-09-15', time: '00:01:00' });
});
test('booking rejects invalid dates, elapsed slots and exact current time', () => {
  const now = new Date('2026-09-14T01:30:00Z');
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(validDate('2024-02-29'), true);
  for (const [date, time] of [['2026-09-13','09:00'], ['2026-09-14','08:29'], ['2026-09-14','08:30:00'], ['2026-09-15','25:00']]) assert.equal(isFutureBooking(date,time,now), false);
  assert.equal(isFutureBooking('2026-09-14','08:31',now), true);
});
test('patient validation rejects malformed and future birth dates', () => {
  const patient = { name: 'Nguyễn Văn A', phone: '0901234567', birthDate: '29/02/2000' };
  const now = new Date('2026-09-14T01:00:00Z');
  assert.equal(validateBookingPatient(patient, now), '');
  for (const change of [{name:''}, {phone:'123'}, {birthDate:'31/02/2000'}, {birthDate:'2099-01-01'}, {email:'invalid'}]) assert.ok(validateBookingPatient({...patient, ...change}, now));
});
test('offline catalog uses only fictional MidHealth doctors and cannot be booked', () => {
  const data = demoClinicCatalog();
  assert.ok(data.doctors.length > 0);
  assert.equal(data.bookingAvailable, false);
  assert.ok(data.doctors.every(doctor => doctor.name && doctor.bookable === false && doctor.isDemo && doctor.slug.startsWith('midhealth-demo-')));
  assert.equal(emptyClinicCatalog().doctors.length, 0);
  assert.equal('hospitals' in data, false);
  assert.equal('clinics' in data, false);
});

test('patient validation handles malformed objects and supported birth date fields', () => {
  for (const patient of [null, [], 'patient', 42]) assert.ok(validateBookingPatient(patient));
  const patient = { fullName: 'Nguyễn Văn A', phone: '0901234567', email: ' patient@example.com ' };
  for (const field of ['birthDate', 'dateOfBirth', 'date_of_birth']) {
    assert.equal(validateBookingPatient({ ...patient, [field]: '2000-02-29' }), '');
  }
  assert.ok(validateBookingPatient({ ...patient, birthDate: '2000-02-29', email: {} }));
});

test('doctor consultation fee overrides the specialty default and validates zero safely', () => {
  assert.equal(resolveConsultationFee(250000, 180000), 250000);
  assert.equal(resolveConsultationFee(null, 180000), 180000);
  assert.equal(resolveConsultationFee('', 180000), 180000);
  assert.equal(resolveConsultationFee(0, 180000), 0);
  assert.equal(resolveConsultationFee(null, 0), 0);
  for (const value of [-1, 1.5, 'not-a-fee', 100000000000000000000]) {
    assert.equal(resolveConsultationFee(value, 180000), null);
  }
  assert.equal(resolveConsultationFee(null, null), null);
});
