import { useEffect, useMemo, useRef, useState } from 'react';
import BieuTuongLogo from '../dung_chung/bieu_tuong_logo';

const STATUS_BADGES = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  completed: 'Đã khám',
  cancelled: 'Đã hủy',
  no_show: 'Không đến',
};

const RISK_BADGES = {
  low: 'Rủi ro thấp',
  medium: 'Cần theo dõi',
  high: 'No-show',
};

const SLOT_PRESETS = [
  { id: 'morning-1', label: 'Sáng 7:30', startTime: '07:30', endTime: '08:00', capacity: '4' },
  { id: 'morning-2', label: 'Sáng 8:00', startTime: '08:00', endTime: '08:30', capacity: '4' },
  { id: 'afternoon-1', label: 'Chiều 13:30', startTime: '13:30', endTime: '14:00', capacity: '4' },
  { id: 'afternoon-2', label: 'Chiều 14:00', startTime: '14:00', endTime: '14:30', capacity: '4' },
  { id: 'evening-1', label: 'Tối 17:30', startTime: '17:30', endTime: '18:00', capacity: '3' },
];

const FLEXIBLE_SLOT_PRESETS = [
  { id: 'morning-1', session: 'morning', label: 'Sáng 07:30', startTime: '07:30', endTime: '08:00', capacity: '4' },
  { id: 'morning-2', session: 'morning', label: 'Sáng 08:00', startTime: '08:00', endTime: '08:30', capacity: '4' },
  { id: 'morning-3', session: 'morning', label: 'Sáng 08:30', startTime: '08:30', endTime: '09:00', capacity: '4' },
  { id: 'afternoon-1', session: 'afternoon', label: 'Chiều 13:30', startTime: '13:30', endTime: '14:00', capacity: '4' },
  { id: 'afternoon-2', session: 'afternoon', label: 'Chiều 14:00', startTime: '14:00', endTime: '14:30', capacity: '4' },
  { id: 'afternoon-3', session: 'afternoon', label: 'Chiều 14:30', startTime: '14:30', endTime: '15:00', capacity: '4' },
  { id: 'evening-1', session: 'evening', label: 'Tối 17:30', startTime: '17:30', endTime: '18:00', capacity: '3' },
  { id: 'evening-2', session: 'evening', label: 'Tối 18:00', startTime: '18:00', endTime: '18:30', capacity: '3' },
];

const SLOT_SESSION_PRESETS = [
  { id: 'morning', label: 'Buổi sáng', startTime: '07:30', endTime: '11:30' },
  { id: 'afternoon', label: 'Buổi chiều', startTime: '13:30', endTime: '17:00' },
  { id: 'evening', label: 'Buổi tối', startTime: '17:30', endTime: '19:00' },
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 phút' },
  { value: 30, label: '30 phút' },
  { value: 45, label: '45 phút' },
  { value: 60, label: '60 phút' },
];

const TIME_OPTIONS = Array.from({ length: 49 }, (_, index) => {
  const totalMinutes = 7 * 60 + index * 15;
  const hour = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minute = String(totalMinutes % 60).padStart(2, '0');
  return `${hour}:${minute}`;
});

const FACILITY_GALLERY_LIMIT = 5;
const FACILITY_GALLERY_MAX_SIZE = 15 * 1024 * 1024;
const FACILITY_GALLERY_TYPES = new Set(['image/png', 'image/jpeg']);

const UNAVAILABILITY_PRESETS = [
  { label: '3 ngày', days: 2 },
  { label: '1 tuần', days: 6 },
  { label: '1 tháng', days: 30 },
  { label: '3 tháng', days: 90 },
];

function WorkspaceBrand({ onHome }) {
  const content = (
    <>
      <BieuTuongLogo />
      <span>Workspace</span>
    </>
  );

  return onHome ? (
    <button className="dw-midhealth-brand" type="button" onClick={onHome} aria-label="Về trang chủ MidHealth">
      {content}
    </button>
  ) : (
    <div className="dw-midhealth-brand">{content}</div>
  );
}

function DashboardPreview() {
  return (
    <div className="dw-dashboard-preview" aria-hidden="true">
      <aside>
        <div className="dw-app-mark">M</div>
        <strong>MidHealth Workspace</strong>
        {['Tổng quan', 'Lịch hẹn', 'Khung giờ', 'Check-in', 'Báo cáo'].map((item, index) => (
          <span className={index === 0 ? 'active' : ''} key={item}>{item}</span>
        ))}
      </aside>
      <main>
        <div className="dw-preview-top">
          <h3>Vận hành đặt khám</h3>
          <span>Hôm nay</span>
        </div>
        <div className="dw-stat-row">
          <article><b>12</b><small>Lịch hẹn</small></article>
          <article><b>08</b><small>Xác nhận</small></article>
          <article><b>04</b><small>Cần xử lý</small></article>
        </div>
        <div className="dw-chart">
          {[36, 64, 48, 72, 42, 58, 30, 68].map((height, index) => (
            <i style={{ height: `${height}%` }} key={index} />
          ))}
        </div>
      </main>
    </div>
  );
}

function numberValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function todayValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function dateValueFromOffset(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDaysToDateValue(value, amount = 1) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
    ? new Date(`${value}T00:00:00`)
    : new Date();
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function displayDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function addMinutesToTime(time, minutes) {
  const [hour = '0', minute = '0'] = String(time || '00:00').split(':');
  const totalMinutes = Number(hour) * 60 + Number(minute) + Number(minutes || 0);
  const normalized = Math.max(0, Math.min(totalMinutes, 23 * 60 + 59));
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function timeToMinutes(time) {
  const [hour = '0', minute = '0'] = String(time || '00:00').split(':');
  return Number(hour) * 60 + Number(minute);
}

function durationBetweenTimes(startTime, endTime) {
  return Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime));
}

function closestDurationOption(minutes) {
  const option = DURATION_OPTIONS.find((item) => item.value === minutes);
  return option?.value || null;
}

function buildSlotRanges(startTime, endTime, durationMinutes) {
  const ranges = [];
  let cursor = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const duration = Math.max(15, Number(durationMinutes) || 30);
  while (cursor + duration <= end && ranges.length < 48) {
    const start = `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`;
    const finish = addMinutesToTime(start, duration);
    ranges.push({ startTime: start, endTime: finish });
    cursor += duration;
  }
  return ranges;
}

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

function digitsOnly(value = '') {
  return String(value || '').replace(/[^\d]/g, '');
}

function findServiceFeeForSpecialty(services = [], specialty) {
  const normalizedSpecialty = normalizeText(specialty?.name || '');
  if (!normalizedSpecialty) return '';
  const service = (services || []).find((item) => {
    const serviceName = normalizeText(item?.name || '');
    return item?.specialtyId === specialty?.id || serviceName === `kham ${normalizedSpecialty}` || serviceName.includes(normalizedSpecialty);
  });
  return digitsOnly(service?.fee || '');
}

function getMetrics(operations, workspace) {
  const summary = operations?.summary || {};
  const locked = workspace?.status !== 'approved';
  return [
    { tone: 'blue', icon: '01', label: 'Lịch hôm nay', value: numberValue(summary.todayAppointments), note: locked ? 'Mở sau khi hồ sơ được duyệt' : 'Tổng số lượt khám trong ngày' },
    { tone: 'orange', icon: '!', label: 'Cần xác nhận', value: numberValue(summary.pendingAppointments), note: 'Ưu tiên xử lý các lịch mới' },
    { tone: 'green', icon: '03', label: 'Chỗ trống sắp tới', value: numberValue(summary.availableSlots), note: 'Tổng sức chứa còn lại trong 14 ngày' },
    { tone: 'violet', icon: '04', label: 'Đã check-in', value: numberValue(summary.checkedIn), note: 'Bệnh nhân đã vào quy trình khám' },
  ];
}

function EmptyState({ title, text, status, getStatusLabel = (value) => value || '' }) {
  return (
    <section className="dw-workspace-empty">
      <div className={status === 'approved' ? 'ready' : 'locked'}>{status === 'approved' ? '0' : '!'}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      <span>{getStatusLabel(status)}</span>
    </section>
  );
}

function formatWorkspaceEventType(type = '') {
  const labels = {
    workspace_submitted: 'Gửi hồ sơ',
    workspace_resubmitted: 'Gửi lại hồ sơ',
    workspace_updated: 'Cập nhật hồ sơ',
    provider_status_reviewed: 'Duyệt hồ sơ',
    appointment_status_updated: 'Cập nhật lịch hẹn',
    appointment_received: 'Nhận lịch đặt mới',
    appointment_cancelled_by_patient: 'Bệnh nhân hủy lịch',
    slot_created: 'Tạo khung giờ',
    slot_updated: 'Cập nhật khung giờ',
    doctor_unavailability_saved: 'Cập nhật lịch nghỉ',
    doctor_unavailability_cleared: 'Xóa lịch nghỉ',
    facility_details_updated: 'Cập nhật trang hiển thị',
  };
  return labels[type] || type || 'Hoạt động';
}

