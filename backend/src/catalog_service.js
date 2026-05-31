import { hasSupabaseConfig, supabase } from './supabase.js';

function stripPrefix(value = '', prefix) {
  return value?.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function doctorImage(value = '') {
  return stripPrefix(value, '/image_doctor/');
}

function hospitalImage(value = '') {
  return stripPrefix(value, '/image_benh_vien/');
}

function clinicImage(value = '') {
  return stripPrefix(value, '/image_phong_kham/');
}

function specialtyImage(value = '') {
  return stripPrefix(value, '/images_chuyen_khoa/');
}

function inferDoctorSpecialty(name = '') {
  const knownSpecialties = {
    'PGS. TS. BS Lâm Việt Trung': 'Tiêu hóa - Ngoại tiết niệu',
  };
  return knownSpecialties[name] || '';
}

function inferDoctorNotice(name = '') {
  if (name.includes('Lâm Việt Trung') || name.includes('LÃ¢m Viá»‡t Trung')) {
    return 'Bác sĩ Lâm Việt Trung nghỉ ngày 20/10 đến 26/10, 27/10 làm lại bình thường. Nếu bệnh nhân bận việc không đến khám được vui lòng hủy lịch khám đã đặt và đặt lại ngày khác.';
  }
  return '';
}

async function selectTable(table, query = '*') {
  const { data, error } = await supabase.from(table).select(query);
  if (error) throw error;
  return data || [];
}

async function selectDoctors() {
  try {
    return await selectTable('doctors', 'id, initials, full_name, specialty_id, facility_id, workplace_text, avatar_url, unavailable_note, notice, is_active');
  } catch (error) {
    if (!String(error.message || '').includes('unavailable_note') && !String(error.message || '').includes('notice')) throw error;
    return selectTable('doctors', 'id, initials, full_name, specialty_id, facility_id, workplace_text, avatar_url, is_active');
  }
}

export async function getCatalog() {
  if (!hasSupabaseConfig) {
    return {
      ok: false,
      status: 503,
      data: { message: 'Backend chưa cấu hình SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.' },
    };
  }

  try {
    const [
      specialties,
      facilities,
      facilityHours,
      facilityNotes,
      facilitySpecialties,
      facilityServices,
      facilityImages,
      doctors,
    ] = await Promise.all([
      selectTable('clinic_specialties', 'id, name, image_url, is_active'),
      selectTable('medical_facilities', 'id, type, name, subtitle, intro, address, latitude, longitude, avatar_url, background_url, is_active'),
      selectTable('facility_hours', 'facility_id, label, time_text, sort_order'),
      selectTable('facility_notes', 'facility_id, title, lines, sort_order'),
      selectTable('facility_specialties', 'facility_id, specialty_id, sort_order'),
      selectTable('facility_services', 'id, facility_id, specialty_id, name, description, fee_text, sort_order, is_active'),
      selectTable('facility_images', 'facility_id, image_url, sort_order'),
      selectDoctors(),
    ]);

    const specialtyNameById = new Map(specialties.map((item) => [item.id, item.name]));
    const facilityNameById = new Map(facilities.map((item) => [item.id, item.name]));

    const activeSpecialties = specialties
      .filter((item) => item.is_active)
      .map((item) => ({
        id: item.id,
        name: item.name,
        image: specialtyImage(item.image_url || ''),
      }));

    const hoursByFacility = new Map();
    facilityHours
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((item) => {
        const current = hoursByFacility.get(item.facility_id) || [];
        current.push({ label: item.label, time: item.time_text });
        hoursByFacility.set(item.facility_id, current);
      });

    const notesByFacility = new Map();
    facilityNotes
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((item) => {
        const current = notesByFacility.get(item.facility_id) || [];
        current.push({ title: item.title, lines: item.lines || [] });
        notesByFacility.set(item.facility_id, current);
      });

    const specialtiesByFacility = new Map();
    facilitySpecialties
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((item) => {
        const current = specialtiesByFacility.get(item.facility_id) || [];
        const name = specialtyNameById.get(item.specialty_id);
        if (name && !current.includes(name)) current.push(name);
        specialtiesByFacility.set(item.facility_id, current);
      });

    const servicesByFacility = new Map();
    facilityServices
      .filter((item) => item.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((item) => {
        const current = servicesByFacility.get(item.facility_id) || [];
        if (!current.some((service) => service.name === item.name)) {
          current.push({
            id: item.id,
            specialtyId: item.specialty_id,
            name: item.name,
            description: item.description || '',
            fee: item.fee_text || '',
          });
        }
        servicesByFacility.set(item.facility_id, current);
      });

    const imagesByFacility = new Map();
    facilityImages
      .sort((a, b) => a.sort_order - b.sort_order)
      .forEach((item) => {
        const current = imagesByFacility.get(item.facility_id) || [];
        current.push(item.image_url);
        imagesByFacility.set(item.facility_id, current);
      });

    const doctorNamesByFacility = new Map();
    doctors.forEach((doctor) => {
      if (!doctor.facility_id) return;
      const current = doctorNamesByFacility.get(doctor.facility_id) || [];
      current.push(doctor.full_name);
      doctorNamesByFacility.set(doctor.facility_id, current);
    });

    const mappedDoctors = doctors
      .filter((doctor) => doctor.is_active)
      .map((doctor) => ({
        id: doctor.id,
        initials: doctor.initials,
        image: doctorImage(doctor.avatar_url || ''),
        name: doctor.full_name,
        specialty: specialtyNameById.get(doctor.specialty_id) || inferDoctorSpecialty(doctor.full_name),
        workplace: facilityNameById.get(doctor.facility_id) || doctor.workplace_text || '',
        notice: doctor.unavailable_note || doctor.notice || inferDoctorNotice(doctor.full_name),
      }));

    const mappedHospitals = facilities
      .filter((facility) => facility.is_active && facility.type === 'hospital')
      .map((facility) => ({
        id: facility.id,
        avatar: hospitalImage(facility.avatar_url || ''),
        background: hospitalImage(facility.background_url || ''),
        gallery: (imagesByFacility.get(facility.id) || []).map(hospitalImage),
        name: facility.name,
        subtitle: facility.subtitle || '',
        address: facility.address,
        latitude: facility.latitude,
        longitude: facility.longitude,
        intro: facility.intro || '',
        services: servicesByFacility.get(facility.id) || [],
        specialties: specialtiesByFacility.get(facility.id) || [],
        notes: notesByFacility.get(facility.id) || [],
        hours: hoursByFacility.get(facility.id) || [],
      }));

    const mappedClinics = facilities
      .filter((facility) => facility.is_active && facility.type === 'clinic')
      .map((facility) => {
        const avatar = clinicImage(facility.avatar_url || '');
        const gallery = (imagesByFacility.get(facility.id) || []).map(clinicImage);
        return {
          id: facility.id,
          avatar,
          gallery: gallery.length ? gallery : [avatar].filter(Boolean),
          name: facility.name,
          subtitle: facility.subtitle || '',
          address: facility.address,
          latitude: facility.latitude,
          longitude: facility.longitude,
          phone: facility.phone || facility.hotline || '',
          intro: facility.intro || '',
          services: servicesByFacility.get(facility.id) || [],
          specialties: specialtiesByFacility.get(facility.id) || [],
          doctors: doctorNamesByFacility.get(facility.id) || [],
          hours: hoursByFacility.get(facility.id) || [],
        };
      });

    return {
      ok: true,
      status: 200,
      data: {
        doctors: mappedDoctors,
        hospitals: mappedHospitals,
        clinics: mappedClinics,
        specialties: activeSpecialties,
      },
    };
  } catch (error) {
    return {
      ok: false,
      status: 500,
      data: { message: 'Không thể tải dữ liệu danh mục từ Supabase.', detail: error.message },
    };
  }
}
