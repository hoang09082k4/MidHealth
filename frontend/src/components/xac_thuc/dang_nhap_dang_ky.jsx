import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { useEffect, useRef, useState } from 'react';
import { savePatientProfile } from '../../lib/appointments';
import { firebaseAuth, signInWithGoogle } from '../../lib/firebase';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const initialProfile = {
  fullName: '',
  phone: '',
  dateOfBirth: '',
  citizenId: '',
  gender: 'male',
  email: '',
  ethnicity: 'Kinh',
  healthInsuranceNumber: '',
  province: '',
  district: '',
  ward: '',
  address: '',
  referralCode: '',
  occupation: '',
};

async function goi_api(path, payload) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || 'Không thể xử lý yêu cầu.');
  }

  return data.data;
}

function lay_thong_bao_loi(error) {
  const code = error?.code || '';
  if (code.includes('auth/operation-not-allowed')) return 'Firebase chua bat phuong thuc dang nhap Email/Password.';
  if (code.includes('auth/network-request-failed')) return 'Khong ket noi duoc Firebase. Vui long kiem tra mang hoac cau hinh Firebase.';

  if (code.includes('auth/invalid-credential')) return 'Email hoặc mật khẩu không đúng.';
  if (code.includes('auth/email-already-in-use')) return 'Email này đã được đăng ký.';
  if (code.includes('auth/weak-password')) return 'Mật khẩu cần tối thiểu 6 ký tự.';
  if (code.includes('auth/invalid-email')) return 'Email không hợp lệ.';
  if (code.includes('auth/missing-password')) return 'Vui lòng nhập mật khẩu.';
  if (code.includes('auth/popup-closed-by-user')) return 'Bạn đã đóng cửa sổ đăng nhập Google.';
  if (code.includes('auth/unauthorized-domain')) {
    return 'Tên miền hiện tại chưa được thêm vào Firebase Authentication. Hãy thêm localhost hoặc domain đang chạy web trong Authorized domains.';
  }
  if (code.includes('auth/account-exists-with-different-credential')) {
    return 'Email này đã tồn tại với phương thức đăng nhập khác.';
  }
  if (code.includes('auth/too-many-requests')) {
    return 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.';
  }

  return error?.message || 'Có lỗi xảy ra. Vui lòng thử lại.';
}

function CacBuocDangKy({ step }) {
  const steps = ['1. Xác thực', '2. Mật khẩu', '3. Hồ sơ khám điện tử'];

  return (
    <div className="signup-steps">
      {steps.map((label, index) => (
        <div className={step === index + 1 ? 'active' : ''} key={label}>
          {label}
        </div>
      ))}
      <div>...</div>
    </div>
  );
}