function formatWorkspaceEventMessage(message = '') {
  const labels = {
    'Provider updated and resubmitted workspace profile.': 'Đối tác đã cập nhật và gửi lại hồ sơ để kiểm duyệt.',
    'Provider submitted workspace profile for review.': 'Đối tác đã gửi hồ sơ để kiểm duyệt.',
    'Provider updated approved workspace profile.': 'Đối tác đã cập nhật hồ sơ đã duyệt.',
    'Patient booked a new appointment.': 'Có lịch đặt mới từ bệnh nhân.',
    'Patient cancelled appointment.': 'Bệnh nhân đã hủy lịch hẹn.',
    'Doctor saved unavailable period.': 'Bác sĩ đã cập nhật khoảng thời gian nghỉ.',
    'Doctor cleared unavailable period.': 'Bác sĩ đã xóa thông báo nghỉ.',
    'Facility public details updated.': 'Cơ sở đã cập nhật thông tin hiển thị công khai.',
  };
  return labels[message] || message || 'Hoạt động đã được ghi nhận.';
}

function formatWorkspaceEventDetail(event = {}) {
  const metadata = event.metadata || {};
  if (['appointment_received', 'appointment_cancelled_by_patient'].includes(event.eventType)) {
    return [
      metadata.patientName,
      metadata.appointmentDate,
      metadata.appointmentTime,
      metadata.appointmentCode ? `Mã ${metadata.appointmentCode}` : '',
    ].filter(Boolean).join(' · ');
  }
  return event.actorEmail || 'system';
}

function ActivityFeed({ events = [] }) {
  if (!events.length) {
    return (
      <div className="dw-activity-empty">
        <strong>Chưa có nhật ký</strong>
        <p>Các thao tác duyệt hồ sơ, đổi trạng thái lịch và cập nhật slot sẽ hiển thị tại đây.</p>
      </div>
    );
  }

  return (
    <div className="dw-activity-feed">
      {events.slice(0, 8).map((event) => (
        <article key={event.id}>
          <span>{formatWorkspaceEventType(event.eventType)}</span>
          <strong>{formatWorkspaceEventMessage(event.message)}</strong>
          <p>{formatWorkspaceEventDetail(event)} · {new Date(event.createdAt).toLocaleString('vi-VN')}</p>
        </article>
      ))}
    </div>
  );
}

function OperationsOverview({ workspace, operations, onNavigate, onAppointmentStatusChange }) {
  const isApproved = workspace?.status === 'approved';
  const isLinked = Boolean(operations?.linked);
  const hasSlots = Boolean(operations?.slots?.length);
  const hasAppointments = Boolean(operations?.appointments?.length);
  const facilityNeedsSpecialties = ['clinic', 'hospital'].includes(workspace?.mode) && isApproved && isLinked && !operations?.specialties?.length;
  const nextAction = !isApproved
    ? { label: 'Kiểm tra hồ sơ', section: 'ho-so', tone: 'warning' }
    : !isLinked
      ? { label: 'Kiểm tra liên kết', section: 'ho-so', tone: 'warning' }
      : facilityNeedsSpecialties
        ? { label: 'Bổ sung chuyên khoa', section: 'ho-so', tone: 'warning' }
        : !hasSlots
          ? { label: 'Mở khung giờ', section: 'lich-lam-viec', tone: 'primary' }
          : { label: 'Quản lý lịch hẹn', section: 'lich-hen', tone: 'primary' };
  const metrics = getMetrics(operations, workspace);
  const appointments = operations?.appointments || [];
  const reason = operations?.reason;
  const workflowSteps = [
    { id: 'profile', label: 'Hồ sơ được duyệt', done: isApproved, section: 'ho-so' },
    { id: 'catalog', label: 'Liên kết catalog', done: isLinked, section: 'ho-so' },
    { id: 'slots', label: 'Mở khung giờ khám', done: hasSlots, section: 'lich-lam-viec' },
    { id: 'appointments', label: 'Nhận lịch bệnh nhân', done: hasAppointments, section: 'lich-hen' },
  ];

  return (
    <>
      <div className="dw-dashboard-heading compact">
        <div>
          <span>Tổng quan vận hành</span>
          <h1>{isApproved ? 'Công việc cần nắm hôm nay' : 'Hoàn thiện hồ sơ để mở workspace'}</h1>
          <p>{reason || 'Theo dõi lịch hẹn, khung giờ trống, check-in và hiệu suất khám từ dữ liệu backend.'}</p>
        </div>
        <button type="button" className={`dw-primary-command ${nextAction.tone === 'warning' ? 'soft-warning' : ''}`} onClick={() => onNavigate(nextAction.section)}>{nextAction.label}</button>
      </div>

      <section className="dw-metric-grid refined">
        {metrics.map((metric) => (
          <article className={`dw-metric-${metric.tone}`} key={metric.label}>
            <small>{metric.label}</small>
            <strong>{metric.value}</strong>
            <p>{metric.note}</p>
            <span className={metric.tone}>{metric.icon}</span>
          </article>
        ))}
      </section>

      <section className="dw-operations-grid refined">
        <article className="dw-today-panel">
          <header>
            <div>
              <span>Lịch gần nhất</span>
              <strong>{appointments.length ? `${appointments.length} lịch trong 14 ngày` : 'Chưa có lịch hẹn'}</strong>
            </div>
            <button type="button" onClick={() => onNavigate(hasSlots ? 'lich-hen' : nextAction.section)}>{hasSlots ? 'Xem tất cả' : nextAction.label}</button>
          </header>
          <AppointmentList
            appointments={appointments.slice(0, 5)}
            workspace={workspace}
            onStatusChange={onAppointmentStatusChange}
          />
        </article>

        <article className="dw-intake-panel">
          <header>
            <span>Trạng thái liên kết</span>
            <strong>{operations?.linked ? 'Đã nối dữ liệu backend' : 'Chưa liên kết catalog'}</strong>
          </header>
          <div className="dw-link-card">
            <b>{operations?.linkedDoctor?.name || operations?.linkedFacility?.name || 'Chưa tìm thấy hồ sơ liên kết'}</b>
            <p>{operations?.linkedDoctor?.specialty || operations?.linkedFacility?.address || reason || 'Backend đã sẵn sàng, cần liên kết workspace với danh mục bác sĩ/bệnh viện/phòng khám để có dữ liệu.'}</p>
          </div>
          {workflowSteps.map((step, index) => (
            <button type="button" className={`dw-intake-step ${step.done ? 'done' : ''}`} key={step.id} onClick={() => onNavigate(step.section)}>
              <i>{String(index + 1).padStart(2, '0')}</i>
              <span>{step.label}</span>
            </button>
          ))}
        </article>

        <article className="dw-activity-panel">
          <header>
            <span>Nhật ký vận hành</span>
            <strong>{operations?.activity?.length ? `${operations.activity.length} sự kiện gần đây` : 'Chưa có sự kiện'}</strong>
          </header>
          <ActivityFeed events={operations?.activity || []} />
        </article>
      </section>
    </>
  );
}

