import AdminSchedule from './admin_schedule';
import ClinicSettings from './clinic_settings';
import ClinicCatalog from './clinic_catalog';
import ClinicReport from './clinic_report';
import { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { firebaseAuth } from '../../lib/firebase';
import { apiBaseUrl } from '../../lib/api_base';
import { adminApiRequest, requireCompletePasswordReset } from '../../lib/admin_api';

const adminApiBaseUrl = apiBaseUrl;
const ADMIN_USERNAME = 'mid';
const ADMIN_AUTH_EMAIL = 'mid@admin.midhealth.local';
function adminLoginEmail(value = '') {
  const username = value.trim();
  return username.toLowerCase() === ADMIN_USERNAME ? ADMIN_AUTH_EMAIL : username;
}
function adminDisplayName(value = '') {
  return value.toLowerCase() === ADMIN_AUTH_EMAIL ? ADMIN_USERNAME : value;
}
function clinicToday() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function validateAdminEmail(value = '') {
  const email = adminLoginEmail(value);
  if (!email) return 'Vui lòng nhập tên đăng nhập.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Tên đăng nhập chưa hợp lệ.';
  return '';
}

function showAccountInlineError(field, message) {
  if (!field) return;
  const errorId = field.dataset.accountValidationMessage;
  if (errorId) {
    const current = document.getElementById(errorId);
    if (current) current.textContent = message;
    return;
  }
  const error = document.createElement('small');
  error.className = 'site-validation-error';
  error.id = `midhealth-account-validation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  error.setAttribute('role', 'alert');
  error.textContent = message;
  field.dataset.accountValidationMessage = error.id;
  field.setAttribute('aria-invalid', 'true');
  field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), error.id].filter(Boolean).join(' '));
  (field.closest('label') || field.parentElement)?.append(error);
}

function AccountCredentialsCard({ title, email, password, note, onDismiss }) {
  const [copied, setCopied] = useState('');
  async function copy(value, label) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else {
        const input = document.createElement('textarea');
        input.value = value;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.append(input);
        input.select();
        const copiedSuccessfully = document.execCommand('copy');
        input.remove();
        if (!copiedSuccessfully) throw new Error('copy failed');
      }
      setCopied(label);
    } catch {
      setCopied('Không thể sao chép');
    }
  }
  return <section className="admin-credential-card" role="status" aria-live="polite">
    <div className="admin-credential-heading"><div><strong>{title}</strong><p>Lưu lại và chuyển thông tin đăng nhập riêng cho đúng người.</p></div><button type="button" className="admin-credential-dismiss" onClick={onDismiss}>Ẩn thông tin</button></div>
    <div className="admin-credential-row"><span><small>Email đăng nhập</small><code>{email}</code></span><button type="button" onClick={() => copy(email, 'Đã sao chép email')}>Sao chép email</button></div>
    <div className="admin-credential-row"><span><small>Mật khẩu đăng nhập</small><code>{password}</code></span><button type="button" onClick={() => copy(password, 'Đã sao chép mật khẩu')}>Sao chép mật khẩu</button></div>
    {note && <p className="admin-credential-note">{note}</p>}
    {copied && <small className="admin-credential-feedback" aria-live="polite">{copied}</small>}
  </section>;
}

function PasswordField({ label, name, value, onChange, autoComplete = 'new-password' }) {
  const [visible, setVisible] = useState(false);
  return <label className="admin-password-field">{label}<span><input name={name} type={visible ? 'text' : 'password'} autoComplete={autoComplete} minLength={8} maxLength={128} value={value} onChange={onChange} /><button className="admin-password-toggle" type="button" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setVisible(current => !current)}>{visible ? 'Ẩn' : 'Hiện'}</button></span></label>;
}

const statusLabels = {
  no_show: 'Không đến',
  active: 'Đang hoạt động',
  disabled: 'Đã khóa',
  pending: 'Chờ xử lý',
  draft: 'Nháp',
  pending_review: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  paid: 'Đã thanh toán',
  unpaid: 'Chưa thanh toán',
  catalog_managed: 'Hồ sơ nội bộ',
};

function formatNumber(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0));
}

function formatMoney(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return 'Chưa có';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function normalizeText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toLowerCase();
}

async function adminRequest(path, token, options = {}) {
  return adminApiRequest(`${adminApiBaseUrl}${path}`, token, options, adminApiFetch);
}

async function loginAdminWithBackend(email, password) {
  const response = await adminApiFetch(`${apiBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, portal: 'admin' }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || 'Không thể đăng nhập admin qua backend.');
  }
  if (!payload.data?.idToken) {
    throw new Error('Backend đăng nhập thành công nhưng không trả Firebase ID token.');
  }
  return payload.data;
}

async function adminApiFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Không kết nối được máy chủ quản trị. Hãy kiểm tra backend đang chạy và tải lại trang.');
    }
    throw error;
  }
}

async function loginAdminWithFirebase(email, password) {
  const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
  const idToken = await credential.user.getIdToken();
  return {
    idToken,
    email: credential.user.email || email,
    displayName: credential.user.displayName || credential.user.email || email,
  };
}

