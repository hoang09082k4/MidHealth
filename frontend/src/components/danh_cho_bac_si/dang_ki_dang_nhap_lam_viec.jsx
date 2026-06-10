import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { useState } from 'react';
import { firebaseAuth } from '../../lib/firebase';
import { DashboardPreview, WorkspaceBrand } from './giao_dien_lam_viec';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const PERSONAL_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];

function isPersonalEmail(email = '') {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === 'test@gmail.com') return false;
  const domain = normalizedEmail.split('@')[1] || '';
  return PERSONAL_EMAIL_DOMAINS.includes(domain);
}

function mapAuthError(error) {
  const code = error?.code || error?.codeName || '';
  if (code.includes('auth/email-already-in-use') || code.includes('EMAIL_EXISTS')) return 'Email này đã có tài khoản. Vui lòng đăng nhập để tiếp tục đăng ký workspace.';
  if (code.includes('auth/invalid-credential') || code.includes('INVALID_LOGIN_CREDENTIALS')) return 'Email hoặc mật khẩu không đúng.';
  if (code.includes('auth/weak-password') || code.includes('WEAK_PASSWORD')) return 'Mật khẩu cần tối thiểu 6 ký tự.';
  if (code.includes('auth/invalid-email') || code.includes('INVALID_EMAIL')) return 'Email không hợp lệ.';
  if (code.includes('auth/network-request-failed')) return 'Không kết nối được Firebase. Vui lòng kiểm tra mạng hoặc cấu hình.';
  return error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
}

async function postApi(path, payload) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.message || 'Không thể xử lý yêu cầu. Vui lòng thử lại.');
    error.codeName = data.code || '';
    throw error;
  }

  return data.data;
}

async function verifyProviderPortal(user) {
  const token = await user.getIdToken(true);
  const response = await fetch(`${apiBaseUrl}/api/auth/me?portal=provider`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Tài khoản không có quyền truy cập workspace bác sĩ.');
  return data.data;
}

function AuthLayout({ children, mode = 'register', onHome }) {
  return (
    <div className="dw-auth-page">
      <section className="dw-auth-form-panel">
        <WorkspaceBrand onHome={onHome} />
        {children}
      </section>
      <section className="dw-auth-visual">
        <DashboardPreview />
        <h2>Chào mừng đến với<br /><span>MidHealth Workspace</span></h2>
        <p>
          {mode === 'login'
            ? 'Đăng nhập để tiếp tục quản lý hồ sơ đối tác, lịch khám và workspace của bạn.'
            : 'Xác thực email trước khi tạo tài khoản đối tác để bảo vệ thông tin chuyên môn và cơ sở y tế.'}
        </p>
      </section>
    </div>
  );
}

function TrangDangKy({ onOtpSent, onSwitchToLogin, onHome }) {
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');

    const email = formData.email.trim().toLowerCase();
    if (isPersonalEmail(email)) {
      setMessage('Vui lòng dùng email cơ quan hoặc email chuyên môn. Tài khoản Gmail/Yahoo/Outlook cá nhân chưa được chấp nhận cho đăng ký đối tác.');
      return;
    }

    setIsLoading(true);
    try {
      await postApi('/api/auth/otp/send', { email });
      onOtpSent({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        email,
      });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dw-register-page refined">
      <section className="dw-register-main">
        <WorkspaceBrand onHome={onHome} />
        <form className="dw-auth-form dw-register-form" onSubmit={submit}>
        <h1>Đăng ký tài khoản đối tác</h1>
        <p className="dw-auth-intro">Bước này chỉ tạo tài khoản đăng nhập. Hồ sơ bác sĩ/phòng khám sẽ là một trang riêng sau khi bạn đăng nhập.</p>
        <div className="dw-register-note">
          <span>01</span>
          <div>
            <strong>Tạo tài khoản</strong>
            <p>Xác thực email và lưu tài khoản đối tác vào Supabase.</p>
          </div>
        </div>
        <label>
          Họ và tên <span>*</span>
          <input value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} placeholder="Họ và tên đầy đủ" required />
        </label>
        <label>
          Số điện thoại <span>*</span>
          <input value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} placeholder="0901234567" required inputMode="tel" />
          <small>MidHealth sẽ dùng số này để liên hệ xác minh hồ sơ đối tác.</small>
        </label>
        <label>
          Email cơ quan/chuyên môn <span>*</span>
          <input value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} placeholder="ten@benhvien.vn" required type="email" />
        </label>
        {message ? <p className="dw-form-alert">{message}</p> : null}
        <button type="submit" disabled={isLoading}>{isLoading ? 'Đang gửi OTP...' : 'Tiếp tục'}</button>
        <div className="dw-register-note muted">
          <span>02</span>
          <div>
            <strong>Thiết lập hồ sơ riêng</strong>
            <p>Sau khi đăng nhập, bạn sẽ vào trang hồ sơ để chọn bác sĩ độc lập hoặc phòng khám.</p>
          </div>
        </div>
        <p className="dw-auth-switch">Bạn đã có tài khoản? <button type="button" onClick={onSwitchToLogin}>Đăng nhập</button></p>
        </form>
      </section>
      <section className="dw-register-preview">
        <span>Tài khoản trước, hồ sơ sau</span>
        <h2>Đăng ký xong sẽ chuyển về đăng nhập, sau đó mở trang hồ sơ riêng</h2>
        <p>MidHealth tách tài khoản đăng nhập khỏi hồ sơ chuyên môn để hồ sơ bác sĩ/phòng khám được kiểm duyệt rõ ràng và ghi dữ liệu vận hành đúng vào Supabase.</p>
        <DashboardPreview />
      </section>
    </div>
  );
}

