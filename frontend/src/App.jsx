import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Suspense, lazy, useEffect, useState } from 'react';
import { firebaseAuth } from './lib/firebase';
import { fallbackCatalog, fetchCatalog } from './lib/catalog';
import { ReferenceDataProvider } from './lib/reference_data';
import MucBaoMatFooter from './components/trang_chu/bao_mat_footer';
import ThanhDieuHuong from './components/dung_chung/thanh_dieu_huong';

const ChatbotAI = lazy(() => import('./components/dung_chung/chatbot_ai'));
const DangNhapDangKy = lazy(() => import('./components/xac_thuc/dang_nhap_dang_ky'));
const TrangDatLichBacSi = lazy(() => import('./components/dat_lich_kham/dat_lich_bac_si'));
const TrangDatLichBenhVien = lazy(() => import('./components/dat_lich_kham/dat_lich_benh_vien'));
const TrangDatLichChuyenKhoa = lazy(() => import('./components/dat_lich_kham/dat_lich_chuyen_khoa'));
const TrangDatLichPhongKham = lazy(() => import('./components/dat_lich_kham/dat_lich_phong_kham'));
const TrangDatKhamTongQuan = lazy(() => import('./components/dat_lich_kham/dat_kham_tong_quan'));
const TrangChuLamViec = lazy(() => import('./components/danh_cho_bac_si/trang_chu_lam_viec'));
const AdminDashboard = lazy(() => import('./components/admin/admin_dashboard'));
const TrangPhieuKhamDienTu = lazy(() => import('./components/phieu_kham/phieu_kham_dien_tu'));
const TrangChu = lazy(() => import('./components/trang_chu/trang_chu'));
const TrangThongTin = lazy(() => import('./components/trang_chu/trang_thong_tin'));
const MucTinYTe = lazy(() => import('./components/tin_y_te/tin_y_te'));

const HEALTH_BASE_PATH = '/tin-tuc';
const HEALTH_PATH_ALIASES = ['/tin-tuc', '/tin-y-te', '/tin-tu'];
const DEFAULT_HEALTH_CATEGORY = 'suc-khoe-tong-quat';
const PUBLIC_INFO_SLUGS = new Set([
  'gioi-thieu',
  'huong-dan-dat-kham',
  'cau-hoi-thuong-gap',
  'lien-he',
  'dieu-khoan-su-dung',
  'chinh-sach-bao-mat',
  'chinh-sach-cookie',
  'thanh-toan-va-hoan-tien',
  'giai-quyet-khieu-nai',
  'mien-tru-trach-nhiem-y-khoa',
]);
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