function AppointmentList({ appointments, workspace, onStatusChange, getStatusLabel }) {
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');

  if (!appointments.length) {
    return (
      <EmptyState
        status={workspace?.status}
        title={workspace?.status === 'approved' ? 'Chưa có lịch hẹn' : 'Chức năng đang khóa'}
        text={workspace?.status === 'approved' ? 'API đã hoạt động nhưng chưa có lịch hẹn liên kết với workspace này.' : 'Hồ sơ cần được duyệt trước khi mở dữ liệu bệnh nhân.'}
        getStatusLabel={getStatusLabel}
      />
    );
  }

  const changeStatus = async (appointmentId, status) => {
    if (!onStatusChange) return;
    setBusyId(`${appointmentId}:${status}`);
    setMessage('');
    try {
      await onStatusChange(appointmentId, status);
    } catch (error) {
      setMessage(error.message || 'Không thể cập nhật lịch hẹn.');
    } finally {
      setBusyId('');
    }
  };

  const canOperate = workspace?.status === 'approved' && onStatusChange;

  return (
    <div className="dw-appointment-list">
      {message ? <p className="dw-form-alert">{message}</p> : null}
      {appointments.map((item) => (
        <article key={item.id}>
          <time>
            <b>{item.time || '--:--'}</b>
            <small>{item.date}</small>
          </time>
          <div>
            <strong>{item.patientName}</strong>
            <p>{item.reason}</p>
            <small>{item.ticketCode || item.appointmentCode || item.patientPhone}</small>
          </div>
          <div className="dw-appointment-actions">
            <span className={`dw-risk ${item.riskLevel || 'low'}`} title={item.riskReason || ''}>{RISK_BADGES[item.riskLevel] || RISK_BADGES.low}</span>
            <span className={`dw-status ${item.status}`}>{STATUS_BADGES[item.status] || item.status}</span>
            {canOperate && item.status === 'pending' ? (
              <>
                <button type="button" disabled={Boolean(busyId)} onClick={() => changeStatus(item.id, 'confirmed')}>
                  {busyId === `${item.id}:confirmed` ? 'Đang lưu...' : 'Xác nhận'}
                </button>
                <button type="button" disabled={Boolean(busyId)} onClick={() => changeStatus(item.id, 'cancelled')}>Hủy</button>
              </>
            ) : null}
            {canOperate && item.status === 'confirmed' ? (
              <>
                <button type="button" disabled={Boolean(busyId)} onClick={() => changeStatus(item.id, 'completed')}>Hoàn tất</button>
                <button type="button" disabled={Boolean(busyId)} onClick={() => changeStatus(item.id, 'no_show')}>Không đến</button>
              </>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function ProfilePanel({ workspace, operations, onEdit }) {
  const isFacility = workspace?.mode === 'clinic' || workspace?.mode === 'hospital';
  const facilityLabel = workspace?.mode === 'hospital' ? 'bệnh viện' : 'phòng khám';
  const linkedFacility = operations?.linkedFacility || {};
  const linkedDoctor = operations?.linkedDoctor || {};
  const specialtyNames = (operations?.specialties || [])
    .map((item) => item?.name || item)
    .filter(Boolean)
    .join(', ');
  const hoursSummary = (operations?.hours || linkedFacility.hours || [])
    .map((item) => [item?.label, item?.time || item?.timeText].filter(Boolean).join(': '))
    .filter(Boolean)
    .slice(0, 3)
    .join(' | ');
  const fields = isFacility
    ? [
      [`Tên ${facilityLabel}`, workspace?.clinicName],
      ['Loại hồ sơ', facilityLabel],
      ['Người phụ trách', workspace?.ownerName],
      ['Địa chỉ hoạt động', workspace?.clinicAddress],
      ['Hotline / số liên hệ', linkedFacility.phone || workspace?.ownerPhone],
      ['Chuyên khoa tiếp nhận', specialtyNames || workspace?.specialty],
      ['Mô tả ngắn ngoài thẻ', linkedFacility.subtitle],
      [workspace?.mode === 'hospital' ? 'Giấy phép hoạt động / mã KCB / mã số thuế' : 'Mã số thuế / mã KCB', workspace?.taxCode],
      ['Giờ làm việc', hoursSummary],
      ['Dịch vụ đặt khám', operations?.services?.length ? `${operations.services.length} dịch vụ` : 'Chưa cập nhật'],
      ['Ảnh thư viện', operations?.images?.length ? `${operations.images.length} ảnh` : 'Chưa cập nhật'],
      ['Email quản trị', workspace?.email],
      ['Mã liên kết catalog', workspace?.linkedFacilityId || linkedFacility.id],
    ]
    : [
      ['Họ tên hiển thị', workspace?.ownerName],
      ['Học hàm / chức danh', workspace?.doctorTitle],
      ['Chuyên khoa chính', workspace?.specialty],
      ['Nơi khám / phòng khám', workspace?.clinicName || linkedDoctor.workplace],
      ['Địa chỉ nơi khám', workspace?.clinicAddress || linkedFacility.address],
      ['Số điện thoại liên hệ', workspace?.ownerPhone],
      ['Trạng thái nhận lịch', linkedDoctor.notice || linkedDoctor.unavailableNote ? 'Đang có thông báo nghỉ' : 'Đang nhận lịch khi có khung giờ'],
      ['Email chuyên môn', workspace?.email],
      ['Mã liên kết bác sĩ', workspace?.linkedDoctorId || linkedDoctor.id],
    ];

  return (
    <section className="dw-provider-profile">
      <div className="dw-dashboard-heading compact">
        <div>
          <span>Thông tin công khai</span>
          <h1>{isFacility ? `Hồ sơ ${facilityLabel}` : 'Hồ sơ bác sĩ'}</h1>
          <p>Thông tin dùng để kiểm duyệt, đồng bộ catalog và hiển thị với bệnh nhân.</p>
        </div>
        <button type="button" className="dw-primary-command" onClick={onEdit}>Chỉnh sửa</button>
      </div>
      <div className="dw-profile-fields">
        {fields.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value || 'Chưa cập nhật'}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function DoctorUnavailabilityPanel({ workspace, operations, onSaveUnavailability }) {
  const currentNotice = operations?.unavailability?.notice || operations?.linkedDoctor?.unavailableNote || '';
  const canManage = workspace?.status === 'approved' && operations?.linked && onSaveUnavailability;
  const [form, setForm] = useState({
    startDate: todayValue(),
    endDate: dateValueFromOffset(2),
    reason: '',
  });
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  const applyPreset = (days) => {
    setForm((current) => ({
      ...current,
      startDate: todayValue(),
      endDate: dateValueFromOffset(days),
    }));
  };

  const save = async (event) => {
    event.preventDefault();
    if (!canManage) return;
    if (!form.startDate || !form.endDate) {
      setMessage('Vui lòng chọn ngày bắt đầu và ngày kết thúc.');
      return;
    }
    if (form.startDate > form.endDate) {
      setMessage('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');
      return;
    }
    setBusy('save');
    setMessage('');
    try {
      await onSaveUnavailability({
        enabled: true,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason,
      });
      setMessage(`Đã thông báo nghỉ từ ${displayDate(form.startDate)} đến ${displayDate(form.endDate)}.`);
    } catch (error) {
      setMessage(error.message || 'Không thể lưu lịch nghỉ.');
    } finally {
      setBusy('');
    }
  };

  const clear = async () => {
    if (!canManage) return;
    setBusy('clear');
    setMessage('');
    try {
      await onSaveUnavailability({ enabled: false });
      setMessage('Đã xoá thông báo nghỉ.');
    } catch (error) {
      setMessage(error.message || 'Không thể xoá thông báo nghỉ.');
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="dw-unavailability-panel">
      <header>
        <div>
          <span>Lịch nghỉ bác sĩ</span>
          <strong>Tạm ngừng nhận lịch khi bận</strong>
          <p>Thông báo này hiển thị trên trang đặt khám cá nhân để bệnh nhân biết bác sĩ nghỉ từ ngày nào đến ngày nào.</p>
        </div>
        {currentNotice ? <em>Đang hiển thị công khai</em> : <em>Chưa có thông báo nghỉ</em>}
      </header>
      {currentNotice ? (
        <div className="dw-current-unavailability">
          <strong>Thông báo hiện tại</strong>
          <p>{currentNotice}</p>
        </div>
      ) : null}
      <form className="dw-unavailability-form" onSubmit={save}>
        <div className="dw-unavailability-presets">
          {UNAVAILABILITY_PRESETS.map((preset) => (
            <button type="button" key={preset.label} disabled={!canManage} onClick={() => applyPreset(preset.days)}>
              {preset.label}
            </button>
          ))}
        </div>
        <label>
          Bắt đầu nghỉ
          <input type="date" min={todayValue()} value={form.startDate} disabled={!canManage} onChange={(event) => setForm({ ...form, startDate: event.target.value })} />
        </label>
        <label>
          Nghỉ đến hết ngày
          <input type="date" min={form.startDate || todayValue()} value={form.endDate} disabled={!canManage} onChange={(event) => setForm({ ...form, endDate: event.target.value })} />
        </label>
        <label className="wide">
          Lý do ngắn
          <input value={form.reason} disabled={!canManage} maxLength={140} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Ví dụ: công tác, nghỉ phép, tham dự hội nghị" />
        </label>
        <div className="dw-unavailability-actions">
          <button type="submit" disabled={!canManage || busy === 'save'}>{busy === 'save' ? 'Đang lưu...' : 'Lưu lịch nghỉ'}</button>
          <button type="button" disabled={!canManage || busy === 'clear' || !currentNotice} onClick={clear}>{busy === 'clear' ? 'Đang xoá...' : 'Xoá lịch nghỉ'}</button>
        </div>
      </form>
      {message ? <p className={message.includes('Đã') ? 'dw-form-alert neutral' : 'dw-form-alert'}>{message}</p> : null}
    </section>
  );
}

function SchedulePanel({ workspace, operations, onSaveSlot, onUpdateSlot, onToggleSlot, onDeleteSlot, onSaveUnavailability, getStatusLabel }) {
  const slots = operations?.slots || [];
  const facilitySpecialties = operations?.specialties || [];
  const isFacilityWorkspace = workspace?.mode === 'clinic' || workspace?.mode === 'hospital';
  const [slotForm, setSlotForm] = useState({
    specialtyId: '',
    date: todayValue(),
    startTime: '07:30',
    endTime: '08:00',
    capacity: '1',
    consultationFee: '',
  });
  const [copyTargetDate, setCopyTargetDate] = useState(() => dateValueFromOffset(1));
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const [editingSlotId, setEditingSlotId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const sortedSlots = useMemo(
    () => [...slots].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.startTime).localeCompare(String(b.startTime))),
    [slots],
  );
  const groups = ['morning', 'afternoon', 'evening'].map((session) => {
    const sessionSlots = slots.filter((slot) => slot.session === session && slot.isActive);
    return {
      session,
      label: { morning: 'Sáng', afternoon: 'Chiều', evening: 'Tối' }[session],
      time: { morning: '07:30 - 11:30', afternoon: '13:30 - 17:00', evening: '17:30 - 19:00' }[session],
      slots: sessionSlots.length,
      available: sessionSlots.reduce((total, slot) => total + slot.availableCount, 0),
    };
  });
  const canManageSlots = workspace?.status === 'approved' && operations?.linked && onSaveSlot;
  const selectedSpecialtyId = slotForm.specialtyId || facilitySpecialties[0]?.id || '';
  const selectedSpecialty = facilitySpecialties.find((specialty) => specialty.id === selectedSpecialtyId) || facilitySpecialties[0] || null;
  const isHospitalWorkspace = workspace?.mode === 'hospital';
  const slotSetupBlocked = isFacilityWorkspace && canManageSlots && !facilitySpecialties.length;
  const canSubmitSlot = canManageSlots && !slotSetupBlocked && (!isFacilityWorkspace || selectedSpecialtyId) && (!isHospitalWorkspace || Number(digitsOnly(slotForm.consultationFee)) > 0);
  const lockedReason = workspace?.status !== 'approved'
    ? 'Hồ sơ cần được admin duyệt trước khi mở giờ khám.'
    : !operations?.linked
      ? 'Workspace cần liên kết với catalog trước khi mở giờ khám.'
      : '';

  useEffect(() => {
    const nextDuration = workspace?.mode === 'doctor' ? 15 : 30;
    setDurationMinutes(nextDuration);
    setSlotForm((current) => ({
      ...current,
      endTime: addMinutesToTime(current.startTime, nextDuration),
      capacity: workspace?.mode === 'doctor' ? '1' : current.capacity || '1',
    }));
  }, [workspace?.mode]);

  useEffect(() => {
    if (!isHospitalWorkspace || !selectedSpecialty) return;
    setSlotForm((current) => {
      if (current.consultationFee) return current;
      return {
        ...current,
        consultationFee: findServiceFeeForSpecialty(operations?.services || [], selectedSpecialty),
      };
    });
  }, [isHospitalWorkspace, operations?.services, selectedSpecialty?.id]);

  useEffect(() => {
    if (!slotForm.date || copyTargetDate > slotForm.date) return;
    setCopyTargetDate(addDaysToDateValue(slotForm.date, 1));
  }, [copyTargetDate, slotForm.date]);

  const applyPreset = (preset) => {
    setSlotForm((current) => ({
      ...current,
      startTime: preset.startTime,
      endTime: preset.endTime,
      capacity: preset.capacity ? String(preset.capacity) : current.capacity,
    }));
  };

  const updateStartTime = (startTime) => {
    setSlotForm((current) => ({
      ...current,
      startTime,
      endTime: timeToMinutes(current.endTime) > timeToMinutes(startTime)
        ? current.endTime
        : addMinutesToTime(startTime, durationMinutes),
    }));
  };

  const updateDuration = (duration) => {
    setDurationMinutes(duration);
    setSlotForm((current) => ({
      ...current,
      endTime: durationBetweenTimes(current.startTime, current.endTime) <= durationMinutes
        ? addMinutesToTime(current.startTime, duration)
        : current.endTime,
    }));
  };

  const updateEndTime = (endTime) => {
    const nextDuration = closestDurationOption(durationBetweenTimes(slotForm.startTime, endTime));
    if (nextDuration) setDurationMinutes(nextDuration);
    setSlotForm((current) => ({
      ...current,
      endTime,
    }));
  };

  const updateCapacity = (nextCapacity) => {
    setSlotForm((current) => ({
      ...current,
      capacity: String(Math.max(1, Math.min(Number(nextCapacity) || 1, 100))),
    }));
  };

  const createPresetGroup = async (session) => {
    if (!canSubmitSlot) return;
    const preset = SLOT_SESSION_PRESETS.find((item) => item.id === session);
    const ranges = buildSlotRanges(preset?.startTime, preset?.endTime, durationMinutes);
    if (!ranges.length) {
      setMessage('Khung giờ kết thúc phải lớn hơn giờ bắt đầu.');
      return;
    }

    setBusyId(`bulk-${session}`);
    setMessage('');
    try {
      for (const range of ranges) {
        await onSaveSlot({
          specialtyId: selectedSpecialtyId,
          date: slotForm.date,
          startTime: range.startTime,
          endTime: range.endTime,
          capacity: Number(slotForm.capacity) || 1,
          consultationFee: isHospitalWorkspace ? digitsOnly(slotForm.consultationFee) : undefined,
        });
      }
      const sessionLabel = groups.find((group) => group.session === session)?.label || '';
      setMessage(`Đã tạo ${ranges.length} khung giờ ${sessionLabel.toLowerCase()}.`);
    } catch (error) {
      setMessage(error.message || 'Không thể tạo nhanh khung giờ.');
    } finally {
      setBusyId('');
    }
  };

  const submitSlot = async (event) => {
    event.preventDefault();
    if (!canSubmitSlot) return;
    if (!slotForm.date || !slotForm.startTime || !slotForm.endTime || !slotForm.capacity) {
      setMessage('Vui lòng nhập đầy đủ ngày, giờ bắt đầu, giờ kết thúc và số lượt khám.');
      return;
    }
    if (isHospitalWorkspace && Number(digitsOnly(slotForm.consultationFee)) <= 0) {
      setMessage('Vui lòng nhập tiền khám chưa tính bảo hiểm y tế cho chuyên khoa bệnh viện.');
      return;
    }
    const ranges = buildSlotRanges(slotForm.startTime, slotForm.endTime, durationMinutes);
    if (!ranges.length) {
      setMessage('Khung giờ kết thúc phải lớn hơn giờ bắt đầu và đủ thời lượng đã chọn.');
      return;
    }
    setBusyId('new-slot');
    setMessage('');
    try {
      if (editingSlotId) {
        await onUpdateSlot?.(editingSlotId, {
          specialtyId: selectedSpecialtyId,
          date: slotForm.date,
          startTime: slotForm.startTime,
          endTime: slotForm.endTime,
          capacity: Number(slotForm.capacity) || 1,
          consultationFee: isHospitalWorkspace ? digitsOnly(slotForm.consultationFee) : undefined,
        });
        setEditingSlotId('');
        setMessage('Đã cập nhật khung giờ.');
        return;
      }
      for (const range of ranges) {
        await onSaveSlot({
          specialtyId: selectedSpecialtyId,
          date: slotForm.date,
          startTime: range.startTime,
          endTime: range.endTime,
          capacity: Number(slotForm.capacity) || 1,
          consultationFee: isHospitalWorkspace ? digitsOnly(slotForm.consultationFee) : undefined,
        });
      }
      setMessage(ranges.length === 1 ? 'Đã lưu 1 khung giờ.' : `Đã tạo ${ranges.length} khung giờ.`);
    } catch (error) {
      setMessage(error.message || 'Không thể lưu khung giờ.');
    } finally {
      setBusyId('');
    }
  };

  const copyDaySlots = async () => {
    if (!canSubmitSlot || !copyTargetDate || copyTargetDate <= slotForm.date) {
      setMessage('Vui lòng chọn ngày đích sau ngày nguồn.');
      return;
    }

    const sourceSlots = sortedSlots.filter((slot) => slot.date === slotForm.date && slot.isActive);
    if (!sourceSlots.length) {
      setMessage('Ngày nguồn chưa có khung giờ đang mở để sao chép.');
      return;
    }

    setBusyId('copy-day');
    setMessage('');
    try {
      for (const slot of sourceSlots) {
        await onSaveSlot({
          specialtyId: slot.specialtyId || selectedSpecialtyId,
          date: copyTargetDate,
          startTime: slot.startTime,
          endTime: slot.endTime,
          capacity: Number(slot.capacity) || 1,
          consultationFee: isHospitalWorkspace ? digitsOnly(slot.consultationFee || slot.fee || findServiceFeeForSpecialty(operations?.services || [], { id: slot.specialtyId, name: slot.specialtyName }) || slotForm.consultationFee) : undefined,
        });
      }
      setMessage(`Đã sao chép ${sourceSlots.length} khung giờ từ ${displayDate(slotForm.date)} sang ${displayDate(copyTargetDate)}.`);
    } catch (error) {
      setMessage(error.message || 'Không thể sao chép khung giờ.');
    } finally {
      setBusyId('');
    }
  };

  const toggleSlot = async (slot) => {
    if (!onToggleSlot) return;
    setBusyId(slot.id);
    setMessage('');
    try {
      await onToggleSlot(slot.id, { isActive: !slot.isActive });
    } catch (error) {
      setMessage(error.message || 'Không thể cập nhật slot.');
    } finally {
      setBusyId('');
    }
  };

  const editSlot = (slot) => {
    setEditingSlotId(slot.id);
    setSlotForm({
      specialtyId: slot.specialtyId || selectedSpecialtyId,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: String(slot.capacity || 1),
      consultationFee: isHospitalWorkspace ? digitsOnly(slot.consultationFee || slot.fee || findServiceFeeForSpecialty(operations?.services || [], { id: slot.specialtyId, name: slot.specialtyName })) : '',
    });
    const minutes = Math.max(15, timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime));
    setDurationMinutes(DURATION_OPTIONS.some((option) => option.value === minutes) ? minutes : 30);
    setMessage('');
  };

  const cancelEditSlot = () => {
    setEditingSlotId('');
    setMessage('');
  };

  const deleteSlot = (slot) => {
    if (!onDeleteSlot) return;
    if (slot.bookedCount > 0) {
      setMessage('Không thể xóa slot đã có lịch đặt. Hãy khóa lịch mới hoặc xử lý lịch đặt trước.');
      return;
    }
    setMessage('');
    setDeleteTarget(slot);
  };

  const confirmDeleteSlot = async () => {
    if (!deleteTarget || !onDeleteSlot) return;
    setBusyId(`delete-${deleteTarget.id}`);
    setMessage('');
    try {
      await onDeleteSlot(deleteTarget.id);
      if (editingSlotId === deleteTarget.id) setEditingSlotId('');
      setMessage('Đã xóa khung giờ.');
      setDeleteTarget(null);
    } catch (error) {
      setMessage(error.message || 'Không thể xóa khung giờ.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <div className="dw-dashboard-heading compact">
        <div>
          <span>Lịch làm việc</span>
          <h1>Khung giờ nhận đặt khám</h1>
          <p>Tạo giờ khám giống trải nghiệm bệnh nhân đang chọn lịch: ngày, giờ bắt đầu, giờ kết thúc và số lượt nhận trong khung giờ.</p>
        </div>
      </div>
      {lockedReason ? (
        <section className="dw-workflow-callout warning">
          <strong>Chưa thể mở giờ khám</strong>
          <p>{lockedReason}</p>
        </section>
      ) : null}
      {workspace?.mode === 'doctor' ? (
        <DoctorUnavailabilityPanel
          workspace={workspace}
          operations={operations}
          onSaveUnavailability={onSaveUnavailability}
        />
      ) : null}
      <section className="dw-schedule-board">
        {groups.map((block) => (
          <article key={block.session}>
            <span>{block.label}</span>
            <strong>{block.time}</strong>
            <p>{block.slots ? `${block.slots} slot đang mở` : 'Chưa có slot'}</p>
            <small>{block.available} lượt còn trống</small>
            <button type="button" disabled={!canSubmitSlot || Boolean(busyId)} onClick={() => createPresetGroup(block.session)}>
              {busyId === `bulk-${block.session}` ? 'Đang tạo...' : `Tạo nhanh ${block.label.toLowerCase()}`}
            </button>
          </article>
        ))}
      </section>
      <section className="dw-slot-manager upgraded">
        <form className="dw-slot-form-card" onSubmit={submitSlot} noValidate>
          <div>
            <span>Tạo giờ khám</span>
            <strong>Chọn ngày, mẫu giờ hoặc tạo cả buổi</strong>
            <p>Slot trùng ngày và giờ bắt đầu sẽ cập nhật sức chứa. Danh sách giờ 24h giúp thao tác nhanh hơn input AM/PM.</p>
          </div>
          <div className="dw-slot-date-shortcuts" aria-label="Chọn ngày nhanh">
            {[
              { label: 'Hôm nay', value: dateValueFromOffset(0) },
              { label: 'Ngày mai', value: dateValueFromOffset(1) },
              { label: 'Sau 2 ngày', value: dateValueFromOffset(2) },
            ].map((item) => (
              <button
                type="button"
                className={slotForm.date === item.value ? 'active' : ''}
                key={item.label}
                onClick={() => setSlotForm({ ...slotForm, date: item.value })}
                disabled={!canManageSlots}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="dw-slot-copy-row">
            <label>
              Sao chép lịch ngày đang chọn sang
              <input type="date" min={addDaysToDateValue(slotForm.date, 1)} value={copyTargetDate} onChange={(event) => setCopyTargetDate(event.target.value)} disabled={!canSubmitSlot || busyId === 'copy-day'} />
            </label>
            <button type="button" disabled={!canSubmitSlot || busyId === 'copy-day'} onClick={copyDaySlots}>
              {busyId === 'copy-day' ? 'Đang sao chép...' : 'Sao chép sang ngày này'}
            </button>
          </div>
          <div className="dw-session-buttons" aria-label="Chọn ca khám nhanh">
            {SLOT_SESSION_PRESETS.map((preset) => (
              <button type="button" key={preset.id} onClick={() => applyPreset(preset)} disabled={!canSubmitSlot}>
                <strong>{preset.label}</strong>
                <span>{preset.startTime} - {preset.endTime}</span>
              </button>
            ))}
          </div>
          {slotSetupBlocked ? (
            <div className="dw-inline-warning">
              <strong>Chưa có chuyên khoa được duyệt</strong>
              <span>Cập nhật hồ sơ cơ sở và chờ admin duyệt chuyên khoa trước khi mở khung giờ.</span>
            </div>
          ) : null}
          {isFacilityWorkspace && facilitySpecialties.length ? (
            <label>
              Chuyên khoa
              <select
                value={selectedSpecialtyId}
                onChange={(event) => {
                  const nextSpecialty = facilitySpecialties.find((specialty) => specialty.id === event.target.value);
                  setSlotForm({
                    ...slotForm,
                    specialtyId: event.target.value,
                    consultationFee: isHospitalWorkspace ? findServiceFeeForSpecialty(operations?.services || [], nextSpecialty) : slotForm.consultationFee,
                  });
                }}
                disabled={!canManageSlots || !facilitySpecialties.length}
                required
              >
                {facilitySpecialties.map((specialty) => (
                  <option value={specialty.id} key={specialty.id}>{specialty.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          {isHospitalWorkspace ? (
            <label className="dw-slot-fee-field">
              Tiền khám chưa BHYT
              <input
                type="number"
                min="1000"
                step="1000"
                inputMode="numeric"
                value={slotForm.consultationFee}
                onChange={(event) => setSlotForm({ ...slotForm, consultationFee: digitsOnly(event.target.value) })}
                placeholder="Ví dụ: 180000"
                disabled={!canManageSlots}
                required
              />
              <small>Giá này dùng để bệnh nhân thanh toán trước; BHYT thường sẽ tính giảm sau.</small>
            </label>
          ) : null}
          <label>
            Ngày khám
            <input type="date" min={todayValue()} value={slotForm.date} onChange={(event) => setSlotForm({ ...slotForm, date: event.target.value })} disabled={!canManageSlots} required />
          </label>
          <label>
            Bắt đầu
            <select value={slotForm.startTime} onChange={(event) => updateStartTime(event.target.value)} disabled={!canManageSlots} required>
              {TIME_OPTIONS.map((time) => <option value={time} key={time}>{time}</option>)}
            </select>
          </label>
          <label>
            Kết thúc
            <select value={slotForm.endTime} onChange={(event) => updateEndTime(event.target.value)} disabled={!canManageSlots} required>
              {TIME_OPTIONS.map((time) => <option value={time} key={time}>{time}</option>)}
            </select>
          </label>
          <label>
            Thời lượng
            <select value={durationMinutes} onChange={(event) => updateDuration(Number(event.target.value))} disabled={!canManageSlots} required>
              {DURATION_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label>
            Sức chứa
            <div className="dw-capacity-stepper">
              <button type="button" onClick={() => updateCapacity(Number(slotForm.capacity) - 1)} disabled={!canManageSlots}>-</button>
              <input type="number" min="1" max="100" value={slotForm.capacity} onChange={(event) => updateCapacity(event.target.value)} disabled={!canManageSlots} required />
              <button type="button" onClick={() => updateCapacity(Number(slotForm.capacity) + 1)} disabled={!canManageSlots}>+</button>
            </div>
          </label>
          <button type="submit" disabled={!canSubmitSlot || busyId === 'new-slot'}>{busyId === 'new-slot' ? 'Đang lưu...' : editingSlotId ? 'Cập nhật khung giờ' : 'Tạo khung giờ'}</button>
          {editingSlotId ? (
            <button type="button" onClick={cancelEditSlot} disabled={busyId === 'new-slot'}>Hủy sửa</button>
          ) : null}
        </form>
        {message ? <p className={message.includes('Đã') ? 'dw-form-alert neutral' : 'dw-form-alert'}>{message}</p> : null}
        <div className="dw-slot-list upgraded">
          <header>
            <div>
              <span>Giờ khám đã tạo</span>
              <strong>{sortedSlots.length ? `${sortedSlots.length} khung giờ sắp tới` : 'Chưa có khung giờ'}</strong>
            </div>
          </header>
          {sortedSlots.slice(0, 18).map((slot) => (
            <article key={slot.id}>
              <div>
                <strong>{slot.date}</strong>
                <span>{slot.specialtyName ? `${slot.specialtyName} · ` : ''}{slot.startTime} - {slot.endTime}</span>
              </div>
              <div>
                <strong>{slot.availableCount}</strong>
                <span>còn trống / {slot.capacity}</span>
              </div>
              <button type="button" disabled={!canManageSlots || Boolean(busyId)} onClick={() => editSlot(slot)}>
                Sửa
              </button>
              <button type="button" disabled={!canManageSlots || busyId === slot.id} onClick={() => toggleSlot(slot)}>
                {slot.isActive ? 'Khóa slot' : 'Mở lại'}
              </button>
              <button type="button" disabled={!canManageSlots || slot.bookedCount > 0 || busyId === `delete-${slot.id}`} onClick={() => deleteSlot(slot)}>
                {busyId === `delete-${slot.id}` ? 'Đang xóa...' : 'Xóa'}
              </button>
            </article>
          ))}
          {!sortedSlots.length ? (
            <EmptyState
              status={workspace?.status}
              title={canManageSlots ? 'Chưa có giờ khám' : 'Chưa mở được giờ khám'}
              text={canManageSlots ? 'Chọn mẫu giờ nhanh hoặc nhập giờ thủ công để bệnh nhân có thể đặt lịch.' : lockedReason || 'Dữ liệu vận hành chưa sẵn sàng.'}
              getStatusLabel={getStatusLabel}
            />
          ) : null}
        </div>
        {deleteTarget ? (
          <div className="dw-slot-delete-backdrop" role="presentation" onMouseDown={() => busyId ? null : setDeleteTarget(null)}>
            <div className="dw-slot-delete-modal" role="dialog" aria-modal="true" aria-labelledby="dw-slot-delete-title" onMouseDown={(event) => event.stopPropagation()}>
              <header>
                <span>Xác nhận xóa</span>
                <h2 id="dw-slot-delete-title">Xóa khung giờ khám?</h2>
              </header>
              <section>
                <strong>{displayDate(deleteTarget.date)} · {deleteTarget.startTime} - {deleteTarget.endTime}</strong>
                <p>{deleteTarget.specialtyName || 'Khung giờ khám'} sẽ được gỡ khỏi danh sách đặt lịch của bệnh nhân. Thao tác này chỉ áp dụng khi slot chưa có lịch đặt.</p>
              </section>
              <footer>
                <button type="button" onClick={() => setDeleteTarget(null)} disabled={Boolean(busyId)}>Hủy</button>
                <button type="button" className="danger" onClick={confirmDeleteSlot} disabled={busyId === `delete-${deleteTarget.id}`}>
                  {busyId === `delete-${deleteTarget.id}` ? 'Đang xóa...' : 'Xóa khung giờ'}
                </button>
              </footer>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}

function AppointmentsPanel({ workspace, operations, onAppointmentStatusChange, onNavigate, getStatusLabel }) {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const [risk, setRisk] = useState('all');
  const allAppointments = operations?.appointments || [];
  const appointments = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return allAppointments
      .filter((item) => status === 'all' || item.status === status)
      .filter((item) => risk === 'all' || item.riskLevel === risk)
      .filter((item) => !normalizedKeyword || [
        item.patientName,
        item.patientPhone,
        item.ticketCode,
        item.appointmentCode,
        item.reason,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedKeyword)));
  }, [allAppointments, keyword, risk, status]);
  const appointmentStats = [
    { label: 'Chờ xác nhận', value: allAppointments.filter((item) => item.status === 'pending').length },
    { label: 'Đã xác nhận', value: allAppointments.filter((item) => item.status === 'confirmed').length },
    { label: 'Đã khám', value: allAppointments.filter((item) => item.status === 'completed').length },
    { label: 'Cần theo dõi', value: allAppointments.filter((item) => item.riskLevel !== 'low').length },
  ];
  const locked = workspace?.status !== 'approved' || !operations?.linked;

  return (
    <>
      <div className="dw-dashboard-heading compact">
        <div>
          <span>Đặt khám</span>
          <h1>Quản lý lịch hẹn</h1>
          <p>Xem lịch bệnh nhân đã đặt, xử lý lịch chờ xác nhận và chuyển nhanh sang mở khung giờ khám.</p>
        </div>
        <button type="button" className="dw-primary-command" onClick={() => onNavigate?.('lich-lam-viec')}>Mở giờ khám</button>
      </div>
      <section className="dw-appointment-summary">
        {appointmentStats.map((item) => (
          <article key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </section>
      {locked ? (
        <section className="dw-workflow-callout warning">
          <strong>{workspace?.status === 'approved' ? 'Chưa liên kết dữ liệu' : 'Hồ sơ đang chờ duyệt'}</strong>
          <p>{workspace?.status === 'approved' ? 'Workspace cần được liên kết catalog để hiển thị lịch hẹn và mở slot.' : 'Admin cần duyệt hồ sơ trước khi bác sĩ/cơ sở y tế xem dữ liệu bệnh nhân.'}</p>
          <button type="button" onClick={() => onNavigate?.('ho-so')}>Xem hồ sơ</button>
        </section>
      ) : null}
      <section className="dw-data-panel clean">
        <div className="dw-data-toolbar">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm bệnh nhân, mã phiếu hoặc số điện thoại" />
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="completed">Đã khám</option>
            <option value="cancelled">Đã hủy</option>
            <option value="no_show">Không đến</option>
          </select>
          <select value={risk} onChange={(event) => setRisk(event.target.value)}>
            <option value="all">Tất cả rủi ro</option>
            <option value="medium">Cần theo dõi</option>
            <option value="high">No-show</option>
            <option value="low">Rủi ro thấp</option>
          </select>
        </div>
      <AppointmentList appointments={appointments} workspace={workspace} onStatusChange={onAppointmentStatusChange} getStatusLabel={getStatusLabel} />
      </section>
    </>
  );
}

const EMPTY_HOUR = { label: '', time: '' };
const EMPTY_SERVICE = { name: '', description: '', fee: '' };

function displayFileSize(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function galleryImageName(value = '', index = 0) {
  const source = String(value || '');
  if (source.startsWith('data:image/')) return `Ảnh ${index + 1}`;
  const lastPart = source.split('/').filter(Boolean).pop() || `Ảnh ${index + 1}`;
  return decodeURIComponent(lastPart.split('?')[0]).slice(0, 80) || `Ảnh ${index + 1}`;
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: `${file.name}_${file.size}_${file.lastModified}`,
      url: String(reader.result || ''),
      name: file.name,
      size: file.size,
    });
    reader.onerror = () => reject(new Error(`Không thể đọc ảnh ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function hydrateHours(hours = []) {
  const rows = (hours || [])
    .map((item) => ({
      label: item?.label || '',
      time: item?.time || '',
    }))
    .filter((item) => item.label || item.time);

  return rows.length ? rows : [{ ...EMPTY_HOUR }];
}

function hydrateServices(services = []) {
  const rows = (services || [])
    .map((item) => ({
      name: item?.name || '',
      description: item?.description || '',
      fee: item?.fee || '',
    }))
    .filter((item) => item.name || item.description || item.fee);

  return rows.length ? rows : [{ ...EMPTY_SERVICE }];
}

function hydrateImages(images = []) {
  const rows = (images || [])
    .map((url, index) => {
      const value = String(url || '').trim();
      return {
        id: `saved_${index}_${value.slice(0, 32)}`,
        url: value,
        name: galleryImageName(value, index),
        size: 0,
      };
    })
    .filter((item) => item.url);

  return rows;
}

function serializeHours(hours = []) {
  return hours
    .map((item) => ({
      label: String(item.label || '').trim(),
      time: String(item.time || '').trim(),
    }))
    .filter((item) => item.label || item.time);
}

function serializeServices(services = []) {
  return services
    .map((item) => ({
      name: String(item.name || '').trim(),
      description: String(item.description || '').trim(),
      fee: String(item.fee || '').trim(),
    }))
    .filter((item) => item.name);
}

function serializeImages(images = []) {
  return images
    .map((item) => String(item.url || '').trim())
    .filter(Boolean);
}

function isUsableMapAddress(value = '') {
  const address = String(value || '').trim();
  return Boolean(address && address.length >= 12 && /\s/.test(address) && /\p{L}/u.test(address));
}

function ServicePanel({ workspace, operations, onSaveFacilityDetails, getStatusLabel }) {
  const isFacility = workspace?.mode === 'clinic' || workspace?.mode === 'hospital';
  const linkedFacility = operations?.linkedFacility || {};
  const [form, setForm] = useState({
    address: '',
    subtitle: '',
    intro: '',
    phone: '',
    hours: [{ ...EMPTY_HOUR }],
    services: [{ ...EMPTY_SERVICE }],
    images: [],
  });
  const galleryInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isDraggingGallery, setIsDraggingGallery] = useState(false);

  useEffect(() => {
    setForm({
      address: linkedFacility.address || workspace?.clinicAddress || '',
      subtitle: linkedFacility.subtitle || '',
      intro: linkedFacility.intro || '',
      phone: linkedFacility.phone || '',
      hours: hydrateHours(operations?.hours || linkedFacility.hours || []),
      services: hydrateServices(operations?.services || linkedFacility.services || []),
      images: hydrateImages(operations?.images || linkedFacility.images || []),
    });
  }, [linkedFacility.id, linkedFacility.address, linkedFacility.subtitle, linkedFacility.intro, linkedFacility.phone, workspace?.clinicAddress, operations?.hours, operations?.services, operations?.images]);

  if (!isFacility) {
    return (
      <>
        <div className="dw-dashboard-heading compact">
          <div>
            <span>Dịch vụ</span>
            <h1>Dịch vụ và lý do khám</h1>
            <p>Danh mục dịch vụ áp dụng cho phòng khám hoặc bệnh viện. Hồ sơ bác sĩ cá nhân quản lý lịch khám ở mục Khung giờ.</p>
          </div>
        </div>
        <EmptyState status={workspace?.status} title="Không áp dụng cho bác sĩ cá nhân" text="Bác sĩ độc lập có thể mở khung giờ khám và cập nhật lịch nghỉ tại mục Khung giờ." getStatusLabel={getStatusLabel} />
      </>
    );
  }

  const canSave = workspace?.status === 'approved' && operations?.linked && onSaveFacilityDetails;

  const updateHour = (index, patch) => {
    setForm((current) => ({
      ...current,
      hours: current.hours.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  };

  const updateService = (index, patch) => {
    setForm((current) => ({
      ...current,
      services: current.services.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  };

  const removeRow = (field, index, emptyRow) => {
    setForm((current) => {
      const nextRows = current[field].filter((_, itemIndex) => itemIndex !== index);
      return { ...current, [field]: nextRows.length ? nextRows : [{ ...emptyRow }] };
    });
  };

  const removeGalleryImage = (imageId) => {
    setForm((current) => ({
      ...current,
      images: current.images.filter((image) => image.id !== imageId),
    }));
  };

  const handleGalleryFiles = async (fileList) => {
    if (!canSave) return;
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const currentImages = form.images || [];
    const remainingSlots = FACILITY_GALLERY_LIMIT - currentImages.length;
    if (remainingSlots <= 0) {
      setMessage(`Chỉ được tải tối đa ${FACILITY_GALLERY_LIMIT} ảnh thư viện.`);
      return;
    }

    const accepted = [];
    const rejected = [];
    const existingKeys = new Set(currentImages.map((image) => image.id));
    files.forEach((file) => {
      const key = `${file.name}_${file.size}_${file.lastModified}`;
      if (!FACILITY_GALLERY_TYPES.has(file.type)) {
        rejected.push(`${file.name}: sai định dạng`);
        return;
      }
      if (file.size > FACILITY_GALLERY_MAX_SIZE) {
        rejected.push(`${file.name}: quá 15MB`);
        return;
      }
      if (existingKeys.has(key)) {
        rejected.push(`${file.name}: đã chọn`);
        return;
      }
      if (accepted.length >= remainingSlots) {
        rejected.push(`${file.name}: vượt quá ${FACILITY_GALLERY_LIMIT} ảnh`);
        return;
      }
      accepted.push(file);
      existingKeys.add(key);
    });

    try {
      const nextImages = await Promise.all(accepted.map(readImageFile));
      setForm((current) => ({
        ...current,
        images: [...current.images, ...nextImages].slice(0, FACILITY_GALLERY_LIMIT),
      }));
      setMessage(rejected.length ? `Một số ảnh không được thêm: ${rejected.join('; ')}.` : '');
    } catch (error) {
      setMessage(error.message || 'Không thể tải ảnh thư viện.');
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (!canSave) return;
    if (!isUsableMapAddress(form.address)) {
      setMessage('Vui lòng nhập địa chỉ đầy đủ, ví dụ: 1B Nguyễn Xí, Bình Lợi Trung, TP.HCM.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await onSaveFacilityDetails({
        address: form.address,
        subtitle: form.subtitle,
        intro: form.intro,
        phone: form.phone,
        hours: serializeHours(form.hours),
        services: serializeServices(form.services),
        images: serializeImages(form.images),
      });
      setMessage('Đã cập nhật thông tin hiển thị trên trang bệnh nhân.');
    } catch (error) {
      setMessage(error.message || 'Không thể cập nhật trang hiển thị.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="dw-dashboard-heading compact">
        <div>
          <span>Trang bệnh nhân</span>
          <h1>Dịch vụ, giới thiệu và giờ làm việc</h1>
          <p>Những thông tin này hiển thị ở thẻ ngoài trang đặt khám, trang chi tiết phòng khám/bệnh viện và luồng bệnh nhân chọn dịch vụ.</p>
        </div>
      </div>
      <form className="dw-facility-public-form" onSubmit={save}>
        <label className="wide">
          Địa chỉ hiển thị trên bản đồ
          <input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Nhập địa chỉ đầy đủ để bệnh nhân mở Google Maps đúng nơi" disabled={!canSave} />
        </label>
        <label>
          Mô tả ngắn ngoài thẻ
          <input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} placeholder="Ví dụ: Phòng khám Sản - Nhi, Tai Mũi Họng" disabled={!canSave} />
        </label>
        <label>
          Số điện thoại/hotline
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Số điện thoại hiển thị cho bệnh nhân" disabled={!canSave} />
        </label>
        <label className="wide">
          Giới thiệu
          <textarea value={form.intro} onChange={(event) => setForm({ ...form, intro: event.target.value })} rows={5} placeholder="Mô tả cơ sở, thế mạnh chuyên môn, quy trình tiếp nhận..." disabled={!canSave} />
        </label>
        <section className="dw-structured-field wide">
          <header>
            <strong>Giờ làm việc</strong>
            <button type="button" onClick={() => setForm((current) => ({ ...current, hours: [...current.hours, { ...EMPTY_HOUR }] }))} disabled={!canSave}>+ Thêm khung giờ</button>
          </header>
          <div className="dw-structured-list">
            {form.hours.map((item, index) => (
              <div className="dw-hours-row" key={`hour-${index}`}>
                <label>
                  Ngày hoặc buổi
                  <input value={item.label} onChange={(event) => updateHour(index, { label: event.target.value })} placeholder="Thứ 2 - Thứ 6" disabled={!canSave} />
                </label>
                <label>
                  Thời gian
                  <input value={item.time} onChange={(event) => updateHour(index, { time: event.target.value })} placeholder="07:30 - 17:00 hoặc Theo lịch hẹn" disabled={!canSave} />
                </label>
                <button type="button" onClick={() => removeRow('hours', index, EMPTY_HOUR)} disabled={!canSave} aria-label="Xóa khung giờ">×</button>
              </div>
            ))}
          </div>
        </section>
        <section className="dw-structured-field wide">
          <header>
            <strong>Dịch vụ đặt khám</strong>
            <button type="button" onClick={() => setForm((current) => ({ ...current, services: [...current.services, { ...EMPTY_SERVICE }] }))} disabled={!canSave}>+ Thêm dịch vụ</button>
          </header>
          <div className="dw-structured-list">
            {form.services.map((item, index) => (
              <div className="dw-service-row" key={`service-${index}`}>
                <label>
                  Tên dịch vụ
                  <input value={item.name} onChange={(event) => updateService(index, { name: event.target.value })} placeholder="Khám tổng quát" disabled={!canSave} />
                </label>
                <label>
                  Mô tả
                  <input value={item.description} onChange={(event) => updateService(index, { description: event.target.value })} placeholder="Khám ban đầu và tư vấn sức khỏe" disabled={!canSave} />
                </label>
                <label>
                  Chi phí
                  <input value={item.fee} onChange={(event) => updateService(index, { fee: event.target.value })} placeholder="Theo bảng giá hoặc 300.000đ" disabled={!canSave} />
                </label>
                <button type="button" onClick={() => removeRow('services', index, EMPTY_SERVICE)} disabled={!canSave} aria-label="Xóa dịch vụ">×</button>
              </div>
            ))}
          </div>
        </section>
        <section className="dw-structured-field wide">
          <header>
            <strong>Ảnh thư viện</strong>
          </header>
          <button
            className={[
              'hospital-upload-box',
              'dw-gallery-upload-box',
              isDraggingGallery ? 'dragging' : '',
              form.images.length >= FACILITY_GALLERY_LIMIT ? 'full' : '',
            ].filter(Boolean).join(' ')}
            disabled={!canSave || form.images.length >= FACILITY_GALLERY_LIMIT}
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            onDragEnter={(event) => { event.preventDefault(); setIsDraggingGallery(true); }}
            onDragLeave={(event) => { event.preventDefault(); setIsDraggingGallery(false); }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              setIsDraggingGallery(false);
              handleGalleryFiles(event.dataTransfer.files);
            }}
          >
            <span>&#9633;</span>
            <strong>{form.images.length >= FACILITY_GALLERY_LIMIT ? 'Đã đủ 5 ảnh' : 'Chọn tập tin'}</strong>
            <em>hoặc kéo & thả tối đa {FACILITY_GALLERY_LIMIT} ảnh</em>
            <small>Size thấp hơn 15MB, định dạng file png, jpg.</small>
          </button>
          <input
            accept="image/png,image/jpeg"
            hidden
            multiple
            ref={galleryInputRef}
            type="file"
            onChange={(event) => {
              handleGalleryFiles(event.target.files);
              event.target.value = '';
            }}
          />
          {form.images.length ? (
            <div className="hospital-file-list dw-gallery-file-list">
              {form.images.map((image) => (
                <figure key={image.id}>
                  <img src={image.url} alt={image.name} />
                  <figcaption>
                    <strong>{image.name}</strong>
                    <small>{image.size ? displayFileSize(image.size) : 'Ảnh đã lưu'}</small>
                  </figcaption>
                  <button type="button" aria-label={`Xóa ${image.name}`} onClick={() => removeGalleryImage(image.id)} disabled={!canSave}>×</button>
                </figure>
              ))}
            </div>
          ) : null}
          <small>Ảnh đại diện chính chỉnh ở mục Hồ sơ.</small>
        </section>
        {message ? <p className={message.includes('Đã') ? 'dw-form-alert neutral' : 'dw-form-alert'}>{message}</p> : null}
        <div className="dw-facility-public-actions">
          <button type="submit" disabled={!canSave || busy}>{busy ? 'Đang lưu...' : 'Cập nhật trang bệnh nhân'}</button>
          <span>{canSave ? 'Sau khi lưu, bệnh nhân sẽ thấy dữ liệu mới khi catalog được tải lại.' : 'Hồ sơ cần được duyệt và liên kết catalog trước khi cập nhật.'}</span>
        </div>
      </form>
    </>
  );
}

function OnlineConsultPanel({ workspace, getStatusLabel }) {
  return (
    <>
      <div className="dw-dashboard-heading compact">
        <div>
          <span>Tư vấn trực tuyến</span>
          <h1>Yêu cầu tư vấn</h1>
          <p>Kênh tư vấn được tách riêng để sau này nối API video/chat.</p>
        </div>
      </div>
      <EmptyState status={workspace?.status} title="Chưa có yêu cầu tư vấn" text="Khi có yêu cầu gửi đến bác sĩ, dữ liệu sẽ hiển thị tại đây." getStatusLabel={getStatusLabel} />
    </>
  );
}

function ReportPanel({ workspace, operations }) {
  const report = operations?.report || [];

  return (
    <>
      <div className="dw-dashboard-heading compact">
        <div>
          <span>Báo cáo</span>
          <h1>Hiệu suất đặt khám</h1>
          <p>Tổng hợp lịch xác nhận, hoàn tất và hủy từ API backend.</p>
        </div>
      </div>
      <section className="dw-operation-chart clean">
        <header>
          <div>
            <span>14 ngày gần nhất</span>
            <strong>{report.length ? `${report.length} ngày có dữ liệu` : 'Chưa có dữ liệu báo cáo'}</strong>
          </div>
        </header>
        <div className="dw-report-bars">
          {(report.length ? report : Array.from({ length: 7 }, (_, index) => ({ date: `D${index + 1}`, total: 0, completed: 0 }))).map((item) => (
            <div key={item.date}>
              <i style={{ height: `${Math.max(item.total * 12, 8)}px` }} />
              <small>{String(item.date).slice(5) || item.date}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function WorkspaceDashboard({
  activeSection = 'tong-quan',
  navItems = [],
  getStatusLabel,
  displayName,
  roleLabel,
  statusLabel,
  accountEmail,
  isOperationsLoading,
  operationsMessage,
  workspace,
  operations,
  onNavigate,
  onEdit,
  onLogout,
  onHome,
  onRefresh,
  onAppointmentStatusChange,
  onSaveSlot,
  onUpdateSlot,
  onToggleSlot,
  onDeleteSlot,
  onSaveUnavailability,
  onSaveFacilityDetails,
}) {
  const allowedSection = navItems.some((item) => item.id === activeSection) ? activeSection : 'tong-quan';

  return (
    <div className="dw-live-dashboard refined">
      <aside className="dw-live-sidebar">
        <div className="dw-live-brand">
          <button className="dw-sidebar-home" type="button" onClick={onHome} aria-label="Về trang chủ MidHealth">
            <div className="dw-app-mark">M</div>
          </button>
          <div>
            <strong>{displayName}</strong>
            <span>{roleLabel}</span>
          </div>
        </div>
        <nav aria-label="Chức năng workspace">
          <b>QUẢN LÝ</b>
          {navItems.map((item) => (
            <button
              type="button"
              className={allowedSection === item.id ? 'active' : ''}
              onClick={() => onNavigate(item.id)}
              key={item.id}
            >
              <i>{item.icon}</i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="dw-sidebar-account">
          <span className={`dw-provider-status ${workspace?.status || 'pending_review'}`}>{statusLabel}</span>
          <strong>{accountEmail}</strong>
          <button type="button" onClick={onEdit}>Chỉnh sửa hồ sơ</button>
          <button type="button" onClick={onLogout}>Đăng xuất</button>
        </div>
      </aside>
      <main className="dw-live-content">
        <header className="dw-workspace-topbar">
          <div>
            <span>{new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())}</span>
            <strong>{displayName}</strong>
          </div>
          <div className={`dw-connection-state ${operations?.linked ? 'connected' : ''}`}>
            <i aria-hidden="true" />
            <span>{isOperationsLoading ? 'Đang đồng bộ dữ liệu' : operations?.linked ? 'Dữ liệu đã liên kết' : 'Chưa liên kết dữ liệu'}</span>
          </div>
        </header>
        {operationsMessage ? <div className="dw-operations-notice">{operationsMessage}</div> : null}
        {allowedSection === 'tong-quan' ? (
          <OperationsOverview
            workspace={workspace}
            operations={operations}
            onNavigate={onNavigate}
            onAppointmentStatusChange={onAppointmentStatusChange}
          />
      ) : allowedSection === 'ho-so' ? (
          <ProfilePanel workspace={workspace} operations={operations} onEdit={onEdit} />
      ) : allowedSection === 'lich-lam-viec' ? (
          <SchedulePanel workspace={workspace} operations={operations} onSaveSlot={onSaveSlot} onUpdateSlot={onUpdateSlot} onToggleSlot={onToggleSlot} onDeleteSlot={onDeleteSlot} onSaveUnavailability={onSaveUnavailability} getStatusLabel={getStatusLabel} />
      ) : allowedSection === 'lich-hen' ? (
          <AppointmentsPanel workspace={workspace} operations={operations} onAppointmentStatusChange={onAppointmentStatusChange} onRefresh={onRefresh} onNavigate={onNavigate} getStatusLabel={getStatusLabel} />
        ) : allowedSection === 'dich-vu' ? (
          <ServicePanel workspace={workspace} operations={operations} onSaveFacilityDetails={onSaveFacilityDetails} getStatusLabel={getStatusLabel} />
        ) : allowedSection === 'tu-van' ? (
          <OnlineConsultPanel workspace={workspace} getStatusLabel={getStatusLabel} />
        ) : (
          <ReportPanel workspace={workspace} operations={operations} />
        )}
      </main>
    </div>
  );
}

export {
  DashboardPreview,
  WorkspaceBrand,
  WorkspaceDashboard,
};
