import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { useState } from 'react';
import { firebaseAuth } from '../../lib/firebase';
import { apiBaseUrl } from '../../lib/api_base';
import { DashboardPreview, WorkspaceBrand } from './giao_dien_lam_viec';

const PERSONAL_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];

function normalizePhone(value = '') {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function validateEmail(value = '') {
  const email = value.trim();
  if (!email) return 'Vui lòng nhập email.';
  if (!email.includes('@')) return 'Email cần có ký tự @.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email chưa đúng định dạng.';
  return '';
}

function validatePhone(value = '') {
  const phone = normalizePhone(value);
  if (!phone) return 'Vui lòng nhập số điện thoại.';
  if (phone.length !== 10) return 'Xin vui lòng nhập đúng số điện thoại!';
  return '';
}

function validatePassword(value = '') {
  if (!value) return 'Vui lòng nhập mật khẩu.';
  if (value.length < 6) return 'Mật khẩu cần tối thiểu 6 ký tự.';
  return '';
}

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
  const response = await fetch(`${apiBaseUrl}/api/auth/me?portal=provider&optional=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (data.data?.allowed === false) throw new Error('PORTAL_ACCESS_DENIED');
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
            ? 'Đăng nhập để tiếp tục quản lý hồ sơ bác sĩ, lịch khám và workspace của bạn.'
            : 'Xác thực email trước khi tạo tài khoản bác sĩ để bảo vệ thông tin chuyên môn và cơ sở y tế.'}
        </p>
      </section>
    </div>
  );
}

function TrangDangKy({ onOtpSent, onSwitchToLogin, onHome }) {
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const updateField = (field, value) => {
    const nextValue = field === 'phone' ? normalizePhone(value) : value;
    setFormData((current) => ({
      ...current,
      [field]: nextValue,
    }));
    const phoneError = field === 'phone' && value && nextValue !== value
      ? 'Xin vui lòng nhập đúng số điện thoại!'
      : field === 'phone' && nextValue ? validatePhone(nextValue) : '';
    setFieldErrors((current) => ({
      ...current,
      [field]: field === 'phone' ? phoneError
        : field === 'email' && nextValue ? validateEmail(nextValue)
          : '',
    }));
  };
  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Vui lòng nhập họ và tên.';
    const phoneMessage = validatePhone(formData.phone);
    if (phoneMessage) errors.phone = phoneMessage;
    const emailMessage = validateEmail(formData.email);
    if (emailMessage) errors.email = emailMessage;
    return errors;
  };
  const canSubmit = !isLoading && !Object.keys(validateForm()).length;

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');

    const errors = validateForm();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }

    const email = formData.email.trim().toLowerCase();
    if (isPersonalEmail(email)) {
      setMessage('Vui lòng dùng email cơ quan hoặc email chuyên môn. Tài khoản Gmail/Yahoo/Outlook cá nhân chưa được chấp nhận cho đăng ký bác sĩ.');
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
        <form className="dw-auth-form dw-register-form" onSubmit={submit} noValidate>
        <h1>Đăng ký tài khoản bác sĩ</h1>
        <p className="dw-auth-intro">Bước này chỉ tạo tài khoản đăng nhập. Hồ sơ bác sĩ, bệnh viện hoặc phòng khám sẽ là một trang riêng sau khi bạn đăng nhập.</p>
        <div className="dw-register-note">
          <span>01</span>
          <div>
            <strong>Tạo tài khoản</strong>
            <p>Xác thực email và lưu tài khoản bác sĩ vào Supabase.</p>
          </div>
        </div>
        <label>
          Họ và tên
          <input className={fieldErrors.name ? 'has-error' : ''} value={formData.name} onChange={(event) => updateField('name', event.target.value)} placeholder="Họ và tên đầy đủ" />
          {fieldErrors.name && <small className="field-error">{fieldErrors.name}</small>}
        </label>
        <label>
          Số điện thoại
          <input className={fieldErrors.phone ? 'has-error' : ''} value={formData.phone} onChange={(event) => updateField('phone', event.target.value)} placeholder="0901234567" inputMode="tel" />
          {fieldErrors.phone && <small className="field-error">{fieldErrors.phone}</small>}
          <small>MidHealth sẽ dùng số này để liên hệ xác minh hồ sơ bác sĩ/cơ sở khám chữa bệnh.</small>
        </label>
        <label>
          Email cơ quan/chuyên môn
          <input className={fieldErrors.email ? 'has-error' : ''} value={formData.email} onChange={(event) => updateField('email', event.target.value)} placeholder="ten@benhvien.vn" inputMode="email" type="text" />
          {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
        </label>
        {message ? <p className="dw-form-alert">{message}</p> : null}
        <button type="submit" disabled={!canSubmit}>{isLoading ? 'Đang gửi OTP...' : 'Tiếp tục'}</button>
        <div className="dw-register-note muted">
          <span>02</span>
          <div>
            <strong>Thiết lập hồ sơ riêng</strong>
            <p>Sau khi đăng nhập, bạn sẽ vào trang hồ sơ để chọn bác sĩ độc lập, bệnh viện hoặc phòng khám.</p>
          </div>
        </div>
        <p className="dw-auth-switch">Bạn đã có tài khoản? <button type="button" onClick={onSwitchToLogin}>Đăng nhập</button></p>
        </form>
      </section>
      <section className="dw-register-preview">
        <span>Tài khoản trước, hồ sơ sau</span>
        <h2>Đăng ký xong sẽ chuyển về đăng nhập, sau đó mở trang hồ sơ riêng</h2>
        <p>MidHealth tách tài khoản đăng nhập khỏi hồ sơ chuyên môn để hồ sơ bác sĩ, bệnh viện hoặc phòng khám được kiểm duyệt rõ ràng và ghi dữ liệu vận hành đúng vào Supabase.</p>
        <DashboardPreview />
      </section>
    </div>
  );
}

function TrangXacNhanOtp({ pendingAccount, onRegistered, onBack, onHome }) {
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(`Mã OTP đã được gửi đến ${pendingAccount.email}. Vui lòng kiểm tra email để tiếp tục.`);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const canSubmit = !isLoading && otp.length === 6 && !validatePassword(password);

  const submit = async (event) => {
    event.preventDefault();
    const errors = {};
    if (otp.length !== 6) errors.otp = 'Vui lòng nhập đủ 6 số OTP.';
    const passwordMessage = validatePassword(password);
    if (passwordMessage) errors.password = passwordMessage;
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
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
      <form className="dw-auth-form" onSubmit={submit} noValidate>
        <h1>Xác nhận đăng ký</h1>
        <p className="dw-auth-intro">Nhập OTP email và tạo mật khẩu để mở tài khoản bác sĩ.</p>
        <label>
          Mã OTP
          <input className={fieldErrors.otp ? 'has-error' : ''} value={otp} onChange={(event) => { const nextOtp = event.target.value.replace(/\D/g, '').slice(0, 6); setOtp(nextOtp); setFieldErrors((current) => ({ ...current, otp: nextOtp && nextOtp.length < 6 ? 'Vui lòng nhập đủ 6 số OTP.' : '' })); }} placeholder="Nhập mã OTP" inputMode="numeric" maxLength="6" />
          {fieldErrors.otp && <small className="field-error">{fieldErrors.otp}</small>}
        </label>
        <label>
          Mật khẩu
          <input className={fieldErrors.password ? 'has-error' : ''} value={password} onChange={(event) => { const nextPassword = event.target.value; setPassword(nextPassword); setFieldErrors((current) => ({ ...current, password: nextPassword ? validatePassword(nextPassword) : '' })); }} placeholder="Tối thiểu 6 ký tự" minLength={6} type="password" />
          {fieldErrors.password && <small className="field-error">{fieldErrors.password}</small>}
        </label>
        {message ? <p className="dw-form-alert neutral">{message}</p> : null}
        <button type="submit" disabled={!canSubmit}>{isLoading ? 'Đang xác nhận...' : 'Xác nhận đăng ký'}</button>
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
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const updateField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({
      ...current,
      [field]: field === 'email' && value ? validateEmail(value) : '',
    }));
  };
  const validateForm = () => {
    const errors = {};
    const emailMessage = validateEmail(formData.email);
    if (emailMessage) errors.email = emailMessage;
    if (!formData.password) errors.password = 'Vui lòng nhập mật khẩu.';
    return errors;
  };
  const canSubmit = !isLoading && !Object.keys(validateForm()).length;

  const submit = async (event) => {
    event.preventDefault();
    setMessage('');
    const errors = validateForm();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
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
      <form className="dw-auth-form" onSubmit={submit} noValidate>
        <h1>Đăng nhập bác sĩ</h1>
        <p className="dw-auth-intro">Chào mừng quay trở lại.</p>
        <label>
          Email
          <input className={fieldErrors.email ? 'has-error' : ''} value={formData.email} onChange={(event) => updateField('email', event.target.value)} placeholder="Email đã đăng ký" inputMode="email" type="text" />
          {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
        </label>
        <label>
          Mật khẩu
          <input className={fieldErrors.password ? 'has-error' : ''} value={formData.password} onChange={(event) => updateField('password', event.target.value)} placeholder="Mật khẩu" type="password" />
          {fieldErrors.password && <small className="field-error">{fieldErrors.password}</small>}
        </label>
        {message ? <p className={message.includes('Đăng ký') ? 'dw-form-alert neutral' : 'dw-form-alert'}>{message}</p> : null}
        <button type="submit" disabled={!canSubmit}>{isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}</button>
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
