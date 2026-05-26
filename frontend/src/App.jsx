import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import BieuTuongLogo from './components/bieu_tuong_logo';
import DangNhapDangKy from './components/dang_nhap_dang_ky';
import TrangDatLichBenhVien from './components/trang_dat_lich_benh_vien';
import TrangDatLichBacSi from './components/trang_dat_lich_bac_si';
import TrangChu from './components/trang_chu';
import { firebaseAuth } from './lib/firebase';

function App() {
  const [isAuthPage, setIsAuthPage] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
      setUser(currentUser);
    });

    return unsubscribe;
  }, []);

  const handleSignOut = async () => {
    await signOut(firebaseAuth);
    setUser(null);
  };

  const showHome = () => {
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(null);
  };

  const showDoctorBooking = (doctor) => {
    setIsAuthPage(false);
    setSelectedDoctor(doctor);
    setSelectedHospital(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const showHospitalBooking = (hospital) => {
    setIsAuthPage(false);
    setSelectedDoctor(null);
    setSelectedHospital(hospital);
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
        ) : (
          <TrangChu onBookDoctor={showDoctorBooking} onBookHospital={showHospitalBooking} />
        )}
      </main>
    </div>
  );
}

export default App;
