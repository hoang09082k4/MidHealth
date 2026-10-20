import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiBaseUrl } from '../../lib/api_base';
import { catalogCacheKey } from '../../lib/catalog';
import './doctor_workspace.css';

async function request(user, path, options = {}) {
  let tokenTimer;
  let token;
  try {
    token = await Promise.race([
      user.getIdToken(),
      new Promise((_, reject) => { tokenTimer = window.setTimeout(() => reject(new Error('Xác thực đang phản hồi chậm. Hãy thử tải lại.')), 20000); }),
    ]);
  } finally { window.clearTimeout(tokenTimer); }
  const controller = new AbortController();
  const fetchTimer = window.setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
    });
  } catch (cause) {
    throw new Error(controller.signal.aborted
      ? 'Máy chủ phản hồi quá lâu. Hãy kiểm tra kết nối rồi thử tải lại.'
      : 'Không kết nối được máy chủ. Hãy kiểm tra mạng rồi thử tải lại.');
  } finally { window.clearTimeout(fetchTimer); }
  const payload = await response.json().catch(() => ({}));
  if (response.status === 404 && path.startsWith('/api/doctor/department/')) {
    throw new Error('Backend đang chạy chưa có API điều phối khoa. Cần cập nhật và khởi động lại backend cùng phiên bản với giao diện.');
  }
  if (!response.ok) throw new Error(payload.message || 'Không thể kết nối phòng khám.');
  return payload.data;
}

const today = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const clinicTime = () => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).format(new Date());
const addDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const displayDate = date => date?.split('-').reverse().join('/') || '—';
const displayDateTime = value => value ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';
const displayFee = fee => fee == null ? 'Chưa cập nhật' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(fee);
const time = value => String(value || '').slice(0, 5);
const statusLabels = { pending: 'Chờ thanh toán cọc', confirmed: 'Đã xác nhận', completed: 'Đã khám', cancelled: 'Đã hủy', no_show: 'Không đến' };
const tabs = [
  ['overview', 'Tổng quan', 'tong-quan'],
  ['appointments', 'Lịch hẹn', 'lich-hen'],
  ['schedule', 'Khung giờ', 'lich-lam-viec'],
  ['coordination', 'Điều phối khoa', 'dieu-phoi'],
  ['services', 'Dịch vụ', 'dich-vu'],
  ['profile', 'Hồ sơ', 'ho-so'],
  ['reports', 'Báo cáo', 'bao-cao'],
];
const departmentTaskStatuses = { open: 'Mới', in_progress: 'Đang làm', blocked: 'Đang vướng', done: 'Hoàn tất' };
const departmentTaskCategories = { coordination: 'Điều phối', handoff: 'Bàn giao ca', quality: 'Cải tiến chất lượng', safety: 'An toàn người bệnh', complaint: 'Phản hồi người bệnh' };
const departmentTaskPriorities = { low: 'Thấp', normal: 'Thường', high: 'Cao', urgent: 'Khẩn' };
const auditEventLabels = { 'department_task.created': 'Tạo công việc', 'department_task.status_changed': 'Đổi trạng thái công việc', 'schedule.slot_created': 'Mở khung giờ', 'schedule.slot_updated': 'Sửa khung giờ', 'schedule.slot_closed': 'Đóng khung giờ', 'clinical.visit_finalized': 'Hoàn tất lượt khám', 'clinical.note_addendum_added': 'Bổ sung hồ sơ', 'clinical.specialty_exam_recorded': 'Ghi kết quả chuyên khoa' };
const tabFromPath = () => tabs.find(([, , slug]) => window.location.pathname.replace(/\/+$/, '').endsWith(`/${slug}`))?.[0] || 'overview';
const newSlot = () => ({ date: addDays(today(), 1), startTime: '07:30', endTime: '08:00', capacity: 1 });
const newNote = () => ({ symptoms: '', summary: '', diagnosis: '', carePlan: '', followUp: '', nextSpecialtyId: '', nextSlotId: '', medicines: [], materials: [], allergiesReviewed: false,
  chiefComplaint: '', history: '', bloodPressure: '', pulse: '', temperature: '', oxygenSaturation: '', examination: '', assessment: '', patientInstructions: '', expectedUpdatedAt: null,
  healthProfile: { medicalHistory: '', allergyStatus: '', allergies: '', bloodGroup: '', bloodGroupSource: '', bloodGroupEvidence: '' },
});
const specialtyNoteFromEncounter = encounter => ({ ...newNote(), ...(encounter.specialtyResult?.details || {}), symptoms: encounter.specialtyResult?.details?.symptoms || encounter.symptoms || '', diagnosis: encounter.specialtyResult?.details?.diagnosis || encounter.provisional_diagnosis || '', expectedUpdatedAt: encounter.specialtyResult?.createdAt || null });
const doctorForm = doctor => ({
  title: doctor.title || '', intro: doctor.intro || '', shortDescription: doctor.short_description || '',
  workplace: doctor.workplace_text || '', yearsExperience: doctor.years_experience ?? '',
  contactEmail: doctor.contact_email || '', contactPhone: doctor.contact_phone || '',
  education: doctor.education || '', expertise: doctor.expertise || '', image: doctor.avatar_url || '',
});
const validRange = (from, to, maxDays) => from && to && from <= to && (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 <= maxDays;
const timeSuggestions = Array.from({ length: 65 }, (_, index) => {
  const minutes = 6 * 60 + index * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});
const normalizeTimeInput = value => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let hour, minute;
  if (raw.includes(':')) {
    const parts = raw.split(':');
    if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[0]) || !/^\d{1,2}$/.test(parts[1])) return raw;
    [hour, minute] = parts;
  } else {
    const digits = raw.replace(/\D/g, '');
    if (digits.length <= 2) { hour = digits; minute = '00'; }
    else if (digits.length === 3) { hour = digits.slice(0, 1); minute = digits.slice(1); }
    else if (digits.length === 4) { hour = digits.slice(0, 2); minute = digits.slice(2); }
    else return raw;
  }
  const hours = Number(hour), minutes = Number(minute);
  if (hours > 23 || minutes > 59) return raw;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
const validClock = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

