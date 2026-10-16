import { ClinicContext } from './lib/clinic';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { Suspense, lazy, useEffect, useState } from 'react';
import { firebaseAuth } from './lib/firebase';
import { apiBaseUrl } from './lib/api_base';
import { fallbackCatalog, fetchCatalog } from './lib/catalog';
import { ReferenceDataProvider } from './lib/reference_data';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import OfflinePage from './components/error/OfflinePage';
import NotFoundPage from './components/error/NotFoundPage';
import MucBaoMatFooter from './components/trang_chu/bao_mat_footer';
import ThanhDieuHuong from './components/dung_chung/thanh_dieu_huong';

const DangNhapDangKy = lazy(() => import('./components/xac_thuc/dang_nhap_dang_ky'));
const TrangDatLichBacSi = lazy(() => import('./components/dat_lich_kham/dat_lich_bac_si'));
const TrangDatLichChuyenKhoa = lazy(() => import('./components/dat_lich_kham/dat_lich_chuyen_khoa'));
const TrangDatKhamTongQuan = lazy(() => import('./components/dat_lich_kham/dat_kham_tong_quan'));

const AdminDashboard = lazy(() => import('./components/admin/admin_dashboard'));
const DoctorWorkspace = lazy(() => import('./components/doctor/doctor_workspace'));
const StaffWorkspace = lazy(() => import('./components/staff/staff_workspace'));
const TrangPhieuKhamDienTu = lazy(() => import('./components/phieu_kham/phieu_kham_dien_tu'));
const TrangChu = lazy(() => import('./components/trang_chu/trang_chu'));
const TrangThongTin = lazy(() => import('./components/trang_chu/trang_thong_tin'));
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
const BOOKING_KIND_PATHS = {
  doctor: 'bac-si',
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

let validationMessageSequence = 0;

function localizedValidationMessage(event) {
  event.preventDefault();
  const field = event.target;
  const validity = field?.validity;
  if (!validity || !field.setCustomValidity) return;
  let message = 'Giá trị chưa hợp lệ. Vui lòng kiểm tra lại.';
  if (validity.valueMissing) message = field.tagName === 'SELECT' ? 'Vui lòng chọn một mục trước khi tiếp tục.' : 'Vui lòng điền trường này.';
  else if (validity.typeMismatch && field.type === 'email') message = 'Email chưa đúng định dạng.';
  else if (validity.typeMismatch && field.type === 'url') message = 'Đường dẫn chưa đúng định dạng.';
  else if (validity.tooShort) message = `Vui lòng nhập ít nhất ${field.minLength} ký tự.`;
  else if (validity.tooLong) message = `Vui lòng nhập không quá ${field.maxLength} ký tự.`;
  else if (validity.rangeUnderflow) message = `Giá trị không được nhỏ hơn ${field.min}.`;
  else if (validity.rangeOverflow) message = `Giá trị không được lớn hơn ${field.max}.`;
  else if (validity.stepMismatch) message = 'Vui lòng nhập giá trị theo đúng bước quy định.';
  else if (validity.patternMismatch) message = 'Thông tin chưa đúng định dạng yêu cầu.';
  else if (validity.badInput) message = 'Vui lòng nhập một giá trị hợp lệ.';
  showSiteValidationError(field, message);
}

function showSiteValidationError(field, message) {
  if (!field) return;
  if (field.dataset.siteValidationMessage) {
    const existing = document.getElementById(field.dataset.siteValidationMessage);
    if (existing) existing.textContent = message;
    return;
  }
  const error = document.createElement('small');
  error.className = 'site-validation-error';
  error.id = `midhealth-validation-${++validationMessageSequence}`;
  error.setAttribute('role', 'alert');
  error.textContent = message;
  const description = field.getAttribute('aria-describedby') || '';
  field.dataset.siteValidationMessage = error.id;
  field.dataset.siteValidationDescription = description;
  field.setAttribute('aria-invalid', 'true');
  field.setAttribute('aria-describedby', [description, error.id].filter(Boolean).join(' '));
  const container = field.closest('label') || field.parentElement;
  container?.append(error);
}
function clearLocalizedValidation(event) {
  const field = event.target;
  if (!field) return;
  if (field.dataset.accountValidationMessage) {
    document.getElementById(field.dataset.accountValidationMessage)?.remove();
    field.removeAttribute('aria-invalid');
    delete field.dataset.accountValidationMessage;
  }
  if (!field.dataset.siteValidationMessage) return;
  document.getElementById(field.dataset.siteValidationMessage)?.remove();
  field.removeAttribute('aria-invalid');
  const description = field.dataset.siteValidationDescription;
  if (description) field.setAttribute('aria-describedby', description);
  else field.removeAttribute('aria-describedby');
  delete field.dataset.siteValidationMessage;
  delete field.dataset.siteValidationDescription;
}

function findBookingItem(items, slug) {
  const normalizedSlug = String(slug || '').toLowerCase();
  return (items || []).find((item) => bookingItemKeys(item).includes(normalizedSlug)) || null;
}

function PageLoading() {
  return <div className="page-loading" role="status">Đang tải...</div>;
}

function paymentResultFromParams(params) {
  const legacyProvider = params.has('paypalStatus') ? 'paypal' : '';
  const status = params.get('paymentStatus') || params.get('paypalStatus') || '';
  const provider = params.get('paymentProvider') || legacyProvider;
  return status ? { provider, status } : null;
}

function routeFromLocation() {
  let path = window.location.pathname.replace(/\/+$/, '') || '/';
  try { decodeURIComponent(path); } catch { return { page: 'not-found' }; }
  const params = new URLSearchParams(window.location.search);
  const paymentResult = paymentResultFromParams(params);
  const bookingMatch = path.match(/^\/dat-kham\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/);
  const bookingOverviewMatch = path.match(/^\/dat-kham\/([^/]+)$/);
  const publicInfoMatch = path.match(/^\/thong-tin\/([^/]+)$/);

  if (paymentResult) {
    return { page: 'payment-result', paymentResult };
  }

  if (path === '/admin' || path.startsWith('/admin/')) {
    return { page: 'admin' };
  }
  if (path === '/nhan-vien' || path.startsWith('/nhan-vien/')) return { page: 'staff' };
  if (path === '/danh-cho-bac-si' || path.startsWith('/danh-cho-bac-si/')) {
    return { page: 'doctor' };
  }

  if (path === '/dat-kham/tim-kiem' || path === '/dat-kham') return { page: 'booking-overview', bookingOverview: { kind: 'specialty' } };

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
      'thong-bao': 'thong_bao',
      'bao-mat': 'tai_khoan',
    }[patientAccountMatch[1]];
    if (patientAccountMatch[1] && !accountTab) return { page: 'not-found' };
    return { page: 'patient-account', accountTab: accountTab || 'lich_kham' };
  }

  if (publicInfoMatch && PUBLIC_INFO_SLUGS.has(publicInfoMatch[1])) {
    return { page: 'public-info', infoSlug: publicInfoMatch[1] };
  }

  if (bookingMatch) {
    const kind = Object.entries(BOOKING_KIND_PATHS).find(([, pathPart]) => pathPart === bookingMatch[1])?.[0];
    const screenPath = bookingMatch[3] || '';
    const normalizedScreenPath = screenPath === 'phieu-kham' ? 'phieu-kham-dien-tu' : screenPath;
    if (!Object.values(BOOKING_SCREEN_PATHS).includes(normalizedScreenPath)) return { page: 'not-found' };
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

  if (bookingOverviewMatch) {
    const kind = Object.entries(BOOKING_KIND_PATHS).find(([, pathPart]) => pathPart === bookingOverviewMatch[1])?.[0];
    if (kind) {
      return { page: 'booking-overview', bookingOverview: { kind } };
    }
  }

  if (path === '/') {
    return { page: 'home' };
  }

  return { page: 'not-found' };
}

