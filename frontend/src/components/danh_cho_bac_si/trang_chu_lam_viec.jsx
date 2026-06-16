import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useMemo, useState } from 'react';
import { firebaseAuth } from '../../lib/firebase';
import DangKiDangNhapLamViec from './dang_ki_dang_nhap_lam_viec';
import KhuVucLamViec from './khu_vuc_lam_viec';
import {
  DashboardPreview,
  WORKSPACE_SECTIONS,
  WorkspaceBrand,
  isWorkspaceSectionAllowed,
} from './giao_dien_lam_viec';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const WORKSPACE_DRAFT_STORAGE_KEY = 'midhealth_provider_workspace_drafts';
function buildWorkspaceScreenUrls(basePath) {
  return {
    landing: basePath,
    login: `${basePath}/login`,
    register: `${basePath}/register`,
    otp: `${basePath}/otp`,
    setup: `${basePath}/setup`,
    profile: `${basePath}/ho-so`,
    edit: `${basePath}/edit`,
  };
}

const NAV_ITEMS = [
  { id: 'dw-home', label: 'Trang chủ' },
  { id: 'dw-trust', label: 'Niềm tin' },
  { id: 'dw-features', label: 'Tính năng' },
  { id: 'dw-workflow', label: 'Quy trình' },
  { id: 'dw-security', label: 'Bảo mật' },
];

const TRUST_METRICS = [
  { value: '24/7', label: 'Hệ thống nhận lịch và giữ dữ liệu vận hành liên tục' },
  { value: '2 lớp', label: 'Xác thực tài khoản và kiểm duyệt hồ sơ trước khi mở workspace' },
  { value: '14 ngày', label: 'Theo dõi lịch hẹn, slot trống và báo cáo sắp tới từ backend' },
  { value: '1 nơi', label: 'Quản lý hồ sơ, lịch khám, check-in và báo cáo trong một màn hình' },
];

const FEATURE_GROUPS = [
  {
    title: 'Quản lý lịch hẹn tập trung',
    items: ['Worklist hôm nay', 'Hàng chờ xác nhận', 'Lọc theo trạng thái', 'Chuẩn bị phiếu khám'],
  },
  {
    title: 'Kiểm soát khung giờ khám',
    items: ['Slot sáng, chiều, tối', 'Tạm khoá lịch bận', 'Sức chứa theo ca', 'Theo dõi slot còn trống'],
  },
  {
    title: 'Hỗ trợ bác sĩ độc lập',
    items: ['Hồ sơ chuyên môn', 'Tư vấn trực tuyến', 'E-check-in', 'Báo cáo hiệu suất'],
  },
  {
    title: 'Onboarding bệnh viện',
    items: ['Giấy phép/mã KCB', 'Người phụ trách vận hành', 'Dịch vụ tiếp nhận', 'Admin duyệt trước khi lên sàn'],
  },
];

const WORKFLOW_STEPS = [
  {
    title: 'Tạo tài khoản đối tác',
    detail: 'Đăng ký bằng email chuyên môn, xác thực OTP và dùng Firebase Authentication để đăng nhập workspace.',
  },
  {
    title: 'Chọn mô hình hoạt động',
    detail: 'Chọn bác sĩ độc lập, phòng khám hoặc bệnh viện. Form thiết lập đổi theo đúng hồ sơ cần kiểm duyệt.',
  },
  {
    title: 'Gửi hồ sơ kiểm duyệt',
    detail: 'MidHealth kiểm tra thông tin chuyên môn, cơ sở khám chữa bệnh, mã KCB/giấy phép hoạt động và dữ liệu liên hệ trước khi mở vận hành.',
  },
  {
    title: 'Mở công cụ đặt khám',
    detail: 'Sau khi duyệt, workspace mở lịch hẹn, khung giờ, intake, tư vấn online và báo cáo từ dữ liệu thật.',
  },
];

