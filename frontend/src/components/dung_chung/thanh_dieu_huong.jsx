import { useEffect, useRef, useState } from 'react';
import BieuTuongLogo from './bieu_tuong_logo';

const ACCOUNT_ITEMS = [
  { id: 'lich_kham', label: 'Lịch khám' },
  { id: 'lich_su_thanh_toan', label: 'Lịch sử thanh toán' },
  { id: 'ho_so', label: 'Hồ sơ khám điện tử' },
  { id: 'thong_bao', label: 'Thông báo' },
];

const BOOKING_ITEMS = [
  { id: 'specialty', label: 'Chuyên khoa / Dịch vụ', description: 'Chọn chuyên khoa và xem chi phí khám' },
  { id: 'doctor', label: 'Đội ngũ bác sĩ', description: 'Xem bác sĩ và khung giờ khám' },
];

function lay_ten_hien_thi(user) {
  return user?.displayName || user?.email?.split('@')[0] || 'Tài khoản';
}

function lay_ten_tat(user) {
  const parts = lay_ten_hien_thi(user).trim().split(/\s+/).filter(Boolean);
  return parts.slice(-2).map((part) => part[0]).join('').toUpperCase() || 'BN';
}

function ThanhDieuHuong({
  user,
  onHome,
  onPublicInfo,
  onBook,
  onOpenAuth,
  onOpenAccount,
  onLogout,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const accountRef = useRef(null);
  const bookingRef = useRef(null);

  useEffect(() => {
    if (!isAccountOpen && !isBookingOpen) return undefined;

    const closeMenu = (event) => {
      const isInsideAccount = accountRef.current?.contains(event.target);
      const isInsideBooking = bookingRef.current?.contains(event.target);
      if (!isInsideAccount && !isInsideBooking) {
        setIsAccountOpen(false);
        setIsBookingOpen(false);
      }
    };
    const closeWithEscape = (event) => {
      if (event.key === 'Escape') {
        setIsAccountOpen(false);
        setIsBookingOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeWithEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeWithEscape);
    };
  }, [isAccountOpen, isBookingOpen]);



  return (
    <header className="site-header">
      <button className="logo-button" type="button" onClick={onHome} aria-label="Về trang chủ MidHealth">
        <BieuTuongLogo />
      </button>

      <button type="button" className="clinic-mobile-toggle" aria-controls="clinic-main-nav" aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? 'Đóng ✕' : 'Menu ☰'}</button>
      <nav id="clinic-main-nav" className={'main-nav' + (mobileOpen ? ' mobile-open' : '')} aria-label="Điều hướng chính" onClick={event => { if (event.target.closest('a, button') && !event.target.closest('.main-nav-booking')) setMobileOpen(false); }}>
        <button type="button" onClick={onHome}>Trang chủ</button>
        <button type="button" onClick={() => onPublicInfo('gioi-thieu')}>Giới thiệu</button>
        <div className="booking-menu" ref={bookingRef}>
          <button
            className={isBookingOpen ? 'main-nav-booking active' : 'main-nav-booking'}
            type="button"
            aria-haspopup="menu"
            aria-expanded={isBookingOpen}
            onClick={() => {
              setIsBookingOpen((current) => !current);
              setIsAccountOpen(false);
            }}
          >
            Đặt khám <span aria-hidden="true">▾</span>
          </button>

          {isBookingOpen ? (
            <div className="booking-dropdown" role="menu">
              {BOOKING_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsBookingOpen(false);
                    onBook(item.id);
                  }}
                >
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </button>
              ))}
              <a className="booking-dropdown-support" href="mailto:cskh@midhealth.vn">
                Cần hỗ trợ? Liên hệ cskh@midhealth.vn
              </a>
            </div>
          ) : null}
        </div>
        <button type="button" onClick={() => onPublicInfo('lien-he')}>Liên hệ</button>
      </nav>

      {user ? (
        <div className="account-menu" ref={accountRef}>
          <button
            className="account-avatar-button"
            type="button"
            aria-haspopup="menu"
            aria-expanded={isAccountOpen}
            aria-label={`Mở menu tài khoản ${lay_ten_hien_thi(user)}`}
            onClick={() => {
              setIsAccountOpen((current) => !current);
              setIsBookingOpen(false);
            }}
          >
            {user.photoURL ? <img src={user.photoURL} alt="" /> : <span>{lay_ten_tat(user)}</span>}
            <i aria-hidden="true">▾</i>
          </button>

          {isAccountOpen ? (
            <div className="account-dropdown" role="menu">
              <div className="account-dropdown-user">
                <strong>{lay_ten_hien_thi(user)}</strong>
                <small>{user.email || user.phoneNumber}</small>
              </div>
              {ACCOUNT_ITEMS.map((item) => (
                <button
                  key={item.id}
                  className={item.id === 'thong_bao' ? 'account-dropdown-notification-link' : ''}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsAccountOpen(false);
                    onOpenAccount(item.id);
                  }}
                >
                  <span>{item.label}</span>
                </button>
              ))}
              <button
                className="account-dropdown-logout"
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsAccountOpen(false);
                  onLogout();
                }}
              >
                Thoát
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="user-menu">
          <button className="login-button" type="button" onClick={() => onOpenAuth('signin')}>Đăng nhập</button>
        </div>
      )}
    </header>
  );
}

export default ThanhDieuHuong;