function bookingRouteToUrl(kind, item, screen = 'detail') {
  if (screen === 'ticket' || screen === 'account') return '/phieu-kham-dien-tu';

  const kindPath = BOOKING_KIND_PATHS[kind] || kind;
  const screenPath = BOOKING_SCREEN_PATHS[screen] || '';
  const baseUrl = `/dat-kham/${kindPath}/${bookingSlug(item)}`;
  return screenPath ? `${baseUrl}/${screenPath}` : baseUrl;
}

function PaymentResultPage({ result, onViewAppointments, onHome }) {
  const providerName = result?.provider === 'paypal' ? 'PayPal' : 'cổng thanh toán';
  const status = result?.status || 'failed';
  const isSuccess = status === 'success';
  const isCancelled = status === 'cancelled';
  const needsReview = status === 'review';
  const isPending = status === 'pending';
  const title = isSuccess
    ? 'Đã nhận phản hồi thanh toán'
    : needsReview
      ? 'Khoản cọc cần đối soát'
    : isPending
      ? 'Lịch đang chờ đối soát thanh toán'
    : isCancelled
      ? 'Thanh toán đã hủy'
      : 'Thanh toán chưa thành công';
  const message = isSuccess
    ? `${providerName} đã chuyển bạn về website. Mở lịch khám để kiểm tra trạng thái giao dịch đã được hệ thống ghi nhận.`
    : needsReview
      ? 'PayPal đã ghi nhận khoản cọc nhưng lịch chưa được xác nhận. Vui lòng liên hệ phòng khám để đối soát; không thanh toán lần nữa.'
     : isPending
       ? 'Chưa xác nhận được kết quả thanh toán. Vui lòng xem trạng thái lịch trong tài khoản trước khi thử thanh toán lại.'
     : isCancelled
      ? `Bạn đã rời bước thanh toán qua ${providerName}. Vui lòng kiểm tra trạng thái lịch khám trong tài khoản.`
      : `Giao dịch ${providerName} chưa hoàn tất. Vui lòng kiểm tra trạng thái lịch khám trong tài khoản trước khi thử lại.`;

  return (
    <section className="payment-result-page">
      <article className={`payment-result-card ${isSuccess ? 'success' : isCancelled ? 'cancelled' : 'failed'}`}>
        <div className="payment-result-mark">{isSuccess ? '✓' : '!'}</div>
        <h1>{title}</h1>
        <p>{message}</p>
        <div className="payment-result-actions">
          <button type="button" onClick={onViewAppointments}>Xem lịch khám</button>
          <button type="button" onClick={onHome}>Về trang chủ</button>
        </div>
      </article>
    </section>
  );
}