function TrangXacNhanOtp({ pendingAccount, onRegistered, onBack, onHome }) {
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(`Mã OTP đã được gửi đến ${pendingAccount.email}. Vui lòng kiểm tra email để tiếp tục.`);
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const otpResult = await postApi('/api/auth/otp/verify', { email: pendingAccount.email, otp: otp.trim() });
      await postApi('/api/auth/register', {
        email: pendingAccount.email,
        password,
        fullName: pendingAccount.name,
        otpToken: otpResult.token,
        skipProfile: true,
        providerRegistration: true,
        accountRole: 'doctor',
      });
      onRegistered?.({
        email: pendingAccount.email,
        name: pendingAccount.name,
        phone: pendingAccount.phone,
      });
    } catch (error) {
      setMessage(mapAuthError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      await postApi('/api/auth/otp/send', { email: pendingAccount.email });
      setMessage(`Đã gửi lại OTP đến ${pendingAccount.email}. Vui lòng kiểm tra email.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout onHome={onHome}>
      <form className="dw-auth-form" onSubmit={submit}>
        <h1>Xác nhận đăng ký</h1>
        <p className="dw-auth-intro">Nhập OTP email và tạo mật khẩu để mở tài khoản đối tác.</p>
        <label>
          Mã OTP <span>*</span>
          <input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Nhập mã OTP" required inputMode="numeric" maxLength="6" />
        </label>
        <label>
          Mật khẩu <span>*</span>
          <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tối thiểu 6 ký tự" required minLength={6} type="password" />
        </label>
        {message ? <p className="dw-form-alert neutral">{message}</p> : null}
        <button type="submit" disabled={isLoading || otp.length < 6 || password.length < 6}>{isLoading ? 'Đang xác nhận...' : 'Xác nhận đăng ký'}</button>
        <p className="dw-auth-switch">
          <button type="button" onClick={resendOtp} disabled={isLoading}>Gửi lại OTP</button>
          <span> · </span>
          <button type="button" onClick={onBack}>Quay lại nhập thông tin</button>
        </p>
      </form>
    </AuthLayout>
  );
}

function TrangDangNhap({ onLogin, onRegister, onHome, initialMessage = '' }) {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [message, setMessage] = useState(initialMessage);
  const [isLoading, setIsLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    setIsLoading(true);

    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, formData.email.trim(), formData.password);
      const user = credential.user;
      await verifyProviderPortal(user);
      onLogin({
        uid: user.uid,
        email: user.email,
        name: user.displayName || user.email,
        phone: '',
      });
    } catch (error) {
      if (firebaseAuth.currentUser) await signOut(firebaseAuth);
      setMessage(mapAuthError(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout mode="login" onHome={onHome}>
      <form className="dw-auth-form" onSubmit={submit}>
        <h1>Đăng nhập đối tác</h1>
        <p className="dw-auth-intro">Chào mừng quay trở lại.</p>
        <label>
          Email
          <input value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} placeholder="Email đã đăng ký" required type="email" />
        </label>
        <label>
          Mật khẩu
          <input value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} placeholder="Mật khẩu" required type="password" />
        </label>
        {message ? <p className={message.includes('Đăng ký') ? 'dw-form-alert neutral' : 'dw-form-alert'}>{message}</p> : null}
        <button type="submit" disabled={isLoading}>{isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
        <p className="dw-auth-switch">Chưa có tài khoản? <button type="button" onClick={onRegister}>Đăng ký</button></p>
      </form>
    </AuthLayout>
  );
}

function DangKiDangNhapLamViec({ screen, pendingAccount, loginMessage, onOtpSent, onVerified, onRegistered, onBack, onLogin, onRegister, onSwitchToLogin, onHome }) {
  if (screen === 'register') {
    return <TrangDangKy onHome={onHome} onOtpSent={onOtpSent} onSwitchToLogin={onSwitchToLogin} />;
  }

  if (screen === 'otp' && pendingAccount) {
    return <TrangXacNhanOtp onHome={onHome} pendingAccount={pendingAccount} onRegistered={onRegistered} onBack={onBack} />;
  }

  return <TrangDangNhap onHome={onHome} initialMessage={loginMessage} onLogin={onLogin} onRegister={onRegister} />;
}

export default DangKiDangNhapLamViec;