async function isPatientSession(user) {
  if (!user) return false;
  const token = await user.getIdToken();
  const response = await fetch(`${apiBaseUrl}/api/auth/me?portal=patient`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok;
}

function healthPathMatch(path) {
  return HEALTH_PATH_ALIASES.find((basePath) => path === basePath || path.startsWith(`${basePath}/`)) || '';
}

function normalizeHealthSlug(path) {
  const basePath = healthPathMatch(path);
  if (!basePath || path === basePath) return '';
  return path.slice(basePath.length + 1);
}

const BOOKING_KIND_PATHS = {
  doctor: 'bac-si',
  hospital: 'benh-vien',
  clinic: 'phong-kham',
  specialty: 'chuyen-khoa',
};

const BOOKING_SCREEN_PATHS = {
  detail: '',
  booking: 'dat-lich',
  success: 'thanh-cong',
  ticket: 'phieu-kham-dien-tu',
  account: 'phieu-kham-dien-tu',
};

const WORKSPACE_SCREEN_PATHS = {
  'dang-nhap': 'login',
  login: 'login',
  'dang-ky': 'register',
  register: 'register',
  'xac-thuc-otp': 'otp',
  otp: 'otp',
  'thiet-lap': 'setup',
  setup: 'setup',
  'ho-so': 'profile',
  profile: 'profile',
  'chinh-sua-ho-so': 'edit',
  edit: 'edit',
};

function slugify(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'dat-kham';
}

function bookingSlug(item) {
  if (item?.slug) return encodeURIComponent(item.slug);

  const labelSlug = slugify(item?.name || item?.title || item?.specialty || '');
  return encodeURIComponent(labelSlug !== 'dat-kham' ? labelSlug : item?.id || labelSlug);
}

function bookingItemKeys(item) {
  const labelSlug = slugify(item?.name || item?.title || item?.specialty || '');
  return [
    item?.slug,
    item?.id,
    labelSlug,
    item?.id && labelSlug !== 'dat-kham' ? `${labelSlug}-${item.id}` : '',
  ].filter(Boolean).map((key) => String(key).toLowerCase());
}

function findBookingItem(items, slug) {
  const normalizedSlug = decodeURIComponent(slug || '').toLowerCase();
  return (items || []).find((item) => bookingItemKeys(item).includes(normalizedSlug)) || null;
}

function PageLoading() {
  return <div className="page-loading" role="status">Đang tải...</div>;
}

function routeFromLocation() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(window.location.search);
  const bookingMatch = path.match(/^\/dat-kham\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/);
  const bookingOverviewMatch = path.match(/^\/dat-kham\/([^/]+)$/);
  const publicInfoMatch = path.match(/^\/thong-tin\/([^/]+)$/);
  const placeTypeParam = params.get('noi-kham') || params.get('placeType') || '';

  if (path === '/admin' || path.startsWith('/admin/')) {
    return { page: 'admin' };
  }

  if (path === '/dat-kham/tim-kiem') {
    const placeType = {
      'bac-si': 'doctor',
      'benh-vien': 'hospital',
      'phong-kham': 'clinic',
      doctor: 'doctor',
      hospital: 'hospital',
      clinic: 'clinic',
    }[placeTypeParam] || 'all';

    return { page: 'booking-search', bookingSearch: { placeType } };
  }

  if (path === '/dang-nhap') {
    return { page: 'auth', authMode: 'signin' };
  }

  if (path === '/dang-ky') {
    return { page: 'auth', authMode: 'signup-entry' };
  }

  if (path === '/phieu-kham-dien-tu' || path === '/phieu-kham') {
    return { page: 'patient-account', accountTab: 'lich_kham' };
  }

  const patientAccountMatch = path.match(/^\/tai-khoan(?:\/([^/]+))?$/);
  if (patientAccountMatch) {
    const accountTab = {
      'lich-kham': 'lich_kham',
      'thanh-toan': 'lich_su_thanh_toan',
      'ho-so': 'ho_so',
      'bao-mat': 'tai_khoan',
    }[patientAccountMatch[1]] || 'lich_kham';
    return { page: 'patient-account', accountTab };
  }

  if (publicInfoMatch && PUBLIC_INFO_SLUGS.has(publicInfoMatch[1])) {
    return { page: 'public-info', infoSlug: publicInfoMatch[1] };
  }

  const doctorWorkspaceMatch = path.match(/^\/bacsi(?:\/([^/]+))?$/);
  if (doctorWorkspaceMatch) {
    const routePart = doctorWorkspaceMatch[1] || '';
    return {
      page: 'doctor-workspace',
      workspace: {
        basePath: '/bacsi',
        requireAuth: true,
        screen: WORKSPACE_SCREEN_PATHS[routePart] || 'work',
        section: WORKSPACE_SCREEN_PATHS[routePart] ? 'tong-quan' : routePart || 'tong-quan',
      },
    };
  }

  const workspaceMatch = path.match(/^\/(?:danh-cho-bac-si|doi-tac-y-te)(?:\/([^/]+))?$/);
  if (workspaceMatch) {
    const routePart = workspaceMatch[1] || '';
    return {
      page: 'doctor-workspace',
      workspace: {
        basePath: '/danh-cho-bac-si',
        requireAuth: false,
        screen: WORKSPACE_SCREEN_PATHS[routePart] || (routePart ? 'work' : 'landing'),
        section: WORKSPACE_SCREEN_PATHS[routePart] ? 'tong-quan' : routePart || 'tong-quan',
      },
    };
  }

  if (bookingMatch) {
    const kind = Object.entries(BOOKING_KIND_PATHS).find(([, pathPart]) => pathPart === bookingMatch[1])?.[0];
    const screenPath = bookingMatch[3] || '';
    const normalizedScreenPath = screenPath === 'phieu-kham' ? 'phieu-kham-dien-tu' : screenPath;
    const screen = normalizedScreenPath === 'phieu-kham-dien-tu' && kind === 'doctor'
      ? 'account'
      : Object.entries(BOOKING_SCREEN_PATHS).find(([, pathPart]) => pathPart === normalizedScreenPath)?.[0] || 'detail';

    if (kind) {
      return {
        page: 'booking',
        booking: {
          kind,
          slug: decodeURIComponent(bookingMatch[2]),
          screen,
        },
      };
    }
  }

  const healthBasePath = healthPathMatch(path);

  if (healthBasePath && path === `${healthBasePath}/tim-kiem`) {
    return {
      page: 'health',
      health: {
        name: 'search',
        keyword: params.get('q') || '',
        category: params.get('category') || DEFAULT_HEALTH_CATEGORY,
      },
    };
  }

  if (bookingOverviewMatch) {
    const kind = Object.entries(BOOKING_KIND_PATHS).find(([, pathPart]) => pathPart === bookingOverviewMatch[1])?.[0];
    if (kind) {
      return { page: 'booking-overview', bookingOverview: { kind } };
    }
  }

  if (healthBasePath && path.startsWith(`${healthBasePath}/doi-ngu-chuyen-gia/`)) {
    return {
      page: 'health',
      health: {
        name: 'expert-profile',
        slug: decodeURIComponent(path.slice(`${healthBasePath}/doi-ngu-chuyen-gia/`.length)),
      },
    };
  }

  if (healthBasePath && path === `${healthBasePath}/doi-ngu-chuyen-gia`) {
    return {
      page: 'health',
      health: {
        name: 'expert-profile',
      },
    };
  }

  if (healthBasePath && path !== healthBasePath) {
    return {
      page: 'health',
      health: {
        name: 'detail',
        slug: decodeURIComponent(normalizeHealthSlug(path)),
      },
    };
  }

  if (healthBasePath) {
    return {
      page: 'health',
      health: {
        name: 'list',
        category: params.get('category') || DEFAULT_HEALTH_CATEGORY,
      },
    };
  }

  return { page: 'home', health: { name: 'list', category: DEFAULT_HEALTH_CATEGORY } };
}