function MetricCard({ label, value, helper, tone = 'default' }) {
  return (
    <article className={`admin-metric-card admin-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function StatusPill({ value }) {
  return <span className={`admin-status admin-status-${value || 'default'}`}>{statusLabels[value] || value || 'Không rõ'}</span>;
}

const auditEventLabels = {
  user_updated: 'Cập nhật tài khoản', user_password_reset: 'Cấp lại mật khẩu',
  appointment_status_updated: 'Cập nhật trạng thái lịch hẹn', appointment_checked_in: 'Tiếp nhận người bệnh',
  clinician_marked_absent: 'Bác sĩ báo vắng', clinician_delay_updated: 'Cập nhật giờ trễ',
  appointment_rescheduled: 'Chuyển lịch khám', appointment_received: 'Đặt lịch khám',
  appointment_cancelled_by_patient: 'Người bệnh hủy lịch', appointment_cancelled_by_payment: 'Hủy lịch do thanh toán',
};
const auditRoleLabels = { admin: 'Quản trị viên', staff: 'Nhân viên', doctor: 'Bác sĩ', head: 'Trưởng khoa', patient: 'Người bệnh', system: 'Hệ thống' };
function auditEventDescription(event) {
  const metadata = event.metadata || {};
  if (event.event_type === 'user_updated') {
    const changes = [];
    if (metadata.role) changes.push(`Vai trò: ${auditRoleLabels[metadata.role] || metadata.role}`);
    if (metadata.status) changes.push(`Trạng thái: ${statusLabels[metadata.status] || metadata.status}`);
    return changes.length ? `Quản trị viên đã cập nhật tài khoản (${changes.join(' · ')}).` : 'Quản trị viên đã cập nhật tài khoản.';
  }
  if (event.event_type === 'appointment_status_updated' && metadata.status) return `Trạng thái lịch hẹn: ${statusLabels[metadata.status] || metadata.status}.`;
  if (event.event_type === 'clinician_delay_updated' && Number.isFinite(Number(metadata.minutes))) return `Đã cập nhật thời gian trễ: ${metadata.minutes} phút.`;
  const descriptions = {
    user_password_reset: 'Quản trị viên đã cấp lại mật khẩu tài khoản.',
    appointment_checked_in: 'Nhân viên đã tiếp nhận lịch khám.',
    clinician_marked_absent: 'Quản trị viên đã ghi nhận bác sĩ vắng mặt.',
    appointment_rescheduled: 'Quản trị viên đã chuyển lịch khám sang khung giờ khác.',
    appointment_received: 'Hệ thống đã ghi nhận lịch khám mới.',
    appointment_cancelled_by_patient: 'Người bệnh đã hủy lịch khám.',
    appointment_cancelled_by_payment: 'Lịch khám đã bị hủy do thanh toán không hoàn tất.',
  };
  return descriptions[event.event_type] || event.message || 'Thao tác hệ thống đã được ghi nhận.';
}
function auditActorLabel(event) {
  const email = event.actor_email || '';
  if (event.actor_role !== 'patient' || !email.includes('@')) return email || 'Hệ thống';
  const [name, domain] = email.split('@');
  return `${name.slice(0, 1)}•••@${domain}`;
}
function auditDateKey(value) {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const date = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${date.year}-${date.month}-${date.day}`;
}
function filterRecentAuditEvents(events, filters) {
  return events.filter(event => {
    if (filters.eventType && event.event_type !== filters.eventType) return false;
    if (filters.actorRole && event.actor_role !== filters.actorRole) return false;
    const eventDate = auditDateKey(event.created_at);
    if (filters.from && eventDate < filters.from) return false;
    if (filters.to && eventDate > filters.to) return false;
    const search = normalizeText(filters.search);
    return !search || normalizeText([event.message, event.event_type, event.actor_email, auditEventDescription(event), auditEventLabels[event.event_type]].join(' ')).includes(search);
  });
}

function AuditEventList({ request }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ page: 1, eventType: '', actorRole: '', from: '', to: '', search: '' });
  const [result, setResult] = useState({ total: 0, totalPages: 1, page: 1 });
  const requestSequence = useRef(0);

  async function loadEvents() {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ page: String(filters.page), pageSize: '50' });
    Object.entries(filters).forEach(([key, value]) => { if (value && key !== 'page') params.set(key, value); });
    try {
      let data;
      try {
        data = await request(`/api/admin/audit-events?${params}`);
      } catch (endpointError) {
        if (endpointError.status !== 404) throw endpointError;
        const legacyDashboard = await request('/api/admin/dashboard');
        const recent = filterRecentAuditEvents(legacyDashboard.events || [], filters);
        data = { events: recent, total: recent.length, totalPages: 1, page: 1 };
      }
      if (sequence !== requestSequence.current) return;
      setEvents(data.events || []);
      setResult({ total: data.total || 0, totalPages: data.totalPages || 1, page: data.page || 1 });
    } catch (loadError) {
      if (sequence !== requestSequence.current) return;
      setEvents([]);
      setError(loadError.message || 'Không thể tải nhật ký.');
    } finally { if (sequence === requestSequence.current) setLoading(false); }
  }

  useEffect(() => { const timer = setTimeout(loadEvents, filters.search ? 250 : 0); return () => clearTimeout(timer); }, [filters.page, filters.eventType, filters.actorRole, filters.from, filters.to, filters.search]);
  const changeFilter = (key, value) => setFilters(current => ({ ...current, [key]: value, page: 1 }));

  return <>
    <div className="admin-audit-toolbar">
      <input aria-label="Tìm nhật ký" placeholder="Tìm nội dung, mã sự kiện hoặc email" maxLength={100} value={filters.search} onChange={event => changeFilter('search', event.target.value)} />
      <select aria-label="Lọc loại sự kiện" value={filters.eventType} onChange={event => changeFilter('eventType', event.target.value)}>
        <option value="">Tất cả sự kiện</option>{Object.entries(auditEventLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <select aria-label="Lọc người thực hiện" value={filters.actorRole} onChange={event => changeFilter('actorRole', event.target.value)}>
        <option value="">Tất cả vai trò</option>{Object.entries(auditRoleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label>Từ ngày<input type="date" value={filters.from} max={filters.to || undefined} onChange={event => changeFilter('from', event.target.value)} /></label>
      <label>Đến ngày<input type="date" value={filters.to} min={filters.from || undefined} onChange={event => changeFilter('to', event.target.value)} /></label>
      <button type="button" onClick={loadEvents} disabled={loading}>{loading ? 'Đang tải…' : 'Làm mới'}</button>
    </div>
    <div className="admin-audit-summary" aria-live="polite">{loading ? 'Đang tải nhật ký…' : `Có ${formatNumber(result.total)} sự kiện phù hợp`}</div>
    {error ? <div className="admin-audit-error" role="alert"><strong>Không tải được nhật ký</strong><p>{error}</p><button type="button" onClick={loadEvents}>Thử lại</button></div> : null}
    {!loading && !error && events.length === 0 ? <div className="admin-empty-panel"><strong>Không có sự kiện phù hợp</strong><p>Thử đổi bộ lọc hoặc khoảng ngày. Nhật ký chỉ hiển thị các thao tác mà hệ thống hiện đang ghi nhận.</p></div> : null}
    {!error && events.length > 0 ? <div className="admin-audit-list">
      {events.map(event => <article key={event.id}>
        <span className="admin-audit-event-type">{auditEventLabels[event.event_type] || 'Sự kiện hệ thống'}</span>
        <div className="admin-audit-event-content"><strong>{auditEventDescription(event)}</strong>
          <p><b>{auditActorLabel(event)}</b><span>{auditRoleLabels[event.actor_role] || event.actor_role || 'Chưa xác định'}</span><time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time></p>
        </div>
      </article>)}
    </div> : null}
    {!error && result.totalPages > 1 ? <nav className="admin-audit-pagination" aria-label="Phân trang nhật ký">
      <button type="button" disabled={loading || result.page <= 1} onClick={() => setFilters(current => ({ ...current, page: current.page - 1 }))}>Trước</button>
      <span>Trang {result.page} / {result.totalPages}</span>
      <button type="button" disabled={loading || result.page >= result.totalPages} onClick={() => setFilters(current => ({ ...current, page: current.page + 1 }))}>Sau</button>
    </nav> : null}
  </>;
}

export default function AdminDashboard({ onBackHome }) {
  const [authReady, setAuthReady] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [backendToken, setBackendToken] = useState('');
  const [adminChecked, setAdminChecked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginErrors, setLoginErrors] = useState({});
  const [dashboard, setDashboard] = useState(null);
  const [activeTab, setActiveTab] = useState('appointments');

  const [accountKindFilter, setAccountKindFilter] = useState('all');
  const [accountKeyword, setAccountKeyword] = useState('');
  const [doctorAccount, setDoctorAccount] = useState({ doctorId: '', role: 'doctor', password: '', confirmPassword: '' });
  const [createdDoctorCredentials, setCreatedDoctorCredentials] = useState(null);
  const [staffAccount, setStaffAccount] = useState({ fullName: '', email: '', password: '', confirmPassword: '' });
  const [createdStaffCredentials, setCreatedStaffCredentials] = useState(null);
  const [passwordResetNotice, setPasswordResetNotice] = useState('');
  const [passwordResetTarget, setPasswordResetTarget] = useState(null);
  const [passwordResetDraft, setPasswordResetDraft] = useState({ password: '', confirmPassword: '' });

  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState('');
  const [message, setMessage] = useState('');
  const [appointmentKeyword, setAppointmentKeyword] = useState('');
  const [appointmentStatus, setAppointmentStatus] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [visitAction, setVisitAction] = useState(null);
  const [visitForm, setVisitForm] = useState({});
  const [rescheduleDoctors, setRescheduleDoctors] = useState([]);
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const rescheduleRequestVersion = useRef(0);
  const filteredAppointments = (dashboard?.appointments || []).filter(item => (!appointmentStatus || item.status === appointmentStatus) && (!appointmentDate || item.appointment_date === appointmentDate) && normalizeText([item.patient_name, item.patient_phone, item.doctors?.full_name].join(' ')).includes(normalizeText(appointmentKeyword)));
  const metrics = dashboard?.metrics || {};
  const currentAdminEmail = adminDisplayName(dashboard?.admin?.email || adminUser?.email || email);

  const filteredAccounts = useMemo(() => (dashboard?.users || []).filter(item => (accountKindFilter === 'all' || item.role === accountKindFilter) && normalizeText((item.full_name || '') + ' ' + item.email).includes(normalizeText(accountKeyword))), [dashboard?.users, accountKindFilter, accountKeyword]);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (!active) return;
      if (!user) {
        setAdminUser(null);
        setBackendToken('');
        setAuthReady(true);
        return;
      }

      try {
        const idToken = await user.getIdToken(true);
        if (!active) return;
        setBackendToken(idToken);
        setAdminUser({
          email: user.email || '',
          displayName: user.displayName || user.email || '',
        });
        setEmail(adminDisplayName(user.email || ''));
      } catch {
        if (!active) return;
        setBackendToken('');
        setAdminUser(null);
      } finally {
        if (active) setAuthReady(true);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function loadDashboard() {
    if (!backendToken) return;
    setLoading(true);
    setMessage('');
    setAdminChecked(false);
    try {
      const data = await adminRequest('/api/admin/dashboard', backendToken);
      setDashboard(data);
    } catch (error) {
      setDashboard(null);
      setMessage(error.message);
    } finally {
      setAdminChecked(true);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (adminUser || backendToken) loadDashboard();
  }, [adminUser, backendToken]);

  async function handleLogin(event) {
    event.preventDefault();
    const errors = {};
    const emailMessage = validateAdminEmail(email);
    if (emailMessage) errors.email = emailMessage;
    if (!password) errors.password = 'Vui lòng nhập mật khẩu.';
    if (Object.keys(errors).length) {
      setLoginErrors(errors);
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const data = await loginAdminWithFirebase(adminLoginEmail(email), password);
      setBackendToken(data.idToken);
      setAdminUser({
        email: data.email || email.trim(),
        displayName: data.displayName || data.appUser?.full_name || data.email || email.trim(),
      });
    } catch (error) {
      setMessage(error.message || 'Đăng nhập admin không thành công.');
    } finally {
      setLoading(false);
    }
  }

  const canLogin = !loading && !validateAdminEmail(email) && Boolean(password);

  async function handleLogout() {
    setCreatedDoctorCredentials(null);
    setCreatedStaffCredentials(null);
    setPasswordResetNotice('');
    setPasswordResetTarget(null);
    setPasswordResetDraft({ password: '', confirmPassword: '' });
    setBackendToken('');
    setAdminUser(null);
    setDashboard(null);
    setMessage('');
    await signOut(firebaseAuth).catch(() => {});
  }

  async function updateAppointment(id, status) {
    const target = dashboard?.appointments?.find(item => item.id === id);
    if (status === 'cancelled' && target?.payment_status === 'paid' && !window.confirm('Lịch đã thanh toán. Hủy lịch không tự hoàn tiền. Xác nhận đã liên hệ bệnh nhân và sẽ xử lý hoàn tiền riêng?')) return;
    setActionId(id); setMessage('');
    try { await adminRequest('/api/admin/appointments/' + id, backendToken, { method: 'PATCH', body: JSON.stringify({ status }) }); await loadDashboard(); }
    catch (error) { setMessage(error.message); } finally { setActionId(''); }
  }

  async function createDoctor(event) {
    event.preventDefault();
    const doctorPicker = event.currentTarget.querySelector('[name="doctorId"]');
    const passwordInput = event.currentTarget.querySelector('[name="password"]');
    const confirmationInput = event.currentTarget.querySelector('[name="confirmPassword"]');
    if (!doctorAccount.doctorId) {
      showAccountInlineError(doctorPicker, 'Hãy chọn bác sĩ đã có hồ sơ trong danh sách.');
      doctorPicker?.focus();
      return;
    }
    if (doctorAccount.password.length < 8 || doctorAccount.password.length > 128 || doctorAccount.password !== doctorAccount.confirmPassword) {
      if (doctorAccount.password.length < 8 || doctorAccount.password.length > 128) showAccountInlineError(passwordInput, 'Mật khẩu cần có từ 8 đến 128 ký tự.');
      if (doctorAccount.password !== doctorAccount.confirmPassword) showAccountInlineError(confirmationInput, 'Mật khẩu xác nhận chưa khớp.');
      (doctorAccount.password.length < 8 || doctorAccount.password.length > 128 ? passwordInput : confirmationInput)?.focus();
      return;
    }
    setCreatedDoctorCredentials(null);
    setActionId('create-doctor'); setMessage('');
    try {
      const result = await adminRequest('/api/admin/doctor-accounts', backendToken, { method: 'POST', body: JSON.stringify({ doctorId: doctorAccount.doctorId, role: doctorAccount.role, password: doctorAccount.password }) });
      setCreatedDoctorCredentials({ email: result.email, password: result.password });
      setDoctorAccount({ doctorId: '', role: 'doctor', password: '', confirmPassword: '' });
      await loadDashboard();
    } catch (error) { setMessage(error.message); }
    finally { setActionId(''); }
  }

  async function createStaff(event) {
    event.preventDefault();
    const nameInput = event.currentTarget.querySelector('[name="fullName"]');
    const emailInput = event.currentTarget.querySelector('[name="email"]');
    const passwordInput = event.currentTarget.querySelector('[name="password"]');
    const confirmationInput = event.currentTarget.querySelector('[name="confirmPassword"]');
    const fullName = staffAccount.fullName.trim();
    const email = staffAccount.email.trim();
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const passwordIsValid = staffAccount.password.length >= 8 && staffAccount.password.length <= 128;
    const passwordMatches = staffAccount.password === staffAccount.confirmPassword;
    if (fullName.length < 2 || fullName.length > 120 || !emailIsValid || email.length > 254 || !passwordIsValid || !passwordMatches) {
      if (fullName.length < 2 || fullName.length > 120) showAccountInlineError(nameInput, 'Nhập họ tên từ 2 đến 120 ký tự.');
      if (!emailIsValid || email.length > 254) showAccountInlineError(emailInput, 'Nhập địa chỉ email hợp lệ, tối đa 254 ký tự.');
      if (!passwordIsValid) showAccountInlineError(passwordInput, 'Mật khẩu cần có từ 8 đến 128 ký tự.');
      if (!passwordMatches) showAccountInlineError(confirmationInput, 'Mật khẩu xác nhận chưa khớp.');
      (fullName.length < 2 || fullName.length > 120 ? nameInput : !emailIsValid || email.length > 254 ? emailInput : !passwordIsValid ? passwordInput : confirmationInput)?.focus();
      return;
    }
    setCreatedStaffCredentials(null);
    setActionId('create-staff'); setMessage('');
    try {
      const result = await adminRequest('/api/admin/staff-accounts', backendToken, { method: 'POST', body: JSON.stringify({ fullName, email, password: staffAccount.password }) });
      setCreatedStaffCredentials({ email: result.email, password: result.password });
      setStaffAccount({ fullName: '', email: '', password: '', confirmPassword: '' });
      await loadDashboard();
    } catch (error) { setMessage(error.message); }
    finally { setActionId(''); }
  }

  async function submitVisitAction(event) {
    event.preventDefault();
    if (!visitAction) return;
    const { id, action } = visitAction;
    setActionId(id); setMessage('');
    try {
      const path = action === 'check-in' ? 'check-in' : action === 'reschedule' ? 'reschedule' : 'disruption';
      const payload = action === 'check-in' ? { ...visitForm, patientName: String(visitForm.patientName || '').trim() } : visitForm;
      await adminRequest(`/api/admin/appointments/${id}/${path}`, backendToken, { method: 'POST', body: JSON.stringify(payload) });
      setVisitAction(null); setVisitForm({});
      await loadDashboard();
    } catch (error) { setMessage(error.message); }
    finally { setActionId(''); }
  }

  function openVisitAction(appointment, action) {
    const requestVersion = ++rescheduleRequestVersion.current;
    setMessage(''); setRescheduleLoading(action === 'reschedule'); setVisitAction({ id: appointment.id, action, appointment });
    setVisitForm(action === 'check-in' ? { patientName: '', birthDate: '' }
      : action === 'reschedule' ? { doctorId: '', fromDate: clinicToday(), slotId: '' }
        : { kind: action, minutes: 15, note: '' });
    if (action === 'reschedule') {
      setRescheduleLoading(true); setRescheduleSlots([]); setRescheduleDoctors([]);
      adminRequest('/api/doctors', backendToken).then(doctors => {
        if (requestVersion === rescheduleRequestVersion.current) setRescheduleDoctors((doctors || []).filter(doctor => doctor.specialtyId === appointment.specialty_id && doctor.bookable));
      }).catch(error => { if (requestVersion === rescheduleRequestVersion.current) setMessage(error.message); }).finally(() => { if (requestVersion === rescheduleRequestVersion.current) setRescheduleLoading(false); });
    }
  }

  async function loadRescheduleSlots(doctorId, fromDate) {
    const requestVersion = ++rescheduleRequestVersion.current;
    setRescheduleSlots([]);
    if (!doctorId) { setRescheduleLoading(false); return; }
    setRescheduleLoading(true); setMessage('');
    try {
      const params = new URLSearchParams({ days: '14' });
      if (fromDate) params.set('from', fromDate);
      const slots = await adminRequest(`/api/doctors/${encodeURIComponent(doctorId)}/slots?${params}`, backendToken);
      if (requestVersion === rescheduleRequestVersion.current) setRescheduleSlots((slots || []).filter(slot => slot.status !== 'full'));
    } catch (error) { if (requestVersion === rescheduleRequestVersion.current) setMessage(error.message); }
    finally { if (requestVersion === rescheduleRequestVersion.current) setRescheduleLoading(false); }
  }

  async function updateUser(userId, patch) {
    setActionId(userId);
    setMessage('');
    try {
      await adminRequest(`/api/admin/users/${encodeURIComponent(userId)}`, backendToken, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await loadDashboard();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setActionId('');
    }
  }

  function resetClinicPassword(account) {
    setPasswordResetNotice('');
    setPasswordResetDraft({ password: '', confirmPassword: '' });
    setPasswordResetTarget(account);
  }

  async function submitPasswordReset(event) {
    event.preventDefault();
    if (!passwordResetTarget) return;
    const passwordInput = event.currentTarget.querySelector('[name="password"]');
    const confirmationInput = event.currentTarget.querySelector('[name="confirmPassword"]');
    const validPassword = passwordResetDraft.password.length >= 8 && passwordResetDraft.password.length <= 128;
    const matches = passwordResetDraft.password === passwordResetDraft.confirmPassword;
    if (!validPassword || !matches) {
      if (!validPassword) showAccountInlineError(passwordInput, 'Mật khẩu cần có từ 8 đến 128 ký tự.');
      if (!matches) showAccountInlineError(confirmationInput, 'Mật khẩu xác nhận chưa khớp.');
      (validPassword ? confirmationInput : passwordInput)?.focus();
      return;
    }
    const target = passwordResetTarget;
    setActionId(`password:${target.id}`);
    setMessage('');
    try {
      const result = await adminRequest(`/api/admin/users/${encodeURIComponent(target.id)}/password-reset`, backendToken, { method: 'POST', body: JSON.stringify({ password: passwordResetDraft.password }) });
      requireCompletePasswordReset(result);
      setPasswordResetNotice(result.message || `Đã cập nhật mật khẩu Firebase cho ${target.email}.`);
      setPasswordResetTarget(null);
      setPasswordResetDraft({ password: '', confirmPassword: '' });
      await loadDashboard();
    } catch (error) { setMessage(error.message); }
    finally { setActionId(''); }
  }

  if (!authReady) {
    return <div className="admin-loading">Đang kiểm tra phiên admin...</div>;
  }

  if (!adminUser && !backendToken) {
    return (
      <section className="admin-login-page admin-security-login">
        <div className="admin-login-card">
          <button type="button" className="admin-back-link" onClick={onBackHome}>Về trang chủ</button>
          <span className="admin-lock-badge">Quản trị phòng khám</span>
          <h1>Đăng nhập admin</h1>
          <p>Dành cho quản trị viên được cấp quyền quản lý phòng khám.</p>
          <form onSubmit={handleLogin} className="admin-login-form" noValidate>
            <label>
              Tên đăng nhập admin
              <input
                className={loginErrors.email ? 'has-error' : ''}
                type="text"
                inputMode="text"
                value={email}
                onChange={(event) => {
                  const nextEmail = event.target.value;
                  setEmail(nextEmail);
                  setLoginErrors((current) => ({ ...current, email: nextEmail ? validateAdminEmail(nextEmail) : '' }));
                }}
                autoComplete="username"
              />
              {loginErrors.email ? <small className="field-error">{loginErrors.email}</small> : null}
            </label>
            <label>
              Mật khẩu
              <input
                className={loginErrors.password ? 'has-error' : ''}
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setLoginErrors((current) => ({ ...current, password: '' }));
                }}
                autoComplete="current-password"
              />
              {loginErrors.password ? <small className="field-error">{loginErrors.password}</small> : null}
            </label>
            {message ? <div className="admin-alert">{message}</div> : null}
            <button type="submit" disabled={!canLogin}>{loading ? 'Đang đăng nhập...' : 'Vào trang admin'}</button>
          </form>
        </div>
        <aside className="admin-login-panel admin-security-panel">
          <span className="admin-shield">MH</span>
          <strong>Một nơi quản lý phòng khám</strong>
          <p>Theo dõi lịch hẹn, sắp xếp lịch khám và chăm sóc người bệnh trong cùng một giao diện.</p>
          <div className="admin-security-list">
            <span>Lịch hẹn bệnh nhân</span>
            <span>Bác sĩ và chuyên khoa</span>
            <span>Lịch làm việc</span>
            <span>Thông tin phòng khám</span>
          </div>
        </aside>
      </section>
    );
  }

  if (!dashboard) {
    return (
      <section className="admin-login-page admin-access-page">
        <div className="admin-login-card">
          <button type="button" className="admin-back-link" onClick={onBackHome}>Về trang chủ</button>
          <span className="admin-eyebrow">Kiểm tra quyền quản trị</span>
          <h1>{loading || !adminChecked ? 'Đang xác minh tài khoản admin' : 'Không thể vào trang admin'}</h1>
          <p>
            Tài khoản hiện tại là <strong>{currentAdminEmail}</strong>. Tài khoản cần có quyền quản trị và đang hoạt động để mở trang này.
          </p>
          {message ? <div className="admin-alert">{message}</div> : null}
          <div className="admin-access-actions">
            <button type="button" onClick={loadDashboard} disabled={loading}>{loading ? 'Đang kiểm tra...' : 'Kiểm tra lại'}</button>
            <button type="button" onClick={handleLogout}>Đăng xuất để đổi tài khoản</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span>MH</span>
          <div>
            <strong>MidHealth</strong>
            <small>Trung tâm quản trị</small>
          </div>
        </div>
        <nav className="admin-nav-group" aria-label="Vận hành phòng khám">
          <span className="admin-nav-label">Vận hành phòng khám</span>
          <button className={activeTab === 'appointments' ? 'active' : ''} type="button" onClick={() => setActiveTab('appointments')}><span>Lịch hẹn</span><small>{formatNumber(metrics.todayAppointments)}</small></button>
          <button className={activeTab === 'schedule' ? 'active' : ''} type="button" onClick={() => setActiveTab('schedule')}>Lịch làm việc</button>
        </nav>
        <nav className="admin-nav-group" aria-label="Dữ liệu phòng khám">
          <span className="admin-nav-label">Dữ liệu phòng khám</span>
          <button className={activeTab === 'clinic' ? 'active' : ''} type="button" onClick={() => setActiveTab('clinic')}>Thông tin phòng khám</button>
          <button className={activeTab === 'clinic-catalog' ? 'active' : ''} type="button" onClick={() => setActiveTab('clinic-catalog')}><span>Bác sĩ & chuyên khoa</span></button>
          <button className={activeTab === 'users' ? 'active' : ''} type="button" onClick={() => setActiveTab('users')}><span>Tài khoản</span><small>{formatNumber(metrics.totalUsers)}</small></button>
          <button className={activeTab === 'reports' ? 'active' : ''} type="button" onClick={() => setActiveTab('reports')}>Báo cáo</button>
          <button className={activeTab === 'audit' ? 'active' : ''} type="button" onClick={() => setActiveTab('audit')}><span>Nhật ký</span></button>
        </nav>
        <div className="admin-sidebar-account">
          <span>Đang đăng nhập</span>
          <strong>{currentAdminEmail}</strong>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <span className="admin-eyebrow">Bảng điều khiển vận hành</span>
            <h1>Quản trị MidHealth</h1>
            <p>Quản lý phòng khám · {currentAdminEmail}</p>
          </div>
          <div className="admin-topbar-actions"><button type="button" onClick={onBackHome}>Xem website ↗</button>
            <button type="button" onClick={loadDashboard} disabled={loading}>{loading ? 'Đang tải...' : 'Làm mới'}</button>
            <button type="button" onClick={handleLogout}>Đăng xuất</button>
          </div>
        </header>

        {message ? <div className="admin-alert">{message}</div> : null}

        {activeTab === 'appointments' && <div className="admin-metric-grid">
          <MetricCard label="Tài khoản hệ thống" value={formatNumber(metrics.totalUsers)} helper={`${formatNumber(metrics.totalPatients)} hồ sơ bệnh nhân`} />
          <MetricCard label="Lịch hẹn hôm nay" value={formatNumber(metrics.todayAppointments)} helper={`${formatNumber(metrics.totalAppointments)} lịch hẹn toàn hệ thống`} tone="info" />
          <MetricCard label="Doanh thu đã thu" value={formatMoney(metrics.revenue)} helper={`${formatNumber(metrics.paidPayments)} giao dịch thành công`} tone="success" />
          <MetricCard label="Đội ngũ bác sĩ" value={formatNumber(metrics.totalDoctors)} helper="Bác sĩ của phòng khám" />
        </div>}

        {activeTab === 'schedule' && <AdminSchedule request={(path, options) => adminRequest(path, backendToken, options)} />}
        {activeTab === 'reports' && <ClinicReport request={(path) => adminRequest(path, backendToken)} />}
        {activeTab === 'clinic' && <ClinicSettings profile={dashboard.clinic} request={async payload => adminRequest('/api/admin/clinic', backendToken, { method: 'PUT', body: JSON.stringify(payload) })} uploadImage={payload => adminRequest('/api/admin/clinic/catalog/image', backendToken, { method: 'POST', body: JSON.stringify(payload) })} onSaved={loadDashboard} />}
        {activeTab === 'clinic-catalog' && <ClinicCatalog request={payload => adminRequest('/api/admin/clinic/catalog', backendToken, payload ? { method: 'POST', body: JSON.stringify(payload) } : {})} uploadImage={payload => adminRequest('/api/admin/clinic/catalog/image', backendToken, { method: 'POST', body: JSON.stringify(payload) })} onSaved={loadDashboard} />}

        {activeTab === 'appointments' ? (
          <section className="admin-card">
            <div className="admin-section-heading"><div><h2>Lịch hẹn bệnh nhân</h2><p>Hiển thị mọi lịch chờ xử lý và 500 lịch gần nhất; bộ lọc áp dụng trong danh sách này.</p></div><span className="admin-count">{filteredAppointments.length} lịch trong danh sách</span></div>
            {!dashboard.visitWorkflowAvailable && <p className="admin-alert" role="status">Quy trình tiếp nhận và xử lý bác sĩ vắng/trễ đang chờ cập nhật dữ liệu. Danh sách lịch hẹn vẫn có thể xem và cập nhật trạng thái.</p>}
          <div className="admin-review-toolbar"><input aria-label="Tìm lịch hẹn" placeholder="Tên bệnh nhân, điện thoại, bác sĩ" value={appointmentKeyword} onChange={e => setAppointmentKeyword(e.target.value)} /><input type="date" aria-label="Ngày khám" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} /><select aria-label="Trạng thái lịch" value={appointmentStatus} onChange={e => setAppointmentStatus(e.target.value)}><option value="">Tất cả trạng thái</option>{['pending', 'confirmed', 'completed', 'cancelled', 'no_show'].map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></div>{!filteredAppointments.length && <p className="admin-empty-panel">Không có lịch hẹn phù hợp.</p>}
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Bệnh nhân</th><th>Ngày khám</th><th>Nơi khám</th><th>Thanh toán</th><th>Trạng thái</th><th>Tiếp nhận</th></tr></thead>
                <tbody>
                  {filteredAppointments.map((appointment) => (
                    <tr key={appointment.id}>
                      <td><strong>{appointment.patient_name}</strong><small>{appointment.patient_phone || 'Chưa có SĐT'}</small><small>{appointment.queue_tickets?.[0]?.appointment_code || ''}</small></td>
                      <td>{formatDate(appointment.appointment_date)}<small>{appointment.appointment_time_text || 'Chưa chọn giờ'}</small></td>
                      <td>{appointment.doctors?.full_name || 'Chưa xác định'}</td>
                      <td>{formatMoney(appointment.final_amount)}<small><StatusPill value={appointment.payment_status} /></small>{appointment.payment_status === 'pending' && <small>PayPal đang chờ đối soát; kiểm tra giao dịch trước khi hủy lịch.</small>}{appointment.status === 'cancelled' && appointment.payment_status === 'paid' && <small>Cần đối soát / hoàn cọc thủ công</small>}</td>
                      <td><StatusPill value={appointment.status} />{!['completed', 'cancelled', 'no_show'].includes(appointment.status) && <select aria-label={'Cập nhật lịch ' + appointment.patient_name} disabled={actionId === appointment.id} value="" onChange={event => updateAppointment(appointment.id, event.target.value)}><option value="">Cập nhật trạng thái</option>{appointment.payment_status === 'paid' && <option value="confirmed">Xác nhận</option>}{appointment.payment_status !== 'pending' && <option value="cancelled">Hủy lịch</option>}{appointment.status === 'confirmed' && <option value="no_show">Không đến sau 15 phút</option>}</select>}</td>
                      <td className="admin-actions">
                        {dashboard.visitWorkflowAvailable && appointment.status === 'confirmed' && <>
                          {!appointment.clinician_absent && (!appointment.checked_in_at ? <button type="button" onClick={() => openVisitAction(appointment, 'check-in')}>Đối chiếu và tiếp nhận</button> : <small>Đã tiếp nhận · bác sĩ ghi kết quả khám</small>)}
                          {!appointment.clinician_absent && <button type="button" onClick={() => openVisitAction(appointment, 'delay')}>Bác sĩ trễ</button>}
                          {!appointment.clinician_absent && <button type="button" onClick={() => openVisitAction(appointment, 'absent')}>Bác sĩ vắng</button>}
                          {!appointment.checked_in_at && <button type="button" onClick={() => openVisitAction(appointment, 'reschedule')}>Chuyển lịch</button>}
                        </>}
                        {appointment.clinician_absent && <small>Cần liên hệ đổi lịch hoặc hủy và xử lý thanh toán.</small>}
                        {appointment.delay_minutes > 0 && <small>Trễ dự kiến {appointment.delay_minutes} phút</small>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === 'users' && <section className="admin-card"><div className="admin-section-heading"><div><h2>Tài khoản phòng khám</h2><p>Quản lý tài khoản đăng nhập và quyền truy cập của nhân viên, bác sĩ.</p></div><span className="admin-count">{formatNumber(filteredAccounts.length)} tài khoản</span></div>
          <p className="admin-account-guide">Chọn đúng phần theo đối tượng cần cấp quyền. Đây là hai quy trình độc lập, không cần thực hiện lần lượt.</p>
          {!dashboard.firebaseAdminConfigured && <p className="admin-password-reset-readiness" role="status">Backend chưa cấu hình Firebase Admin service account nên chưa thể đổi mật khẩu.</p>}
          <div className="admin-account-flow"><h3>Nhân viên phòng khám</h3><p>Dùng cho lễ tân hoặc nhân viên chưa có tài khoản. Nhập thông tin nhân viên và tự đặt mật khẩu dễ nhớ để chuyển riêng cho họ.</p><form noValidate className="admin-account-create-form admin-account-create-staff" onSubmit={createStaff}><input name="fullName" aria-label="Họ tên nhân viên" placeholder="Họ tên nhân viên" maxLength={120} value={staffAccount.fullName} onChange={event => setStaffAccount({ ...staffAccount, fullName: event.target.value })} /><input name="email" aria-label="Email nhân viên" type="email" maxLength={254} placeholder="Email đăng nhập của nhân viên" value={staffAccount.email} onChange={event => setStaffAccount({ ...staffAccount, email: event.target.value })} /><PasswordField label="Mật khẩu (tối thiểu 8 ký tự)" name="password" value={staffAccount.password} onChange={event => setStaffAccount({ ...staffAccount, password: event.target.value })} /><PasswordField label="Nhập lại mật khẩu" name="confirmPassword" value={staffAccount.confirmPassword} onChange={event => setStaffAccount({ ...staffAccount, confirmPassword: event.target.value })} /><button type="submit" disabled={actionId === 'create-staff'}>{actionId === 'create-staff' ? 'Đang tạo...' : 'Tạo tài khoản nhân viên'}</button></form></div>
          {createdStaffCredentials && <AccountCredentialsCard title="Tài khoản nhân viên đã tạo" email={createdStaffCredentials.email} password={createdStaffCredentials.password} onDismiss={() => setCreatedStaffCredentials(null)} />}
          {dashboard.doctorAccountsAvailable ? <div className="admin-account-flow"><h3>Bác sĩ đã có hồ sơ</h3><p>Chọn hồ sơ bác sĩ chưa có tài khoản, vai trò và tự đặt mật khẩu dễ nhớ.</p><form noValidate className="admin-account-create-form admin-account-create-doctor" onSubmit={createDoctor}><select name="doctorId" aria-label="Chọn bác sĩ để tạo tài khoản" value={doctorAccount.doctorId} onChange={e => setDoctorAccount({ ...doctorAccount, doctorId: e.target.value })}><option value="">Chọn bác sĩ chưa có tài khoản</option>{(dashboard.doctors || []).filter(doctor => doctor.is_active && !(dashboard.users || []).some(account => account.doctor_id === doctor.id)).map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.full_name}</option>)}</select><select aria-label="Vai trò bác sĩ" value={doctorAccount.role} onChange={e => setDoctorAccount({ ...doctorAccount, role: e.target.value })}><option value="doctor">Bác sĩ chuyên khoa</option><option value="head">Trưởng khoa</option></select><PasswordField label="Mật khẩu (tối thiểu 8 ký tự)" name="password" value={doctorAccount.password} onChange={e => setDoctorAccount({ ...doctorAccount, password: e.target.value })} /><PasswordField label="Nhập lại mật khẩu" name="confirmPassword" value={doctorAccount.confirmPassword} onChange={e => setDoctorAccount({ ...doctorAccount, confirmPassword: e.target.value })} /><button type="submit" disabled={actionId === 'create-doctor'}>{actionId === 'create-doctor' ? 'Đang tạo...' : 'Cấp tài khoản bác sĩ'}</button></form>{createdDoctorCredentials && <AccountCredentialsCard title="Tài khoản bác sĩ đã tạo" email={createdDoctorCredentials.email} password={createdDoctorCredentials.password} onDismiss={() => setCreatedDoctorCredentials(null)} />}</div> : <p className="admin-alert" role="status">Tạo tài khoản bác sĩ đang chờ cập nhật dữ liệu.</p>}
          {passwordResetTarget && <form noValidate className="admin-password-reset-form" onSubmit={submitPasswordReset}><div><strong>Đặt mật khẩu mới cho {passwordResetTarget.full_name || passwordResetTarget.email}</strong><p>Mật khẩu được cập nhật trực tiếp trên Firebase. Sau khi lưu, người dùng đăng nhập bằng mật khẩu mới; các phiên đăng nhập cũ sẽ bị thu hồi.</p></div><PasswordField label="Mật khẩu mới (tối thiểu 8 ký tự)" name="password" value={passwordResetDraft.password} onChange={e => setPasswordResetDraft({ ...passwordResetDraft, password: e.target.value })} /><PasswordField label="Nhập lại mật khẩu mới" name="confirmPassword" value={passwordResetDraft.confirmPassword} onChange={e => setPasswordResetDraft({ ...passwordResetDraft, confirmPassword: e.target.value })} /><div className="admin-password-reset-actions"><button type="submit" disabled={actionId === `password:${passwordResetTarget.id}`}>{actionId === `password:${passwordResetTarget.id}` ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}</button><button type="button" onClick={() => setPasswordResetTarget(null)}>Hủy</button></div></form>}
          {passwordResetNotice && <p className="admin-password-reset-success" role="status">{passwordResetNotice}</p>}
          <div className="admin-review-toolbar"><input aria-label="Tìm người dùng" placeholder="Tìm họ tên hoặc email" value={accountKeyword} onChange={e => setAccountKeyword(e.target.value)} /><select aria-label="Lọc vai trò" value={accountKindFilter} onChange={e => setAccountKindFilter(e.target.value)}><option value="all">Tất cả</option><option value="patient">Người dùng</option><option value="doctor">Bác sĩ</option><option value="head">Trưởng khoa</option><option value="staff">Nhân viên</option><option value="admin">Admin</option></select></div>
          <div className="admin-table-wrap admin-account-table-wrap"><table className="admin-table"><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{filteredAccounts.map(item => <tr key={item.id}><td><strong>{item.full_name || 'Chưa cập nhật'}</strong><small>{item.email}</small></td><td>{item.role === 'admin' ? 'Admin' : item.role === 'doctor' ? 'Bác sĩ' : item.role === 'head' ? 'Trưởng khoa' : item.role === 'staff' ? 'Nhân viên' : 'Người dùng'}</td><td><StatusPill value={item.status} /></td><td className="admin-actions">{['doctor', 'head'].includes(item.role) ? <select aria-label={'Vai trò bác sĩ ' + item.email} value={item.role} disabled={actionId === item.id} onChange={e => updateUser(item.id, { role: e.target.value })}><option value="doctor">Bác sĩ</option><option value="head">Trưởng khoa</option></select> : <select aria-label={'Vai trò của ' + item.email} value={item.role} disabled={actionId === item.id || item.id === dashboard.admin.id} onChange={e => updateUser(item.id, { role: e.target.value })}><option value="patient">Người dùng</option><option value="staff">Nhân viên</option><option value="admin">Admin</option></select>}{['doctor', 'head', 'staff'].includes(item.role) && item.auth_provider === 'password' && <button className="admin-action-primary" disabled={!dashboard.firebaseAdminConfigured || actionId === item.id || actionId === `password:${item.id}`} title={!dashboard.firebaseAdminConfigured ? 'Backend chưa cấu hình Firebase Admin service account' : undefined} onClick={() => resetClinicPassword(item)}>{actionId === `password:${item.id}` ? '\u0110ang c\u1EA5p...' : 'C\u1EA5p l\u1EA1i m\u1EADt kh\u1EA9u'}</button>}<button disabled={actionId === item.id || item.id === dashboard.admin.id} onClick={() => updateUser(item.id, { status: item.status === 'active' ? 'disabled' : 'active' })}>{item.status === 'active' ? 'Khóa' : 'Mở'}</button></td></tr>)}</tbody></table></div>{!filteredAccounts.length && <p className="admin-empty-panel">Không có người dùng phù hợp.</p>}
        </section>}

        {activeTab === 'audit' ? (
          <section className="admin-card">
            <div className="admin-section-heading">
              <div>
                <h2>Nhật ký vận hành</h2>
                <p>Tra cứu thao tác hệ thống đã ghi nhận theo người thực hiện, loại sự kiện và thời gian.</p>
              </div>
            </div>
            <AuditEventList request={(path, options) => adminRequest(path, backendToken, options)} />
          </section>
        ) : null}
      </main>
      {visitAction && (
        <div className="app-confirm-backdrop">
          <form className="app-confirm-modal admin-visit-form" role="dialog" aria-modal="true" onSubmit={submitVisitAction}>
            <header><h2>{visitAction.action === 'check-in' ? 'Đối chiếu bệnh nhân' : visitAction.action === 'reschedule' ? 'Chuyển lịch khám' : visitAction.action === 'delay' ? 'Thông báo bác sĩ trễ' : 'Thông báo bác sĩ vắng'}</h2></header>
            <section>
              <p>Mã phiếu: {visitAction.appointment.queue_tickets?.[0]?.appointment_code || '—'} · {visitAction.appointment.patient_name}</p>
              {visitAction.action === 'check-in' && <>
                <p>Yêu cầu người đến khám tự nêu họ tên và ngày sinh; đối chiếu giấy tờ trước khi nhập. Không dùng mã phiếu làm thông tin định danh duy nhất.</p>
                <label>Họ tên do bệnh nhân cung cấp<input required minLength="2" maxLength="160" autoComplete="off" value={visitForm.patientName || ''} onChange={e => setVisitForm({ ...visitForm, patientName: e.target.value })} /></label>
                <label>Ngày sinh do bệnh nhân cung cấp<input required type="date" max={clinicToday()} value={visitForm.birthDate || ''} onChange={e => setVisitForm({ ...visitForm, birthDate: e.target.value })} /></label>
              </>}
              {visitAction.action === 'delay' && <><label>Số phút trễ dự kiến<input type="number" min="1" max="240" required value={visitForm.minutes || ''} onChange={e => setVisitForm({ ...visitForm, minutes: Number(e.target.value) })} /></label><label>Ghi chú cho bệnh nhân<input maxLength={500} value={visitForm.note || ''} onChange={e => setVisitForm({ ...visitForm, note: e.target.value })} /></label></>}
              {visitAction.action === 'absent' && <p>Bệnh nhân sẽ thấy thông báo bác sĩ vắng. Nhân viên cần liên hệ trực tiếp để đổi lịch/bác sĩ hoặc hủy và xử lý khoản đã thanh toán.</p>}
              {visitAction.action === 'reschedule' && <>
                <p>Chỉ chuyển sang bác sĩ cùng chuyên khoa và giờ còn chỗ. Hãy xác nhận giờ mới với bệnh nhân trước khi lưu. Mã phiếu và khoản đã thanh toán được giữ nguyên.</p>
                <label>Bác sĩ thay thế<select required value={visitForm.doctorId || ''} onChange={e => { const doctorId = e.target.value; setVisitForm({ ...visitForm, doctorId, slotId: '' }); loadRescheduleSlots(doctorId, visitForm.fromDate); }}><option value="">Chọn bác sĩ</option>{rescheduleDoctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label>
                {!rescheduleLoading && !rescheduleDoctors.length && <p>Chưa có bác sĩ cùng chuyên khoa đang nhận lịch. Vui lòng liên hệ bệnh nhân để thống nhất phương án khác.</p>}
                <label>Tìm lịch từ ngày<input type="date" min={clinicToday()} value={visitForm.fromDate || ''} onChange={e => { const fromDate = e.target.value; setVisitForm({ ...visitForm, fromDate, slotId: '' }); loadRescheduleSlots(visitForm.doctorId, fromDate); }} /></label>
                <label>Khung giờ mới<select required value={visitForm.slotId || ''} onChange={e => setVisitForm({ ...visitForm, slotId: e.target.value })}><option value="">{rescheduleLoading ? 'Đang tải...' : 'Chọn khung giờ'}</option>{rescheduleSlots.filter(slot => slot.id !== visitAction.appointment.appointment_slot_id).map(slot => <option key={slot.id} value={slot.id}>{slot.date} · {slot.label} · còn {slot.capacity - slot.bookedCount} chỗ</option>)}</select></label>
                {!rescheduleLoading && visitForm.doctorId && !rescheduleSlots.length && <p>Không có khung giờ còn chỗ trong 14 ngày. Thử ngày khác hoặc liên hệ bệnh nhân để hủy.</p>}
              </>}
              {message && <p role="alert">{message}</p>}
            </section>
            <footer><button type="button" onClick={() => { rescheduleRequestVersion.current++; setVisitAction(null); setMessage(''); setRescheduleLoading(false); }}>Đóng</button><button className="confirm" disabled={actionId === visitAction.id || rescheduleLoading} type="submit">{actionId === visitAction.id ? 'Đang lưu...' : 'Xác nhận'}</button></footer>
          </form>
        </div>
      )}
    </section>
  );
}
