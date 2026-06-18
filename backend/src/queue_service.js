import { firebaseUid } from './authorization_service.js';
import { hasSupabaseConfig, supabase } from './supabase.js';

function clean(value) {
  return typeof value === 'string' ? value.trim() : value;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '');
}

export function optionalUuid(value) {
  const id = clean(value);
  return isUuid(id) ? id : null;
}

export function toSafeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

export function formatQueueTicketCode(number) {
  return `MH-${String(1000 + number)}`;
}

export function formatAppointmentCode(number, date = new Date()) {
  const now = date;
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `YMA${y}${m}${d}${String(50000 + number).padStart(5, '0')}`;
}

export function formatPatientCode(number) {
  return `BN${String(100000 + number)}`;
}

function requireSupabase() {
  if (!hasSupabaseConfig) {
    return {
      ok: false,
      status: 503,
      data: { message: 'Backend chưa cấu hình Supabase để quản lý số khám.' },
    };
  }
  return { ok: true };
}

export function normalizeTicketCode(value = '') {
  return decodeURIComponent(value || '').trim().toUpperCase();
}

function normalizeKey(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .toLowerCase()
    .trim();
}

export function queueStatusLabel(status = '') {
  return {
    waiting: 'Đang chờ',
    called: 'Đến lượt',
    serving: 'Đang khám',
    done: 'Hoàn tất',
    cancelled: 'Đã hủy',
  }[status] || status || 'Đang chờ';
}

export function normalizeQueueStatus(value) {
  const normalized = normalizeKey(clean(value));
  const statusMap = {
    waiting: 'waiting',
    called: 'called',
    serving: 'serving',
    done: 'done',
    cancelled: 'cancelled',
    'dang cho': 'waiting',
    'den luot': 'called',
    'dang kham': 'serving',
    'hoan tat': 'done',
    'da huy': 'cancelled',
  };
  return statusMap[normalized] || null;
}

export function queueEtaText(ticket) {
  if (ticket.status === 'called') return 'Vào phòng khám';
  if (ticket.status === 'serving') return 'Đang phục vụ';
  if (ticket.status === 'done') return 'Đã hoàn tất';
  if (ticket.status === 'cancelled') return 'Đã hủy';
  const minutes = Number(ticket.estimated_minutes || 0);
  return minutes > 0 ? `Khoảng ${minutes} phút` : 'Đang tính toán';
}

export function mapQueueTicketResponse(ticket = {}) {
  const appointment = Array.isArray(ticket.appointments) ? ticket.appointments[0] : ticket.appointments;
  const doctor = Array.isArray(appointment?.doctors) ? appointment.doctors[0] : appointment?.doctors;
  const facility = Array.isArray(appointment?.medical_facilities) ? appointment.medical_facilities[0] : appointment?.medical_facilities;
  const specialty = Array.isArray(appointment?.clinic_specialties) ? appointment.clinic_specialties[0] : appointment?.clinic_specialties;
  const service = Array.isArray(appointment?.facility_services) ? appointment.facility_services[0] : appointment?.facility_services;

  return {
    id: ticket.id,
    ticket: ticket.ticket_code,
    appointmentCode: ticket.appointment_code || '',
    patientCode: ticket.patient_code || '',
    patient: appointment?.patient_name || 'Bệnh nhân',
    department: specialty?.name || service?.name || appointment?.appointment_type || 'Khám tổng quát',
    doctor: doctor?.full_name || facility?.name || 'Chờ phân công',
    room: ticket.room || 'Đang cập nhật',
    number: ticket.queue_number,
    current: ticket.current_number,
    status: queueStatusLabel(ticket.status),
    rawStatus: ticket.status,
    eta: queueEtaText(ticket),
    createdAt: ticket.created_at,
    appointmentId: ticket.appointment_id || '',
  };
}

async function nextQueueNumber() {
  const { data, error } = await supabase
    .from('queue_tickets')
    .select('queue_number')
    .order('queue_number', { ascending: false })
    .limit(1);
  if (error) throw error;
  return (data?.[0]?.queue_number || 0) + 1;
}

