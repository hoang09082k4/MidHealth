import { listAppointments } from './appointments';
import { mergeAppointments, readLocalAppointments, saveLocalAppointments } from './local_appointments';

const READ_PREFIX = 'midhealth_notification_reads';

function userKey(user) {
  return String(user?.uid || user?.email || user?.phoneNumber || 'guest').trim().toLowerCase();
}

function readStorageKey(user) {
  return `${READ_PREFIX}:${userKey(user)}`;
}

function readReadIds(user) {
  try {
    const data = JSON.parse(localStorage.getItem(readStorageKey(user)) || '[]');
    return new Set(Array.isArray(data) ? data : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(user, ids) {
  localStorage.setItem(readStorageKey(user), JSON.stringify([...ids]));
}

function parseAppointmentDate(appointment) {
  const dateValue = appointment?.dateValue || appointment?.appointmentDate || appointment?.appointment_date || '';
  const timeValue = String(appointment?.startTime || appointment?.appointmentStartTime || appointment?.appointment_start_time || appointment?.time || '00:00').match(/\d{2}:\d{2}/)?.[0] || '00:00';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;
  const value = new Date(`${dateValue}T${timeValue}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function appointmentKey(appointment) {
  return appointment?.id || appointment?.appointmentCode || appointment?.ticket || '';
}

function displayPlace(appointment) {
  return appointment?.doctorShortName || appointment?.doctorName || appointment?.hospitalName || appointment?.facilityName || 'Cơ sở y tế';
}

function displayTime(appointment) {
  return [appointment?.dateDisplay, appointment?.time].filter(Boolean).join(' - ');
}

function valueOrEmpty(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function firstValue(values) {
  return values.map(valueOrEmpty).find(Boolean) || '';
}

function buildSections(appointment) {
  const patientProfile = appointment?.patientProfile || {};
  const bookingRows = [
    ['Mã phiếu khám', appointment?.appointmentCode || appointment?.ticket],
    ['STT', appointment?.number],
    ['Dịch vụ', appointment?.serviceName],
    ['Chuyên khoa', appointment?.department],
    ['Cơ sở khám', appointment?.hospitalName || appointment?.facilityName || appointment?.doctorName],
    ['Địa chỉ', appointment?.address],
    ['Ngày khám', appointment?.dateDisplay],
    ['Giờ khám', appointment?.time],
    ['Trạng thái', appointment?.status || 'Đã đặt lịch'],
  ].filter(([, value]) => valueOrEmpty(value));

  const patientRows = [
    ['Mã bệnh nhân', appointment?.patientCode],
    ['Họ và tên', firstValue([appointment?.patientName, patientProfile.fullName, patientProfile.name])],
    ['Ngày sinh', firstValue([appointment?.birthDate, patientProfile.birthDate])],
    ['Số điện thoại', firstValue([appointment?.phone, patientProfile.phone])],
    ['Giới tính', firstValue([appointment?.gender, patientProfile.gender])],
    ['Email', firstValue([patientProfile.email, appointment?.patientEmail, appointment?.email])],
    ['Địa chỉ bệnh nhân', firstValue([appointment?.patientAddress, patientProfile.address])],
  ].filter(([, value]) => valueOrEmpty(value));

  return [
    { title: 'Thông tin lịch khám', rows: bookingRows },
    { title: 'Thông tin bệnh nhân', rows: patientRows },
  ].filter((section) => section.rows.length);
}

function appointmentSummary(appointment, place, schedule) {
  const parts = [
    appointment?.appointmentCode ? `Mã phiếu ${appointment.appointmentCode}` : '',
    appointment?.number ? `STT ${appointment.number}` : '',
    place,
    schedule,
  ].filter(Boolean);
  return parts.join(' • ');
}

function notificationPayload(base, appointment, place, schedule, detailMessage, noteItems = []) {
  return {
    ...base,
    summary: appointmentSummary(appointment, place, schedule),
    detailMessage,
    sections: buildSections(appointment),
    notes: noteItems,
    appointmentId: appointmentKey(appointment),
    appointmentCode: appointment?.appointmentCode || appointment?.ticket || '',
    patientName: appointment?.patientName || appointment?.patientProfile?.fullName || appointment?.patientProfile?.name || '',
    place,
    schedule,
  };
}

function makeNotification(type, appointment, now) {
  const key = appointmentKey(appointment);
  const place = displayPlace(appointment);
  const schedule = displayTime(appointment);
  const status = appointment?.status || '';

  if (type === 'reminder') {
    return notificationPayload({
      id: `reminder:${key}`,
      type,
      title: 'Sắp đến lịch khám',
      message: `Bạn có lịch khám tại ${place}${schedule ? `, ${schedule}` : ''}. Vui lòng đến sớm 15 phút.`,
      createdAt: now.toISOString(),
    }, appointment, place, schedule, `Lịch khám của bạn tại ${place} sắp diễn ra${schedule ? ` vào ${schedule}` : ''}. MidHealth nhắc bạn chuẩn bị giấy tờ cần thiết và đến sớm khoảng 15 phút để làm thủ tục.`, [
      'Mang theo CCCD/CMND, thẻ BHYT nếu có và các kết quả khám trước đó.',
      'Nếu không thể đến đúng giờ, bạn nên hủy hoặc đặt lại lịch để tránh ảnh hưởng lượt khám.',
    ]);
  }

  if (status === 'Đã hủy') {
    return notificationPayload({
      id: `cancelled:${key}`,
      type: 'cancelled',
      title: 'Lịch khám đã hủy',
      message: `Lịch khám tại ${place}${schedule ? `, ${schedule}` : ''} đã được hủy.`,
      createdAt: now.toISOString(),
    }, appointment, place, schedule, `Lịch khám tại ${place}${schedule ? `, khung giờ ${schedule}` : ''} đã được cập nhật sang trạng thái hủy. Bạn có thể đặt lịch mới nếu vẫn cần tiếp tục khám.`, [
      'Các thông tin phiếu khám cũ vẫn được giữ trong lịch sử để bạn tra cứu.',
    ]);
  }

  if (status === 'Đã khám') {
    return notificationPayload({
      id: `completed:${key}`,
      type: 'completed',
      title: 'Lịch khám đã hoàn tất',
      message: `Phiếu khám tại ${place} đã được cập nhật trạng thái hoàn tất.`,
      createdAt: now.toISOString(),
    }, appointment, place, schedule, `Phiếu khám tại ${place} đã được ghi nhận hoàn tất. Khi cơ sở y tế cập nhật kết quả, bạn có thể xem lại trong phiếu khám điện tử.`, [
      'Theo dõi phần kết quả trong phiếu khám điện tử để xem cập nhật mới.',
    ]);
  }

  return notificationPayload({
    id: `confirmed:${key}`,
    type: 'confirmed',
    title: 'Đã đặt lịch khám',
    message: `Bạn đã đặt lịch tại ${place}${schedule ? `, khung giờ ${schedule}` : ''}. Mã phiếu ${appointment?.appointmentCode || key}.`,
    createdAt: now.toISOString(),
  }, appointment, place, schedule, `MidHealth đã xác nhận lịch khám của bạn tại ${place}${schedule ? `, khung giờ ${schedule}` : ''}. Vui lòng kiểm tra kỹ thông tin bên dưới để đảm bảo đúng bệnh nhân, ngày khám, giờ khám và cơ sở khám.`, [
    'Bạn nên đến trước giờ khám 15 phút để làm thủ tục tiếp nhận.',
    'Khi đến nơi, cung cấp mã phiếu hoặc STT cho quầy tiếp nhận nếu được yêu cầu.',
  ]);
}

function buildNotifications(appointments, user) {
  const now = new Date();
  const readIds = readReadIds(user);
  const notifications = [];

  mergeAppointments(appointments).forEach((appointment) => {
    const key = appointmentKey(appointment);
    if (!key) return;
    notifications.push(makeNotification('confirmed', appointment, now));

    const appointmentDate = parseAppointmentDate(appointment);
    const hoursUntil = appointmentDate ? (appointmentDate.getTime() - now.getTime()) / 36e5 : Infinity;
    if (appointment?.status !== 'Đã hủy' && hoursUntil >= 0 && hoursUntil <= 24) {
      notifications.push(makeNotification('reminder', appointment, now));
    }
  });

  return notifications
    .map((item) => ({ ...item, read: readIds.has(item.id) }))
    .sort((a, b) => Number(a.read) - Number(b.read) || b.createdAt.localeCompare(a.createdAt));
}

export async function loadNotifications(user) {
  const localAppointments = readLocalAppointments(user);
  if (!user) return buildNotifications(localAppointments, user);

  try {
    const apiAppointments = await listAppointments(user);
    const appointments = saveLocalAppointments(user, mergeAppointments([...(apiAppointments || []), ...localAppointments]));
    return buildNotifications(appointments, user);
  } catch {
    return buildNotifications(localAppointments, user);
  }
}

export function markNotificationsRead(user, notificationIds) {
  const readIds = readReadIds(user);
  notificationIds.forEach((id) => readIds.add(id));
  saveReadIds(user, readIds);
}
