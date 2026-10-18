import test from 'node:test';
import assert from 'node:assert/strict';
import { validClinicHours, validWorkingTime } from '../src/clinic_service.js';

test('clinic working hours accept valid sessions, days off, and 24/7', () => {
  for (const value of ['07:30 - 12:00', '07:30 - 12:00, 13:30 - 17:00', '07:30 - 12:00 / 13:30 - 17:00', '08:00–24:00', 'Nghỉ', 'Đóng cửa', '24/7']) {
    assert.equal(validWorkingTime(value), true, value);
  }
});

test('clinic working hours reject malformed or non-positive time ranges', () => {
  for (const value of ['', 'sáng', '25:00 - 26:00', '08:75 - 09:00', '10:00 - 09:00', '08:00 - 12:00,', '07:30 - 12:00, 11:30 - 17:00']) {
    assert.equal(validWorkingTime(value), false, value);
  }
});

test('clinic hours reject duplicate day labels but allow separate valid days', () => {
  assert.equal(validClinicHours([]), true);
  assert.equal(validClinicHours([{ label: 'Thứ 2 - Thứ 6', time: '07:30 - 12:00, 13:30 - 17:00' }, { label: 'Thứ 7', time: '08:00 - 12:00' }]), true);
  assert.equal(validClinicHours([{ label: 'Thứ 7', time: '08:00 - 12:00' }, { label: '  thứ 7  ', time: '13:00 - 17:00' }]), false);
});
