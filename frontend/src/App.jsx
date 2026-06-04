import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import BieuTuongLogo from './components/dung_chung/bieu_tuong_logo';
import DangNhapDangKy from './components/xac_thuc/dang_nhap_dang_ky';
import TrangDatLichBacSi from './components/dat_lich_kham/dat_lich_bac_si';
import TrangDatLichBenhVien from './components/dat_lich_kham/dat_lich_benh_vien';
import TrangDatLichChuyenKhoa from './components/dat_lich_kham/dat_lich_chuyen_khoa';
import TrangDatLichPhongKham from './components/dat_lich_kham/dat_lich_phong_kham';
import TrangPhieuKhamDienTu from './components/dat_lich_kham/phieu_kham-dien-tu';
import TrangChu from './components/trang_chu/trang_chu';
import MucTinYTe from './components/tin_y_te/tin_y_te';
import { firebaseAuth } from './lib/firebase';
import { fallbackCatalog, fetchCatalog } from './lib/catalog';
import { ReferenceDataProvider } from './lib/reference_data';

const HEALTH_BASE_PATH = '/tin-tuc';
const HEALTH_PATH_ALIASES = ['/tin-tuc', '/tin-y-te', '/tin-tu'];
const DEFAULT_HEALTH_CATEGORY = 'suc-khoe-tong-quat';

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

function routeFromLocation() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(window.location.search);
  const bookingMatch = path.match(/^\/dat-kham\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/);

  if (path === '/dang-nhap') {
    return { page: 'auth', authMode: 'signin' };
  }

  if (path === '/dang-ky') {
    return { page: 'auth', authMode: 'signup-entry' };
  }

  if (path === '/phieu-kham-dien-tu' || path === '/phieu-kham') {
    return { page: 'ticket' };
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
    const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
      setUser(currentUser);
    });

    return unsubscribe;
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

  return (
    <ReferenceDataProvider>
    <div className={`site-shell${isHealthPage ? ' health-news-shell' : ''}`} id="home">
      {!isHealthPage ? (
        <header className="site-header">
          <button className="logo-button" type="button" onClick={showHome} aria-label="Về trang chủ MidHealth">
            <BieuTuongLogo />
          </button>
          <nav className="main-nav" aria-label="Điều hướng chính">
            <a href="#booking" onClick={(event) => { event.preventDefault(); showHome(); }}>Đặt khám <span aria-hidden="true">▾</span></a>
            <a href="/tin-tuc" onClick={(event) => { event.preventDefault(); showHealthNews(); }}>Tin Y tế</a>
          </nav>
          {user ? (
            <div className="user-menu">
              <span>{user.displayName || user.email}</span>
              <button className="login-button" type="button" onClick={signOutToAuth}>Đăng xuất</button>
            </div>
          ) : (
            <div className="user-menu">
              <button className="login-button" type="button" onClick={() => openAuth('signin')}>Đăng nhập</button>
              <button className="login-button" type="button" onClick={() => openAuth('signup-entry')}>Đăng ký</button>
            </div>
          )}
        </header>
      ) : null}

      <main>
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
        ) : appRoute.page === 'ticket' ? (
          <TrangPhieuKhamDienTu
            appointment={null}
            user={user}
            onLogout={signOutToAuth}
          />
        ) : appRoute.page === 'health' ? (
          <MucTinYTe route={appRoute.health} onNavigate={showHealthNews} onHome={showHome} onBookSpecialty={showSpecialtyBooking} />
        ) : (
          <TrangChu
            catalog={catalog}
            onBookDoctor={showDoctorBooking}
            onBookHospital={showHospitalBooking}
            onBookClinic={showClinicBooking}
            onSelectSpecialty={showSpecialtyBooking}
            onOpenHealthNews={showHealthNews}
          />
        )}
      </main>
    </div>
    </ReferenceDataProvider>
  );
}

export default App;