const REQUIREMENT_ITEMS = [
  'Email chuyên môn hoặc email cơ quan để tạo tài khoản đối tác.',
  'Số điện thoại có thể liên hệ khi MidHealth cần xác minh hồ sơ.',
  'Bác sĩ độc lập cần chuẩn bị chức danh, chuyên khoa chính và mô tả chuyên môn.',
  'Phòng khám cần chuẩn bị tên, địa chỉ hoạt động và mã số thuế hoặc mã khám chữa bệnh nếu có.',
  'Bệnh viện cần chuẩn bị tên pháp lý, địa chỉ, giấy phép hoạt động hoặc mã KCB/mã số thuế và người phụ trách vận hành.',
];

const SECURITY_ITEMS = [
  'Xác thực email bằng OTP trước khi tạo tài khoản đối tác.',
  'Tài khoản đăng nhập dùng Firebase Authentication chung với MidHealth.',
  'Hồ sơ đối tác được tách khỏi hồ sơ bệnh nhân để tránh nhầm quyền sử dụng.',
  'Dữ liệu lịch hẹn chỉ mở khi hồ sơ bác sĩ, bệnh viện hoặc phòng khám được MidHealth kiểm duyệt.',
];

const TRUST_PILLARS = [
  {
    title: 'Minh bạch hồ sơ chuyên môn',
    text: 'Bác sĩ, phòng khám và bệnh viện có hồ sơ riêng, trạng thái kiểm duyệt rõ ràng, thông tin công khai được chuẩn hóa trước khi hiển thị với bệnh nhân.',
  },
  {
    title: 'Dữ liệu vận hành không dùng mock',
    text: 'Workspace đọc lịch hẹn, khung giờ và số liệu từ API backend; các thao tác xác nhận, hủy, hoàn tất lịch đều ghi lại qua Supabase.',
  },
  {
    title: 'Tách biệt quyền bệnh nhân và đối tác',
    text: 'Tài khoản đối tác được ghi vào bảng app_users với vai trò bác sĩ, bệnh viện hoặc phòng khám, không trộn với hồ sơ bệnh nhân cá nhân.',
  },
];

const OPERATING_ITEMS = [
  'Nhận lịch mới và xác nhận trạng thái khám theo từng bệnh nhân.',
  'Tạo, cập nhật, khóa hoặc mở lại khung giờ khám theo ngày.',
  'Theo dõi slot còn trống, số lịch chờ xác nhận, check-in và báo cáo 14 ngày.',
  'Thiết lập hồ sơ bác sĩ độc lập, bệnh viện hoặc phòng khám trước khi mở dữ liệu bệnh nhân.',
];

function internalScreen(routeScreen) {
  if (routeScreen === 'profile' || routeScreen === 'setup' || routeScreen === 'edit' || routeScreen === 'work') return routeScreen === 'profile' ? 'profile' : 'resume';
  return ['landing', 'login', 'register', 'otp'].includes(routeScreen) ? routeScreen : 'landing';
}

function createAccountFromFirebaseUser(authUser, fallbackPhone = '') {
  if (!authUser) return null;
  return {
    uid: authUser.uid,
    email: authUser.email,
    name: authUser.displayName || authUser.email,
    phone: fallbackPhone,
  };
}

function findWorkspaceDraft(uid) {
  try {
    const drafts = JSON.parse(window.localStorage.getItem(WORKSPACE_DRAFT_STORAGE_KEY) || '[]');
    return drafts.find((workspace) => workspace.uid === uid) || null;
  } catch {
    return null;
  }
}

