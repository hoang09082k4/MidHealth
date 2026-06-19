import { useEffect, useRef, useState } from 'react';
import { loadNotifications } from '../../lib/notifications';
import BieuTuongLogo from './bieu_tuong_logo';

const ACCOUNT_ITEMS = [
  { id: 'lich_kham', label: 'Lịch khám' },
  { id: 'lich_su_thanh_toan', label: 'Lịch sử thanh toán' },
  { id: 'ho_so', label: 'Hồ sơ khám điện tử' },
  { id: 'thong_bao', label: 'Thông báo' },
];

const BOOKING_ITEMS = [
  {
    id: 'doctor',
    label: 'Đặt khám bác sĩ',
    description: 'Chọn bác sĩ và khung giờ khám phù hợp',
  },
  {
    id: 'hospital',
    label: 'Đặt khám bệnh viện',
    description: 'Đặt lịch tại bệnh viện đã kết nối',
  },
  {
    id: 'clinic',
    label: 'Đặt khám phòng khám',
    description: 'Tìm phòng khám theo chuyên khoa và dịch vụ',
  },
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
  onBook,
  onHealthNews,
  onDoctorWorkspace,
  onOpenAuth,
  onOpenAccount,
  onLogout,
}) {
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
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

  useEffect(() => {
    let active = true;
    if (!user || !isAccountOpen) {
      setNotifications([]);
      return () => {
        active = false;
      };
    }

    loadNotifications(user).then((items) => {
      if (active) setNotifications(items);
    });

    return () => {
      active = false;
    };
  }, [isAccountOpen, user]);

  const openMedicalAssistant = () => {
    window.dispatchEvent(new CustomEvent('midhealth:open-chatbot'));
  };

  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <header className="site-header">
      <button className="logo-button" type="button" onClick={onHome} aria-label="Về trang chủ MidHealth">
        <BieuTuongLogo />
      </button>

      <nav className="main-nav" aria-label="Điều hướng chính">
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
        <a href="/tin-tuc" onClick={(event) => { event.preventDefault(); onHealthNews(); }}>Tin Y tế</a>
        <button type="button" onClick={openMedicalAssistant}>Trợ lý y khoa</button>
        <a href="/danh-cho-bac-si" onClick={(event) => { event.preventDefault(); onDoctorWorkspace(); }}>Dành cho bác sĩ</a>
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
                  {item.id === 'thong_bao' && unreadCount > 0 ? <b className="account-notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</b> : null}
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