function bookingRouteToUrl(kind, item, screen = 'detail') {
  if (screen === 'ticket' || screen === 'account') return '/phieu-kham-dien-tu';

  const kindPath = BOOKING_KIND_PATHS[kind] || kind;
  const screenPath = BOOKING_SCREEN_PATHS[screen] || '';
  const baseUrl = `/dat-kham/${kindPath}/${bookingSlug(item)}`;
  return screenPath ? `${baseUrl}/${screenPath}` : baseUrl;
}

function healthRouteToUrl(route) {
  if (route.name === 'expert-profile') {
    return route.slug
      ? `${HEALTH_BASE_PATH}/doi-ngu-chuyen-gia/${encodeURIComponent(route.slug)}`
      : `${HEALTH_BASE_PATH}/doi-ngu-chuyen-gia`;
  }

  if (route.name === 'detail') return `${HEALTH_BASE_PATH}/${encodeURIComponent(route.slug)}`;

  if (route.name === 'search') {
    const params = new URLSearchParams();
    params.set('q', route.keyword || '');
    params.set('category', route.category || DEFAULT_HEALTH_CATEGORY);
    return `${HEALTH_BASE_PATH}/tim-kiem?${params.toString()}`;
  }

  const category = route.category || DEFAULT_HEALTH_CATEGORY;
  if (category === DEFAULT_HEALTH_CATEGORY) return HEALTH_BASE_PATH;

  const params = new URLSearchParams();
  params.set('category', category);
  return `${HEALTH_BASE_PATH}?${params.toString()}`;
}

