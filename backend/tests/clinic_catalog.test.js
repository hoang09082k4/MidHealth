import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClinicCatalogPayload } from '../src/clinic_catalog_service.js';
import { doctors, specialties } from '../scripts/catalog_seed_data.js';

test('clinic catalog writes reject malformed input and invalid specialty links', () => {
  const input = { kind: 'doctor', name: 'Bác sĩ MidHealth', birthDate: '1990-05-16', specialtyId: '550e8400-e29b-41d4-a716-446655440000', isDemo: true };
  assert.equal(validateClinicCatalogPayload(input), '');
  for (const patch of [
    { name: ' ' }, { name: {} }, { specialtyId: 'old-marketplace' }, { image: 'javascript:alert(1)' },
    { isDemo: 'false' }, { isActive: 'true' }, { birthDate: '1990-02-30' },
    { contactPhone: 'call me' }, { yearsExperience: null }, { yearsExperience: '1e2' }, { yearsExperience: ' ' },
    { consultationFee: 100000001 }, { consultationFee: '1e5' }, { consultationFee: ' ' },
    { image: '//evil.example/image.png' }, { image: 'https://user:pass@example.com/image.png' }, { image: 'https://example.com/\nimage.png' },
  ]) {
    assert.ok(validateClinicCatalogPayload({ ...input, ...patch }));
  }
  assert.ok(validateClinicCatalogPayload(null));
  assert.ok(validateClinicCatalogPayload({ kind: 'hospital', name: 'Other' }));
  assert.equal(validateClinicCatalogPayload({ kind: 'specialty', name: 'Nội tổng quát' }), '');
  assert.ok(validateClinicCatalogPayload({ kind: 'specialty', name: 'Nội tổng quát', consultationFee: 180000.5 }));
});

test('MidHealth demo data has unique identities, valid specialties and bundled portraits', () => {
  assert.equal(new Set(doctors.map(item => item.slug)).size, doctors.length);
  assert.equal(new Set(specialties.map(item => item.slug)).size, specialties.length);
  for (const doctor of doctors) {
    assert.ok(doctor.isDemo);
    assert.equal(doctor.workplace, 'MidHealth');
    assert.ok(specialties.some(item => item.name === doctor.specialty));
    assert.match(doctor.image, /^\/image_doctor\/[a-z0-9]+\.jpg$/);
  }
});