async function getAuthHeaders() {
  const user = firebaseAuth.currentUser;
  const token = user ? await user.getIdToken(true) : '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function getProviderWorkspaceApi() {
  const response = await fetch(`${apiBaseUrl}/api/provider/workspace`, {
    headers: await getAuthHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Không thể tải hồ sơ đối tác.');
  }
  return data.data || null;
}

async function verifyProviderAccount(authUser) {
  if (!authUser) return null;
  const token = await authUser.getIdToken(true);
  const response = await fetch(`${apiBaseUrl}/api/auth/me?portal=provider`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Tài khoản không thuộc cổng đối tác y tế.');
  return data.data;
}

function GioiThieuDoiTacYTe({ currentAccount, isLoading, message, onContinue, onRegister, onLogin, onHome }) {
  const [activeSection, setActiveSection] = useState(NAV_ITEMS[0].id);

  const scrollTo = (id) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.id) setActiveSection(visible.target.id);
    }, { rootMargin: '-28% 0px -58% 0px', threshold: [0.1, 0.25, 0.45] });

    NAV_ITEMS.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="dw-landing">
      <header className="dw-topbar">
        <div className="dw-topbar-left">
          <WorkspaceBrand onHome={onHome} />
          <span>Tổng đài hỗ trợ: 1900 2815</span>
        </div>
        <nav aria-label="MidHealth Workspace">
          {NAV_ITEMS.map((item) => (
            <button
              type="button"
              className={activeSection === item.id ? 'active' : ''}
              onClick={() => scrollTo(item.id)}
              key={item.id}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="dw-topbar-actions">
          {currentAccount ? <button type="button" onClick={onContinue} disabled={isLoading}>{isLoading ? 'Đang tải...' : 'Tiếp tục'}</button> : null}
          <button type="button" onClick={onLogin}>Đăng nhập</button>
          <button type="button" className="primary" onClick={onRegister}>Đăng ký ngay</button>
        </div>
      </header>

      <section className="dw-hero" id="dw-home">
        <div>
          <span className="dw-kicker">Dành cho bác sĩ, bệnh viện và phòng khám</span>
          <h1>Nền tảng đối tác y tế để cơ sở khám chữa bệnh nhận lịch minh bạch và vận hành chuyên nghiệp</h1>
          <p>
            MidHealth Workspace giúp bác sĩ, bệnh viện và phòng khám xây dựng hồ sơ tin cậy, tiếp nhận lịch đặt khám từ bệnh nhân,
            kiểm soát khung giờ, xử lý trạng thái khám và theo dõi hiệu suất vận hành bằng dữ liệu backend chính thức.
          </p>
          <p className="dw-scope-note">Tài khoản đối tác được xác thực email, ghi nhận trong Supabase và chỉ mở dữ liệu bệnh nhân sau khi hồ sơ được kiểm duyệt.</p>
          <div className="dw-hero-actions">
            {currentAccount ? <button type="button" onClick={onContinue} disabled={isLoading}>{isLoading ? 'Đang tải hồ sơ...' : `Tiếp tục với ${currentAccount.email}`}</button> : null}
            <button type="button" className="primary" onClick={onRegister}>Đăng ký ngay</button>
            <button type="button" onClick={() => scrollTo('dw-trust')}>Vì sao nên tham gia</button>
          </div>
          {message ? <p className="dw-form-alert neutral">{message}</p> : null}
        </div>
        <DashboardPreview />
      </section>

      <section className="dw-section dw-trust-section" id="dw-trust">
        <div className="dw-section-head">
          <span>Niềm tin</span>
          <h2>MidHealth giúp đối tác y tế xuất hiện chuyên nghiệp trước khi bệnh nhân đặt lịch</h2>
          <p>Trang đối tác không chỉ là form đăng ký. Đây là quy trình xác thực, kiểm duyệt và vận hành để bảo vệ uy tín chuyên môn của bác sĩ và cơ sở y tế.</p>
        </div>
        <div className="dw-trust-metrics">
          {TRUST_METRICS.map((item) => (
            <article key={item.value}>
              <strong>{item.value}</strong>
              <p>{item.label}</p>
            </article>
          ))}
        </div>
        <div className="dw-trust-grid">
          {TRUST_PILLARS.map((item) => (
            <article key={item.title}>
              <span>✓</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="dw-section" id="dw-features">
        <div className="dw-section-head">
          <span>Tính năng</span>
          <h2>Đủ luồng để bác sĩ vận hành đặt khám hằng ngày</h2>
        </div>
        <div className="dw-feature-grid">
          {FEATURE_GROUPS.map((group) => (
            <article key={group.title}>
              <h3>{group.title}</h3>
              {group.items.map((item) => <p key={item}>{item}</p>)}
            </article>
          ))}
        </div>
        <div className="dw-no-clinic-note">
          <h3>Tôi không có phòng khám riêng, có dùng được không?</h3>
          <p>
            Có. Bác sĩ độc lập vẫn có thể dùng hồ sơ chuyên môn, tư vấn trực tuyến, lịch hẹn cá nhân,
            e-check-in và báo cáo sau khi MidHealth duyệt hồ sơ.
          </p>
        </div>
        <div className="dw-operating-panel">
          <div>
            <span>Vận hành thật</span>
            <h3>Những gì bác sĩ làm được sau khi hồ sơ được duyệt</h3>
          </div>
          <ul>
            {OPERATING_ITEMS.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <section className="dw-section dw-workflow" id="dw-workflow">
        <div className="dw-section-head">
          <span>Quy trình</span>
          <h2>Từ đăng ký đến mở workspace đặt khám</h2>
        </div>
        <div className="dw-flow-grid">
          {WORKFLOW_STEPS.map((step, index) => (
            <article key={step.title}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
        <div className="dw-requirement-panel">
          <h3>Thông tin cần chuẩn bị</h3>
          <div>
            {REQUIREMENT_ITEMS.map((item) => <p key={item}>{item}</p>)}
          </div>
        </div>
      </section>

      <section className="dw-section dw-security" id="dw-security">
        <div className="dw-section-head">
          <span>Bảo mật</span>
          <h2>Kiểm duyệt trước khi mở dữ liệu bệnh nhân</h2>
        </div>
        <div className="dw-security-list">
          {SECURITY_ITEMS.map((item) => <article key={item}>{item}</article>)}
        </div>
        <div className="dw-final-cta">
          <span>Sẵn sàng mở workspace?</span>
          <h2>Đăng ký tài khoản đối tác và đăng nhập để gửi hồ sơ kiểm duyệt</h2>
          <p>Sau khi đăng ký thành công, MidHealth sẽ chuyển bạn về màn đăng nhập. Bạn đăng nhập lại để thiết lập hồ sơ bác sĩ, bệnh viện hoặc phòng khám.</p>
          <button type="button" onClick={onRegister}>Đăng ký đối tác</button>
        </div>
      </section>
    </div>
  );
}

function TrangChuLamViec({
  onBackHome,
  initialScreen = 'landing',
  initialSection = 'tong-quan',
  basePath = '/danh-cho-bac-si',
  requireAuth = false,
}) {
  const screenUrls = useMemo(() => buildWorkspaceScreenUrls(basePath), [basePath]);
  const [screen, setScreen] = useState(internalScreen(initialScreen));
  const [pendingAccount, setPendingAccount] = useState(null);
  const [account, setAccount] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [editingWorkspace, setEditingWorkspace] = useState(null);
  const [workspaceMessage, setWorkspaceMessage] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(false);
  const [activeWorkspaceSection, setActiveWorkspaceSection] = useState(
    WORKSPACE_SECTIONS.has(initialSection) ? initialSection : 'tong-quan',
  );

  const hasWorkspace = useMemo(() => Boolean(workspace?.id || workspace?.firebaseUid), [workspace]);

  const setWorkspaceUrl = (url, replace = false) => {
    if (window.location.pathname === url) return;
    window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
  };

  const navigateScreen = (nextScreen, { replace = false } = {}) => {
    const safeScreen = requireAuth && nextScreen === 'landing' ? 'login' : nextScreen;
    setWorkspaceUrl(screenUrls[safeScreen] || screenUrls.landing, replace);
    setScreen(internalScreen(safeScreen));
    if (safeScreen !== 'edit') setEditingWorkspace(null);
    if (safeScreen !== 'login') setLoginMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateWorkspace = (section) => {
    const nextSection = WORKSPACE_SECTIONS.has(section) ? section : 'tong-quan';
    const nextUrl = `${basePath}/${nextSection}`;
    if (window.location.pathname !== nextUrl) {
      window.history.pushState({}, '', nextUrl);
    }
    setActiveWorkspaceSection(nextSection);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadWorkspaceForAccount = async (nextAccount, nextScreenWhenLoaded = '') => {
    if (!nextAccount) return null;

    setIsWorkspaceLoading(true);
    setWorkspaceMessage('');

    try {
      const nextWorkspace = await getProviderWorkspaceApi();
      setWorkspace(nextWorkspace);
      setEditingWorkspace(initialScreen === 'edit' ? nextWorkspace : null);
      if (nextScreenWhenLoaded) {
        const targetScreen = nextWorkspace ? 'work' : nextScreenWhenLoaded;
        setScreen(targetScreen);
        setWorkspaceUrl(
          initialScreen === 'edit' && nextWorkspace
            ? screenUrls.edit
            : nextWorkspace
              ? `${basePath}/${activeWorkspaceSection}`
              : screenUrls.profile,
          true,
        );
      }
      return nextWorkspace;
    } catch (error) {
      setWorkspace(null);
      setWorkspaceMessage(error.message);
      if (nextScreenWhenLoaded) {
        setScreen(nextScreenWhenLoaded === 'work' ? 'profile' : nextScreenWhenLoaded);
        setWorkspaceUrl(requireAuth ? screenUrls.login : screenUrls.profile, true);
      }
      return null;
    } finally {
      setIsWorkspaceLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (authUser) => {
      if (!authUser) {
        setAccount(null);
        setWorkspace(null);
        setEditingWorkspace(null);
        if (screen === 'resume') navigateScreen('login', { replace: true });
        return;
      }

      try {
        await verifyProviderAccount(authUser);
      } catch (error) {
        if (!active) return;
        setAccount(null);
        setWorkspace(null);
        setEditingWorkspace(null);
        setLoginMessage(error.message);
        if (screen === 'resume' || screen === 'profile' || screen === 'work') {
          navigateScreen('login', { replace: true });
        }
        return;
      }

      if (!active) return;
      if (account?.uid === authUser.uid) {
        if (screen === 'resume' || screen === 'profile') loadWorkspaceForAccount(account, 'profile');
        return;
      }

      const nextAccount = createAccountFromFirebaseUser(authUser, account?.phone || '');
      setAccount(nextAccount);
      loadWorkspaceForAccount(nextAccount, screen === 'resume' ? 'work' : '');
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [account?.phone, account?.uid, screen]);

  const applyAccount = async (nextAccount) => {
    setAccount(nextAccount);
    await loadWorkspaceForAccount(nextAccount, 'profile');
  };

  const logoutTo = async (nextScreen) => {
    await signOut(firebaseAuth);
    setAccount(null);
    setWorkspace(null);
    setEditingWorkspace(null);
    navigateScreen(nextScreen, { replace: true });
  };

  useEffect(() => {
    const nextScreen = internalScreen(initialScreen);
    setScreen(nextScreen);

    if (initialScreen === 'edit' && workspace) {
      setEditingWorkspace(workspace);
    } else if (initialScreen !== 'edit') {
      setEditingWorkspace(null);
    }

    if (initialScreen === 'otp' && !pendingAccount) {
      navigateScreen('register', { replace: true });
    }
  }, [initialScreen]);

  useEffect(() => {
    setActiveWorkspaceSection(WORKSPACE_SECTIONS.has(initialSection) ? initialSection : 'tong-quan');
  }, [initialSection]);

  useEffect(() => {
    if (!workspace?.mode || isWorkspaceSectionAllowed(workspace.mode, activeWorkspaceSection)) return;
    navigateWorkspace('tong-quan');
  }, [activeWorkspaceSection, workspace?.mode]);

  useEffect(() => {
    if (!hasWorkspace || screen !== 'work') return;
    if (window.location.pathname === basePath || window.location.pathname === '/danh-cho-bac-si' || window.location.pathname === '/doi-tac-y-te') {
      window.history.replaceState({}, '', `${basePath}/${activeWorkspaceSection}`);
    }
  }, [activeWorkspaceSection, basePath, hasWorkspace, screen]);

  useEffect(() => {
    if (!requireAuth || account || ['login', 'register', 'otp'].includes(screen)) return;
    navigateScreen('login', { replace: true });
  }, [account, requireAuth, screen]);

  useEffect(() => {
    if (screen !== 'profile' || account) return;
    navigateScreen('login', { replace: true });
  }, [account, screen]);

  if (screen === 'register' || screen === 'otp' || screen === 'login') {
    return (
      <DangKiDangNhapLamViec
        screen={screen}
        loginMessage={loginMessage}
        onHome={onBackHome}
        pendingAccount={pendingAccount}
        onOtpSent={(payload) => {
          setPendingAccount(payload);
          navigateScreen('otp');
        }}
        onVerified={applyAccount}
        onRegistered={(payload) => {
          setPendingAccount(null);
          setLoginMessage(`Đăng ký ${payload.email} thành công. Vui lòng đăng nhập để thiết lập hồ sơ đối tác.`);
          navigateScreen('login', { replace: true });
        }}
        onBack={() => navigateScreen('register')}
        onLogin={applyAccount}
        onRegister={() => navigateScreen('register')}
        onSwitchToLogin={() => navigateScreen('login')}
      />
    );
  }

  if (requireAuth && !account) {
    return (
      <DangKiDangNhapLamViec
        screen="login"
        loginMessage={loginMessage}
        onHome={onBackHome}
        pendingAccount={pendingAccount}
        onOtpSent={(payload) => {
          setPendingAccount(payload);
          navigateScreen('otp');
        }}
        onVerified={applyAccount}
        onRegistered={(payload) => {
          setPendingAccount(null);
          setLoginMessage(`Đăng ký ${payload.email} thành công. Vui lòng đăng nhập để thiết lập hồ sơ đối tác.`);
          navigateScreen('login', { replace: true });
        }}
        onBack={() => navigateScreen('register')}
        onLogin={applyAccount}
        onRegister={() => navigateScreen('register')}
        onSwitchToLogin={() => navigateScreen('login')}
      />
    );
  }

  if ((screen === 'work' || screen === 'resume' || screen === 'profile') && account) {
    return (
      <KhuVucLamViec
        account={account}
        workspace={workspace}
        hasWorkspace={hasWorkspace && !editingWorkspace}
        initialWorkspace={editingWorkspace || workspace || findWorkspaceDraft(account.uid)}
        activeSection={activeWorkspaceSection}
        onNavigate={navigateWorkspace}
        onHome={onBackHome}
        onComplete={(nextWorkspace) => {
          setWorkspace(nextWorkspace);
          setEditingWorkspace(null);
          setScreen('work');
          navigateWorkspace('tong-quan');
        }}
        onEdit={() => {
          setEditingWorkspace(workspace);
          setScreen('work');
          setWorkspaceUrl(screenUrls.edit);
        }}
        onCancelEdit={() => {
          setEditingWorkspace(null);
          setWorkspaceUrl(`${basePath}/${activeWorkspaceSection}`, true);
        }}
        onLogout={() => logoutTo(hasWorkspace ? 'landing' : 'login')}
      />
    );
  }

  return (
    <GioiThieuDoiTacYTe
      currentAccount={account}
      isLoading={isWorkspaceLoading}
      message={workspaceMessage}
      onContinue={() => loadWorkspaceForAccount(account, 'work')}
      onRegister={() => navigateScreen('register')}
      onLogin={() => navigateScreen('login')}
      onHome={onBackHome}
    />
  );
}

export default TrangChuLamViec;