function App() {
  const [isAuthPage, setIsAuthPage] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [catalog, setCatalog] = useState(fallbackCatalog);
  const [appRoute, setAppRoute] = useState(routeFromLocation);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    });

    return () => {
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = previousScrollRestoration;
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (currentUser) => {
      if (!currentUser) {
        if (active) {
          setUser(null);
          setIsAuthReady(true);
        }
        return;
      }
      try {
        const allowed = await isPatientSession(currentUser);
        if (active) setUser(allowed ? currentUser : null);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setIsAuthReady(true);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchCatalog()
      .then((data) => {
        if (isMounted) setCatalog(data);
      })
      .catch(() => {
        if (isMounted) setCatalog(fallbackCatalog);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setAppRoute(routeFromLocation());
      setIsAuthPage(false);
      setSelectedDoctor(null);
      setSelectedHospital(null);
      setSelectedClinic(null);
      setSelectedSpecialty(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (appRoute.page === 'auth') {
      setIsAuthPage(true);
      setAuthMode(appRoute.authMode || 'signin');
      setSelectedDoctor(null);
      setSelectedHospital(null);
      setSelectedClinic(null);
      setSelectedSpecialty(null);
      return;
    }

    if (appRoute.page !== 'booking') return;

    const { kind, slug } = appRoute.booking;
    setIsAuthPage(false);
    setSelectedDoctor(kind === 'doctor' ? findBookingItem(catalog.doctors, slug) : null);
    setSelectedHospital(kind === 'hospital' ? findBookingItem(catalog.hospitals, slug) : null);
    setSelectedClinic(kind === 'clinic' ? findBookingItem(catalog.clinics, slug) : null);
    setSelectedSpecialty(kind === 'specialty' ? findBookingItem(catalog.specialties, slug) || { name: slug } : null);
  }, [appRoute, catalog]);

  const pushUrl = (url) => {
    if (window.location.pathname + window.location.search !== url) {
      window.history.pushState({}, '', url);
    }
  };

  const handleSignOut = async () => {
    await signOut(firebaseAuth);
    setUser(null);
  };

  const openAuth = (mode = 'signin') => {
    pushUrl(mode === 'signup-entry' ? '/dang-ky' : '/dang-nhap');
    setAppRoute({ page: 'auth', authMode: mode });
    setAuthMode(mode);
    setIsAuthPage(true);
    setSelectedDoctor(null);
    setSelectedHospital(null);
    setSelectedClinic(null);
    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  const signOutToAuth = async () => {
    await handleSignOut();
    showHome();
  };

  const showHome = () => {
    pushUrl('/');
    setAppRoute({ page: 'home', health: { name: 'list', category: DEFAULT_HEALTH_CATEGORY } });
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(null);
    setSelectedClinic(null);
    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  const showHealthNews = (route = { name: 'list', category: DEFAULT_HEALTH_CATEGORY }) => {
    pushUrl(healthRouteToUrl(route));
    setAppRoute({ page: 'health', health: route });
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(null);
    setSelectedClinic(null);
    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const showBookingOverview = (kind = 'doctor') => {
    const kindPath = BOOKING_KIND_PATHS[kind] || BOOKING_KIND_PATHS.doctor;
    pushUrl(`/dat-kham/${kindPath}`);
    setAppRoute({ page: 'booking-overview', bookingOverview: { kind } });
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(null);
    setSelectedClinic(null);
    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showPublicInfo = (slug = 'gioi-thieu') => {
    const infoSlug = PUBLIC_INFO_SLUGS.has(slug) ? slug : 'gioi-thieu';
    pushUrl(`/thong-tin/${infoSlug}`);
    setAppRoute({ page: 'public-info', infoSlug });
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(null);
    setSelectedClinic(null);
    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const showBookingSearch = (placeType = 'doctor') => {
    const placePath = {
      doctor: 'bac-si',
      hospital: 'benh-vien',
      clinic: 'phong-kham',
    }[placeType] || 'tat-ca';
    pushUrl(`/dat-kham/tim-kiem?noi-kham=${placePath}`);
    setAppRoute({ page: 'booking-search', bookingSearch: { placeType } });
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(null);
    setSelectedClinic(null);
    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showDoctorWorkspace = () => {
    pushUrl('/danh-cho-bac-si');
    setAppRoute({ page: 'doctor-workspace', workspace: { basePath: '/danh-cho-bac-si', requireAuth: false, screen: 'landing', section: 'tong-quan' } });
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(null);
    setSelectedClinic(null);
    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showPatientAccount = (accountTab = 'lich_kham') => {
    const accountPath = {
      lich_kham: 'lich-kham',
      lich_su_thanh_toan: 'thanh-toan',
      ho_so: 'ho-so',
      tai_khoan: 'bao-mat',
    }[accountTab] || 'lich-kham';
    pushUrl(`/tai-khoan/${accountPath}`);
    setAppRoute({ page: 'patient-account', accountTab });
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(null);
    setSelectedClinic(null);
    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showDoctorBooking = (doctor) => {
    pushUrl(bookingRouteToUrl('doctor', doctor));
    setAppRoute({ page: 'booking', booking: { kind: 'doctor', slug: decodeURIComponent(bookingSlug(doctor)), screen: 'detail' } });
    setIsAuthPage(false);
    setSelectedDoctor(doctor);
    setSelectedHospital(null);
    setSelectedClinic(null);
    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showHospitalBooking = (hospital) => {
    pushUrl(bookingRouteToUrl('hospital', hospital));
    setAppRoute({ page: 'booking', booking: { kind: 'hospital', slug: decodeURIComponent(bookingSlug(hospital)), screen: 'detail' } });
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(hospital);
    setSelectedClinic(null);
    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showClinicBooking = (clinic) => {
    pushUrl(bookingRouteToUrl('clinic', clinic));
    setAppRoute({ page: 'booking', booking: { kind: 'clinic', slug: decodeURIComponent(bookingSlug(clinic)), screen: 'detail' } });
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(null);
    setSelectedClinic(clinic);
    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showSpecialtyBooking = (specialty) => {
    pushUrl(bookingRouteToUrl('specialty', specialty));
    setAppRoute({ page: 'booking', booking: { kind: 'specialty', slug: decodeURIComponent(bookingSlug(specialty)), screen: 'detail' } });
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(null);
    setSelectedClinic(null);
    setSelectedSpecialty(specialty);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateBookingScreen = (kind, item, screen) => {
    const route = { page: 'booking', booking: { kind, slug: decodeURIComponent(bookingSlug(item)), screen } };
    pushUrl(bookingRouteToUrl(kind, item, screen));
    setAppRoute(route);
  };

  const isHealthPage = appRoute.page === 'health';
  const isDoctorWorkspacePage = appRoute.page === 'doctor-workspace';
  const isAdminPage = appRoute.page === 'admin';

  return (
    <ReferenceDataProvider>
    <div className={`site-shell${isHealthPage ? ' health-news-shell' : ''}${isDoctorWorkspacePage ? ' doctor-workspace-shell' : ''}${isAdminPage ? ' admin-site-shell' : ''}`} id="home">
      {!isHealthPage && !isDoctorWorkspacePage && !isAdminPage ? (
        <ThanhDieuHuong
          user={user}
          onHome={showHome}
          onBook={showBookingOverview}
          onHealthNews={showHealthNews}
          onDoctorWorkspace={showDoctorWorkspace}
          onOpenAuth={openAuth}
          onOpenAccount={showPatientAccount}
          onLogout={signOutToAuth}
        />
      ) : null}

      <main>
        <Suspense fallback={<PageLoading />}>
        {isAuthPage ? (
          <DangNhapDangKy
            initialMode={authMode}
            onBack={showHome}
            onAuthSuccess={(authUser) => {
              setUser(authUser);
              showHome();
            }}
          />
        ) : selectedDoctor ? (
          <TrangDatLichBacSi
            doctor={selectedDoctor}
            initialScreen={appRoute.booking?.kind === 'doctor' ? appRoute.booking.screen : 'detail'}
            user={user}
            onBackHome={showHome}
            onScreenChange={(screen) => updateBookingScreen('doctor', selectedDoctor, screen)}
            onSignOut={signOutToAuth}
          />
        ) : selectedHospital ? (
          <TrangDatLichBenhVien
            hospital={selectedHospital}
            initialScreen={appRoute.booking?.kind === 'hospital' ? appRoute.booking.screen : 'detail'}
            user={user}
            onBackHome={showHome}
            onScreenChange={(screen) => updateBookingScreen('hospital', selectedHospital, screen)}
          />
        ) : selectedClinic ? (
          <TrangDatLichPhongKham
            clinic={selectedClinic}
            initialScreen={appRoute.booking?.kind === 'clinic' ? appRoute.booking.screen : 'detail'}
            user={user}
            onBackHome={showHome}
            onScreenChange={(screen) => updateBookingScreen('clinic', selectedClinic, screen)}
          />
        ) : selectedSpecialty ? (
          <TrangDatLichChuyenKhoa
            catalog={catalog}
            initialSpecialty={selectedSpecialty}
            onBookDoctor={showDoctorBooking}
            onBookHospital={showHospitalBooking}
            onBookClinic={showClinicBooking}
          />
        ) : appRoute.page === 'booking-search' ? (
          <TrangDatLichChuyenKhoa
            catalog={catalog}
            initialPlaceType={appRoute.bookingSearch?.placeType || 'all'}
            onBookDoctor={showDoctorBooking}
            onBookHospital={showHospitalBooking}
            onBookClinic={showClinicBooking}
          />
        ) : appRoute.page === 'booking-overview' ? (
          <TrangDatKhamTongQuan
            catalog={catalog}
            activeTab={appRoute.bookingOverview?.kind || 'doctor'}
            onBookDoctor={showDoctorBooking}
            onBookHospital={showHospitalBooking}
            onBookClinic={showClinicBooking}
            onSelectSpecialty={showSpecialtyBooking}
            onChangeTab={showBookingOverview}
            onOpenSearch={showBookingSearch}
            user={user}
          />
        ) : appRoute.page === 'patient-account' ? (
          !isAuthReady ? <PageLoading /> : user ? (
            <TrangPhieuKhamDienTu
              appointment={null}
              user={user}
              initialTab={appRoute.accountTab || 'lich_kham'}
              onTabChange={showPatientAccount}
              onLogout={signOutToAuth}
            />
          ) : (
            <DangNhapDangKy
              initialMode="signin"
              onBack={showHome}
              onAuthSuccess={(authUser) => {
                setUser(authUser);
                showPatientAccount(appRoute.accountTab || 'lich_kham');
              }}
            />
          )
        ) : appRoute.page === 'doctor-workspace' ? (
          <TrangChuLamViec
            initialScreen={appRoute.workspace?.screen || 'landing'}
            initialSection={appRoute.workspace?.section || 'tong-quan'}
            basePath={appRoute.workspace?.basePath || '/danh-cho-bac-si'}
            requireAuth={Boolean(appRoute.workspace?.requireAuth)}
            onBackHome={showHome}
          />
        ) : appRoute.page === 'admin' ? (
          <AdminDashboard onBackHome={showHome} />
        ) : appRoute.page === 'health' ? (
          <MucTinYTe route={appRoute.health} onNavigate={showHealthNews} onHome={showHome} onBookSpecialty={showSpecialtyBooking} />
        ) : appRoute.page === 'public-info' ? (
          <TrangThongTin
            slug={appRoute.infoSlug}
            onNavigate={showPublicInfo}
            onBackHome={showHome}
          />
        ) : (
          <TrangChu
            catalog={catalog}
            onBookDoctor={showDoctorBooking}
            onBookHospital={showHospitalBooking}
            onBookClinic={showClinicBooking}
            onSelectSpecialty={showSpecialtyBooking}
            onOpenHealthNews={showHealthNews}
            onOpenBookingOverview={showBookingOverview}
          />
        )}
        </Suspense>
      </main>
      {!isDoctorWorkspacePage && !isAdminPage ? (
        <MucBaoMatFooter
          onNavigate={showPublicInfo}
          onOpenBookingOverview={showBookingOverview}
          onOpenHealthNews={showHealthNews}
        />
      ) : null}
      {!isDoctorWorkspacePage && !isAdminPage ? (
        <Suspense fallback={null}>
          <ChatbotAI user={user} />
        </Suspense>
      ) : null}
    </div>
    </ReferenceDataProvider>
  );
}

export default App;