function App() {
  const [isAuthPage, setIsAuthPage] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [catalog, setCatalog] = useState(fallbackCatalog);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [authReturnRoute, setAuthReturnRoute] = useState(null);
  useEffect(() => {
    const update = event => setCatalog(current => ({ ...current, clinic: event.detail }));
    const reload = () => { setCatalogLoading(true); setCatalogRetry(value => value + 1); };
    window.addEventListener('midhealth:clinic-updated', update);
    window.addEventListener('midhealth:catalog-updated', reload);
    return () => { window.removeEventListener('midhealth:clinic-updated', update); window.removeEventListener('midhealth:catalog-updated', reload); };
  }, []);
  const [appRoute, setAppRoute] = useState(routeFromLocation);
  const isOnline = useOnlineStatus();

  const isAdminPage = ['admin', 'doctor', 'staff'].includes(appRoute.page);

  useEffect(() => {
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
  }, [appRoute.page, appRoute.booking?.slug, appRoute.booking?.screen, appRoute.bookingOverview?.kind, appRoute.infoSlug]);

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
        if (active) { setUser(null); setIsAuthReady(true); }
        return;
      }
      if (window.location.pathname === '/dang-ky') {
        if (active) { setUser(null); setIsAuthReady(true); }
        return;
      }
      try {
        const token = await currentUser.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };
        const accountResponse = await fetch(`${apiBaseUrl}/api/auth/me?portal=account&optional=1`, { headers });
        const account = await accountResponse.json();
        if (account.data?.role === 'patient') {
          const profileResponse = await fetch(`${apiBaseUrl}/api/auth/me?portal=patient&optional=1`, { headers });
          const profile = await profileResponse.json();
          if (profile.data?.reason === 'PATIENT_PROFILE_INCOMPLETE') {
            if (active) {
              setUser(null);
              setAuthMode('complete-profile');
              setIsAuthPage(true);
              window.history.replaceState({}, '', '/dang-ky');
              setAppRoute({ page: 'auth', authMode: 'complete-profile' });
              setIsAuthReady(true);
            }
            return;
          }
        }
      } catch {
        // A temporary API failure should not invalidate the Firebase session.
      }
      if (active) { setUser(currentUser); setIsAuthReady(true); }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    fetchCatalog({ force: catalogRetry > 0 })
      .then((data) => {
        if (isMounted) { setCatalog(data); setCatalogError(''); }
      })
      .catch(error => { if (isMounted) setCatalogError(error?.message || 'Không thể tải thông tin phòng khám. Vui lòng thử lại sau.'); })
      .finally(() => { if (isMounted) setCatalogLoading(false); });

    return () => {
      isMounted = false;
    };
  }, [catalogRetry]);

  useEffect(() => {
    const handlePopState = () => {
      setAppRoute(routeFromLocation());
      setIsAuthPage(false);
      setSelectedDoctor(null);

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

      setSelectedSpecialty(null);
      return;
    }

    if (appRoute.page !== 'booking') return;

    const { kind, slug } = appRoute.booking;
    setIsAuthPage(false);
    setSelectedDoctor(kind === 'doctor' ? findBookingItem(catalog.doctors, slug) : null);

    setSelectedSpecialty(kind === 'specialty' ? findBookingItem(catalog.specialties, slug) : null);
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
    setAuthReturnRoute(appRoute.page === 'booking' ? appRoute : null);
    pushUrl(mode === 'signup-entry' ? '/dang-ky' : '/dang-nhap');
    setAppRoute({ page: 'auth', authMode: mode });
    setAuthMode(mode);
    setIsAuthPage(true);
    setSelectedDoctor(null);

    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  const signOutToAuth = async () => {
    await handleSignOut();
    showHome();
  };

  const showHome = () => {
    pushUrl('/');
    setAppRoute({ page: 'home' });
    setIsAuthPage(false);
    setSelectedDoctor(null);

    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
  };

  const showAdmin = () => {
    pushUrl('/admin');
    setAppRoute({ page: 'admin' });
    setIsAuthPage(false);
    setAuthReturnRoute(null);
  };

  const showDoctor = () => {
    if (!window.location.pathname.startsWith('/danh-cho-bac-si/')) {
      pushUrl('/danh-cho-bac-si/tong-quan');
    }
    setAppRoute({ page: 'doctor' });
    setIsAuthPage(false);
    setAuthReturnRoute(null);
  };

  const showStaff = () => {
    pushUrl('/nhan-vien');
    setAppRoute({ page: 'staff' });
    setIsAuthPage(false);
    setAuthReturnRoute(null);
  };

  const showBookingOverview = (kind = 'doctor') => {
    const kindPath = BOOKING_KIND_PATHS[kind] || BOOKING_KIND_PATHS.doctor;
    pushUrl(`/dat-kham/${kindPath}`);
    setAppRoute({ page: 'booking-overview', bookingOverview: { kind } });
    setIsAuthPage(false);
    setSelectedDoctor(null);

    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showPublicInfo = (slug = 'gioi-thieu') => {
    const infoSlug = PUBLIC_INFO_SLUGS.has(slug) ? slug : 'gioi-thieu';
    pushUrl(`/thong-tin/${infoSlug}`);
    setAppRoute({ page: 'public-info', infoSlug });
    setIsAuthPage(false);
    setSelectedDoctor(null);

    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const showPatientAccount = (accountTab = 'lich_kham') => {
    const accountPath = {
      lich_kham: 'lich-kham',
      lich_su_thanh_toan: 'thanh-toan',
      ho_so: 'ho-so',
      thong_bao: 'thong-bao',
      tai_khoan: 'bao-mat',
    }[accountTab] || 'lich-kham';
    pushUrl(`/tai-khoan/${accountPath}`);
    setAppRoute({ page: 'patient-account', accountTab });
    setIsAuthPage(false);
    setSelectedDoctor(null);

    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showDoctorBooking = (doctor) => {
    pushUrl(bookingRouteToUrl('doctor', doctor));
    setAppRoute({ page: 'booking', booking: { kind: 'doctor', slug: decodeURIComponent(bookingSlug(doctor)), screen: 'detail' } });
    setIsAuthPage(false);
    setSelectedDoctor(doctor);

    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showSpecialtyBooking = (specialty) => {
    pushUrl(bookingRouteToUrl('specialty', specialty));
    setAppRoute({ page: 'booking', booking: { kind: 'specialty', slug: decodeURIComponent(bookingSlug(specialty)), screen: 'detail' } });
    setIsAuthPage(false);
    setSelectedDoctor(null);

    setSelectedSpecialty(specialty);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateBookingScreen = (kind, item, screen) => {
    const route = { page: 'booking', booking: { kind, slug: decodeURIComponent(bookingSlug(item)), screen } };
    pushUrl(bookingRouteToUrl(kind, item, screen));
    setAppRoute(route);
  };

  if (!isOnline) {
    return <OfflinePage />;
  }

  return (
    <ClinicContext.Provider value={catalog.clinic}>
    <ReferenceDataProvider>
    <div className={`site-shell${isAdminPage ? ' admin-site-shell' : ''}`} id="home"
      onInvalidCapture={localizedValidationMessage} onInputCapture={clearLocalizedValidation} onChangeCapture={clearLocalizedValidation}>
      {!isAdminPage ? (
        <ThanhDieuHuong
          user={isAuthPage ? null : user}
          onHome={showHome}
          onPublicInfo={showPublicInfo}
          onBook={showBookingOverview}
          onOpenAuth={openAuth}
          onOpenAccount={showPatientAccount}
          onLogout={signOutToAuth}
        />
      ) : null}

      <main>
        {(catalog.notice || catalogError) && !isAdminPage && !(['booking', 'booking-overview', 'booking-search'].includes(appRoute.page) && catalogError) && <div className="catalog-notice" role="status"><span>{catalog.notice || catalogError}</span><button disabled={catalogLoading} onClick={() => { setCatalogLoading(true); setCatalogRetry(value => value + 1); }}>{catalogLoading ? 'Đang tải...' : 'Thử kết nối lại'}</button></div>}
        <Suspense fallback={<PageLoading />}>
        {['booking', 'booking-overview', 'booking-search'].includes(appRoute.page) && catalogLoading ? <PageLoading /> : ['booking', 'booking-overview', 'booking-search'].includes(appRoute.page) && catalogError ? <section className="clinic-empty" role="alert"><h1>Chưa tải được dữ liệu phòng khám</h1><p>{catalogError}</p><button className="clinic-primary" onClick={() => { setCatalogLoading(true); setCatalogRetry(value => value + 1); }}>Thử lại</button></section> : isAuthPage ? (
          <DangNhapDangKy
            initialMode={authMode}
            onBack={showHome}
            onAuthSuccess={(authUser, role) => {
              setUser(authUser);
              if (role === 'admin') { showAdmin(); return; }
              if (role === 'doctor' || role === 'head') { showDoctor(); return; }
              if (role === 'staff') { showStaff(); return; }
              if (authReturnRoute) {
                const { kind, slug } = authReturnRoute.booking;
                const item = findBookingItem(kind === 'doctor' ? catalog.doctors : catalog.specialties, slug);
                if (item) {
                  pushUrl(bookingRouteToUrl(kind, item, 'booking'));
                  setAppRoute({ ...authReturnRoute, booking: { ...authReturnRoute.booking, screen: 'booking' } });
                  setIsAuthPage(false);
                  setAuthReturnRoute(null);
                  return;
                }
              }
              showHome();
            }}
          />
        ) : appRoute.page === 'payment-result' ? (
          <PaymentResultPage
            result={appRoute.paymentResult}
            onViewAppointments={() => showPatientAccount('lich_kham')}
            onHome={showHome}
          />
        ) : selectedDoctor ? (
          <TrangDatLichBacSi
            key={selectedDoctor.id}
            doctor={selectedDoctor}
            services={catalog.services}
            initialScreen={appRoute.booking?.kind === 'doctor' ? appRoute.booking.screen : 'detail'}
            user={user}
            onBackHome={showHome}
            onScreenChange={(screen) => updateBookingScreen('doctor', selectedDoctor, screen)}
            onSignOut={signOutToAuth}
            onOpenAuth={() => openAuth('signin')}
          />
        ) : selectedSpecialty ? (
          <TrangDatLichChuyenKhoa
            catalog={catalog}
            initialSpecialty={selectedSpecialty}
            onBookDoctor={showDoctorBooking}

          />
        ) : appRoute.page === 'booking-search' ? (
          <TrangDatLichChuyenKhoa
            catalog={catalog}
            initialPlaceType={appRoute.bookingSearch?.placeType || 'all'}
            onBookDoctor={showDoctorBooking}

          />
        ) : appRoute.page === 'booking-overview' ? (
          <TrangDatKhamTongQuan
            catalog={catalog}
            activeTab={appRoute.bookingOverview?.kind || 'doctor'}
            onBookDoctor={showDoctorBooking}

            onSelectSpecialty={showSpecialtyBooking}
            onChangeTab={showBookingOverview}
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
              onAuthSuccess={(authUser, role) => {
                setUser(authUser);
                if (role === 'admin') { showAdmin(); return; }
                if (role === 'doctor' || role === 'head') { showDoctor(); return; }
                if (role === 'staff') { showStaff(); return; }
                showPatientAccount(appRoute.accountTab || 'lich_kham');
              }}
            />
          )
        ) : appRoute.page === 'admin' ? (
          <AdminDashboard onBackHome={showHome} />
        ) : appRoute.page === 'doctor' ? (
          !isAuthReady ? <PageLoading /> : user ? <DoctorWorkspace user={user} onLogout={signOutToAuth} /> : <DangNhapDangKy initialMode="signin" onBack={showHome} onAuthSuccess={(authUser, role) => { setUser(authUser); if (role === 'doctor' || role === 'head') showDoctor(); else if (role === 'admin') showAdmin(); else if (role === 'staff') showStaff(); else showHome(); }} />
        ) : appRoute.page === 'staff' ? (
          !isAuthReady ? <PageLoading /> : user ? <StaffWorkspace user={user} onLogout={signOutToAuth} /> : <DangNhapDangKy initialMode="signin" onBack={showHome} onAuthSuccess={(authUser, role) => { setUser(authUser); if (role === 'staff') showStaff(); else if (role === 'admin') showAdmin(); else if (role === 'doctor' || role === 'head') showDoctor(); else showHome(); }} />
        ) : appRoute.page === 'public-info' ? (
          <TrangThongTin
            slug={appRoute.infoSlug}
            onNavigate={showPublicInfo}
            onBackHome={showHome}
          />
        ) : appRoute.page === 'not-found' || appRoute.page === 'booking' ? (
          <NotFoundPage onHome={showHome} />
        ) : (
          <TrangChu
            catalog={catalog}
            onBookDoctor={showDoctorBooking}

            onSelectSpecialty={showSpecialtyBooking}
            onOpenBookingOverview={showBookingOverview}
            onOpenPublicInfo={showPublicInfo}
          />
        )}
        </Suspense>
      </main>
      {!isAdminPage ? (
        <MucBaoMatFooter
          onNavigate={showPublicInfo}
          onOpenBookingOverview={showBookingOverview}
        />
      ) : null}
    </div>
    </ReferenceDataProvider>
    </ClinicContext.Provider>
  );
}

export default App;
