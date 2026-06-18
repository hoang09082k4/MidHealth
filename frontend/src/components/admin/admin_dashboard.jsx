import { useEffect, useMemo, useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseAuth } from '../../lib/firebase';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const emptyArticleForm = {
  id: '',
  title: '',
  slug: '',
  categoryId: '',
  summary: '',
  content: '',
  thumbnailUrl: '',
  imageDataUrl: '',
  status: 'draft',
  isFeatured: false,
};

function validateAdminEmail(value = '') {
  const email = value.trim();
  if (!email) return 'Vui lòng nhập email admin.';
  if (!email.includes('@')) return 'Email cần có ký tự @.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email admin chưa đúng định dạng.';
  return '';
}

const statusLabels = {
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
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = response.status === 404
      ? 'API admin chưa sẵn sàng trên backend. Hãy restart backend để nạp route /api/admin/dashboard.'
      : payload.message || 'Không thể xử lý yêu cầu admin.';
    throw new Error(message);
  }
  return payload.data;
}

async function loginAdminWithBackend(email, password) {
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
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

function AuditEventList({ events = [] }) {
  if (!events.length) {
    return (
      <div className="admin-empty-panel">
        <strong>Chưa có nhật ký vận hành</strong>
        <p>Các thao tác duyệt hồ sơ, cập nhật lịch và thay đổi dữ liệu quan trọng sẽ hiển thị tại đây.</p>
      </div>
    );
  }

  return (
    <div className="admin-audit-list">
      {events.map((event) => (
        <article key={event.id}>
          <span>{event.event_type}</span>
          <div>
            <strong>{event.message}</strong>
            <p>{event.actor_email || 'system'} · {event.entity_type} · {formatDateTime(event.created_at)}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function AdminDashboard({ onBackHome }) {
  const [authReady] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [backendToken, setBackendToken] = useState('');
  const [adminChecked, setAdminChecked] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginErrors, setLoginErrors] = useState({});
  const [dashboard, setDashboard] = useState(null);
  const [activeTab, setActiveTab] = useState('providers');
  const [providerStatusFilter, setProviderStatusFilter] = useState('all');
  const [providerKeyword, setProviderKeyword] = useState('');
  const [accountKindFilter, setAccountKindFilter] = useState('all');
  const [accountKeyword, setAccountKeyword] = useState('');
  const [catalogKindFilter, setCatalogKindFilter] = useState('all');
  const [catalogKeyword, setCatalogKeyword] = useState('');
  const [catalogHomepageDrafts, setCatalogHomepageDrafts] = useState({});
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState('');
  const [message, setMessage] = useState('');
  const [articleForm, setArticleForm] = useState(emptyArticleForm);
  const [articleEditorOpen, setArticleEditorOpen] = useState(false);
  const [deleteArticleTarget, setDeleteArticleTarget] = useState(null);

  const metrics = dashboard?.metrics || {};
  const currentAdminEmail = dashboard?.admin?.email || adminUser?.email || email;
  const pendingProviders = useMemo(
    () => (dashboard?.providers || []).filter((provider) => provider.status === 'pending_review'),
    [dashboard],
  );
  const filteredProviders = useMemo(() => {
    const keyword = normalizeText(providerKeyword.trim());
    return (dashboard?.providers || [])
      .filter((provider) => providerStatusFilter === 'all' || provider.status === providerStatusFilter)
      .filter((provider) => !keyword || normalizeText([
        provider.clinic_name,
        provider.owner_name,
        provider.email,
        provider.specialty,
        provider.clinic_address,
      ].filter(Boolean).join(' ')).includes(keyword));
  }, [dashboard?.providers, providerKeyword, providerStatusFilter]);
  const filteredAccounts = useMemo(() => {
    const keyword = normalizeText(accountKeyword.trim());
    return (dashboard?.accountDirectory || dashboard?.users || [])
      .filter((item) => accountKindFilter === 'all' || item.kind === accountKindFilter || item.role === accountKindFilter)
      .filter((item) => !keyword || normalizeText([
        item.displayName,
        item.full_name,
        item.email,
        item.role,
        item.kind,
        item.specialty,
        item.workplace,
        item.address,
        item.sourceLabel,
      ].filter(Boolean).join(' ')).includes(keyword));
  }, [accountKeyword, accountKindFilter, dashboard?.accountDirectory, dashboard?.users]);
  const catalogItems = useMemo(
    () => (dashboard?.accountDirectory || []).filter((item) => item.hasCatalog),
    [dashboard?.accountDirectory],
  );
  const filteredCatalogItems = useMemo(() => {
    const keyword = normalizeText(catalogKeyword.trim());
    return catalogItems
      .filter((item) => catalogKindFilter === 'all' || item.kind === catalogKindFilter)
      .filter((item) => !keyword || normalizeText([
        item.displayName,
        item.specialty,
        item.workplace,
        item.address,
        item.sourceLabel,
      ].filter(Boolean).join(' ')).includes(keyword))
      .sort((a, b) => String(a.kind).localeCompare(String(b.kind))
        || Number(a.homepageOrder ?? 100) - Number(b.homepageOrder ?? 100)
        || String(a.displayName || '').localeCompare(String(b.displayName || ''), 'vi'));
  }, [catalogItems, catalogKeyword, catalogKindFilter]);

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
      const data = await loginAdminWithFirebase(email.trim(), password);
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
    setBackendToken('');
    setAdminUser(null);
    setDashboard(null);
    setMessage('');
  }

  async function updateProvider(providerId, status) {
    setActionId(providerId);
    setMessage('');
    try {
      await adminRequest(`/api/admin/provider-workspaces/${encodeURIComponent(providerId)}`, backendToken, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          reviewNote: status === 'approved' ? 'Hồ sơ đã được admin MidHealth duyệt.' : 'Hồ sơ cần bổ sung thông tin.',
        }),
      });
      await loadDashboard();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setActionId('');
    }
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

  async function updateCatalogEntity(item, patch) {
    const entityType = item.doctorId ? 'doctor' : item.facilityId ? 'facility' : '';
    const entityId = item.doctorId || item.facilityId || '';
    if (!entityType || !entityId) return;

    setActionId(item.id);
    setMessage('');
    try {
      await adminRequest('/api/admin/catalog-entities', backendToken, {
        method: 'PATCH',
        body: JSON.stringify({ entityType, entityId, ...patch }),
      });
      setCatalogHomepageDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      await loadDashboard();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setActionId('');
    }
  }

  function homepageDraftFor(item) {
    return catalogHomepageDrafts[item.id] || {
      homepageFeatured: item.homepageFeatured !== false,
      homepageOrder: Number(item.homepageOrder ?? 100),
    };
  }

  function updateHomepageDraft(item, patch) {
    setCatalogHomepageDrafts((current) => ({
      ...current,
      [item.id]: {
        homepageFeatured: item.homepageFeatured !== false,
        homepageOrder: Number(item.homepageOrder ?? 100),
        ...(current[item.id] || {}),
        ...patch,
      },
    }));
  }

  async function syncCatalogAccounts() {
    setActionId('sync-catalog-accounts');
    setMessage('');
    try {
      const result = await adminRequest('/api/admin/catalog-accounts/sync', backendToken, { method: 'POST' });
      const summary = result?.data || result || {};
      setMessage(`Đã tạo ${summary.doctorsCreated || 0} tài khoản bác sĩ, ${summary.hospitalsCreated || 0} tài khoản bệnh viện và ${summary.clinicsCreated || 0} tài khoản phòng khám.`);
      await loadDashboard();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setActionId('');
    }
  }

  function openArticleEditor(article = null) {
    setMessage('');
    setArticleForm(article ? {
      id: article.id,
      title: article.title || '',
      slug: article.slug || '',
      categoryId: article.category_id || article.category?.id || '',
      summary: article.summary || '',
      content: article.content || '',
      thumbnailUrl: article.thumbnail_url || '',
      imageDataUrl: '',
      status: article.status || 'draft',
      isFeatured: Boolean(article.is_featured),
    } : {
      ...emptyArticleForm,
      categoryId: dashboard?.healthCategories?.[0]?.id || '',
    });
    setArticleEditorOpen(true);
  }

  function chooseArticleImage(file) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Ảnh bài viết phải là JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setMessage('Ảnh bài viết không được vượt quá 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setArticleForm((current) => ({ ...current, imageDataUrl: reader.result }));
    reader.readAsDataURL(file);
  }

  async function saveArticle(event) {
    event.preventDefault();
    if (!articleForm.title.trim()) {
      setMessage('Vui lòng nhập tiêu đề bài viết.');
      return;
    }
    if (!articleForm.categoryId) {
      setMessage('Vui lòng chọn chuyên mục bài viết.');
      return;
    }
    if (!articleForm.content.trim()) {
      setMessage('Vui lòng nhập nội dung bài viết.');
      return;
    }
    setActionId('save-article');
    setMessage('');
    try {
      await adminRequest(
        articleForm.id ? `/api/admin/health-articles/${encodeURIComponent(articleForm.id)}` : '/api/admin/health-articles',
        backendToken,
        {
          method: articleForm.id ? 'PATCH' : 'POST',
          body: JSON.stringify(articleForm),
        },
      );
      setArticleEditorOpen(false);
      setArticleForm(emptyArticleForm);
      setMessage(articleForm.status === 'published' ? 'Bài viết đã được xuất bản trên trang Tin Y tế.' : 'Bản nháp đã được lưu.');
      await loadDashboard();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setActionId('');
    }
  }

  function deleteArticle(article) {
    setDeleteArticleTarget(article);
  }

  async function confirmDeleteArticle() {
    const article = deleteArticleTarget;
    if (!article) return;
    setActionId(article.id);
    setMessage('');
    try {
      await adminRequest(`/api/admin/health-articles/${encodeURIComponent(article.id)}`, backendToken, { method: 'DELETE' });
      setMessage('Đã xóa bài viết.');
      setDeleteArticleTarget(null);
      await loadDashboard();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setActionId('');
    }
  }

  if (!authReady) {
    return <div className="admin-loading">Đang kiểm tra phiên admin...</div>;
  }

  if (!adminUser && !backendToken) {
    return (
      <section className="admin-login-page admin-security-login">
        <div className="admin-login-card">
          <button type="button" className="admin-back-link" onClick={onBackHome}>Về trang chủ</button>
          <span className="admin-lock-badge">Secure admin access</span>
          <span className="admin-eyebrow">MidHealth Control Center</span>
          <h1>Đăng nhập quản trị bảo mật</h1>
          <p>Chỉ tài khoản có role <strong>admin</strong> và trạng thái <strong>active</strong> trong Supabase mới được mở dashboard.</p>
          <form onSubmit={handleLogin} className="admin-login-form" noValidate>
            <label>
              Email admin
              <input
                className={loginErrors.email ? 'has-error' : ''}
                type="text"
                inputMode="email"
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
          <strong>Lớp kiểm soát truy cập</strong>
          <p>Mỗi lần vào `/admin`, frontend lấy Firebase ID token và backend đối chiếu lại quyền trong Supabase trước khi trả dữ liệu.</p>
          <div className="admin-security-list">
            <span>Firebase Auth session</span>
            <span>Supabase role check</span>
            <span>Admin API protected</span>
            <span>Audit-ready actions</span>
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
            Tài khoản hiện tại là <strong>{currentAdminEmail}</strong>. Dashboard chỉ mở sau khi backend xác nhận tài khoản này có role <strong>admin</strong> và trạng thái <strong>active</strong> trong Supabase.
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
        <span className="admin-nav-label">Vận hành</span>
        <button className={activeTab === 'providers' ? 'active' : ''} type="button" onClick={() => setActiveTab('providers')}><span>Hồ sơ bác sĩ</span><small>{formatNumber(metrics.pendingProviders)}</small></button>
        <button className={activeTab === 'appointments' ? 'active' : ''} type="button" onClick={() => setActiveTab('appointments')}><span>Lịch hẹn</span><small>{formatNumber(metrics.todayAppointments)}</small></button>
        <span className="admin-nav-label">Dữ liệu hệ thống</span>
        <button className={activeTab === 'catalog' ? 'active' : ''} type="button" onClick={() => setActiveTab('catalog')}><span>Danh mục y tế</span><small>{formatNumber(catalogItems.length)}</small></button>
        <button className={activeTab === 'users' ? 'active' : ''} type="button" onClick={() => setActiveTab('users')}><span>Tài khoản</span><small>{formatNumber(metrics.totalUsers)}</small></button>
        <button className={activeTab === 'content' ? 'active' : ''} type="button" onClick={() => setActiveTab('content')}><span>Nội dung</span><small>{formatNumber(metrics.publishedArticles)}</small></button>
        <button className={activeTab === 'audit' ? 'active' : ''} type="button" onClick={() => setActiveTab('audit')}><span>Nhật ký</span></button>
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
            <p>Dữ liệu trực tiếp từ Supabase · phiên quản trị {currentAdminEmail}</p>
          </div>
          <div className="admin-topbar-actions">
            <button type="button" onClick={loadDashboard} disabled={loading}>{loading ? 'Đang tải...' : 'Làm mới'}</button>
            <button type="button" onClick={handleLogout}>Đăng xuất</button>
          </div>
        </header>

        {message ? <div className="admin-alert">{message}</div> : null}

        <div className="admin-metric-grid">
          <MetricCard label="Tài khoản hệ thống" value={formatNumber(metrics.totalUsers)} helper={`${formatNumber(metrics.totalPatients)} hồ sơ bệnh nhân`} />
          <MetricCard label="Hồ sơ bác sĩ" value={formatNumber(metrics.totalProviders)} helper={`${formatNumber(metrics.pendingProviders)} hồ sơ cần xử lý`} tone={metrics.pendingProviders ? 'warning' : 'success'} />
          <MetricCard label="Lịch hẹn hôm nay" value={formatNumber(metrics.todayAppointments)} helper={`${formatNumber(metrics.totalAppointments)} lịch hẹn toàn hệ thống`} tone="info" />
          <MetricCard label="Doanh thu đã thu" value={formatMoney(metrics.revenue)} helper={`${formatNumber(metrics.paidPayments)} giao dịch thành công`} tone="success" />
          <MetricCard label="Danh mục y tế" value={formatNumber((metrics.totalDoctors || 0) + (metrics.totalFacilities || 0))} helper={`${formatNumber(metrics.totalDoctors)} bác sĩ · ${formatNumber(metrics.totalFacilities)} cơ sở`} />
          <MetricCard label="Bài viết" value={formatNumber(metrics.publishedArticles)} helper="Nội dung đang xuất bản" />
        </div>

        {activeTab === 'providers' ? (
          <section className="admin-card">
            <div className="admin-section-heading">
              <div>
                <h2>Duyệt hồ sơ bác sĩ/phòng khám</h2>
                <p>{pendingProviders.length} hồ sơ đang cần admin xử lý.</p>
              </div>
            </div>
            <div className="admin-review-toolbar">
              <input value={providerKeyword} onChange={(event) => setProviderKeyword(event.target.value)} placeholder="Tìm theo tên, email, chuyên khoa, địa chỉ" />
              <select value={providerStatusFilter} onChange={(event) => setProviderStatusFilter(event.target.value)}>
                <option value="all">Tất cả trạng thái</option>
                <option value="pending_review">Chờ duyệt</option>
                <option value="approved">Đã duyệt</option>
                <option value="rejected">Cần bổ sung</option>
              </select>
            </div>
            <div className="admin-review-guide">
              <article><strong>1. Danh tính</strong><span>Đối chiếu tên, email và số điện thoại trong hồ sơ.</span></article>
              <article><strong>2. Chuyên môn</strong><span>Kiểm tra chức danh, chuyên khoa và thông tin công khai.</span></article>
              <article><strong>3. Vận hành</strong><span>Xác minh địa chỉ; hồ sơ duyệt sẽ liên kết với catalog.</span></article>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Hồ sơ</th><th>Loại</th><th>Chuyên khoa</th><th>Liên hệ</th><th>Trạng thái</th><th>Thao tác</th></tr>
                </thead>
                <tbody>
                  {filteredProviders.map((provider) => (
                    <tr key={provider.id}>
                      <td><strong>{provider.clinic_name || provider.owner_name}</strong><small>{provider.clinic_address || provider.doctor_title || 'Chưa có mô tả'}</small></td>
                      <td>{provider.mode === 'hospital' ? 'Bệnh viện' : provider.mode === 'clinic' ? 'Phòng khám' : 'Bác sĩ'}</td>
                      <td>{provider.specialty || 'Chưa chọn'}</td>
                      <td><span>{provider.email}</span><small>{provider.owner_phone || 'Chưa có SĐT'}</small></td>
                      <td><StatusPill value={provider.status} /></td>
                      <td className="admin-actions">
                        <button className="admin-action-primary" type="button" disabled={actionId === provider.id || provider.status === 'approved'} onClick={() => updateProvider(provider.id, 'approved')}>Duyệt</button>
                        <button className="admin-action-danger" type="button" disabled={actionId === provider.id || provider.status === 'rejected'} onClick={() => updateProvider(provider.id, 'rejected')}>Yêu cầu bổ sung</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === 'catalog' ? (
          <section className="admin-card">
            <div className="admin-section-heading">
              <div>
                <h2>Danh mục bác sĩ, bệnh viện, phòng khám</h2>
                <p>{catalogItems.length} hồ sơ catalog đang được quản lý trong Supabase và dùng cho trang đặt khám.</p>
              </div>
              <button type="button" disabled={actionId === 'sync-catalog-accounts'} onClick={syncCatalogAccounts}>
                {actionId === 'sync-catalog-accounts' ? 'Đang đồng bộ...' : 'Đồng bộ tài khoản'}
              </button>
            </div>
            <div className="admin-review-toolbar">
              <input value={catalogKeyword} onChange={(event) => setCatalogKeyword(event.target.value)} placeholder="Tìm theo tên, chuyên khoa, nơi làm việc, địa chỉ" />
              <select value={catalogKindFilter} onChange={(event) => setCatalogKindFilter(event.target.value)}>
                <option value="all">Tất cả danh mục</option>
                <option value="doctor">Bác sĩ</option>
                <option value="clinic">Phòng khám</option>
                <option value="hospital">Bệnh viện</option>
              </select>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Hồ sơ catalog</th><th>Loại</th><th>Chuyên khoa / nơi làm việc</th><th>Nguồn liên kết</th><th>Ưu tiên trang chủ</th><th>Hiển thị</th><th>Thao tác</th></tr></thead>
                <tbody>
                  {filteredCatalogItems.map((item) => {
                    const homepageDraft = homepageDraftFor(item);
                    return (
                    <tr key={`catalog-${item.id}`}>
                      <td>
                        <strong>{item.displayName}</strong>
                        <small>{item.address || item.email || 'Chưa có thông tin bổ sung'}</small>
                      </td>
                      <td>{item.kind === 'doctor' ? 'Bác sĩ' : item.kind === 'clinic' ? 'Phòng khám' : 'Bệnh viện'}</td>
                      <td>
                        <span>{item.specialty || item.workplace || 'Chưa cập nhật'}</span>
                        <small>{item.workplace && item.specialty ? item.workplace : ''}</small>
                      </td>
                      <td>
                        <span>{item.sourceLabel || 'Catalog'}</span>
                        <small>
                          {item.needsLinking
                            ? 'Chưa có tài khoản/workspace'
                            : item.kind === 'hospital'
                              ? 'Đã liên kết quản lý'
                              : 'Đã liên kết quản lý'}
                        </small>
                      </td>
                      <td>
                        <div className="admin-homepage-priority">
                          <label>
                            <input
                              type="checkbox"
                              checked={homepageDraft.homepageFeatured}
                              onChange={(event) => updateHomepageDraft(item, { homepageFeatured: event.target.checked })}
                            />
                            <span>Trang chủ</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            aria-label={`Thứ tự trang chủ của ${item.displayName}`}
                            value={homepageDraft.homepageOrder}
                            onChange={(event) => updateHomepageDraft(item, { homepageOrder: event.target.value })}
                          />
                          <button
                            type="button"
                            disabled={actionId === item.id}
                            onClick={() => updateCatalogEntity(item, {
                              homepageFeatured: Boolean(homepageDraft.homepageFeatured),
                              homepageOrder: Number(homepageDraft.homepageOrder),
                            })}
                          >
                            Lưu
                          </button>
                        </div>
                      </td>
                      <td><StatusPill value={item.catalogStatus} /></td>
                      <td className="admin-actions">
                        {item.catalogStatus === 'active'
                          ? <button type="button" disabled={actionId === item.id} onClick={() => updateCatalogEntity(item, { active: false })}>Ẩn</button>
                          : <button type="button" disabled={actionId === item.id} onClick={() => updateCatalogEntity(item, { active: true })}>Hiện</button>}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === 'appointments' ? (
          <section className="admin-card">
            <div className="admin-section-heading"><h2>Lịch hẹn gần đây</h2></div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Bệnh nhân</th><th>Ngày khám</th><th>Nơi khám</th><th>Thanh toán</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  {(dashboard?.appointments || []).map((appointment) => (
                    <tr key={appointment.id}>
                      <td><strong>{appointment.patient_name}</strong><small>{appointment.patient_phone || 'Chưa có SĐT'}</small></td>
                      <td>{formatDate(appointment.appointment_date)}<small>{appointment.appointment_time_text || 'Chưa chọn giờ'}</small></td>
                      <td>{appointment.doctors?.full_name || appointment.medical_facilities?.name || 'Chưa xác định'}</td>
                      <td>{formatMoney(appointment.final_amount)}<small><StatusPill value={appointment.payment_status} /></small></td>
                      <td><StatusPill value={appointment.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === 'users' ? (
          <section className="admin-card">
            <div className="admin-section-heading">
              <div>
                <h2>Tài khoản và hồ sơ y tế</h2>
                <p>Gộp tài khoản đăng nhập, workspace bác sĩ/phòng khám và catalog đang hiển thị trên trang đặt khám.</p>
              </div>
            </div>
            <div className="admin-review-toolbar">
              <input value={accountKeyword} onChange={(event) => setAccountKeyword(event.target.value)} placeholder="Tìm theo tên, email, chuyên khoa, nơi làm việc" />
              <select value={accountKindFilter} onChange={(event) => setAccountKindFilter(event.target.value)}>
                <option value="all">Tất cả loại hồ sơ</option>
                <option value="doctor">Bác sĩ</option>
                <option value="clinic">Phòng khám</option>
                <option value="hospital">Bệnh viện</option>
                <option value="patient">Bệnh nhân</option>
                <option value="admin">Admin</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Hồ sơ</th><th>Nguồn</th><th>Vai trò</th><th>Trạng thái</th><th>Liên kết</th><th>Thao tác</th></tr></thead>
                <tbody>
                  {filteredAccounts.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.displayName || item.full_name || item.email}</strong>
                        <small>{[item.email, item.specialty, item.workplace || item.address].filter(Boolean).join(' · ') || 'Chưa có thông tin bổ sung'}</small>
                      </td>
                      <td>{item.sourceLabel || 'Tài khoản'}</td>
                      <td>{item.kind || item.role}</td>
                      <td>
                        {item.authProvider === 'catalog'
                          ? <StatusPill value="catalog_managed" />
                          : item.accountStatus ? <StatusPill value={item.accountStatus} /> : null}
                        {item.workspaceStatus ? <small><StatusPill value={item.workspaceStatus} /></small> : null}
                        {item.catalogStatus ? <small><StatusPill value={item.catalogStatus} /></small> : null}
                      </td>
                      <td>
                        {item.needsLinking ? <StatusPill value="pending" /> : <StatusPill value={item.duplicateResolved ? 'approved' : 'active'} />}
                        <small>
                          {item.needsLinking
                            ? 'Catalog chưa có tài khoản/workspace'
                            : item.kind === 'hospital'
                              ? 'Đã gộp logic quản lý'
                              : 'Đã gộp logic quản lý'}
                        </small>
                      </td>
                      <td className="admin-actions">
                        {item.userId && item.authProvider !== 'catalog' ? (
                          <>
                            <button type="button" disabled={actionId === item.id || item.accountStatus === 'active'} onClick={() => updateUser(item.userId, { status: 'active' })}>Mở</button>
                            <button type="button" disabled={actionId === item.id || item.accountStatus === 'disabled'} onClick={() => updateUser(item.userId, { status: 'disabled' })}>Khóa</button>
                            <button type="button" disabled={actionId === item.id || item.role === 'staff'} onClick={() => updateUser(item.userId, { role: 'staff' })}>Staff</button>
                          </>
                        ) : item.authProvider === 'catalog' ? <span className="admin-managed-note">Quản lý qua catalog</span> : null}
                        {item.hasCatalog ? (
                          item.catalogStatus === 'active'
                            ? <button type="button" disabled={actionId === item.id} onClick={() => updateCatalogEntity(item, false)}>Ẩn</button>
                            : <button type="button" disabled={actionId === item.id} onClick={() => updateCatalogEntity(item, true)}>Hiện</button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === 'content' ? (
          <section className="admin-card">
            <div className="admin-section-heading">
              <div>
                <h2>Nội dung Tin Y tế</h2>
                <p>Tạo và xuất bản bài viết hiển thị trực tiếp trên trang Tin Y tế dành cho bệnh nhân.</p>
              </div>
              <button type="button" onClick={() => openArticleEditor()}>Tạo bài viết</button>
            </div>
            {articleEditorOpen ? (
              <form className="admin-article-editor" onSubmit={saveArticle} noValidate>
                <div className="admin-article-editor-head">
                  <div>
                    <strong>{articleForm.id ? 'Chỉnh sửa bài viết' : 'Bài viết mới'}</strong>
                    <span>{articleForm.status === 'published' ? 'Đang hiển thị công khai' : 'Chưa hiển thị trên trang khách'}</span>
                  </div>
                  <button type="button" onClick={() => setArticleEditorOpen(false)}>Đóng</button>
                </div>
                <div className="admin-article-form-grid">
                  <label className="admin-field-wide">
                    <span>Tiêu đề</span>
                    <input value={articleForm.title} onChange={(event) => setArticleForm({ ...articleForm, title: event.target.value })} required />
                  </label>
                  <label>
                    <span>Chuyên mục</span>
                    <select value={articleForm.categoryId} onChange={(event) => setArticleForm({ ...articleForm, categoryId: event.target.value })} required>
                      <option value="">Chọn chuyên mục</option>
                      {(dashboard?.healthCategories || []).map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Đường dẫn</span>
                    <input value={articleForm.slug} onChange={(event) => setArticleForm({ ...articleForm, slug: event.target.value })} placeholder="Tự tạo theo tiêu đề" />
                  </label>
                  <label className="admin-field-wide">
                    <span>Mô tả ngắn</span>
                    <textarea rows="3" value={articleForm.summary} onChange={(event) => setArticleForm({ ...articleForm, summary: event.target.value })} />
                  </label>
                  <label className="admin-field-wide">
                    <span>Nội dung bài viết</span>
                    <textarea className="admin-article-content-input" rows="12" value={articleForm.content} onChange={(event) => setArticleForm({ ...articleForm, content: event.target.value })} required />
                  </label>
                  <div className="admin-article-image-field">
                    <span>Ảnh đại diện</span>
                    <label className="admin-article-image-picker">
                      {(articleForm.imageDataUrl || articleForm.thumbnailUrl)
                        ? <img src={articleForm.imageDataUrl || articleForm.thumbnailUrl} alt="Xem trước ảnh bài viết" />
                        : <strong>Chọn ảnh JPG, PNG hoặc WebP</strong>}
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseArticleImage(event.target.files?.[0])} />
                    </label>
                    <input value={articleForm.thumbnailUrl} onChange={(event) => setArticleForm({ ...articleForm, thumbnailUrl: event.target.value, imageDataUrl: '' })} placeholder="Hoặc nhập URL ảnh" />
                  </div>
                  <div className="admin-article-publish-field">
                    <label>
                      <span>Trạng thái</span>
                      <select value={articleForm.status} onChange={(event) => setArticleForm({ ...articleForm, status: event.target.value })}>
                        <option value="draft">Bản nháp</option>
                        <option value="published">Xuất bản</option>
                        <option value="archived">Lưu trữ</option>
                      </select>
                    </label>
                    <label className="admin-checkbox-field">
                      <input type="checkbox" checked={articleForm.isFeatured} onChange={(event) => setArticleForm({ ...articleForm, isFeatured: event.target.checked })} />
                      <span>Bài viết nổi bật</span>
                    </label>
                    <button type="submit" disabled={actionId === 'save-article'}>{actionId === 'save-article' ? 'Đang lưu...' : 'Lưu bài viết'}</button>
                  </div>
                </div>
              </form>
            ) : null}
            <div className="admin-content-list">
              {(dashboard?.articles || []).map((article) => (
                <article key={article.id} className="admin-content-row">
                  {article.thumbnail_url ? <img src={article.thumbnail_url} alt="" /> : <div className="admin-content-image-empty">MH</div>}
                  <div>
                    <div className="admin-content-row-meta">
                      <StatusPill value={article.status} />
                      {article.is_featured ? <span>Nổi bật</span> : null}
                      <span>{article.category?.name || 'Chưa phân loại'}</span>
                    </div>
                    <h3>{article.title}</h3>
                    <p>{article.summary || 'Chưa có mô tả ngắn.'}</p>
                    <small>{formatNumber(article.view_count)} lượt xem · cập nhật {formatDate(article.updated_at || article.published_at)}</small>
                  </div>
                  <div className="admin-content-actions">
                    <button type="button" onClick={() => openArticleEditor(article)}>Sửa</button>
                    <button type="button" disabled={actionId === article.id} onClick={() => deleteArticle(article)}>Xóa</button>
                  </div>
                </article>
              ))}
              {!dashboard?.articles?.length ? <div className="admin-empty-panel"><strong>Chưa có bài viết</strong><p>Tạo bài viết đầu tiên để hiển thị trên trang Tin Y tế.</p></div> : null}
            </div>
          </section>
        ) : null}
        {activeTab === 'audit' ? (
          <section className="admin-card">
            <div className="admin-section-heading">
              <div>
                <h2>Nhật ký vận hành</h2>
                <p>Theo dõi các thao tác quan trọng của admin, bác sĩ và cơ sở khám chữa bệnh.</p>
              </div>
            </div>
            <AuditEventList events={dashboard?.events || []} />
          </section>
        ) : null}
      </main>
      {deleteArticleTarget ? (
        <div className="app-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && actionId !== deleteArticleTarget.id) setDeleteArticleTarget(null); }}>
          <article className="app-confirm-modal danger" role="dialog" aria-modal="true" aria-labelledby="admin-delete-article-title">
            <header>
              <span>Cần xác nhận</span>
              <h2 id="admin-delete-article-title">Xóa bài viết</h2>
            </header>
            <section>
              <p>Bạn có chắc muốn xóa bài viết này?</p>
              <small>{deleteArticleTarget.title}</small>
            </section>
            <footer>
              <button type="button" disabled={actionId === deleteArticleTarget.id} onClick={() => setDeleteArticleTarget(null)}>Giữ lại</button>
              <button type="button" className="confirm danger" disabled={actionId === deleteArticleTarget.id} onClick={confirmDeleteArticle}>
                {actionId === deleteArticleTarget.id ? 'Đang xóa...' : 'Xóa bài viết'}
              </button>
            </footer>
          </article>
        </div>
      ) : null}
    </section>
  );
}