function isUniqueViolation(error) {
  return error?.code === '23505' || String(error?.message || '').toLowerCase().includes('duplicate key');
}

async function findOwnerProfile(firebaseUser) {
  const uid = firebaseUid(firebaseUser);
  if (!uid) return null;

  const { data, error } = await supabase
    .from('patient_profiles')
    .select('id')
    .eq('firebase_uid', uid)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function queueSelect() {
  return `
    *,
    appointments(
      id,
      patient_name,
      appointment_type,
      appointment_date,
      appointment_time_text,
      doctors(full_name),
      medical_facilities(name),
      clinic_specialties(name),
      facility_services(name)
    )
  `;
}

export async function listQueueTickets() {
  const ready = requireSupabase();
  if (!ready.ok) return ready;

  try {
    const { data, error } = await supabase
      .from('queue_tickets')
      .select(queueSelect())
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return { ok: true, status: 200, data: (data || []).map(mapQueueTicketResponse) };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function getQueueTicket(ticketCodeValue) {
  const ready = requireSupabase();
  if (!ready.ok) return ready;

  try {
    const ticketCodeValueNormalized = normalizeTicketCode(ticketCodeValue);
    const { data, error } = await supabase
      .from('queue_tickets')
      .select(queueSelect())
      .eq('ticket_code', ticketCodeValueNormalized)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, status: 404, data: { message: 'Không tìm thấy số khám.' } };
    return { ok: true, status: 200, data: mapQueueTicketResponse(data) };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function createQueueTicket(firebaseUser, payload = {}) {
  const ready = requireSupabase();
  if (!ready.ok) return ready;

  try {
    const owner = await findOwnerProfile(firebaseUser);
    let lastError;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const number = await nextQueueNumber();
      const ticketRow = {
        appointment_id: optionalUuid(payload.appointmentId),
        owner_profile_id: owner?.id || null,
        patient_medical_profile_id: optionalUuid(payload.patientMedicalProfileId),
        ticket_code: formatQueueTicketCode(number),
        appointment_code: clean(payload.appointmentCode) || formatAppointmentCode(number),
        patient_code: clean(payload.patientCode) || formatPatientCode(number),
        queue_number: number,
        current_number: toSafeNumber(payload.currentNumber ?? payload.current, Math.max(number - 6, 1)),
        room: clean(payload.room) || 'Đang cập nhật',
        status: normalizeQueueStatus(payload.status) || 'waiting',
        estimated_minutes: toSafeNumber(payload.estimatedMinutes, 15),
      };

      const { data, error } = await supabase
        .from('queue_tickets')
        .insert(ticketRow)
        .select(queueSelect())
        .single();
      if (!error) return { ok: true, status: 201, data: mapQueueTicketResponse(data) };
      if (!isUniqueViolation(error)) throw error;
      lastError = error;
    }

    throw lastError || new Error('Không thể tạo số khám.');
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function updateQueueTicket(ticketCodeValue, payload = {}) {
  const ready = requireSupabase();
  if (!ready.ok) return ready;

  const updates = {};
  const status = normalizeQueueStatus(payload.status);
  if (status) updates.status = status;
  if (payload.currentNumber !== undefined || payload.current !== undefined) {
    updates.current_number = toSafeNumber(payload.currentNumber ?? payload.current, 0);
  }
  if (payload.room !== undefined) updates.room = clean(payload.room) || null;
  if (payload.estimatedMinutes !== undefined) updates.estimated_minutes = toSafeNumber(payload.estimatedMinutes, 15);

  if (!Object.keys(updates).length) {
    return { ok: false, status: 400, data: { message: 'Không có dữ liệu số khám hợp lệ để cập nhật.' } };
  }

  try {
    const { data, error } = await supabase
      .from('queue_tickets')
      .update(updates)
      .eq('ticket_code', normalizeTicketCode(ticketCodeValue))
      .select(queueSelect())
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ok: false, status: 404, data: { message: 'Không tìm thấy số khám.' } };
    return { ok: true, status: 200, data: mapQueueTicketResponse(data) };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}