function TimeField({ id, label, value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const fieldRef = useRef(null);
  const toggleRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = event => { if (!fieldRef.current?.contains(event.target)) setOpen(false); };
    const onKeyDown = event => {
      if (event.key === 'Escape') { setOpen(false); toggleRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);
  const suggestionId = `${id}-suggestions`;
  return <div className="doctor-time-field" ref={fieldRef}>
    <label htmlFor={`${id}-input`}>{label}</label>
    <div className="doctor-time-control">
      <input id={`${id}-input`} required type="text" inputMode="numeric" autoComplete="off" maxLength={5} placeholder="08:00" disabled={disabled} value={value} onChange={event => onChange(event.target.value.replace(/[^\d:]/g, '').slice(0, 5))} onBlur={event => onChange(normalizeTimeInput(event.target.value))} />
      <button ref={toggleRef} className="doctor-time-picker-toggle" type="button" aria-label={`${open ? 'Ẩn' : 'Mở'} gợi ý giờ ${label.toLocaleLowerCase('vi')}`} aria-expanded={open} aria-controls={suggestionId} disabled={disabled} onClick={() => setOpen(current => !current)}>
        <svg aria-hidden="true" viewBox="0 0 20 20"><circle cx="10" cy="10" r="7.2" /><path d="M10 5.8v4.6l3 1.8" /></svg>
      </button>
      {open && <div id={suggestionId} className="doctor-time-suggestions" role="group" aria-label={`Gợi ý giờ ${label.toLocaleLowerCase('vi')}`}>
        <strong>Chọn nhanh · mỗi 15 phút</strong>
        <div>{timeSuggestions.map(timeValue => <button key={timeValue} type="button" aria-pressed={value === timeValue} className={value === timeValue ? 'selected' : ''} onClick={() => { onChange(timeValue); setOpen(false); document.getElementById(`${id}-input`)?.focus(); }}>{timeValue}</button>)}</div>
      </div>}
    </div>
  </div>;
}

function ReportStats({ data }) {
  const values = [
    ['Tổng lịch hẹn', data.total],
    ['Đã tiếp nhận', data.checkedIn],
    ['Đã khám', data.byStatus?.completed],
    ['Chờ xác nhận', data.byStatus?.pending],
    ['Đã xác nhận', data.byStatus?.confirmed],
    ['Đã hủy', data.byStatus?.cancelled],
    ['Không đến', data.byStatus?.no_show],
  ];
  return <div className="doctor-stat-grid">{values.map(([label, value]) => <div className="doctor-stat" key={label}><strong>{value ?? 0}</strong><span>{label}</span></div>)}</div>;
}

function ReportBreakdown({ title, rows = [], unit, nameHeader }) {
  const activityRows = rows.some(row => row.appointments != null || row.encounters != null);
  const hasDuration = rows.some(row => row.avgMinutes != null);
  return <section className="doctor-report-breakdown">
    <h3>{title}</h3>
    {rows.length ? <div className="doctor-report-table-wrap"><table className="doctor-report-table"><thead><tr><th>{nameHeader || (activityRows ? 'Bác sĩ' : 'Tên')}</th><th>{activityRows ? 'Lượt khám' : 'Dòng ghi nhận'}</th><th>{activityRows ? 'Đã hoàn tất' : `Số lượng${unit ? ` (${unit})` : ''}`}</th>{hasDuration && <th>Thời gian TB (phút)</th>}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.name || row.date}-${index}`}><th scope="row">{row.name || (row.date ? displayDate(row.date) : '—')}</th><td>{row.encounters ?? row.appointments ?? row.items ?? 0}</td><td>{row.completed ?? row.quantity ?? 0}</td>{hasDuration && <td>{row.avgMinutes ?? '—'}</td>}</tr>)}</tbody></table></div> : <p>Chưa có dữ liệu trong giai đoạn này.</p>}
  </section>;
}

export default function DoctorWorkspace({ user, onLogout }) {
  const [tab, setTab] = useState(tabFromPath);
  const [date, setDate] = useState(today);
  const [workspace, setWorkspace] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [schedule, setSchedule] = useState(null);
  const [departmentDoctors, setDepartmentDoctors] = useState([]);
  const [departmentOperations, setDepartmentOperations] = useState(null);
  const [departmentTasksRevision, setDepartmentTasksRevision] = useState(0);
  const [departmentTaskForm, setDepartmentTaskForm] = useState(() => ({ title: '', description: '', category: 'coordination', priority: 'normal', assigneeId: '', dueDate: addDays(today(), 7) }));
  const [departmentTasksLoading, setDepartmentTasksLoading] = useState(false);
  const [departmentTasksError, setDepartmentTasksError] = useState('');
  const [scheduleDoctorId, setScheduleDoctorId] = useState('');
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleRange, setScheduleRange] = useState(() => ({ from: today(), to: addDays(today(), 30) }));
  const [upcomingSlots, setUpcomingSlots] = useState([]);
  const [upcomingError, setUpcomingError] = useState('');
  const [clinic, setClinic] = useState(null);
  const [dailyReport, setDailyReport] = useState(null);
  const [report, setReport] = useState(null);
  const [departmentReport, setDepartmentReport] = useState(null);
  const [reportError, setReportError] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportRange, setReportRange] = useState(() => ({ from: addDays(today(), -29), to: today() }));
  const [reportRevision, setReportRevision] = useState(0);
  const [slotsRevision, setSlotsRevision] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [visit, setVisit] = useState(null);
  const [visitError, setVisitError] = useState('');
  const [referralSlots, setReferralSlots] = useState([]);
  const [referralSlotsLoading, setReferralSlotsLoading] = useState(false);
  const [addendumVisit, setAddendumVisit] = useState(null);
  const [addendumText, setAddendumText] = useState('');
  const [addendumError, setAddendumError] = useState('');
  const [note, setNote] = useState(newNote);
  const [slot, setSlot] = useState(newSlot);
  const [profile, setProfile] = useState(null);
  const [profileImage, setProfileImage] = useState('');
  const [keyword, setKeyword] = useState('');
  const [keywordDraft, setKeywordDraft] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [appointmentPage, setAppointmentPage] = useState(1);
  const loadSequence = useRef(0);
  const scheduleSequence = useRef(0);
  const slotFormRef = useRef(null);

  const selectTab = useCallback(next => {
    setTab(next);
    const slug = tabs.find(([key]) => key === next)?.[2];
    if (slug) {
      const path = `/danh-cho-bac-si/${slug}`;
      if (window.location.pathname !== path) window.history.pushState({}, '', path);
    }
  }, []);
  useEffect(() => {
    const onPopState = () => setTab(tabFromPath());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const loadWorkspace = useCallback(async () => {
    const sequence = ++loadSequence.current;
    setWorkspaceLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ date, page: String(appointmentPage), status: statusFilter, search: keyword });
      const data = await request(user, `/api/doctor/workspace?${params}`);
      if (sequence !== loadSequence.current) return;
      setWorkspace(data);
      setProfile(current => current ?? doctorForm(data.doctor));
    } catch (cause) {
      if (sequence === loadSequence.current) setError(cause.message);
    } finally {
      if (sequence === loadSequence.current) setWorkspaceLoading(false);
    }
  }, [user, date, appointmentPage, statusFilter, keyword]);
  useEffect(() => {
    loadWorkspace();
    return () => { loadSequence.current += 1; };
  }, [loadWorkspace]);

  const loadSchedule = useCallback(async () => {
    const sequence = ++scheduleSequence.current;
    if (!validRange(scheduleRange.from, scheduleRange.to, 93)) {
      setSchedule(null);
      setScheduleError('Chọn khoảng ngày hợp lệ, tối đa 93 ngày.');
      setScheduleLoading(false);
      return;
    }
    setScheduleLoading(true);
    setSchedule(null);
    setScheduleError('');
    try {
      const doctorParam = workspace?.role === 'head' && scheduleDoctorId ? `&doctorId=${scheduleDoctorId}` : '';
      const data = await request(user, `/api/doctor/slots?from=${scheduleRange.from}&to=${scheduleRange.to}${doctorParam}`);
      if (sequence === scheduleSequence.current) setSchedule(data);
    } catch (cause) {
      if (sequence === scheduleSequence.current) setScheduleError(cause.message);
    } finally {
      if (sequence === scheduleSequence.current) setScheduleLoading(false);
    }
  }, [user, scheduleRange.from, scheduleRange.to, workspace?.role, scheduleDoctorId]);
  useEffect(() => {
    if (workspace?.role !== 'head') return;
    request(user, '/api/doctor/department-doctors').then(data => {
      setDepartmentDoctors(data.doctors || []);
      setScheduleDoctorId(current => current || workspace.doctor.id);
    }).catch(cause => setScheduleError(cause.message));
  }, [user, workspace?.role, workspace?.doctor?.id]);
  useEffect(() => {
    loadSchedule();
    return () => { scheduleSequence.current += 1; };
  }, [loadSchedule, slotsRevision]);

  useEffect(() => {
    let active = true;
    request(user, '/api/clinic').then(data => { if (active) setClinic(data); }).catch(() => {});
    return () => { active = false; };
  }, [user]);
  useEffect(() => {
    if (tab !== 'services') return undefined;
    let active = true;
    setUpcomingSlots([]);
    setUpcomingError('');
    request(user, `/api/doctor/slots?from=${today()}&to=${addDays(today(), 30)}`)
      .then(data => { if (active) setUpcomingSlots((data.slots || []).filter(item => item.is_active && (item.slot_date > today() || (item.slot_date === today() && time(item.start_time) > clinicTime())))); })
      .catch(cause => { if (active) setUpcomingError(cause.message); });
    return () => { active = false; };
  }, [user, tab, slotsRevision]);

  useEffect(() => {
    if ((tab !== 'overview' && tab !== 'reports') || workspace?.role === 'head') return undefined;
    const isOverview = tab === 'overview';
    const from = isOverview ? date : reportRange.from;
    const to = isOverview ? date : reportRange.to;
    if (!validRange(from, to, 365)) {
      setReportError('Chọn khoảng ngày hợp lệ, tối đa 366 ngày.');
      return undefined;
    }
    let active = true;
    setReportError('');
    setReportLoading(true);
    if (isOverview) setDailyReport(null);
    else setReport(null);
    request(user, `/api/doctor/report?from=${from}&to=${to}`)
      .then(data => { if (active) { if (isOverview) setDailyReport(data); else setReport(data); } })
      .catch(cause => { if (active) setReportError(cause.message); })
      .finally(() => { if (active) setReportLoading(false); });
    return () => { active = false; };
  }, [user, tab, date, reportRange.from, reportRange.to, reportRevision, workspace?.role]);

  useEffect(() => {
    if (workspace?.role !== 'head' || (tab !== 'reports' && tab !== 'overview')) return undefined;
    let active = true;
    const from = tab === 'overview' ? date : reportRange.from;
    const to = tab === 'overview' ? date : reportRange.to;
    request(user, `/api/reports/clinic?from=${from}&to=${to}`)
      .then(data => { if (active) setDepartmentReport(data); })
      .catch(cause => { if (active) setReportError(cause.message); });
    return () => { active = false; };
  }, [user, workspace?.role, tab, date, reportRange.from, reportRange.to, reportRevision]);

  useEffect(() => {
    if (visit?.mode !== 'specialist' || !note.nextSpecialtyId) {
      setReferralSlots([]);
      setReferralSlotsLoading(false);
      return undefined;
    }
    let active = true;
    setReferralSlots([]);
    setReferralSlotsLoading(true);
    request(user, `/api/doctor/referral-slots?specialtyId=${encodeURIComponent(note.nextSpecialtyId)}&date=${encodeURIComponent(visit.appointment_date)}`)
      .then(data => { if (active) setReferralSlots(data.slots || []); })
      .catch(cause => { if (active) { setReferralSlots([]); setVisitError(cause.message); } })
      .finally(() => { if (active) setReferralSlotsLoading(false); });
    return () => { active = false; };
  }, [user, visit?.mode, visit?.appointment_date, note.nextSpecialtyId]);

  useEffect(() => {
    if (workspace?.role !== 'head' || tab !== 'coordination') return undefined;
    let active = true;
    setDepartmentTasksLoading(true);
    setDepartmentTasksError('');
    request(user, '/api/doctor/department/tasks')
      .then(data => { if (active) setDepartmentOperations(data); })
      .catch(cause => { if (active) setDepartmentTasksError(cause.message); })
      .finally(() => { if (active) setDepartmentTasksLoading(false); });
    return () => { active = false; };
  }, [user, workspace?.role, tab, departmentTasksRevision]);

  useEffect(() => {
    if (keywordDraft === keyword) return undefined;
    const timeout = window.setTimeout(() => { setAppointmentPage(1); setKeyword(keywordDraft); }, 250);
    return () => window.clearTimeout(timeout);
  }, [keywordDraft, keyword]);

  const appointments = workspace?.appointments || [];
  const filteredAppointments = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase('vi');
    return appointments.filter(item => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (!query) return true;
      const code = item.queue_tickets?.[0]?.appointment_code || '';
      return [item.patient_name, item.patient_phone, code].some(value => String(value || '').toLocaleLowerCase('vi').includes(query));
    });
  }, [appointments, keyword, statusFilter]);
  const slots = schedule?.slots || [];

  function invalidateCatalog() {
    try { window.sessionStorage.removeItem(catalogCacheKey); } catch { /* Private browsing may disable storage. */ }
    window.dispatchEvent(new Event('midhealth:catalog-updated'));
  }
  async function saveAddendum(event) {
    event.preventDefault();
    const content = addendumText.trim();
    if (content.length < 10) { setAddendumError('Nhập nội dung bổ sung tối thiểu 10 ký tự.'); return; }
    setBusy(true); setAddendumError(''); setNotice('');
    try {
      await request(user, `/api/doctor/appointments/${addendumVisit.id}/addenda`, { method: 'POST', body: JSON.stringify({ content }) });
      setNotice('Đã lưu ghi chú bổ sung vào lịch sử hồ sơ.');
      setAddendumVisit(null); setAddendumText('');
      await loadWorkspace();
    } catch (cause) { setAddendumError(cause.message); }
    finally { setBusy(false); }
  }
  async function saveVisit(event) {
    event.preventDefault();
    const isSpecialistVisit = ['specialist', 'specialist_edit', 'details_retry', 'profile_retry'].includes(visit.mode);
    const isSpecialistEdit = visit.mode === 'specialist_edit';
    const healthProfile = note.healthProfile || {};
    const healthProfilePayload = {
      medicalHistory: healthProfile.medicalHistory || '', allergyStatus: healthProfile.allergyStatus || 'keep',
      allergies: healthProfile.allergies || '', bloodGroup: healthProfile.bloodGroup || '',
      bloodGroupSource: healthProfile.bloodGroupSource || '', bloodGroupEvidence: healthProfile.bloodGroupEvidence || '',
    };
    const hasHealthProfileChanges = Boolean(healthProfilePayload.medicalHistory.trim()
      || healthProfilePayload.allergyStatus !== 'keep' || healthProfilePayload.bloodGroup);
    if (visit.mode === 'profile_retry' && !hasHealthProfileChanges) {
      setVisitError('Không còn thông tin để cập nhật. Hãy nhập lại dữ liệu cần lưu hoặc chọn bỏ qua cập nhật hồ sơ.'); return;
    }
    if (['specialist', 'specialist_edit', 'details_retry'].includes(visit.mode) && (note.symptoms.trim().length < 5 || note.diagnosis.trim().length < 2)) {
      setVisitError('Cần nhập triệu chứng và chẩn đoán tạm thời.'); return;
    }
    if (visit.mode === 'specialist' && note.nextSpecialtyId && !note.nextSlotId) {
      setVisitError('Chọn bác sĩ và khung giờ còn sức chứa để chuyển bệnh nhân.'); return;
    }
    if (visit.mode === 'final' && note.medicines.length && !note.allergiesReviewed) {
      setVisitError('Xác nhận đã rà soát dị ứng và tiền sử thuốc trước khi kê đơn.'); return;
    }
    if (visit.mode === 'final' && (note.summary.trim().length < 10 || note.diagnosis.trim().length < 2 || note.carePlan.trim().length < 10)) {
      setVisitError('Nhập tối thiểu 10 ký tự cho tóm tắt và hướng dẫn, 2 ký tự cho kết luận.');
      return;
    }
    setBusy(true); setVisitError(''); setError(''); setNotice('');
    try {
      if (visit.mode === 'specialist') {
        await request(user, `/api/doctor/encounters/${visit.encounter.id}/result`, { method: 'POST', body: JSON.stringify({ symptoms: note.symptoms, diagnosis: note.diagnosis, nextSpecialtyId: note.nextSpecialtyId || null, nextSlotId: note.nextSlotId || null, materials: note.materials }) });
      }
      if (['specialist', 'specialist_edit', 'details_retry'].includes(visit.mode)) {
        try {
          const details = Object.fromEntries(['chiefComplaint','symptoms','history','bloodPressure','pulse','temperature','oxygenSaturation','examination','diagnosis','assessment','carePlan','patientInstructions','followUp'].map(key => [key, note[key] || '']));
          await request(user, `/api/doctor/encounters/${visit.encounter.id}/result-details`, { method: 'POST', body: JSON.stringify({ ...details, expectedUpdatedAt: note.expectedUpdatedAt || null, editMode: isSpecialistEdit }) });
        } catch (cause) {
          setVisit(current => current ? { ...current, mode: 'details_retry' } : current);
          setVisitError(`Kết quả khám cơ bản đã lưu. Chưa lưu được nội dung chi tiết: ${cause.message} Có thể thử lại mà không ghi lặp lượt khám.`);
          return;
        }
      }
      if (isSpecialistVisit && !isSpecialistEdit && hasHealthProfileChanges) {
        try {
          await request(user, `/api/doctor/encounters/${visit.encounter.id}/patient-health-profile`, { method: 'POST', body: JSON.stringify(healthProfilePayload) });
        } catch (cause) {
          setVisit(current => current ? { ...current, mode: 'profile_retry' } : current);
          setVisitError(`Kết quả khám đã lưu. Cập nhật hồ sơ sức khỏe chưa thành công: ${cause.message} Hãy thử lại; kết quả khám sẽ không bị lưu lặp.`);
          return;
        }
      }
      if (!isSpecialistVisit) {
        await request(user, `/api/doctor/appointments/${visit.id}/complete`, { method: 'POST', body: JSON.stringify(note) });
      }
      setVisit(null); setNote(newNote());
      setNotice(isSpecialistVisit ? (isSpecialistEdit ? 'Đã cập nhật kết quả khám. Lịch sử chỉnh sửa được lưu.' : hasHealthProfileChanges ? 'Đã lưu kết quả khám và cập nhật hồ sơ sức khỏe của người bệnh.' : note.nextSlotId ? 'Đã lưu kết quả và chuyển bệnh nhân vào khung giờ chuyên khoa đã chọn.' : 'Đã lưu kết quả chuyên khoa, không cần chuyển tiếp.') : 'Đã hoàn tất hồ sơ và lưu đơn thuốc.');
      setReportRevision(value => value + 1);
      await loadWorkspace();
    } catch (cause) { setVisitError(cause.message); }
    finally { setBusy(false); }
  }
  async function saveSlot(event) {
    event.preventDefault();
    const startTime = normalizeTimeInput(slot.startTime);
    const endTime = normalizeTimeInput(slot.endTime);
    if (!validClock(startTime) || !validClock(endTime)) { setError('Nhập giờ hợp lệ theo định dạng 24 giờ, ví dụ 08:00 hoặc 0800.'); return; }
    const normalizedSlot = { ...slot, startTime, endTime };
    if (startTime !== slot.startTime || endTime !== slot.endTime) setSlot(current => ({ ...current, startTime, endTime }));
    if (endTime <= startTime) { setError('Giờ kết thúc phải sau giờ bắt đầu.'); return; }
    if (normalizedSlot.date < today() || (normalizedSlot.date === today() && startTime <= clinicTime())) { setError('Chỉ có thể mở hoặc sửa khung giờ chưa bắt đầu.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const { id, bookedCount: _bookedCount, ...values } = normalizedSlot;
      const doctorParam = workspace?.role === 'head' && scheduleDoctorId ? `?doctorId=${scheduleDoctorId}` : '';
      await request(user, id ? `/api/doctor/slots/${id}${doctorParam}` : `/api/doctor/slots${doctorParam}`, {
        method: id ? 'PATCH' : 'POST', body: JSON.stringify(values),
      });
      setSlot(newSlot());
      setNotice(id ? 'Đã cập nhật khung giờ.' : 'Đã mở khung giờ nhận khám.');
      if (values.date < scheduleRange.from || values.date > scheduleRange.to) {
        setScheduleRange({ from: values.date, to: addDays(values.date, 30) });
      } else {
        setSlotsRevision(value => value + 1);
      }
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  async function toggleSlot(item) {
    setBusy(true); setError(''); setNotice('');
    try {
      const doctorParam = workspace?.role === 'head' && scheduleDoctorId ? `?doctorId=${scheduleDoctorId}` : '';
      await request(user, `/api/doctor/slots/${item.id}${doctorParam}`, { method: 'PATCH', body: JSON.stringify({ isActive: !item.is_active }) });
      setNotice(item.is_active ? 'Đã đóng khung giờ cho lượt đặt mới.' : 'Đã mở lại khung giờ.');
      setSlotsRevision(value => value + 1);
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  function editSlot(item) {
    setSlot({ id: item.id, date: item.slot_date, startTime: time(item.start_time), endTime: time(item.end_time), capacity: item.capacity, bookedCount: item.total_booked_count ?? item.booked_count ?? 0 });
    slotFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      let image = profile.image;
      if (profileImage) image = (await request(user, '/api/doctor/profile/image', {
        method: 'POST', body: JSON.stringify({ dataUrl: profileImage }),
      })).url;
      const updated = await request(user, '/api/doctor/profile', {
        method: 'PATCH', body: JSON.stringify({ ...profile, image }),
      });
      setWorkspace(current => ({ ...current, doctor: updated.doctor }));
      setProfile(doctorForm(updated.doctor));
      setProfileImage('');
      invalidateCatalog();
      setNotice('Đã cập nhật hồ sơ bác sĩ trên trang đặt khám.');
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  async function saveServices(event) {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const updated = await request(user, '/api/doctor/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          shortDescription: profile.shortDescription, contactPhone: profile.contactPhone,
          contactEmail: profile.contactEmail, intro: profile.intro,
        }),
      });
      setWorkspace(current => ({ ...current, doctor: updated.doctor }));
      setProfile(current => ({ ...current, ...{
        shortDescription: updated.doctor.short_description || '', contactPhone: updated.doctor.contact_phone || '',
        contactEmail: updated.doctor.contact_email || '', intro: updated.doctor.intro || '',
      } }));
      invalidateCatalog();
      setNotice('Đã cập nhật thông tin hiển thị cho bệnh nhân.');
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  }
  async function saveDepartmentTask(event) {
    event.preventDefault();
    setBusy(true); setDepartmentTasksError(''); setNotice('');
    try {
      await request(user, '/api/doctor/department/tasks', { method: 'POST', body: JSON.stringify(departmentTaskForm) });
      setDepartmentTaskForm({ title: '', description: '', category: 'coordination', priority: 'normal', assigneeId: '', dueDate: addDays(today(), 7) });
      setDepartmentTasksRevision(value => value + 1);
      setNotice('Đã lưu công việc điều phối và ghi lịch sử thao tác.');
    } catch (cause) { setDepartmentTasksError(cause.message); }
    finally { setBusy(false); }
  }
  async function changeDepartmentTaskStatus(task, status) {
    setBusy(true); setDepartmentTasksError(''); setNotice('');
    try {
      await request(user, `/api/doctor/department/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setDepartmentTasksRevision(value => value + 1);
      setNotice('Đã cập nhật trạng thái công việc.');
    } catch (cause) { setDepartmentTasksError(cause.message); }
    finally { setBusy(false); }
  }

  const doctor = workspace?.doctor;
  const operationTasks = departmentOperations?.tasks || [];
  const openOperationTasks = operationTasks.filter(task => task.status !== 'done');
  const overdueOperationTasks = openOperationTasks.filter(task => task.dueDate && task.dueDate < today());
  const qualityFollowUps = openOperationTasks.filter(task => ['quality', 'safety', 'complaint'].includes(task.category));
  const openHandoffs = openOperationTasks.filter(task => task.category === 'handoff');
  return <div className="doctor-page">
    <header className="doctor-header"><strong className="doctor-logo">Mid<span>Health</span> <em>Workspace</em></strong><div><strong>{doctor?.full_name || user.email}</strong><button type="button" onClick={onLogout}>Đăng xuất</button></div></header>
    <div className="doctor-layout">
      <aside className="doctor-sidebar"><strong>QUẢN LÝ KHÁM</strong>{tabs.filter(([key]) => key !== 'coordination' || !workspace || ['head', 'doctor'].includes(workspace.role)).map(([key, label], index) => <button key={key} type="button" className={tab === key ? 'active' : ''} aria-current={tab === key ? 'page' : undefined} onClick={() => selectTab(key)}><span className="doctor-nav-number">{String(index + 1).padStart(2, '0')}</span>{label}</button>)}</aside>
      <main className="doctor-main" aria-busy={workspaceLoading}>
        {error && workspace && <p role="alert" className="doctor-error">{error} <button type="button" onClick={loadWorkspace}>Thử lại</button></p>}
        {notice && <p role="status" className="doctor-notice">{notice}</p>}
        {workspaceLoading && !workspace && <section className="doctor-workspace-loading" role="status" aria-live="polite"><span className="doctor-loading-spinner" aria-hidden="true" /><div><h1>Đang tải khu vực làm việc</h1><p>Đang xác thực tài khoản và tải lịch khám, chuyên khoa.</p></div><div className="doctor-loading-skeleton" aria-hidden="true"><i /><i /><i /></div></section>}
        {error && !workspace && !workspaceLoading && <section className="doctor-workspace-load-error" role="alert"><span className="doctor-load-error-icon" aria-hidden="true">!</span><div><h1>Chưa tải được khu vực làm việc</h1><p>{error}</p><button type="button" onClick={loadWorkspace}>Thử tải lại</button></div></section>}
        {doctor && tab === 'overview' && <>
          <span className="doctor-eyebrow">TỔNG QUAN</span><h1>Xin chào, {doctor.full_name}</h1>
          <p>Thông tin trong ngày {displayDate(date)} của {doctor.specialty_name || 'chuyên khoa đang cập nhật'}.</p>
          <div className="doctor-toolbar"><label>Ngày khám<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><button type="button" onClick={() => { loadWorkspace(); setReportRevision(value => value + 1); }}>Làm mới</button></div>
          {reportError && <p role="alert" className="doctor-error">{reportError}</p>}
          {reportLoading && <p role="status">Đang tải tổng quan...</p>}
          {workspace?.role === 'head' && departmentReport ? <div className="doctor-stat-grid">
            {[['Lịch trong khoa', departmentReport.appointments], ['Bệnh nhân', departmentReport.patients], ['Đã hoàn tất', departmentReport.completed], ['Đơn thuốc', departmentReport.prescriptionItems], ['Vật tư', departmentReport.materialItems]].map(([label, value]) => <div className="doctor-stat" key={label}><strong>{value ?? 0}</strong><span>{label}</span></div>)}
          </div> : dailyReport && <ReportStats data={dailyReport} />}
          {workspace?.role === 'head' && departmentReport?.byDoctor?.length > 0 && <ReportBreakdown title="Lịch khám theo bác sĩ trong ngày" rows={departmentReport.byDoctor} />}
          <div className="doctor-section-heading"><h2>Lịch hẹn trong ngày</h2><button type="button" onClick={() => selectTab('appointments')}>Xem lịch hẹn</button></div>
          <div className="doctor-workspace-list">{appointments.slice(0, 5).map(item => <article key={item.id} className="doctor-workspace-card"><div><strong>{item.patient_name}</strong><small>{item.appointment_time_text || 'Chưa có giờ'} · {item.queue_tickets?.[0]?.appointment_code || 'Chưa có mã phiếu'}</small></div><span className="doctor-card-state">{statusLabels[item.status] || item.status}</span></article>)}{!appointments.length && <p>Không có lịch khám trong ngày này.</p>}{appointments.length > 5 && <p>Còn {appointments.length - 5} lịch hẹn. Mở “Lịch hẹn” để xem đầy đủ.</p>}</div>
        </>}
        {doctor && tab === 'appointments' && <>
          <span className="doctor-eyebrow">LỊCH KHÁM CỦA TÔI</span><h1>Bệnh nhân trong ngày</h1>
          <p>Nhân viên tiếp nhận và xác minh danh tính trước khi bác sĩ ghi kết quả khám cho lịch hẹn hôm nay.</p>
          <div className="doctor-toolbar doctor-appointment-toolbar"><label>Ngày khám<input type="date" value={date} onChange={event => { setAppointmentPage(1); setDate(event.target.value); }} /></label><label>Tìm bệnh nhân<input type="search" placeholder="Tên hoặc số điện thoại" value={keywordDraft} onChange={event => setKeywordDraft(event.target.value)} /></label><label>Trạng thái<select value={statusFilter} onChange={event => { setAppointmentPage(1); setStatusFilter(event.target.value); }}><option value="">Tất cả</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button type="button" onClick={loadWorkspace}>Làm mới</button></div>
          {workspaceLoading && <p role="status" className="doctor-refresh-status" aria-live="polite">Đang cập nhật lịch hẹn…</p>}
          <div className="doctor-workspace-list">{filteredAppointments.map(item => {
            const clinicalNote = Array.isArray(item.appointment_clinical_notes) ? item.appointment_clinical_notes[0] : item.appointment_clinical_notes;
            const encounters = item.clinical_encounters || [];
            const humanAddenda = (item.clinical_note_addenda || []).filter(entry => !String(entry.content || '').startsWith('Kết quả khám chuyên khoa ['));
            const ownEncounter = encounters.find(encounter => encounter.doctor_id === doctor.id && encounter.status === 'waiting');
            const canFinalize = workspace.role === 'head' && encounters.length > 0 && encounters.every(encounter => encounter.status === 'completed');
            return <article key={item.id} className="doctor-workspace-card doctor-appointment-card">
              <div><strong>{item.patient_name}</strong><small>{item.queue_tickets?.[0]?.appointment_code || 'Chưa có mã phiếu'} · {displayDate(item.appointment_date)} · {item.appointment_time_text || 'Chưa có giờ'}</small><small>{item.patient_phone ? <a href={`tel:${item.patient_phone.replace(/[^+\d]/g, '')}`}>{item.patient_phone}</a> : 'Chưa có số điện thoại'}</small></div>
              <div><span className="doctor-card-state">{statusLabels[item.status] || item.status}</span><small>{item.checked_in_at ? 'Đã tiếp nhận' : 'Chưa tiếp nhận'}{item.delay_minutes > 0 ? ` · Trễ ${item.delay_minutes} phút` : ''}{item.clinician_absent ? ' · Bác sĩ vắng' : ''}</small></div>
              {(item.checked_in_at || item.status === 'completed') && <details className="doctor-visit-detail"><summary>Hồ sơ sức khỏe người bệnh</summary><p><strong>Nhóm máu:</strong> {item.patient_medical_profiles?.blood_group || 'Chưa ghi nhận'}</p><p><strong>Dị ứng:</strong> {item.patient_medical_profiles?.allergies || 'Chưa ghi nhận'}</p><p><strong>Tiền sử bệnh:</strong> {item.patient_medical_profiles?.medical_history || 'Chưa ghi nhận'}</p><small>Thông tin do người bệnh cung cấp; bác sĩ cần xác minh trong buổi khám.</small></details>}
              {item.appointment_date === today() && item.checked_in_at && item.status === 'confirmed' && ownEncounter && !item.clinician_absent && <button className="doctor-primary-action" type="button" onClick={() => { setNote(newNote()); setVisit({ ...item, mode: 'specialist', encounter: ownEncounter }); setVisitError(''); setError(''); }}>Ghi kết quả chuyên khoa</button>}
              {item.checked_in_at && item.status === 'confirmed' && canFinalize && <button className="doctor-primary-action" type="button" onClick={() => { setNote(newNote()); setVisit({ ...item, mode: 'final' }); setVisitError(''); setError(''); }}>Kết luận và kê đơn</button>}
              {item.status === 'completed' && item.prescription_items?.length > 0 && <details className="doctor-visit-detail"><summary>Đơn thuốc đã lưu ({item.prescription_items.length})</summary><ul>{item.prescription_items.map((medicine, index) => <li key={`${medicine.medicine_name}-${index}`}><strong>{medicine.medicine_name}</strong> · {medicine.dosage} · {medicine.frequency} · {medicine.duration} · Số lượng {medicine.quantity}</li>)}</ul></details>}
              {item.clinical_material_usage?.length > 0 && <details className="doctor-visit-detail"><summary>Vật tư đã ghi nhận ({item.clinical_material_usage.length})</summary><ul>{item.clinical_material_usage.map((material, index) => <li key={`${material.material_name}-${index}`}>{material.material_name} · Số lượng {material.quantity}</li>)}</ul></details>}
              {encounters.length > 0 && <details className="doctor-visit-detail"><summary>Kết quả các khoa ({encounters.filter(encounter => encounter.status === 'completed').length}/{encounters.length})</summary>{encounters.map(encounter => { const referralSlot = Array.isArray(encounter.appointment_slots) ? encounter.appointment_slots[0] : encounter.appointment_slots; const assignedDoctor = Array.isArray(encounter.doctors) ? encounter.doctors[0] : encounter.doctors; const result = encounter.specialtyResult?.details; return <div className="doctor-specialty-result-entry" key={encounter.id}><p><strong>Khoa {workspace.specialties?.find(specialty => specialty.id === encounter.specialty_id)?.name || ''}</strong>{assignedDoctor?.full_name ? ` · ${assignedDoctor.full_name}` : ''}{referralSlot ? ` · ${displayDate(referralSlot.slot_date)} ${time(referralSlot.start_time)}–${time(referralSlot.end_time)}` : ''}</p>{encounter.status === 'completed' ? <><p><strong>Lý do khám:</strong> {result?.chiefComplaint || 'Chưa ghi nhận'} · <strong>Chẩn đoán:</strong> {encounter.provisional_diagnosis}</p>{result?.examination && <p><strong>Khám:</strong> {result.examination}</p>}{encounter.specialtyResultHistory?.length > 1 && <small>Đã chỉnh sửa {encounter.specialtyResultHistory.length - 1} lần · cập nhật gần nhất {displayDateTime(encounter.specialtyResult?.createdAt)}</small>}{encounter.doctor_id === doctor.id && <button type="button" onClick={() => { setNote(specialtyNoteFromEncounter(encounter)); setVisit({ ...item, mode: 'specialist_edit', encounter }); setVisitError(''); setError(''); }}>Chỉnh sửa kết quả khám</button>}</> : <p>Đang chờ khám</p>}</div>; })}</details>}
              {item.status === 'completed' && clinicalNote && <details className="doctor-visit-detail"><summary>Xem kết quả đã lưu</summary><p><strong>Tóm tắt:</strong> {clinicalNote.summary}</p><p><strong>Kết luận:</strong> {clinicalNote.diagnosis}</p><p><strong>Hướng dẫn:</strong> {clinicalNote.care_plan}</p>{clinicalNote.follow_up && <p><strong>Tái khám:</strong> {clinicalNote.follow_up}</p>}{clinicalNote.allergies_reviewed && <small>Đã xác nhận rà soát dị ứng và tiền sử thuốc khi kê đơn.</small>}</details>}
              {humanAddenda.length > 0 && <details className="doctor-visit-detail"><summary>Ghi chú bổ sung ({humanAddenda.length})</summary>{humanAddenda.map(addendum => <p key={addendum.id}><strong>{addendum.author_name} · {displayDateTime(addendum.created_at)}:</strong> {addendum.content}</p>)}</details>}
              {workspace?.role === 'head' && item.status === 'completed' && clinicalNote && <button type="button" onClick={() => { setAddendumVisit(item); setAddendumText(''); setAddendumError(''); }}>Bổ sung hồ sơ</button>}
            </article>;
          })}{!filteredAppointments.length && <p>{appointments.length ? 'Không có lịch hẹn phù hợp bộ lọc.' : 'Không có lịch khám trong ngày này.'}</p>}</div>
          {workspace?.pagination && (workspace.pagination.total > workspace.pagination.pageSize || workspace.pagination.extraCount > 0 || workspace.pagination.page > 1) && <div className="doctor-pagination"><span>Trang {workspace.pagination.page} · {workspace.pagination.total} lịch theo bộ lọc{workspace.pagination.page === 1 && workspace.pagination.extraCount > 0 ? ` · ${workspace.pagination.extraCount} lượt chuyển đến đang chờ` : ''}</span><div><button type="button" disabled={workspaceLoading || appointmentPage <= 1} onClick={() => setAppointmentPage(value => Math.max(1, value - 1))}>Trang trước</button><button type="button" disabled={workspaceLoading || !workspace.pagination.hasMore} onClick={() => setAppointmentPage(value => value + 1)}>Trang sau</button></div></div>}
        </>}
        {doctor && tab === 'schedule' && <>
          <span className="doctor-eyebrow">LỊCH LÀM VIỆC</span><h1>Khung giờ nhận đặt khám</h1>
          <p>{workspace?.role === 'head' ? 'Trưởng khoa điều phối lịch làm việc cho các bác sĩ trong chuyên khoa phụ trách.' : 'Xem lịch làm việc và khung giờ nhận khám của bạn.'} Khung giờ đã có người đặt chỉ có thể tăng sức chứa hoặc đóng lượt đặt mới.</p>
          {workspace?.role === 'head' && <label>Bác sĩ<select value={scheduleDoctorId} onChange={event => { setScheduleDoctorId(event.target.value); setSlot(newSlot()); }}><option value="">Chọn bác sĩ</option>{departmentDoctors.map(item => <option key={item.id} value={item.id}>{item.full_name}{item.specialty_name ? ` · ${item.specialty_name}` : ''}</option>)}</select></label>}
          {workspace?.role === 'head' && scheduleDoctorId && <>
          <form ref={slotFormRef} className="doctor-slot-form" onSubmit={saveSlot}>
            <h2>{slot.id ? 'Chỉnh sửa khung giờ' : 'Thêm khung giờ'}</h2>
            <label>Ngày khám<input required type="date" min={today()} disabled={Boolean(slot.id && slot.bookedCount)} value={slot.date} onChange={event => setSlot({ ...slot, date: event.target.value })} /></label>
            <TimeField id="slot-start" label="Bắt đầu" disabled={Boolean(slot.id && slot.bookedCount)} value={slot.startTime} onChange={startTime => setSlot(current => ({ ...current, startTime }))} />
            <TimeField id="slot-end" label="Kết thúc" disabled={Boolean(slot.id && slot.bookedCount)} value={slot.endTime} onChange={endTime => setSlot(current => ({ ...current, endTime }))} />
            <label>Sức chứa<input required type="number" min={Math.max(1, slot.bookedCount || 0)} max="100" value={slot.capacity} onChange={event => setSlot({ ...slot, capacity: Number(event.target.value) })} /></label>
            <button disabled={busy} type="submit">{busy ? 'Đang lưu...' : slot.id ? 'Lưu thay đổi' : 'Mở khung giờ'}</button>
            {slot.id && <button type="button" disabled={busy} onClick={() => setSlot(newSlot())}>Hủy chỉnh sửa</button>}
          </form>
          </>}
          <div className="doctor-section-heading"><h2>Khung giờ đã tạo</h2><div className="doctor-range"><label>Từ<input type="date" value={scheduleRange.from} onChange={event => setScheduleRange({ ...scheduleRange, from: event.target.value })} /></label><label>Đến<input type="date" value={scheduleRange.to} onChange={event => setScheduleRange({ ...scheduleRange, to: event.target.value })} /></label><button type="button" onClick={loadSchedule}>Làm mới</button></div></div>
          {scheduleError && <p role="alert" className="doctor-error">{scheduleError}</p>}
          {scheduleLoading && <p role="status">Đang tải khung giờ...</p>}
          <div className="doctor-workspace-list">{slots.map(item => {
            const elapsed = item.slot_date < today() || (item.slot_date === today() && time(item.start_time) <= clinicTime());
            const occupied = item.total_booked_count ?? item.booked_count ?? 0;
            return <article key={item.id} className="doctor-workspace-card"><div><strong>{displayDate(item.slot_date)} · {time(item.start_time)}–{time(item.end_time)}</strong><small>{occupied}/{item.capacity} đã đặt{item.referral_count ? ` · ${item.referral_count} lượt được chuyển đến` : ''}{elapsed ? ' · Đã qua giờ bắt đầu' : ''}</small></div><span className="doctor-card-state">{item.is_active ? 'Đang mở' : 'Đã đóng'}</span>{workspace?.role === 'head' && <div className="doctor-card-actions"><button type="button" disabled={busy || elapsed} onClick={() => editSlot(item)}>Chỉnh sửa</button><button type="button" disabled={busy || elapsed} onClick={() => toggleSlot(item)}>{item.is_active ? 'Đóng' : 'Mở lại'}</button></div>}</article>;
          })}{!slots.length && !scheduleLoading && <p>Chưa có khung giờ trong khoảng đã chọn.</p>}</div>
        </>}
        {doctor && ['head', 'doctor'].includes(workspace?.role) && tab === 'coordination' && <>
          <span className="doctor-eyebrow">ĐIỀU PHỐI KHOA</span><h1>{workspace.role === 'head' ? 'Giao việc và bàn giao' : 'Công việc được giao'}</h1>
          <p>{workspace.role === 'head' ? 'Giao người phụ trách, hạn xử lý và theo dõi công việc chất lượng/an toàn.' : 'Cập nhật tiến độ các việc được trưởng khoa giao.'} Không nhập tên, mã hồ sơ hay thông tin nhận dạng người bệnh vào nội dung công việc.</p>
          {departmentTasksError && <p role="alert" className="doctor-error">{departmentTasksError}</p>}
          {departmentTasksLoading && <p role="status">Đang tải công việc của khoa...</p>}
          {workspace.role === 'head' && <form className="doctor-workspace-profile-form" onSubmit={saveDepartmentTask}>
            <label>Việc cần làm<input required minLength="4" maxLength="140" value={departmentTaskForm.title} onChange={event => setDepartmentTaskForm({ ...departmentTaskForm, title: event.target.value })} placeholder="Ví dụ: Rà soát thời gian chờ lịch khám" /></label>
            <label>Nhóm việc<select value={departmentTaskForm.category} onChange={event => setDepartmentTaskForm({ ...departmentTaskForm, category: event.target.value })}>{Object.entries(departmentTaskCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label>Mức ưu tiên<select value={departmentTaskForm.priority} onChange={event => setDepartmentTaskForm({ ...departmentTaskForm, priority: event.target.value })}>{Object.entries(departmentTaskPriorities).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label>Người phụ trách<select required value={departmentTaskForm.assigneeId} onChange={event => setDepartmentTaskForm({ ...departmentTaskForm, assigneeId: event.target.value })}><option value="">Chọn bác sĩ phụ trách</option>{(departmentOperations?.doctors || departmentDoctors).map(member => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label>
            <label>Hạn xử lý<input required type="date" min={today()} value={departmentTaskForm.dueDate} onChange={event => setDepartmentTaskForm({ ...departmentTaskForm, dueDate: event.target.value })} /></label>
            <label>Ghi chú / tiêu chí hoàn thành<textarea maxLength="1200" rows="3" value={departmentTaskForm.description} onChange={event => setDepartmentTaskForm({ ...departmentTaskForm, description: event.target.value })} /></label>
            <div className="doctor-profile-actions"><button disabled={busy} type="submit">{busy ? 'Đang lưu...' : 'Giao việc'}</button></div>
          </form>}
          {departmentOperations && <div className="doctor-stat-grid"><div className="doctor-stat"><strong>{openOperationTasks.length}</strong><span>Việc đang mở</span></div><div className="doctor-stat"><strong>{overdueOperationTasks.length}</strong><span>Việc quá hạn</span></div><div className="doctor-stat"><strong>{openHandoffs.length}</strong><span>Bàn giao còn mở</span></div><div className="doctor-stat"><strong>{qualityFollowUps.length}</strong><span>An toàn / chất lượng / phản hồi cần theo dõi</span></div></div>}
          <div className="doctor-section-heading"><h2>{workspace.role === 'head' ? 'Danh sách công việc' : 'Việc của tôi'}</h2><button type="button" onClick={() => setDepartmentTasksRevision(value => value + 1)}>Làm mới</button></div>
          <div className="doctor-workspace-list">{operationTasks.map(task => <article key={task.id} className="doctor-workspace-card"><div><strong>{task.title}</strong><small>{departmentTaskCategories[task.category] || 'Điều phối'} · {departmentTaskPriorities[task.priority] || 'Thường'} · {task.assigneeName || 'Chưa giao'}</small>{task.description && <small>{task.description}</small>}<small>Hạn: {task.dueDate ? displayDate(task.dueDate) : 'Chưa đặt'} · Cập nhật: {displayDateTime(task.updatedAt)}</small></div><span className={`doctor-card-state ${task.status === 'blocked' || (task.dueDate && task.dueDate < today() && task.status !== 'done') ? 'doctor-card-state-alert' : ''}`}>{task.dueDate && task.dueDate < today() && task.status !== 'done' ? 'Quá hạn · ' : ''}{departmentTaskStatuses[task.status] || task.status}</span><div className="doctor-card-actions">{['open', 'blocked'].includes(task.status) && <button type="button" disabled={busy} onClick={() => changeDepartmentTaskStatus(task, 'in_progress')}>Bắt đầu</button>}{task.status === 'in_progress' && <button type="button" disabled={busy} onClick={() => changeDepartmentTaskStatus(task, 'blocked')}>Báo vướng</button>}{task.status !== 'done' && <button type="button" disabled={busy} onClick={() => changeDepartmentTaskStatus(task, 'done')}>Hoàn tất</button>}{task.status === 'done' && <button type="button" disabled={busy} onClick={() => changeDepartmentTaskStatus(task, 'open')}>Mở lại</button>}</div></article>)}{!departmentTasksLoading && !departmentTasksError && !operationTasks.length && <p>{workspace.role === 'head' ? 'Khoa chưa có công việc. Tạo mục đầu tiên ở biểu mẫu trên.' : 'Chưa có việc nào được giao cho bạn.'}</p>}</div>
          {workspace.role === 'head' && <details className="doctor-report-breakdown"><summary>Nhật ký thao tác của khoa ({departmentOperations?.auditEvents?.length || 0})</summary><p>Ghi nhận thay đổi lịch, công việc điều phối và thao tác hoàn tất/bổ sung hồ sơ. Không hiển thị nội dung bệnh án trong nhật ký này.</p><div className="doctor-workspace-list">{(departmentOperations?.auditEvents || []).map((event, index) => <article className="doctor-workspace-card" key={`${event.entity_id}-${event.created_at}-${index}`}><div><strong>{auditEventLabels[event.event_type] || event.event_type}</strong><small>{event.message} · {event.actor_email || event.actor_role || 'Tài khoản hệ thống'}</small></div><span>{displayDateTime(event.created_at)}</span></article>)}{!(departmentOperations?.auditEvents || []).length && <p>Chưa ghi nhận thao tác trong khoa.</p>}</div></details>}
        </>}
        {doctor && tab === 'services' && <>
          <span className="doctor-eyebrow">TRANG BỆNH NHÂN</span><h1>Dịch vụ, giới thiệu và giờ làm việc</h1>
          <p>Thông tin này hiển thị trên thẻ bác sĩ và trang đặt khám. Chuyên khoa, phí khám và địa chỉ lấy từ dữ liệu phòng khám.</p>
          {profile && <form className="doctor-workspace-profile-form doctor-service-form" onSubmit={saveServices}>
            <label>Địa chỉ hiển thị trên bản đồ<input readOnly value={clinic?.address || 'Phòng khám chưa cập nhật địa chỉ'} />{clinic?.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.address)}`} target="_blank" rel="noreferrer">Xem trên bản đồ</a>}</label>
            <label>Chuyên khoa<input readOnly value={doctor.specialty_name || 'Chưa cập nhật'} /></label>
            <label>Phí khám<input readOnly value={displayFee(doctor.booking_fee)} /></label>
            <label>Mô tả ngắn ngoài thẻ<input maxLength="240" value={profile.shortDescription} onChange={event => setProfile({ ...profile, shortDescription: event.target.value })} placeholder="Giới thiệu ngắn về bác sĩ" /></label>
            <label>Số điện thoại liên hệ<input type="tel" maxLength="20" value={profile.contactPhone} onChange={event => setProfile({ ...profile, contactPhone: event.target.value })} placeholder="Số điện thoại hiển thị cho bệnh nhân" /></label>
            <label>Email liên hệ<input type="email" value={profile.contactEmail} onChange={event => setProfile({ ...profile, contactEmail: event.target.value })} placeholder="Email hiển thị cho bệnh nhân" /></label>
            <label>Giới thiệu<textarea maxLength="5000" rows="6" value={profile.intro} onChange={event => setProfile({ ...profile, intro: event.target.value })} placeholder="Kinh nghiệm và cách tiếp cận khám chữa bệnh" /></label>
            <div className="doctor-profile-actions"><button disabled={busy} type="submit">{busy ? 'Đang lưu...' : 'Lưu thông tin hiển thị'}</button></div>
          </form>}
          <div className="doctor-section-heading"><div><h2>Giờ làm việc</h2><p>Khung giờ đã mở trong 30 ngày tới, theo giờ Việt Nam.</p></div>{workspace?.role === 'head' && <button type="button" onClick={() => { selectTab('schedule'); setSlot(newSlot()); }}>+ Sắp lịch bác sĩ</button>}</div>
          {upcomingError && <p role="alert" className="doctor-error">{upcomingError}</p>}
          <div className="doctor-workspace-list">{upcomingSlots.slice(0, 10).map(item => <article key={item.id} className="doctor-workspace-card"><strong>{displayDate(item.slot_date)}</strong><span>{time(item.start_time)}–{time(item.end_time)}</span><small>{item.booked_count || 0}/{item.capacity} đã đặt · {(item.booked_count || 0) >= item.capacity ? 'Đã hết chỗ' : `Còn ${item.capacity - (item.booked_count || 0)} chỗ`}</small></article>)}{!upcomingSlots.length && !upcomingError && <p>Chưa có khung giờ được mở trong 30 ngày tới.</p>}{upcomingSlots.length > 10 && <button type="button" onClick={() => selectTab('schedule')}>Xem thêm {upcomingSlots.length - 10} khung giờ</button>}</div>
        </>}
        {doctor && tab === 'profile' && <>
          <span className="doctor-eyebrow">HỒ SƠ BÁC SĨ</span><h1>{doctor.full_name || 'Bác sĩ'}</h1>
          <p>Email đăng nhập: {user.email} · Ngày sinh: {doctor.birth_date ? displayDate(doctor.birth_date) : 'Chưa cập nhật'}</p>
          <p>Admin quản lý họ tên, ngày sinh, chuyên khoa, giấy phép hành nghề và phí khám.</p>
          <div className="doctor-profile-facts"><span>Chuyên khoa: <strong>{doctor.specialty_name || 'Chưa cập nhật'}</strong></span><span>Số giấy phép: <strong>{doctor.license_number || 'Chưa cập nhật'}</strong></span><span>Phí khám: <strong>{displayFee(doctor.booking_fee)}</strong></span></div>
          {profile && <form className="doctor-workspace-profile-form" onSubmit={saveProfile}>
            <label>Chức danh<input maxLength="100" value={profile.title} onChange={event => setProfile({ ...profile, title: event.target.value })} /></label>
            <label>Nơi công tác<input maxLength="160" value={profile.workplace} onChange={event => setProfile({ ...profile, workplace: event.target.value })} /></label>
            <label>Số năm kinh nghiệm<input type="number" min="0" max="80" value={profile.yearsExperience} onChange={event => setProfile({ ...profile, yearsExperience: event.target.value })} /></label>
            <label>Đào tạo, bằng cấp<input maxLength="500" value={profile.education} onChange={event => setProfile({ ...profile, education: event.target.value })} /></label>
            <label>Lĩnh vực chuyên sâu<input maxLength="500" value={profile.expertise} onChange={event => setProfile({ ...profile, expertise: event.target.value })} /></label>
            <label>Email liên hệ<input type="email" value={profile.contactEmail} onChange={event => setProfile({ ...profile, contactEmail: event.target.value })} /></label>
            <label>Số điện thoại liên hệ<input type="tel" maxLength="20" value={profile.contactPhone} onChange={event => setProfile({ ...profile, contactPhone: event.target.value })} /></label>
            <label>Mô tả ngắn ngoài thẻ<input maxLength="240" value={profile.shortDescription} onChange={event => setProfile({ ...profile, shortDescription: event.target.value })} /></label>
            <label>Giới thiệu<textarea maxLength="5000" rows="5" value={profile.intro} onChange={event => setProfile({ ...profile, intro: event.target.value })} /></label>
            <label className="doctor-avatar-field">Ảnh đại diện<span className="doctor-upload-control"><span>Chọn ảnh</span><small>{profileImage ? 'Đã chọn ảnh mới' : 'JPG, PNG hoặc WebP · tối đa 4 MB'}</small></span><input className="doctor-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) { setError('Chỉ dùng ảnh JPG, PNG hoặc WebP dưới 4 MB.'); event.target.value = ''; return; } const reader = new FileReader(); reader.onload = () => setProfileImage(String(reader.result || '')); reader.readAsDataURL(file); }} /></label>
            {(profileImage || profile.image) && <div className="doctor-avatar-preview"><img className="doctor-profile-avatar" src={profileImage || profile.image} alt="Ảnh bác sĩ" /><button type="button" onClick={() => { setProfileImage(''); setProfile({ ...profile, image: '' }); }}>Xóa ảnh</button></div>}
            <div className="doctor-profile-actions"><button disabled={busy} type="submit">{busy ? 'Đang lưu...' : 'Lưu hồ sơ'}</button></div>
          </form>}
        </>}
        {doctor && tab === 'reports' && <>
          <span className="doctor-eyebrow">BÁO CÁO</span><h1>Hoạt động khám bệnh</h1>
          <p>{workspace?.role === 'head' ? 'Tổng hợp hoạt động, thuốc và vật tư của chuyên khoa theo thời gian.' : `Số liệu lịch hẹn của bác sĩ ${doctor.full_name}, theo ngày khám tại phòng khám.`}</p>
          <div className="doctor-toolbar"><label>Từ ngày<input type="date" value={reportRange.from} onChange={event => setReportRange({ ...reportRange, from: event.target.value })} /></label><label>Đến ngày<input type="date" value={reportRange.to} onChange={event => setReportRange({ ...reportRange, to: event.target.value })} /></label><button type="button" onClick={() => setReportRevision(value => value + 1)}>Làm mới</button></div>
          {reportError && <p role="alert" className="doctor-error">{reportError}</p>}
          {reportLoading && <p role="status">Đang tải báo cáo...</p>}
          {workspace?.role !== 'head' && report && !reportError && <><p>Giai đoạn {displayDate(report.from)} – {displayDate(report.to)}.</p><ReportStats data={report} /><p>Đã hoàn tất {report.total ? Math.round((report.byStatus?.completed || 0) / report.total * 100) : 0}% số lịch hẹn.</p></>}
          {workspace?.role === 'head' && departmentReport && <>
            <h2 className="doctor-report-title">Tổng hợp chuyên khoa · {displayDate(reportRange.from)} – {displayDate(reportRange.to)}</h2>
            <div className="doctor-stat-grid">
              {[['Bệnh nhân', departmentReport.patients], ['Lịch khám', departmentReport.appointments], ['Đã hoàn tất', departmentReport.completed], ['Đơn thuốc', departmentReport.prescriptionItems], ['Số lượng thuốc', departmentReport.medicineQuantity], ['Vật tư', departmentReport.materialItems], ['Số lượng vật tư', departmentReport.materialQuantity], ['Tiền cọc đã thu', displayFee(departmentReport.revenue)]].map(([label, value]) => <div className="doctor-stat" key={label}><strong>{value ?? 0}</strong><span>{label}</span></div>)}
            </div>
            <section className="doctor-report-breakdown"><h3>Trạng thái lịch hẹn</h3><div className="doctor-stat-grid">{[['Chờ thanh toán', 'pending'], ['Đã xác nhận', 'confirmed'], ['Đã hoàn tất', 'completed'], ['Đã hủy', 'cancelled'], ['Không đến', 'no_show']].map(([label, key]) => <div className="doctor-stat" key={key}><strong>{departmentReport.appointmentStatuses?.[key] ?? 0}</strong><span>{label}</span></div>)}</div></section>
            {departmentReport.qualityMetrics && <section className="doctor-report-breakdown"><h3>Chỉ số quy trình</h3><p>Tỷ lệ tính trên lịch trong khoảng đã chọn; đây không phải kết quả điều trị hay chỉ số an toàn lâm sàng.</p><div className="doctor-stat-grid">{[['Hoàn tất', departmentReport.qualityMetrics.completionRate], ['Hủy', departmentReport.qualityMetrics.cancellationRate], ['Không đến', departmentReport.qualityMetrics.noShowRate]].map(([label, value]) => <div className="doctor-stat" key={label}><strong>{value == null ? '—' : `${value}%`}</strong><span>{label} · {departmentReport.qualityMetrics.appointments} lịch</span></div>)}</div></section>}
            {departmentReport.managementMetrics && <section className="doctor-report-breakdown"><h3>Theo dõi điều phối và chất lượng</h3><p>Đếm công việc theo dõi được trưởng khoa ghi nhận trong khoảng ngày đã chọn; không đồng nghĩa số sự cố lâm sàng.</p><div className="doctor-stat-grid">{[['Bàn giao còn mở', departmentReport.managementMetrics.openHandoffs], ['An toàn / cải tiến còn mở', departmentReport.managementMetrics.openQualityFollowUps], ['Phản hồi cần xử lý', departmentReport.managementMetrics.complaintsToReview], ['Công việc quá hạn', departmentReport.managementMetrics.overdueTasks], ['Chuyển khám đang chờ', departmentReport.referralMetrics?.waiting ?? 0], ['Tuổi chuyển khám lâu nhất (giờ)', departmentReport.referralMetrics?.oldestHours ?? '—']].map(([label, value]) => <div className="doctor-stat" key={label}><strong>{value}</strong><span>{label}</span></div>)}</div></section>}
            <ReportBreakdown title="Lượt khám chuyên khoa theo bác sĩ tiếp nhận" rows={departmentReport.byDoctor} />
            <ReportBreakdown title="Tiến độ theo ngày" rows={departmentReport.byDate} nameHeader="Ngày" />
            <ReportBreakdown title="Thuốc theo bác sĩ" rows={departmentReport.medicineByDoctor} unit="đơn vị" />
            <ReportBreakdown title="Vật tư theo bác sĩ" rows={departmentReport.materialByDoctor} unit="đơn vị" />
            <ReportBreakdown title="Thuốc theo chuyên khoa" rows={departmentReport.medicineBySpecialty} unit="đơn vị" />
            <ReportBreakdown title="Vật tư theo chuyên khoa" rows={departmentReport.materialBySpecialty} unit="đơn vị" />
          </>}
        </>}
      </main>
    </div>
    {visit && <div className="doctor-modal" role="dialog" aria-modal="true" aria-labelledby="doctor-visit-title"><form onSubmit={saveVisit}>
      <h2 id="doctor-visit-title">{['specialist', 'specialist_edit', 'details_retry', 'profile_retry'].includes(visit.mode) ? (visit.mode === 'specialist_edit' ? 'Chỉnh sửa kết quả chuyên khoa' : 'Kết quả chuyên khoa') : 'Kết luận và kê đơn'} · {visit.patient_name}</h2>
      <section className="doctor-visit-context" aria-label="Thông tin sức khỏe cần xác minh">
        <strong>Thông tin sức khỏe cần xác minh</strong>
        <p><span>Nhóm máu</span><b>{visit.patient_medical_profiles?.blood_group || 'Chưa ghi nhận'}</b><span>Dị ứng</span><b>{visit.patient_medical_profiles?.allergies || 'Chưa ghi nhận'}</b></p>
        <p><span>Tiền sử bệnh</span><b>{visit.patient_medical_profiles?.medical_history || 'Chưa ghi nhận'}</b></p>
        <small>Đối chiếu với người bệnh trước khi sử dụng; thông tin chưa ghi nhận không đồng nghĩa với không có bệnh hoặc dị ứng.</small>
      </section>
      <p className="doctor-visit-guidance">Trao đổi kết quả trực tiếp với người bệnh trước khi lưu. Thông tin khai báo cần ghi đúng là lời người bệnh cung cấp.</p>
      {visitError && <p role="alert" className="doctor-error">{visitError}</p>}
      {['specialist', 'specialist_edit', 'details_retry', 'profile_retry'].includes(visit.mode) ? <>
        <p className="doctor-visit-scope">Phiếu này ghi nhận triệu chứng và chẩn đoán tạm thời của lượt chuyên khoa. Chuyển khám là tùy chọn; kết luận cuối cùng được ghi ở bước hoàn tất hồ sơ.</p>
        <label>Lý do đến khám<input required minLength={2} maxLength={500} value={note.chiefComplaint} onChange={event => setNote({ ...note, chiefComplaint: event.target.value })} placeholder="Vấn đề chính người bệnh muốn được khám" /></label>
        <label>Triệu chứng và diễn biến<textarea required minLength={5} maxLength={4000} value={note.symptoms} onChange={event => setNote({ ...note, symptoms: event.target.value })} /></label>
        <label>Tiền sử liên quan đến lần khám này<textarea maxLength={4000} value={note.history} onChange={event => setNote({ ...note, history: event.target.value })} placeholder="Khởi phát, thời gian, diễn tiến, thuốc đã dùng, yếu tố liên quan" /></label>
        <fieldset className="doctor-entry-group"><legend>Dấu hiệu sinh tồn (nếu đo)</legend><div className="doctor-entry-row">
          <label>Huyết áp<input maxLength={100} value={note.bloodPressure} onChange={event => setNote({ ...note, bloodPressure: event.target.value })} placeholder="Ví dụ: 120/80 mmHg" /></label>
          <label>Mạch<input maxLength={30} value={note.pulse} onChange={event => setNote({ ...note, pulse: event.target.value })} placeholder="lần/phút" /></label>
          <label>Nhiệt độ<input maxLength={30} value={note.temperature} onChange={event => setNote({ ...note, temperature: event.target.value })} placeholder="°C" /></label>
          <label>SpO₂<input maxLength={30} value={note.oxygenSaturation} onChange={event => setNote({ ...note, oxygenSaturation: event.target.value })} placeholder="%" /></label>
        </div></fieldset>
        <label>Kết quả khám thực thể<textarea required minLength={5} maxLength={4000} value={note.examination} onChange={event => setNote({ ...note, examination: event.target.value })} placeholder="Ghi nhận khách quan theo chuyên khoa; nêu rõ nếu chưa thực hiện khám thực thể" /></label>
        <label>Chẩn đoán tạm thời<textarea required minLength={2} maxLength={2000} value={note.diagnosis} onChange={event => setNote({ ...note, diagnosis: event.target.value })} /></label>
        <label>Nhận định chuyên môn<textarea required minLength={5} maxLength={4000} value={note.assessment} onChange={event => setNote({ ...note, assessment: event.target.value })} placeholder="Cơ sở nhận định, vấn đề cần loại trừ hoặc mức độ cần theo dõi" /></label>
        <label>Kế hoạch xử trí / điều trị<textarea required minLength={5} maxLength={4000} value={note.carePlan} onChange={event => setNote({ ...note, carePlan: event.target.value })} placeholder="Điều trị, xét nghiệm hoặc thủ thuật dự kiến; kê đơn chính thức ở bước hoàn tất hồ sơ" /></label>
        <label>Tư vấn và hướng dẫn cho người bệnh<textarea maxLength={4000} value={note.patientInstructions} onChange={event => setNote({ ...note, patientInstructions: event.target.value })} /></label>
        <label>Tái khám / dấu hiệu cần quay lại<textarea maxLength={2000} value={note.followUp} onChange={event => setNote({ ...note, followUp: event.target.value })} /></label>
        <label>Chuyển khám sang khoa khác (không bắt buộc)<select value={note.nextSpecialtyId} onChange={event => { setVisitError(''); setNote({ ...note, nextSpecialtyId: event.target.value, nextSlotId: '' }); }}><option value="">Không chuyển khám</option>{(workspace?.specialties || []).filter(specialty => specialty.id !== visit.encounter.specialty_id).map(specialty => <option key={specialty.id} value={specialty.id}>{specialty.name}</option>)}</select></label>
        {note.nextSpecialtyId && <label>Bác sĩ và giờ tiếp nhận<select required value={note.nextSlotId} onChange={event => setNote({ ...note, nextSlotId: event.target.value })} disabled={referralSlotsLoading}><option value="">{referralSlotsLoading ? 'Đang tải khung giờ...' : 'Chọn khung giờ còn chỗ'}</option>{referralSlots.map(item => <option key={item.id} value={item.id}>{item.doctor_name} · {time(item.start_time)}–{time(item.end_time)} · Còn {item.available_count} chỗ</option>)}</select>{!referralSlotsLoading && referralSlots.length === 0 && <small role="status">Không còn khung giờ phù hợp hôm nay. Hãy trao đổi phương án tiếp nhận trước khi lưu.</small>}</label>}
        <fieldset className="doctor-entry-group"><legend>Vật tư đã sử dụng ở lượt khám này</legend>
          {note.materials.map((material, index) => <div className="doctor-entry-row" key={`specialist-material-${index}`}>
            <label>Tên vật tư<input required maxLength="200" value={material.name} onChange={event => setNote({ ...note, materials: note.materials.map((item, i) => i === index ? { ...item, name: event.target.value } : item) })} /></label>
            <label>Số lượng<input required type="number" min="1" max="10000" value={material.quantity} onChange={event => setNote({ ...note, materials: note.materials.map((item, i) => i === index ? { ...item, quantity: Number(event.target.value) } : item) })} /></label>
            <button type="button" onClick={() => setNote({ ...note, materials: note.materials.filter((_, i) => i !== index) })}>Xóa vật tư</button>
          </div>)}
          <button type="button" disabled={note.materials.length >= 30} onClick={() => setNote({ ...note, materials: [...note.materials, { name: '', quantity: 1 }] })}>+ Ghi nhận vật tư</button>
        </fieldset>
        <fieldset className="doctor-entry-group"><legend>Cập nhật hồ sơ sức khỏe sau khám (tùy chọn)</legend>
          <p className="doctor-visit-scope">Chỉ cập nhật thông tin vừa trao đổi hoặc đã đối chiếu. Tiền sử và dị ứng do người bệnh khai sẽ được ghi rõ nguồn; không suy đoán nhóm máu.</p>
          <label>Tiền sử bệnh người bệnh khai (nếu có)<textarea maxLength={2500} value={note.healthProfile.medicalHistory} onChange={event => setNote({ ...note, healthProfile: { ...note.healthProfile, medicalHistory: event.target.value } })} /></label>
          <label>Tình trạng dị ứng sau khi rà soát<select value={note.healthProfile.allergyStatus} onChange={event => setNote({ ...note, healthProfile: { ...note.healthProfile, allergyStatus: event.target.value, allergies: event.target.value === 'known' ? note.healthProfile.allergies : '' } })}><option value="">Không cập nhật</option><option value="known">Người bệnh khai có dị ứng</option><option value="none_reported">Người bệnh xác nhận chưa ghi nhận dị ứng</option><option value="unknown">Chưa xác định</option></select></label>
          {note.healthProfile.allergyStatus === 'known' && <label>Chất gây dị ứng / phản ứng người bệnh khai<textarea required minLength={2} maxLength={1500} value={note.healthProfile.allergies} onChange={event => setNote({ ...note, healthProfile: { ...note.healthProfile, allergies: event.target.value } })} /></label>}
          <label>Nhóm máu (chỉ chọn khi có bằng chứng)<select value={note.healthProfile.bloodGroup} onChange={event => setNote({ ...note, healthProfile: { ...note.healthProfile, bloodGroup: event.target.value } })}><option value="">Không cập nhật</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(group => <option key={group} value={group}>{group}</option>)}</select></label>
          {note.healthProfile.bloodGroup && <><label>Nguồn xác minh nhóm máu<select required value={note.healthProfile.bloodGroupSource} onChange={event => setNote({ ...note, healthProfile: { ...note.healthProfile, bloodGroupSource: event.target.value } })}><option value="">Chọn nguồn</option><option value="laboratory">Kết quả xét nghiệm</option><option value="medical_record">Hồ sơ y tế có sẵn</option></select></label><label>Mã / ngày xét nghiệm hoặc thông tin hồ sơ đối chiếu<input required minLength={5} maxLength={300} value={note.healthProfile.bloodGroupEvidence} onChange={event => setNote({ ...note, healthProfile: { ...note.healthProfile, bloodGroupEvidence: event.target.value } })} /></label></>}
        </fieldset>
      </> : <>
        {[['summary', 'Tóm tắt lần khám'], ['diagnosis', 'Chẩn đoán cuối'], ['carePlan', 'Điều trị và hướng dẫn chăm sóc'], ['followUp', 'Tái khám hoặc dấu hiệu cần liên hệ']].map(([key, label]) => <label key={key}>{label}<textarea required={key !== 'followUp'} minLength={key === 'summary' || key === 'carePlan' ? 10 : key === 'diagnosis' ? 2 : undefined} maxLength={key === 'followUp' || key === 'diagnosis' ? 2000 : 4000} value={note[key]} onChange={event => setNote({ ...note, [key]: event.target.value })} /></label>)}
        <fieldset className="doctor-entry-group"><legend>Đơn thuốc</legend>
          <p className="doctor-medication-caution">Kiểm tra thông tin dị ứng và tiền sử thuốc với người bệnh. MidHealth không tự kiểm tra tương tác thuốc hoặc tính phù hợp liều dùng.</p>
          {note.medicines.map((medicine, index) => <div className="doctor-entry-row doctor-medicine-row" key={`medicine-${index}`}>
            <label>Tên thuốc, hàm lượng<input required maxLength="200" value={medicine.name} onChange={event => setNote({ ...note, medicines: note.medicines.map((item, i) => i === index ? { ...item, name: event.target.value } : item) })} /></label>
            <label>Liều dùng<input required maxLength="200" value={medicine.dosage} onChange={event => setNote({ ...note, medicines: note.medicines.map((item, i) => i === index ? { ...item, dosage: event.target.value } : item) })} /></label>
            <label>Số lần dùng<input required maxLength="200" value={medicine.frequency} onChange={event => setNote({ ...note, medicines: note.medicines.map((item, i) => i === index ? { ...item, frequency: event.target.value } : item) })} /></label>
            <label>Thời gian dùng<input required maxLength="200" value={medicine.duration} onChange={event => setNote({ ...note, medicines: note.medicines.map((item, i) => i === index ? { ...item, duration: event.target.value } : item) })} /></label>
            <label>Số lượng<input required type="number" min="1" max="1000" value={medicine.quantity} onChange={event => setNote({ ...note, medicines: note.medicines.map((item, i) => i === index ? { ...item, quantity: Number(event.target.value) } : item) })} /></label>
            <button type="button" onClick={() => setNote({ ...note, medicines: note.medicines.filter((_, i) => i !== index) })}>Xóa thuốc</button>
          </div>)}
          <button type="button" disabled={note.medicines.length >= 30} onClick={() => setNote({ ...note, medicines: [...note.medicines, { name: '', dosage: '', frequency: '', duration: '', quantity: 1 }] })}>+ Thêm thuốc</button>
          {note.medicines.length > 0 && <label className="doctor-allergy-review"><input type="checkbox" checked={note.allergiesReviewed} onChange={event => setNote({ ...note, allergiesReviewed: event.target.checked })} />Tôi đã rà soát dị ứng và tiền sử thuốc với người bệnh trước khi kê đơn.</label>}
        </fieldset>
        <fieldset className="doctor-entry-group"><legend>Vật tư đã sử dụng</legend>
          {note.materials.map((material, index) => <div className="doctor-entry-row" key={`material-${index}`}>
            <label>Tên vật tư<input required maxLength="200" value={material.name} onChange={event => setNote({ ...note, materials: note.materials.map((item, i) => i === index ? { ...item, name: event.target.value } : item) })} /></label>
            <label>Số lượng<input required type="number" min="1" max="10000" value={material.quantity} onChange={event => setNote({ ...note, materials: note.materials.map((item, i) => i === index ? { ...item, quantity: Number(event.target.value) } : item) })} /></label>
            <button type="button" onClick={() => setNote({ ...note, materials: note.materials.filter((_, i) => i !== index) })}>Xóa vật tư</button>
          </div>)}
          <button type="button" disabled={note.materials.length >= 30} onClick={() => setNote({ ...note, materials: [...note.materials, { name: '', quantity: 1 }] })}>+ Thêm vật tư</button>
        </fieldset>
      </>}
      <div><button type="button" disabled={busy} onClick={() => { setVisit(null); setNote(newNote()); setVisitError(''); }}>{['profile_retry','details_retry'].includes(visit.mode) ? 'Đóng và lưu lại sau' : 'Đóng'}</button><button disabled={busy} type="submit">{busy ? 'Đang lưu...' : visit.mode === 'profile_retry' ? 'Thử lại cập nhật hồ sơ' : visit.mode === 'details_retry' ? 'Thử lại lưu chi tiết' : visit.mode === 'specialist_edit' ? 'Lưu chỉnh sửa' : visit.mode === 'specialist' ? 'Lưu kết quả' : 'Hoàn tất hồ sơ'}</button></div>
    </form></div>}
    {addendumVisit && <div className="doctor-modal" role="dialog" aria-modal="true" aria-labelledby="doctor-addendum-title"><form onSubmit={saveAddendum}>
      <h2 id="doctor-addendum-title">Bổ sung hồ sơ · {addendumVisit.patient_name}</h2>
      <p>Ghi chú bổ sung sẽ được lưu cùng tác giả và thời gian, không thay thế nội dung đã chốt.</p>
      {addendumError && <p role="alert" className="doctor-error">{addendumError}</p>}
      <label>Nội dung bổ sung<textarea required minLength={10} maxLength={4000} rows={6} value={addendumText} onChange={event => setAddendumText(event.target.value)} /></label>
      <div><button type="button" disabled={busy} onClick={() => { setAddendumVisit(null); setAddendumText(''); setAddendumError(''); }}>Hủy</button><button type="submit" disabled={busy}>{busy ? 'Đang lưu...' : 'Lưu bổ sung'}</button></div>
    </form></div>}
  </div>;
}
