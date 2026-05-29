import { config } from '../src/config.js';
import { supabase, hasSupabaseConfig } from '../src/supabase.js';
import {
  clinics,
  doctors,
  hospitals,
  specialties,
} from './catalog_seed_data.js';

function slugify(value = '') {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const knownFacilitySlugs = {
  'Bệnh viện Nhi đồng 2': 'benh-vien-nhi-dong-2',
  'Bệnh viện Đa Khoa Thủ Đức': 'benh-vien-da-khoa-thu-duc',
  'Bệnh viện Quân Y 175': 'benh-vien-quan-y-175',
  'Bệnh viện Ung Bướu TPHCM': 'benh-vien-ung-buou-tphcm',
  'Bệnh viện Răng Hàm Mặt TP.HCM': 'benh-vien-rang-ham-mat-tphcm',
  'Bệnh viện Y Học Cổ Truyền TP.HCM': 'benh-vien-y-hoc-co-truyen-tphcm',
  'Phòng khám Sản Phụ Khoa 13 Cao Thắng': 'phong-kham-san-phu-khoa-13-cao-thang',
  'Phòng khám Nhi Mỹ Mỹ': 'phong-kham-nhi-my-my',
  'Trung Tâm Chăm Sóc Sức Khỏe Cộng Đồng - CHAC': 'trung-tam-chac',
  'Phòng khám Da liễu Shine Clinic': 'phong-kham-da-lieu-shine-clinic',
};

function facilitySlug(name) {
  return knownFacilitySlugs[name] || slugify(name);
}

const knownDoctorSlugs = {
  'BS.CKII Nguyễn Thị Thu Lan': 'bs-nguyen-thi-thu-lan',
};

function doctorSlug(name) {
  return knownDoctorSlugs[name] || slugify(name);
}

function normalizeImage(path, prefix) {
  if (!path) return null;
  return path.startsWith('/') ? path : `${prefix}/${path}`;
}

function mapGender(value) {
  if (value === 'Nam' || value === 'male') return 'male';
  if (value === 'Nữ' || value === 'female') return 'female';
  return 'other';
}

async function upsert(table, rows, onConflict) {
  if (!rows.length) return [];
  const { data, error } = await supabase
    .from(table)
    .upsert(rows, { onConflict })
    .select();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data || [];
}

async function selectAll(table, columns = '*') {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data || [];
}

async function insertMissing(table, rows, existsFn) {
  if (!rows.length) return;
  const existing = await selectAll(table);
  const missing = rows.filter((row) => !existing.some((item) => existsFn(item, row)));
  if (!missing.length) return;
  const { error } = await supabase.from(table).insert(missing);
  if (error) throw new Error(`${table}: ${error.message}`);
}

function buildFacilityRows() {
  const hospitalRows = hospitals.map((hospital) => ({
    slug: facilitySlug(hospital.name),
    type: 'hospital',
    name: hospital.name,
    subtitle: hospital.subtitle || null,
    intro: hospital.intro || null,
    address: hospital.address,
    province: hospital.address?.includes('Hồ Chí Minh') || hospital.address?.includes('TP.HCM') ? 'Hồ Chí Minh' : null,
    district: null,
    avatar_url: normalizeImage(hospital.avatar, '/image_benh_vien'),
    background_url: normalizeImage(hospital.background, '/image_benh_vien'),
    is_active: true,
  }));

  const clinicRows = clinics.map((clinic) => ({
    slug: facilitySlug(clinic.name),
    type: 'clinic',
    name: clinic.name,
    subtitle: clinic.subtitle || null,
    intro: clinic.intro || null,
    address: clinic.address,
    province: clinic.address?.includes('Hồ Chí Minh') || clinic.address?.includes('TP.HCM') ? 'Hồ Chí Minh' : null,
    district: null,
    avatar_url: normalizeImage(clinic.avatar, '/image_phong_kham'),
    background_url: null,
    is_active: true,
  }));

  return [...hospitalRows, ...clinicRows];
}

async function main() {
  if (!hasSupabaseConfig) {
    throw new Error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong backend/.env');
  }

  console.log(`Seeding catalog to ${config.supabaseUrl}`);

  const specialtyRows = specialties.map((specialty) => ({
    slug: slugify(specialty.name),
    name: specialty.name,
    image_url: normalizeImage(specialty.image, '/images_chuyen_khoa'),
    is_active: true,
  }));

  const upsertedSpecialties = await upsert('clinic_specialties', specialtyRows, 'name');
  const allSpecialties = await selectAll('clinic_specialties', 'id, slug, name');
  const specialtyByName = new Map(allSpecialties.map((item) => [item.name, item]));

  const upsertedFacilities = await upsert('medical_facilities', buildFacilityRows(), 'slug');
  const allFacilities = await selectAll('medical_facilities', 'id, slug, name, type');
  const facilityByName = new Map(allFacilities.map((item) => [item.name, item]));

  const facilityHours = [];
  const facilityImages = [];
  const facilityNotes = [];
  const facilitySpecialties = [];
  const facilityServices = [];

  [...hospitals, ...clinics].forEach((facility) => {
    const savedFacility = facilityByName.get(facility.name);
    if (!savedFacility) return;

    (facility.hours || []).forEach((hour, index) => {
      facilityHours.push({
        facility_id: savedFacility.id,
        label: hour.label,
        time_text: hour.time,
        sort_order: index + 1,
      });
    });

    (facility.notes || []).forEach((note, index) => {
      facilityNotes.push({
        facility_id: savedFacility.id,
        title: note.title,
        lines: note.lines || [],
        sort_order: index + 1,
      });
    });

    const gallery = facility.gallery || [facility.background, facility.avatar].filter(Boolean);
    gallery.forEach((image, index) => {
      facilityImages.push({
        facility_id: savedFacility.id,
        image_url: normalizeImage(image, savedFacility.type === 'hospital' ? '/image_benh_vien' : '/image_phong_kham'),
        alt_text: facility.name,
        sort_order: index + 1,
      });
    });

    (facility.specialties || []).forEach((specialtyName, index) => {
      const specialty = specialtyByName.get(specialtyName);
      if (!specialty) return;
      facilitySpecialties.push({
        facility_id: savedFacility.id,
        specialty_id: specialty.id,
        sort_order: index + 1,
      });
    });

    (facility.services || facility.specialties || []).forEach((serviceName, index) => {
      const specialty = specialtyByName.get(serviceName) || null;
      facilityServices.push({
        facility_id: savedFacility.id,
        specialty_id: specialty?.id || null,
        name: serviceName,
        description: `Dịch vụ ${serviceName} tại ${facility.name}`,
        fee_text: 'Thanh toán tại cơ sở',
        sort_order: index + 1,
        is_active: true,
      });
    });
  });

  await insertMissing('facility_hours', facilityHours, (item, row) => item.facility_id === row.facility_id && item.label === row.label);
  await insertMissing('facility_images', facilityImages, (item, row) => item.facility_id === row.facility_id && item.image_url === row.image_url);
  await insertMissing('facility_notes', facilityNotes, (item, row) => item.facility_id === row.facility_id && item.title === row.title);

  await upsert('facility_specialties', facilitySpecialties, 'facility_id,specialty_id');
  await upsert('facility_services', facilityServices, 'facility_id,name');

  const doctorRows = doctors.map((doctor) => {
    const specialty = specialtyByName.get(doctor.specialty);
    const facility = facilityByName.get(doctor.workplace);
    return {
      slug: doctorSlug(doctor.name),
      initials: doctor.initials,
      full_name: doctor.name,
      specialty_id: specialty?.id || null,
      facility_id: facility?.id || null,
      workplace_text: doctor.workplace,
      avatar_url: normalizeImage(doctor.image, '/image_doctor'),
      years_experience: 26,
      is_active: true,
    };
  });

  clinics.forEach((clinic) => {
    const facility = facilityByName.get(clinic.name);
    const specialty = specialtyByName.get(clinic.specialties?.[0]) || specialtyByName.get(clinic.services?.[0]);
    (clinic.doctors || []).forEach((doctorName) => {
      doctorRows.push({
        slug: doctorSlug(doctorName),
        initials: doctorName.split(/\s+/).filter(Boolean).slice(-2).map((word) => word[0]).join('').toUpperCase(),
        full_name: doctorName,
        specialty_id: specialty?.id || null,
        facility_id: facility?.id || null,
        workplace_text: clinic.name,
        avatar_url: null,
        years_experience: null,
        is_active: true,
      });
    });
  });

  const upsertedDoctors = await upsert('doctors', doctorRows, 'slug');
  const doctorSpecialties = upsertedDoctors
    .filter((doctor) => doctor.specialty_id)
    .map((doctor) => ({
      doctor_id: doctor.id,
      specialty_id: doctor.specialty_id,
    }));
  await upsert('doctor_specialties', doctorSpecialties, 'doctor_id,specialty_id');

  console.log(JSON.stringify({
    specialties: upsertedSpecialties.length,
    facilities: upsertedFacilities.length,
    doctors: upsertedDoctors.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
