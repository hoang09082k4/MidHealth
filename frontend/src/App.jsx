import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import BieuTuongLogo from './components/dung_chung/bieu_tuong_logo';
import DangNhapDangKy from './components/xac_thuc/dang_nhap_dang_ky';
import TrangDatLichBacSi from './components/dat_lich_kham/dat_lich_bac_si';
import TrangDatLichBenhVien from './components/dat_lich_kham/dat_lich_benh_vien';
import TrangDatLichChuyenKhoa from './components/dat_lich_kham/dat_lich_chuyen_khoa';
import TrangDatLichPhongKham from './components/dat_lich_kham/dat_lich_phong_kham';
import TrangChu from './components/trang_chu/chu';
import MucTinYTe from './components/tin_y_te/tin_y_te';
import { firebaseAuth } from './lib/firebase';
import { fallbackCatalog, fetchCatalog } from './lib/catalog';
import { ReferenceDataProvider } from './lib/reference_data';

function routeFromLocation() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(window.location.search);

  if (path === '/tin-y-te/tim-kiem') {
    return {
      page: 'health',
      health: {
        name: 'search',
        keyword: params.get('q') || '',
        category: params.get('category') || 'thuoc',
      },
    };
  }

  if (path.startsWith('/tin-y-te/') && path !== '/tin-y-te') {
    return {
      page: 'health',
      health: {
        name: 'detail',
        slug: decodeURIComponent(path.replace('/tin-y-te/', '')),
      },
    };
  }

  if (path === '/tin-y-te') {
    return {
      page: 'health',
      health: {
        name: 'list',
        category: params.get('category') || 'thuoc',
      },
    };
  }

  return { page: 'home', health: { name: 'list', category: 'thuoc' } };
}

function healthRouteToUrl(route) {
  if (route.name === 'detail') return `/tin-y-te/${encodeURIComponent(route.slug)}`;

  if (route.name === 'search') {
    const params = new URLSearchParams();
    params.set('q', route.keyword || '');
    params.set('category', route.category || 'thuoc');
    return `/tin-y-te/tim-kiem?${params.toString()}`;
  }

  const params = new URLSearchParams();
  params.set('category', route.category || 'thuoc');
  return `/tin-y-te?${params.toString()}`;
}

function App() {
  const [isAuthPage, setIsAuthPage] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [user, setUser] = useState(null);
  const [catalog, setCatalog] = useState(fallbackCatalog);
  const [appRoute, setAppRoute] = useState(routeFromLocation);

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

  const handleSignOut = async () => {
    await signOut(firebaseAuth);
    setUser(null);
  };

  const showHome = () => {
    if (window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    setAppRoute({ page: 'home', health: { name: 'list', category: 'thuoc' } });
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(null);
    setSelectedClinic(null);
    setSelectedSpecialty(null);
  };

  const showHealthNews = (route = { name: 'list', category: 'thuoc' }) => {
    window.history.pushState({}, '', healthRouteToUrl(route));
    setAppRoute({ page: 'health', health: route });
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(null);
    setSelectedClinic(null);
    setSelectedSpecialty(null);
  };

  const showDoctorBooking = (doctor) => {
    setIsAuthPage(false);
    setSelectedDoctor(doctor);
    setSelectedHospital(null);
    setSelectedClinic(null);
    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showHospitalBooking = (hospital) => {
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(hospital);
    setSelectedClinic(null);
    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showClinicBooking = (clinic) => {
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(null);
    setSelectedClinic(clinic);
    setSelectedSpecialty(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showSpecialtyBooking = (specialty) => {
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(null);
    setSelectedClinic(null);
    setSelectedSpecialty(specialty);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <ReferenceDataProvider>
    <div className="site-shell" id="home">
      <header className="site-header">
        <button className="logo-button" type="button" onClick={showHome} aria-label="Về trang chủ MidHealth">
          <BieuTuongLogo />
        </button>
        <nav className="main-nav" aria-label="Điều hướng chính">
          <a href="#booking" onClick={showHome}>Đặt khám <span aria-hidden="true">▾</span></a>
          <a href="#consult" onClick={showHome}>Tư vấn trực tuyến</a>
          <a href="/tin-y-te" onClick={(event) => { event.preventDefault(); showHealthNews(); }}>Tin Y tế</a>
        </nav>
        {user ? (
          <div className="user-menu">
            <span>{user.displayName || user.email}</span>
            <button className="login-button" type="button" onClick={handleSignOut}>Đăng xuất</button>
          </div>
        ) : (
          <button className="login-button" type="button" onClick={() => setIsAuthPage(true)}>Đăng nhập</button>
        )}
      </header>

      <main>
        {isAuthPage ? (
          <DangNhapDangKy onBack={showHome} onAuthSuccess={setUser} />
        ) : selectedDoctor ? (
          <TrangDatLichBacSi doctor={selectedDoctor} user={user} onBackHome={showHome} onSignOut={handleSignOut} />
        ) : selectedHospital ? (
          <TrangDatLichBenhVien hospital={selectedHospital} user={user} onBackHome={showHome} />
        ) : selectedClinic ? (
          <TrangDatLichPhongKham clinic={selectedClinic} user={user} onBackHome={showHome} />
        ) : selectedSpecialty ? (
          <TrangDatLichChuyenKhoa
            catalog={catalog}
            initialSpecialty={selectedSpecialty}
            onBookDoctor={showDoctorBooking}
            onBookHospital={showHospitalBooking}
            onBookClinic={showClinicBooking}
          />
        ) : appRoute.page === 'health' ? (
          <MucTinYTe route={appRoute.health} onNavigate={showHealthNews} />
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