function DangNhapDangKy({ initialMode = 'signin', onBack, onAuthSuccess }) {
  const otpInputRefs = useRef([]);
  const [mode, setMode] = useState('signin');
  const [signupStep, setSignupStep] = useState(1);
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [googleSignupUser, setGoogleSignupUser] = useState(null);
  const [signupAuthUser, setSignupAuthUser] = useState(null);
  const [form, setForm] = useState({
    email: '',
    password: '',
    remember: false,
    otp: '',
    profile: initialProfile,
  });
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setForm({
      email: '',
      password: '',
      remember: false,
      otp: '',
      profile: initialProfile,
    });
  }, []);

  useEffect(() => {
    if (initialMode === 'signup-entry') {
      mo_form_dang_ky();
      return;
    }

    setMode('signin');
    setSignupStep(1);
    setOtpSent(false);
    setOtpToken('');
    setGoogleSignupUser(null);
    setSignupAuthUser(null);
    setMessage('');
  }, [initialMode]);

  const cap_nhat_form = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
      profile: field === 'email' ? { ...current.profile, email: value } : current.profile,
    }));

    if (field === 'email') {
      setOtpSent(false);
      setOtpToken('');
      setGoogleSignupUser(null);
      setSignupAuthUser(null);
      setSignupStep(1);
    }
  };

  const cap_nhat_ho_so = (field, value) => {
    setForm((current) => ({
      ...current,
      profile: { ...current.profile, [field]: value },
    }));
  };

  const mo_form_dang_ky = () => {
    setMode('signup-entry');
    setSignupStep(1);
    setOtpSent(false);
    setOtpToken('');
    setGoogleSignupUser(null);
    setSignupAuthUser(null);
    setMessage('');
    setForm((current) => ({ ...current, otp: '' }));
  };

  const gui_otp_dang_ky = async () => {
    if (!form.email.trim()) {
      throw new Error('Vui lòng nhập email trước khi đăng ký.');
    }

    await goi_api('/api/auth/otp/send', { email: form.email.trim() });
    setMode('signup');
    setSignupStep(1);
    setOtpSent(true);
    setOtpToken('');
    setForm((current) => ({ ...current, otp: '' }));
    setMessage('Đã gửi mã OTP đến Gmail. Vui lòng nhập mã để tiếp tục.');
  };

  const bat_dau_dang_ky = async () => {
    setMessage('');
    setIsLoading(true);

    try {
      await gui_otp_dang_ky();
    } catch (error) {
      setMessage(lay_thong_bao_loi(error));
      if (!form.email.trim()) {
        mo_form_dang_ky();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const xac_thuc_otp = async () => {
    const verifiedOtp = await goi_api('/api/auth/otp/verify', {
      email: form.email.trim(),
      otp: form.otp.trim(),
    });
    setOtpToken(verifiedOtp.token);
    setSignupStep(2);
    setMessage('');
  };

  const hoan_tat_ho_so_google = async () => {
    const profile = {
      ...form.profile,
      email: googleSignupUser.email || form.email.trim(),
      fullName: form.profile.fullName || googleSignupUser.displayName || '',
    };

    await savePatientProfile(googleSignupUser, profile);
    return googleSignupUser;
  };

  const tao_mat_khau_google = async () => {
    await updatePassword(googleSignupUser, form.password);
    setSignupAuthUser(googleSignupUser);
    setSignupStep(3);
    setMessage('');
  };

  const tao_tai_khoan_email = async () => {
    if (!otpToken) {
      throw new Error('Vui long xac minh OTP email truoc khi dang ky.');
    }

    let credential;
    try {
      credential = await createUserWithEmailAndPassword(
        firebaseAuth,
        form.email.trim(),
        form.password,
      );
    } catch (error) {
      if (!error?.code?.includes('auth/email-already-in-use')) {
        throw error;
      }

      credential = await signInWithEmailAndPassword(
        firebaseAuth,
        form.email.trim(),
        form.password,
      );
    }
    setSignupAuthUser(credential.user);
    setSignupStep(3);
    setMessage('');
  };

  const hoan_tat_ho_so_email = async () => {
    const authUser = signupAuthUser || firebaseAuth.currentUser || await dang_nhap_email();
    await savePatientProfile(authUser, {
      ...form.profile,
      email: form.email.trim(),
      fullName: form.profile.fullName,
    });
    if (form.profile.fullName && authUser.displayName !== form.profile.fullName) {
      await updateProfile(authUser, { displayName: form.profile.fullName });
    }
    return authUser;
  };

  const dang_nhap_google = async () => {
    setMessage('');
    setIsLoading(true);

    try {
      const credential = await signInWithGoogle();
      const idToken = await credential.user.getIdToken();
      await goi_api('/api/auth/google', { idToken });

      if (mode === 'signup-entry') {
        const googleUser = credential.user;
        setGoogleSignupUser(googleUser);
        setSignupAuthUser(null);
        setMode('signup');
        setSignupStep(1);
        setOtpSent(false);
        setOtpToken('');
        setForm((current) => ({
          ...current,
          email: googleUser.email || '',
          otp: '',
          password: '',
          profile: {
            ...current.profile,
            email: googleUser.email || '',
            fullName: current.profile.fullName || googleUser.displayName || '',
          },
        }));
        setMessage('Google đã xác thực email. Bấm tiếp tục để tạo mật khẩu.');
        return;
      }

      onAuthSuccess(credential.user);
      onBack();
    } catch (error) {
      setMessage(lay_thong_bao_loi(error));
    } finally {
      setIsLoading(false);
    }
  };

  const dang_nhap_email = async () => {
    const credential = await signInWithEmailAndPassword(
      firebaseAuth,
      form.email.trim(),
      form.password,
    );
    return credential.user;
  };

  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const digits = form.otp.padEnd(6, ' ').split('');
    digits[index] = digit || ' ';
    const nextOtp = digits.join('').replace(/\s/g, '');
    setForm((current) => ({ ...current, otp: nextOtp }));

    if (digit && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');
    setIsLoading(true);

    try {
      if (mode === 'signin') {
        const authUser = await dang_nhap_email();
        onAuthSuccess(authUser);
        onBack();
        return;
      }

      if (googleSignupUser && signupStep === 1) {
        setSignupStep(2);
        setMessage('');
        return;
      }

      if (signupStep === 1 && !otpSent) {
        await gui_otp_dang_ky();
        return;
      }

      if (signupStep === 1) {
        await xac_thuc_otp();
        return;
      }

      if (signupStep === 2) {
        if (googleSignupUser) {
          await tao_mat_khau_google();
          return;
        }

        await tao_tai_khoan_email();
        return;
      }

      const authUser = googleSignupUser
        ? await hoan_tat_ho_so_google()
        : await hoan_tat_ho_so_email();
      onAuthSuccess(authUser);
      onBack();
    } catch (error) {
      setMessage(lay_thong_bao_loi(error));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setMessage('');

    if (!form.email.trim()) {
      setMessage('Nhập email của bạn để đặt lại mật khẩu.');
      return;
    }

    try {
      await sendPasswordResetEmail(firebaseAuth, form.email.trim());
      setMessage('Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra hộp thư.');
    } catch (error) {
      setMessage(lay_thong_bao_loi(error));
    }
  };

  const renderSignupStep = () => (
    <section className="signup-wizard-page">
      <form className="signup-wizard-card" onSubmit={handleSubmit}>
        <CacBuocDangKy step={signupStep} />

        {signupStep === 1 && (
          <div className="signup-step-content signup-otp-step">
            {googleSignupUser ? (
              <>
                <p>Google đã xác thực email {form.email}. Bấm tiếp tục để tạo mật khẩu cho tài khoản MidHealth.</p>
              </>
            ) : !otpSent ? (
              <>
                <p>Nhập Gmail để MidHealth gửi mã OTP xác thực tài khoản.</p>
                <input
                  className="signup-single-input"
                  type="email"
                  value={form.email}
                  onChange={(event) => cap_nhat_form('email', event.target.value)}
                  placeholder="Địa chỉ Gmail của bạn"
                  required
                />
              </>
            ) : (
              <>
                <p>Nhập mã OTP vừa được gửi đến Gmail {form.email}</p>
                <div className="otp-boxes">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <input
                      key={index}
                      ref={(element) => { otpInputRefs.current[index] = element; }}
                      value={form.otp[index] || ''}
                      onChange={(event) => handleOtpChange(index, event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Backspace' && !form.otp[index] && index > 0) {
                          otpInputRefs.current[index - 1]?.focus();
                        }
                      }}
                      inputMode="numeric"
                      maxLength={1}
                    />
                  ))}
                </div>
              </>
            )}
            {message && <div className="auth-message">{message}</div>}
            <button type="submit" disabled={isLoading || (!googleSignupUser && otpSent && form.otp.length < 6)}>
              {isLoading ? 'Đang xử lý...' : googleSignupUser || otpSent ? 'Tiếp tục' : 'Gửi OTP'}
            </button>
            {!googleSignupUser && otpSent && (
              <div className="resend-otp">
                Không nhận được mã OTP?
                <button type="button" onClick={bat_dau_dang_ky} disabled={isLoading}>Thử lại</button>
              </div>
            )}
          </div>
        )}

        {signupStep === 2 && (
          <div className="signup-step-content signup-password-step">
            <p>Nhập mật khẩu gồm tối thiểu 6 ký tự để bảo vệ hồ sơ khám điện tử của bạn và đăng nhập những lần sau.</p>
            <label>
              Mật khẩu
              <input
                type="password"
                value={form.password}
                onChange={(event) => cap_nhat_form('password', event.target.value)}
                placeholder="Tạo mật khẩu cho tài khoản"
                required
                minLength={6}
              />
            </label>
            {message && <div className="auth-message">{message}</div>}
            <button type="submit" disabled={isLoading || form.password.length < 6}>
              {isLoading ? 'Đang xử lý...' : 'Tạo mật khẩu'}
            </button>
          </div>
        )}

        {signupStep === 3 && (
          <div className="signup-profile-step">
            <p>Tạo hồ sơ khám điện tử đầy đủ thông tin sẽ hỗ trợ việc khám chữa bệnh của bạn tốt hơn.</p>
            <div className="profile-form-grid">
              <div>
                <h3>Thông tin hồ sơ khám điện tử</h3>
                <label>Họ và tên <span>*</span><input value={form.profile.fullName} onChange={(event) => cap_nhat_ho_so('fullName', event.target.value)} placeholder="Họ và tên" required /></label>
                <label>Số điện thoại <span>*</span><input value={form.profile.phone} onChange={(event) => cap_nhat_ho_so('phone', event.target.value)} placeholder="Số điện thoại" required /></label>
                <label>Ngày sinh <span>*</span><input type="date" value={form.profile.dateOfBirth} onChange={(event) => cap_nhat_ho_so('dateOfBirth', event.target.value)} required /></label>
                <label>Số CMND/CCCD<input value={form.profile.citizenId} onChange={(event) => cap_nhat_ho_so('citizenId', event.target.value)} placeholder="Số CMND/CCCD" /></label>
                <div className="gender-field">
                  <span>Giới tính</span>
                  <button className={form.profile.gender === 'male' ? 'active' : ''} type="button" onClick={() => cap_nhat_ho_so('gender', 'male')}>Nam</button>
                  <button className={form.profile.gender === 'female' ? 'active' : ''} type="button" onClick={() => cap_nhat_ho_so('gender', 'female')}>Nữ</button>
                </div>
                <label>Địa chỉ email của bạn<input type="email" value={form.email} disabled /></label>
                <label>Dân tộc<select value={form.profile.ethnicity} onChange={(event) => cap_nhat_ho_so('ethnicity', event.target.value)}><option>Kinh</option><option>Hoa</option><option>Khmer</option><option>Chăm</option><option>Khác</option></select></label>
              </div>
              <div>
                <h3>Thông tin bổ sung</h3>
                <label>Mã thẻ Bảo hiểm y tế<input value={form.profile.healthInsuranceNumber} onChange={(event) => cap_nhat_ho_so('healthInsuranceNumber', event.target.value)} placeholder="Mã số trên thẻ Bảo hiểm y tế" /></label>
                <label>Tỉnh / Thành phố<select value={form.profile.province} onChange={(event) => cap_nhat_ho_so('province', event.target.value)}><option value="">Chọn tỉnh thành phố của bạn</option><option>TP. Hồ Chí Minh</option><option>Hà Nội</option><option>Đà Nẵng</option><option>Cần Thơ</option></select></label>
                <label>Quận / Huyện<select value={form.profile.district} onChange={(event) => cap_nhat_ho_so('district', event.target.value)}><option value="">Chọn quận huyện của bạn</option><option>Quận 1</option><option>Quận 3</option><option>Quận Bình Thạnh</option><option>TP. Thủ Đức</option></select></label>
                <label>Phường / Xã<select value={form.profile.ward} onChange={(event) => cap_nhat_ho_so('ward', event.target.value)}><option value="">Chọn phường xã của bạn</option><option>Phường Bến Nghé</option><option>Phường Đa Kao</option><option>Phường Linh Trung</option></select></label>
                <label>Địa chỉ cụ thể<input value={form.profile.address} onChange={(event) => cap_nhat_ho_so('address', event.target.value)} placeholder="Số nhà, tên đường" /></label>
                <label>Mã giới thiệu<input value={form.profile.referralCode} onChange={(event) => cap_nhat_ho_so('referralCode', event.target.value)} placeholder="Mã của người giới thiệu" /></label>
                <label>Nghề nghiệp<select value={form.profile.occupation} onChange={(event) => cap_nhat_ho_so('occupation', event.target.value)}><option value="">Chọn nghề nghiệp</option><option>Nhân viên văn phòng</option><option>Học sinh / Sinh viên</option><option>Kinh doanh</option><option>Khác</option></select></label>
              </div>
            </div>
            {message && <div className="auth-message">{message}</div>}
            <button className="finish-profile-button" type="submit" disabled={isLoading}>
              {isLoading ? 'Đang lưu...' : 'Hoàn tất'}
            </button>
          </div>
        )}
      </form>
    </section>
  );

  if (mode === 'signup-entry') {
    return (
      <section className="auth-page">
        <div className="auth-visual">
          <div className="auth-orbit">
            <div className="auth-bubble bubble-chat">≡</div>
            <div className="auth-bubble bubble-video">▮</div>
            <div className="auth-bubble bubble-heart">♥</div>
            <div className="auth-bubble bubble-phone">☎</div>
            <div className="auth-bubble bubble-doctor">BS</div>
            <div className="auth-caption">
              Đặt khám <strong>DỄ DÀNG HƠN</strong><br />
              trên website <b>MidHealth</b> với <strong>600+</strong> bác sĩ,<br />
              <strong>100</strong> phòng khám, <strong>25</strong> bệnh viện
            </div>
          </div>
        </div>

        <div className="auth-panel">
          <div className="auth-card auth-card-page">
            <div className="auth-switch">
              <button type="button" onClick={() => setMode('signin')}>Đăng nhập</button>
              <button className="active" type="button">Đăng ký</button>
            </div>

            <form
              className="auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                bat_dau_dang_ky();
              }}
            >
              <label>
                Email
                <input type="email" value={form.email} onChange={(event) => cap_nhat_form('email', event.target.value)} placeholder="Nhập email để nhận OTP" required />
              </label>
              {message && <div className="auth-message">{message}</div>}
              <button type="submit" disabled={isLoading}>{isLoading ? 'Đang gửi OTP...' : 'Đăng ký'}</button>
            </form>

            <div className="auth-divider"><span>hoặc</span></div>
            <button className="google-login-button" type="button" onClick={dang_nhap_google} disabled={isLoading}>
              <span>G</span>
              Đăng ký với Google
            </button>

            <div className="auth-bottom">
              <p>Đã có tài khoản? <button type="button" onClick={() => setMode('signin')}>Đăng nhập</button></p>
              <button className="back-home" type="button" onClick={onBack}>Quay về trang chủ</button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (mode === 'signup') {
    return renderSignupStep();
  }

  return (
    <section className="auth-page">
      <div className="auth-visual">
        <div className="auth-orbit">
          <div className="auth-bubble bubble-chat">≡</div>
          <div className="auth-bubble bubble-video">▮</div>
          <div className="auth-bubble bubble-heart">♥</div>
          <div className="auth-bubble bubble-phone">☎</div>
          <div className="auth-bubble bubble-doctor">BS</div>
          <div className="auth-caption">
            Đặt khám <strong>DỄ DÀNG HƠN</strong><br />
            trên website <b>MidHealth</b> với <strong>600+</strong> bác sĩ,<br />
            <strong>100</strong> phòng khám, <strong>25</strong> bệnh viện
          </div>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-card auth-card-page">
          <div className="auth-switch">
            <button className="active" type="button">Đăng nhập</button>
            <button type="button" onClick={mo_form_dang_ky} disabled={isLoading}>Đăng ký</button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form" autoComplete="off">
            <label>
              Email
              <input
                autoComplete="off"
                name="midhealth_login_email"
                type="email"
                value={form.email}
                onChange={(event) => cap_nhat_form('email', event.target.value)}
                placeholder="Nhập email"
                required
              />
            </label>
            <label>
              Mật khẩu
              <input
                autoComplete="new-password"
                name="midhealth_login_password"
                type="password"
                value={form.password}
                onChange={(event) => cap_nhat_form('password', event.target.value)}
                placeholder="Nhập mật khẩu"
                required
              />
            </label>
            <div className="auth-row">
              <label className="checkbox-line">
                <input type="checkbox" checked={form.remember} onChange={(event) => cap_nhat_form('remember', event.target.checked)} />
                Ghi nhớ mật khẩu
              </label>
              <button className="link-button" type="button" onClick={handleResetPassword}>Quên mật khẩu?</button>
            </div>
            {message && <div className="auth-message">{message}</div>}
            <button type="submit" disabled={isLoading}>{isLoading ? 'Đang xử lý...' : 'Đăng nhập'}</button>
          </form>

          <div className="auth-divider"><span>hoặc</span></div>
          <button className="google-login-button" type="button" onClick={dang_nhap_google} disabled={isLoading}>
            <span>G</span>
            Đăng nhập với Google
          </button>

          <div className="auth-bottom">
            <p>Chưa có tài khoản? <button type="button" onClick={mo_form_dang_ky} disabled={isLoading}>Đăng ký ngay</button></p>
            <button className="back-home" type="button" onClick={onBack}>Quay về trang chủ</button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default DangNhapDangKy;
