import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import BieuTuongLogo from './components/bieu_tuong_logo';
import DangNhapDangKy from './components/dang_nhap_dang_ky';
import TrangDatLichBacSi from './components/trang_dat_lich_bac_si';
import TrangDatLichBenhVien from './components/trang_dat_lich_benh_vien';
import TrangDatLichChuyenKhoa from './components/trang_dat_lich_chuyen_khoa';
import TrangDatLichPhongKham from './components/trang_dat_lich_phong_kham';
import TrangChu from './components/trang_chu';
import { firebaseAuth } from './lib/firebase';
import { fallbackCatalog, fetchCatalog } from './lib/catalog';

function App() {
  const [isAuthPage, setIsAuthPage] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [user, setUser] = useState(null);
  const [catalog, setCatalog] = useState(fallbackCatalog);

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

  const handleSignOut = async () => {
    await signOut(firebaseAuth);
    setUser(null);
  };

  const showHome = () => {
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
    <div className="site-shell" id="home">
      <header className="site-header">
        <button className="logo-button" type="button" onClick={showHome} aria-label="Về trang chủ MidHealth">
          <BieuTuongLogo />
        </button>
        <nav className="main-nav" aria-label="Điều hướng chính">
          <a href="#booking" onClick={showHome}>Đặt khám <span aria-hidden="true">▾</span></a>
          <a href="#consult" onClick={showHome}>Tư vấn trực tuyến</a>
          <a href="#news" onClick={showHome}>Tin Y tế</a>
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
        ) : (
          <TrangChu
            catalog={catalog}
            onBookDoctor={showDoctorBooking}
            onBookHospital={showHospitalBooking}
            onBookClinic={showClinicBooking}
            onSelectSpecialty={showSpecialtyBooking}
          />
        )}
      </main>
    </div>
  );
}

export default App;
