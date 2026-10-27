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
  const specialty = Array.isArray(appointment?.clinic_specialties) ? appointment.clinic_specialties[0] : appointment?.clinic_specialties;

  return {
    id: ticket.id,
    ticket: ticket.ticket_code,
    appointmentCode: ticket.appointment_code || '',
    patientCode: ticket.patient_code || '',
    patient: appointment?.patient_name || 'Bệnh nhân',
    department: specialty?.name || 'Khám tổng quát',
    doctor: doctor?.full_name || 'Chờ phân công',
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

export function canReadQueueTicket(ticket = {}, owner = null, privileged = false) {
  if (privileged) return true;
  return Boolean(owner?.id && ticket.owner_profile_id === owner.id);
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
    appointments!inner(
      id,
      status,
      checked_in_at,
      patient_name,
      appointment_type,
      appointment_date,
      appointment_time_text,
      doctors(full_name),
      clinic_specialties(name)
    )
  `;
}

export async function listQueueTickets(options = {}) {
  const ready = requireSupabase();
  if (!ready.ok) return ready;

  try {
    let query = supabase
      .from('queue_tickets')
      .select(queueSelect())
      .not('appointments.checked_in_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!options.privileged) {
      const owner = await findOwnerProfile(options.firebaseUser);
      if (!owner?.id) return { ok: true, status: 200, data: [] };
      query = query.eq('owner_profile_id', owner.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, status: 200, data: (data || []).map(mapQueueTicketResponse) };
  } catch (error) {
    return { ok: false, status: 500, data: { message: error.message } };
  }
}

export async function getQueueTicket(ticketCodeValue, options = {}) {
  const ready = requireSupabase();
  if (!ready.ok) return ready;

  try {
    const owner = options.privileged ? null : await findOwnerProfile(options.firebaseUser);
    const ticketCodeValueNormalized = normalizeTicketCode(ticketCodeValue);
    const { data, error } = await supabase
      .from('queue_tickets')
      .select(queueSelect())
      .eq('ticket_code', ticketCodeValueNormalized)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.appointments?.checked_in_at) return { ok: false, status: 404, data: { message: 'Số khám chỉ có sau khi check-in.' } };
    if (!canReadQueueTicket(data, owner, options.privileged)) {
      return { ok: false, status: 403, data: { message: 'Ban khong co quyen xem so kham nay.' } };
    }
    return { ok: true, status: 200, data: mapQueueTicketResponse(data) };
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
