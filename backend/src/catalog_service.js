import { hasSupabaseConfig, supabase } from './supabase.js';
import { getClinic, defaultClinic } from './clinic_service.js';
import { specialtyBasePrice } from './pricing.js';
import { doctors as demoDoctors, specialties as demoSpecialties } from '../scripts/catalog_seed_data.js';

const imageName = (value = '') => value.replace(/^\/(?:image_doctor|images_chuyen_khoa)\//, '');
export const demoMode = () => ['development', 'test'].includes(process.env.NODE_ENV);

export function emptyClinicCatalog(clinic = defaultClinic) {
  return { clinic, doctors: [], specialties: [], services: [], source: 'unavailable', bookingAvailable: false,
    notice: 'Thông tin lịch khám đang được cập nhật. Vui lòng thử lại sau hoặc liên hệ phòng khám.' };
}

export function demoClinicCatalog(clinic = defaultClinic) {
  const specialties = demoSpecialties.map(item => ({ ...item, id: item.slug }));
  return { clinic, specialties, doctors: demoDoctors.map(item => ({ ...item, id: item.slug, bookable: false })),
    services: specialties.map(item => ({ ...item, fee: specialtyBasePrice(item.name) })),
    source: 'demo', bookingAvailable: false, notice: 'Bạn đang xem dữ liệu mô phỏng MidHealth. Đặt lịch sẽ mở khi phòng khám công bố lịch tiếp nhận.' };
}

export async function getCatalog() {
  try {
    const clinic = await getClinic();
    let doctors;
    let specialties;
    if (!hasSupabaseConfig) return { ok: true, status: 200,
      data: demoMode() ? demoClinicCatalog(clinic) : emptyClinicCatalog(clinic) };
    {
      const [doctorResult, specialtyResult, profileResult] = await Promise.all([
        supabase.from('doctors').select('*').eq('clinic_owned', true).eq('is_active', true).eq('is_demo', false).order('full_name'),
        supabase.from('clinic_specialties').select('*').eq('clinic_owned', true).eq('is_active', true).order('name'),
        supabase.from('clinic_profile').select('profile').eq('id', true).maybeSingle(),
      ]);
      if (doctorResult.error) throw doctorResult.error;
      if (specialtyResult.error) throw specialtyResult.error;
      specialties = (specialtyResult.data || []).map(item => ({ id: item.id, slug: item.slug, name: item.name, consultationFee: Number(item.consultation_fee), image: imageName(item.image_url || (item.slug === 'kham-tong-quat' ? '/images_chuyen_khoa/Noitongquat.webp' : '')) }));
      const specialtyNames = new Map(specialties.map(item => [item.id, item.name]));
      const doctorContacts = profileResult.error ? {} : profileResult.data?.profile?.doctorContacts || {};
      const publicText = value => typeof value === 'string' ? value.trim() : '';
      doctors = (doctorResult.data || []).map(item => ({
        id: item.id, slug: item.slug, name: item.full_name, initials: item.initials,
        title: item.title, specialtyId: item.specialty_id, specialty: specialtyNames.get(item.specialty_id) || '',
        image: imageName(item.avatar_url || ''), intro: item.intro || '', yearsExperience: item.years_experience,
        consultationFee: item.consultation_fee == null ? null : Number(item.consultation_fee),
        shortDescription: publicText(doctorContacts[item.id]?.shortDescription),
        contactEmail: publicText(doctorContacts[item.id]?.email),
        contactPhone: publicText(doctorContacts[item.id]?.phone),
        education: publicText(doctorContacts[item.id]?.education),
        expertise: publicText(doctorContacts[item.id]?.expertise),
        workplace: publicText(item.workplace_text) || clinic.name,
        address: clinic.address, notice: item.unavailable_note || item.notice || '',
        homepageFeatured: item.homepage_featured !== false, homepageOrder: item.homepage_order, bookable: item.is_demo !== true || demoMode(),
        isDemo: item.is_demo === true,
      }));
    }
    doctors.sort((a, b) => (a.homepageOrder ?? 100) - (b.homepageOrder ?? 100));
    return { ok: true, status: 200, data: { clinic, doctors, specialties,
      services: specialties.map(item => ({ ...item, specialtyId: item.id, fee: item.consultationFee })), source: 'database', bookingAvailable: true } };
  } catch {
    return { ok: true, status: 200, data: emptyClinicCatalog() };
  }
}
