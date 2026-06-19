import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { useEffect, useMemo, useRef, useState } from 'react';
import { savePatientProfile } from '../../lib/appointments';
import {
  firebaseAuth,
  getGoogleRedirectResult,
  signInWithGoogleRedirect,
} from '../../lib/firebase';
import { apiBaseUrl } from '../../lib/api_base';
import { useReferenceData } from '../../lib/reference_data';

const GOOGLE_AUTH_MODE_KEY = 'midhealth_google_auth_mode';
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

const supportedCardImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function email_hop_le(value = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function thong_bao_email(value = '') {
  const email = value.trim();
  if (!email) return 'Vui lòng nhập email.';
  if (!email.includes('@')) return 'Email cần có ký tự @. Ví dụ: ten@gmail.com.';
  if (!email_hop_le(email)) return 'Email chưa đúng định dạng. Ví dụ: ten@gmail.com.';
  return '';
}

function chuan_hoa_so_dien_thoai(value = '') {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function thong_bao_so_dien_thoai(value = '') {
  const phone = chuan_hoa_so_dien_thoai(value);
  if (!phone) return 'Vui lòng nhập số điện thoại.';
  if (!/^0(3|5|7|8|9)\d{8}$/.test(phone)) return 'Xin vui lòng nhập đúng số điện thoại!';
  return '';
}

function thong_bao_mat_khau(value = '') {
  if (!value) return 'Vui lòng nhập mật khẩu.';
  if (value.length < 6) return 'Mật khẩu cần tối thiểu 6 ký tự.';
  return '';
}

function chuan_hoa_ngay_tu_qr(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 8) return '';
  const dayFirst = `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
  const yearFirst = `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  const candidates = Number(digits.slice(0, 4)) > 1900 ? [yearFirst, dayFirst] : [dayFirst, yearFirst];
  return candidates.find((dateText) => {
    const date = new Date(`${dateText}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateText;
  }) || '';
}

function phan_tich_qr_the(rawValue, documentType) {
  const parts = String(rawValue || '').split('|').map((part) => part.trim());
  if (parts.length < 4) return null;

  if (documentType === 'citizen') {
    const citizenId = parts.find((part) => /^\d{12}$/.test(part)) || '';
    const idIndex = parts.indexOf(citizenId);
    if (!citizenId || idIndex < 0) return null;
    const fullName = parts[idIndex + 2] || parts[idIndex + 1] || '';
    const dateOfBirth = chuan_hoa_ngay_tu_qr(parts[idIndex + 3]);
    const genderText = String(parts[idIndex + 4] || '').toLowerCase();
    const address = parts[idIndex + 5] || '';
    const addressParts = address.split(',').map((part) => part.trim()).filter(Boolean);
    return {
      citizenId,
      fullName,
      dateOfBirth,
      gender: genderText.includes('nam') && !genderText.includes('nữ') ? 'male'
        : genderText.includes('nữ') || genderText.includes('nu') ? 'female' : '',
      address,
      province: addressParts.length >= 2 ? addressParts.at(-1) : '',
      district: addressParts.length >= 3 ? addressParts.at(-2) : '',
      ward: addressParts.length >= 3 ? addressParts.at(-3) : '',
    };
  }

  const healthInsuranceNumber = parts.find((part) => /^[A-Za-z0-9]{10,15}$/.test(part.replace(/\s/g, '')))
    ?.replace(/\s/g, '').toUpperCase() || '';
  const dateOfBirth = parts.map(chuan_hoa_ngay_tu_qr).find(Boolean) || '';
  const genderText = parts.find((part) => /^(nam|nữ|nu)$/i.test(part)) || '';
  const fullName = parts.find((part) => /[A-Za-zÀ-ỹ]{2,}\s+[A-Za-zÀ-ỹ]/.test(part) && !/bảo hiểm|insurance/i.test(part)) || '';
  if (!healthInsuranceNumber) return null;
  return {
    healthInsuranceNumber,
    fullName,
    dateOfBirth,
    gender: /^nam$/i.test(genderText) ? 'male' : /^(nữ|nu)$/i.test(genderText) ? 'female' : '',
  };
}

async function doc_qr_tren_anh(canvas, documentType) {
  if (!('BarcodeDetector' in window)) return null;
  try {
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    const rotations = [0, 90, 180, 270];
    for (const degrees of rotations) {
      const source = degrees === 0 ? canvas : document.createElement('canvas');
      if (degrees !== 0) {
        const swapSides = degrees === 90 || degrees === 270;
        source.width = swapSides ? canvas.height : canvas.width;
        source.height = swapSides ? canvas.width : canvas.height;
        const context = source.getContext('2d');
        context.translate(source.width / 2, source.height / 2);
        context.rotate(degrees * Math.PI / 180);
        context.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
      }
      const codes = await detector.detect(source);
      const parsed = codes.map((code) => phan_tich_qr_the(code.rawValue, documentType)).find(Boolean);
      if (parsed) return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

async function chuan_hoa_anh_the(file, documentType) {
  if (!supportedCardImageTypes.has(file?.type)) {
    throw new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('Ảnh gốc không được vượt quá 12 MB.');
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const maxSide = 2000;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Không thể xử lý ảnh đã chọn.')), 'image/jpeg', 0.9);
  });
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Không thể đọc ảnh đã chọn.'));
    reader.readAsDataURL(blob);
  });
  const qrResult = await doc_qr_tren_anh(canvas, documentType);
  return {
    imageBase64: dataUrl.split(',')[1],
    mimeType: 'image/jpeg',
    previewUrl: dataUrl,
    qrResult,
  };
}

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

async function goi_api_nhan_dien(payload) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(`${apiBaseUrl}/api/card-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) return data.data;
      lastError = new Error(data.message || 'Không thể nhận diện ảnh.');
      if (![502, 503, 504].includes(response.status)) throw lastError;
    } catch (error) {
      lastError = error;
    }
    if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 900));
  }
  throw lastError || new Error('Không thể kết nối dịch vụ nhận diện ảnh.');
}

async function xac_minh_cong_benh_nhan(user, { allowIncomplete = false } = {}) {
  const token = await user.getIdToken(true);
  const query = allowIncomplete ? '?portal=patient&allowIncomplete=1&optional=1' : '?portal=patient&optional=1';
  const response = await fetch(`${apiBaseUrl}/api/auth/me${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (data.data?.allowed === false) throw new Error(data.message || 'PORTAL_ACCESS_DENIED');
  if (!response.ok) throw new Error(data.message || 'Tài khoản không thuộc cổng bệnh nhân.');
  return data.data;
}

function lay_thong_bao_loi(error) {
  const code = error?.code || '';
  if (code.includes('auth/operation-not-allowed')) return 'Firebase chưa bật phương thức đăng nhập Email/Password.';
  if (code.includes('auth/network-request-failed')) return 'Không kết nối được Firebase. Vui lòng kiểm tra mạng hoặc cấu hình Firebase.';

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
    </div>
  );
}

function DangNhapDangKy({ initialMode = 'signin', onBack, onAuthSuccess }) {
  const otpInputRefs = useRef([]);
  const profileFormRef = useRef(null);
  const cardVideoRef = useRef(null);
  const googleRedirectHandledRef = useRef(false);
  const [mode, setMode] = useState('signin');
  const [signupStep, setSignupStep] = useState(1);
  const [otpSent, setOtpSent] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [googleSignupUser, setGoogleSignupUser] = useState(null);
  const [signupAuthUser, setSignupAuthUser] = useState(null);
  const [form, setForm] = useState({
    email: '',
    phone: '',
    password: '',
    remember: false,
    otp: '',
    profile: initialProfile,
  });
  const [message, setMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [cardUpload, setCardUpload] = useState({ loading: false, type: '', fileName: '', previewUrl: '', result: null, error: '' });
  const [autofilledFields, setAutofilledFields] = useState([]);
  const [cardCamera, setCardCamera] = useState({ active: false, type: '', status: '', quality: null });
  const { addressData, ethnicGroups, occupations } = useReferenceData();
  const selectedProvince = useMemo(
    () => addressData.find((item) => item.name === form.profile.province),
    [addressData, form.profile.province],
  );
  const selectedDistrict = useMemo(
    () => selectedProvince?.districts.find((item) => item.name === form.profile.district),
    [selectedProvince, form.profile.district],
  );

  useEffect(() => {
    setForm({
      email: '',
      phone: '',
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

  useEffect(() => {
    if (googleRedirectHandledRef.current) return;
    googleRedirectHandledRef.current = true;

    let isMounted = true;

    const xu_ly_ket_qua_redirect = async () => {
      try {
        const credential = await getGoogleRedirectResult();
        if (!credential || !isMounted) return;

        const redirectMode = sessionStorage.getItem(GOOGLE_AUTH_MODE_KEY) || 'signin';
        sessionStorage.removeItem(GOOGLE_AUTH_MODE_KEY);
        setMessage('');
        setIsLoading(true);
        await xu_ly_google_credential(credential, redirectMode);
      } catch (error) {
        if (isMounted) setMessage(lay_thong_bao_loi(error));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    xu_ly_ket_qua_redirect();

    return () => {
      isMounted = false;
    };
  }, []);

  const cap_nhat_form = (field, value) => {
    const nextValue = field === 'phone' ? chuan_hoa_so_dien_thoai(value) : value;
    setForm((current) => ({
      ...current,
      [field]: nextValue,
      profile: field === 'email' ? { ...current.profile, email: nextValue } : current.profile,
    }));

    if (field === 'email') {
      setOtpSent(false);
      setOtpToken('');
      setGoogleSignupUser(null);
      setSignupAuthUser(null);
      setSignupStep(1);
    }
    setFieldErrors((current) => ({
      ...current,
      [field]: field === 'email' && nextValue ? thong_bao_email(nextValue)
        : field === 'phone' && value && nextValue !== value ? 'Xin vui lòng nhập đúng số điện thoại!'
          : field === 'phone' && nextValue ? thong_bao_so_dien_thoai(nextValue)
            : '',
    }));
  };

  const cap_nhat_ho_so = (field, value) => {
    const nextValue = field === 'phone' ? chuan_hoa_so_dien_thoai(value) : value;
    setForm((current) => ({
      ...current,
      profile: {
        ...current.profile,
        [field]: nextValue,
        ...(field === 'province' ? { district: '', ward: '' } : {}),
        ...(field === 'district' ? { ward: '' } : {}),
      },
    }));
    const phoneError = field === 'phone' && value && nextValue !== value
      ? 'Xin vui lòng nhập đúng số điện thoại!'
      : field === 'phone' && nextValue ? thong_bao_so_dien_thoai(nextValue) : '';
    setFieldErrors((current) => ({
      ...current,
      [`profile.${field}`]: phoneError,
    }));
  };

  const lop_tu_dong_dien = (field) => (autofilledFields.includes(field) ? 'is-autofilled' : '');

  const dung_camera_the = () => {
    const stream = cardVideoRef.current?.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    if (cardVideoRef.current) cardVideoRef.current.srcObject = null;
    setCardCamera({ active: false, type: '', status: '', quality: null });
  };

  const mo_camera_the = async (documentType) => {
    dung_camera_the();
    setMessage('');
    setCardCamera({ active: true, type: documentType, status: 'Đang mở camera...', quality: null });
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Trình duyệt không hỗ trợ camera hoặc trang chưa chạy bằng HTTPS/localhost.');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
      if (!cardVideoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cardVideoRef.current.srcObject = stream;
      await cardVideoRef.current.play();
      setCardCamera((current) => ({ ...current, status: 'Đưa toàn bộ thẻ vào khung. Giữ camera song song với mặt thẻ.' }));
    } catch (error) {
      dung_camera_the();
      setMessage(error?.name === 'NotAllowedError' ? 'Bạn chưa cấp quyền camera cho trình duyệt.' : error?.message || 'Không thể mở camera.');
    }
  };

  const danh_gia_anh_camera = (canvas) => {
    const sample = document.createElement('canvas');
    const width = 320;
    sample.width = width;
    sample.height = Math.max(1, Math.round(width * canvas.height / canvas.width));
    const context = sample.getContext('2d', { willReadFrequently: true });
    context.drawImage(canvas, 0, 0, sample.width, sample.height);
    const { data } = context.getImageData(0, 0, sample.width, sample.height);
    const gray = new Float32Array(sample.width * sample.height);
    let brightness = 0;
    for (let index = 0; index < gray.length; index += 1) {
      const offset = index * 4;
      gray[index] = (data[offset] * 0.299) + (data[offset + 1] * 0.587) + (data[offset + 2] * 0.114);
      brightness += gray[index];
    }
    brightness /= gray.length;
    let edgeTotal = 0;
    let edgeSquared = 0;
    let edgeCount = 0;
    for (let y = 1; y < sample.height - 1; y += 1) {
      for (let x = 1; x < sample.width - 1; x += 1) {
        const center = gray[(y * sample.width) + x];
        const laplacian = gray[((y - 1) * sample.width) + x] + gray[((y + 1) * sample.width) + x]
          + gray[(y * sample.width) + x - 1] + gray[(y * sample.width) + x + 1] - (4 * center);
        edgeTotal += laplacian;
        edgeSquared += laplacian * laplacian;
        edgeCount += 1;
      }
    }
    const mean = edgeTotal / edgeCount;
    const sharpness = (edgeSquared / edgeCount) - (mean * mean);
    return { brightness, sharpness };
  };

  const chup_anh_the = async () => {
    const video = cardVideoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) return;
    const cropWidth = video.videoWidth * 0.82;
    const cropHeight = Math.min(video.videoHeight * 0.82, cropWidth / 1.586);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cropWidth);
    canvas.height = Math.round(cropHeight);
    canvas.getContext('2d').drawImage(
      video,
      (video.videoWidth - cropWidth) / 2,
      (video.videoHeight - cropHeight) / 2,
      cropWidth,
      cropHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    const quality = danh_gia_anh_camera(canvas);
    if (quality.brightness < 65 || quality.brightness > 225 || quality.sharpness < 85) {
      const status = quality.brightness < 65
        ? 'Ảnh quá tối. Hãy tăng ánh sáng và thử lại.'
        : quality.brightness > 225
          ? 'Ảnh bị lóa. Hãy nghiêng nguồn sáng hoặc di chuyển thẻ.'
          : 'Ảnh còn mờ. Hãy giữ thiết bị ổn định, đưa thẻ gần hơn và thử lại.';
      setCardCamera((current) => ({ ...current, status, quality }));
      return;
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    const file = new File([blob], `${cardCamera.type === 'citizen' ? 'cccd' : 'bhyt'}-camera.jpg`, { type: 'image/jpeg' });
    const type = cardCamera.type;
    dung_camera_the();
    await tai_anh_va_nhan_dien(type, file);
  };

  const tai_anh_va_nhan_dien = async (documentType, file) => {
    if (!file) return;
    setMessage('');
    setAutofilledFields([]);
    setCardUpload({ loading: true, type: documentType, fileName: file.name, previewUrl: '', result: null, error: '' });
    try {
      const image = await chuan_hoa_anh_the(file, documentType);
      setCardUpload((current) => ({ ...current, previewUrl: image.previewUrl }));
      let aiResult = null;
      let recognitionError = null;
      try {
        aiResult = await goi_api_nhan_dien({
          documentType,
          imageBase64: image.imageBase64,
          mimeType: image.mimeType,
        });
      } catch (error) {
        recognitionError = error;
      }
      if (!aiResult && !image.qrResult) throw recognitionError || new Error('Không thể nhận diện ảnh.');
      const result = {
        ...(aiResult || {}),
        ...Object.fromEntries(Object.entries(image.qrResult || {}).filter(([, value]) => value)),
        confidence: aiResult?.confidence || (image.qrResult ? 0.92 : 0),
        missingFields: aiResult?.missingFields || [],
        warnings: aiResult?.warnings || [],
      };
      const profileValues = {
        fullName: result.fullName,
        dateOfBirth: result.dateOfBirth,
        gender: result.gender,
        citizenId: documentType === 'citizen' ? result.citizenId : '',
        healthInsuranceNumber: documentType === 'insurance' ? result.healthInsuranceNumber : '',
        address: result.address,
        province: result.province,
        district: result.district,
        ward: result.ward,
      };
      const fields = Object.entries(profileValues).filter(([, value]) => value).map(([field]) => field);
      setForm((current) => ({
        ...current,
        profile: Object.entries(profileValues).reduce(
          (profile, [field, value]) => value ? { ...profile, [field]: value } : profile,
          current.profile,
        ),
      }));
      setCardUpload((current) => ({ ...current, loading: false, result }));
      setAutofilledFields(fields);
      setMessage(`Đã nhận diện và tự động điền ${fields.length} trường thông tin${image.qrResult ? ' từ mã QR và hình ảnh thẻ' : ''}. Vui lòng kiểm tra lại dữ liệu bên dưới.`);
      window.requestAnimationFrame(() => profileFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      window.setTimeout(() => setAutofilledFields([]), 3200);
    } catch (error) {
      setCardUpload((current) => ({ ...current, loading: false, error: error?.message || 'Không thể nhận diện ảnh.' }));
      setMessage(error?.message || 'Không thể nhận diện ảnh.');
    }
  };

  useEffect(() => () => {
    const stream = cardVideoRef.current?.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
  }, []);

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
    const emailMessage = thong_bao_email(form.email);
    if (emailMessage) {
      setFieldErrors((current) => ({ ...current, email: emailMessage }));
      throw new Error(emailMessage);
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
    const errors = validateSignupProfile();
    if (Object.keys(errors).length) {
      setFieldErrors((current) => ({ ...current, ...errors }));
      throw new Error('Vui lòng kiểm tra lại các ô thông tin màu đỏ.');
    }

    const profile = {
      ...form.profile,
      email: googleSignupUser.email || form.email.trim(),
      fullName: form.profile.fullName || googleSignupUser.displayName || '',
    };

    await updatePassword(googleSignupUser, form.password);
    await xac_minh_cong_benh_nhan(googleSignupUser, { allowIncomplete: true });
    await savePatientProfile(googleSignupUser, profile);
    await xac_minh_cong_benh_nhan(googleSignupUser);
    return googleSignupUser;
  };

  const tao_mat_khau_google = async () => {
    setSignupStep(3);
    setMessage('');
  };

  const tao_tai_khoan_email = async () => {
    if (!otpToken) {
      throw new Error('Vui long xac minh OTP email truoc khi dang ky.');
    }

    setSignupStep(3);
    setMessage('');
  };

  const hoan_tat_ho_so_email = async () => {
    const errors = validateSignupProfile();
    if (Object.keys(errors).length) {
      setFieldErrors((current) => ({ ...current, ...errors }));
      throw new Error('Vui lòng kiểm tra lại các ô thông tin màu đỏ.');
    }

    let authUser = signupAuthUser;
    if (!authUser) {
      try {
        const credential = await createUserWithEmailAndPassword(
          firebaseAuth,
          form.email.trim(),
          form.password,
        );
        authUser = credential.user;
      } catch (error) {
        if (!error?.code?.includes('auth/email-already-in-use')) {
          throw error;
        }

        const credential = await signInWithEmailAndPassword(
          firebaseAuth,
          form.email.trim(),
          form.password,
        );
        authUser = credential.user;
      }
      setSignupAuthUser(authUser);
    }

    if (form.profile.fullName && authUser.displayName !== form.profile.fullName) {
      await updateProfile(authUser, { displayName: form.profile.fullName });
    }
    await xac_minh_cong_benh_nhan(authUser, { allowIncomplete: true });
    await savePatientProfile(authUser, {
      ...form.profile,
      email: form.email.trim(),
      fullName: form.profile.fullName,
    });
    await xac_minh_cong_benh_nhan(authUser);
    return authUser;
  };

  const xu_ly_google_credential = async (credential, authMode = mode) => {
    if (!credential?.user) {
      throw new Error('Khong nhan duoc thong tin dang nhap Google. Vui long thu lai.');
    }

    if (authMode === 'signup-entry') {
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
      setMessage('Google da xac thuc email. Bam tiep tuc de tao mat khau.');
      return;
    }

    const idToken = await credential.user.getIdToken();
    await goi_api('/api/auth/google', { idToken, portal: 'patient' });
    await xac_minh_cong_benh_nhan(credential.user);
    onAuthSuccess(credential.user);
    onBack();
  };

  const dang_nhap_google = async () => {
    setMessage('');
    setIsLoading(true);

    try {
      sessionStorage.setItem(GOOGLE_AUTH_MODE_KEY, mode);
      await signInWithGoogleRedirect();
      return;

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

      const idToken = await credential.user.getIdToken();
      await goi_api('/api/auth/google', { idToken, portal: 'patient' });
      await xac_minh_cong_benh_nhan(credential.user);
      onAuthSuccess(credential.user);
      onBack();
    } catch (error) {
      const code = error?.code || '';
      const shouldUseRedirect = [
        'auth/popup-closed-by-user',
        'auth/popup-blocked',
        'auth/cancelled-popup-request',
      ].some((item) => code.includes(item));

      if (shouldUseRedirect) {
        sessionStorage.setItem(GOOGLE_AUTH_MODE_KEY, mode);
        await signInWithGoogleRedirect();
        return;
      }

      setMessage(lay_thong_bao_loi(error));
    } finally {
      setIsLoading(false);
    }
  };

  const dang_nhap_email = async () => {
    const errors = validateLoginForm();
    if (Object.keys(errors).length) {
      setFieldErrors((current) => ({ ...current, ...errors }));
      throw new Error('Vui lòng kiểm tra lại email và mật khẩu.');
    }

    await goi_api('/api/auth/login', {
      email: form.email.trim(),
      password: form.password,
      portal: 'patient',
    });
    const credential = await signInWithEmailAndPassword(firebaseAuth, form.email.trim(), form.password);
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
        try {
          await xac_minh_cong_benh_nhan(authUser);
        } catch (error) {
          await signOut(firebaseAuth);
          throw error;
        }
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

    const emailMessage = thong_bao_email(form.email);
    if (emailMessage) {
      setFieldErrors((current) => ({ ...current, email: emailMessage }));
      setMessage(emailMessage);
      return;
    }

    try {
      await goi_api('/api/auth/password-reset', { email: form.email.trim() });
      setMessage('Đã gửi email đặt lại mật khẩu tới địa chỉ email của bạn.');
    } catch (error) {
      setMessage(lay_thong_bao_loi(error));
    }
  };

  const validateLoginForm = () => {
    const errors = {};
    const emailMessage = thong_bao_email(form.email);
    if (emailMessage) errors.email = emailMessage;
    if (!form.password) errors.password = 'Vui lòng nhập mật khẩu.';
    return errors;
  };

  const validateSignupProfile = () => {
    const errors = {};
    if (!form.profile.fullName.trim()) errors['profile.fullName'] = 'Vui lòng nhập họ và tên.';
    const phoneMessage = thong_bao_so_dien_thoai(form.profile.phone);
    if (phoneMessage) errors['profile.phone'] = phoneMessage;
    if (!form.profile.dateOfBirth.trim()) errors['profile.dateOfBirth'] = 'Vui lòng chọn ngày sinh.';
    if (!form.profile.province.trim()) errors['profile.province'] = 'Vui lòng chọn tỉnh/thành phố.';
    if (!form.profile.address.trim()) errors['profile.address'] = 'Vui lòng nhập địa chỉ cụ thể.';
    return errors;
  };

  const canSubmitSignin = !isLoading && !thong_bao_email(form.email) && Boolean(form.password);
  const canSubmitSignupEmail = !isLoading && !thong_bao_email(form.email);
  const canSubmitSignupPassword = !isLoading && !thong_bao_mat_khau(form.password);
  const canFinishProfile = !isLoading && !cardUpload.loading && !Object.keys(validateSignupProfile()).length;

  const renderSignupStep = () => (
    <section className="signup-wizard-page">
      <form className="signup-wizard-card" onSubmit={handleSubmit} noValidate>
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
                  className={fieldErrors.email ? 'signup-single-input has-error' : 'signup-single-input'}
                  type="text"
                  inputMode="email"
                  value={form.email}
                  onChange={(event) => cap_nhat_form('email', event.target.value)}
                  placeholder="Địa chỉ Gmail của bạn"
                />
                {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
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
            <button type="submit" disabled={googleSignupUser ? isLoading : otpSent ? isLoading || form.otp.length < 6 : !canSubmitSignupEmail}>
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
                  className={fieldErrors.password ? 'has-error' : ''}
                  value={form.password}
                  onChange={(event) => {
                    cap_nhat_form('password', event.target.value);
                    setFieldErrors((current) => ({ ...current, password: event.target.value ? thong_bao_mat_khau(event.target.value) : '' }));
                  }}
                  placeholder="Tạo mật khẩu cho tài khoản"
                  minLength={6}
                />
                {fieldErrors.password && <small className="field-error">{fieldErrors.password}</small>}
            </label>
            {message && <div className="auth-message">{message}</div>}
            <button type="submit" disabled={!canSubmitSignupPassword}>
              {isLoading ? 'Đang xử lý...' : 'Tạo mật khẩu'}
            </button>
          </div>
        )}

        {signupStep === 3 && (
          <div className="signup-profile-step">
            <p>Tạo hồ sơ khám điện tử đầy đủ thông tin sẽ hỗ trợ việc khám chữa bệnh của bạn tốt hơn.</p>
            <div className="card-upload-tool">
              <div className="card-upload-heading">
                <strong>Quét thông tin từ CCCD hoặc thẻ BHYT</strong>
                <span>Tải ảnh có sẵn hoặc dùng camera. Hệ thống sẽ tự động điền thông tin đọc được vào hồ sơ.</span>
              </div>
              <div className="card-upload-actions">
                <div className="card-scan-primary-actions">
                  <button type="button" onClick={() => mo_camera_the('citizen')} disabled={cardUpload.loading || cardCamera.active}>
                    Quét CCCD bằng camera
                  </button>
                  <button type="button" onClick={() => mo_camera_the('insurance')} disabled={cardUpload.loading || cardCamera.active}>
                    Quét thẻ BHYT bằng camera
                  </button>
                </div>
                <div className="card-upload-secondary-actions">
                  <label className={cardUpload.loading ? 'disabled' : ''}>
                    Tải ảnh CCCD
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={cardUpload.loading}
                      onChange={(event) => {
                        tai_anh_va_nhan_dien('citizen', event.target.files?.[0]);
                        event.target.value = '';
                      }}
                    />
                  </label>
                  <label className={cardUpload.loading ? 'disabled' : ''}>
                    Tải ảnh BHYT
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={cardUpload.loading}
                      onChange={(event) => {
                        tai_anh_va_nhan_dien('insurance', event.target.files?.[0]);
                        event.target.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
              {cardCamera.active && (
                <div className="card-camera-panel">
                  <div className="card-camera-view">
                    <video ref={cardVideoRef} muted playsInline />
                    <div className="card-camera-frame" />
                    <span>{cardCamera.type === 'citizen' ? 'MẶT TRƯỚC CCCD' : 'MẶT TRƯỚC THẺ BHYT'}</span>
                  </div>
                  <div className="card-camera-guide">
                    <strong>{cardCamera.status}</strong>
                    <ol>
                      <li>Đặt trọn bốn góc thẻ nằm ngang trong khung trắng.</li>
                      <li>Giữ camera song song, đủ sáng và tránh vùng bị lóa.</li>
                      <li>Giữ yên để chữ rõ nét rồi bấm Chụp ảnh.</li>
                    </ol>
                    <div className="card-camera-controls">
                      <button type="button" onClick={chup_anh_the}>Chụp ảnh</button>
                      <button type="button" onClick={dung_camera_the}>Đóng camera</button>
                    </div>
                  </div>
                </div>
              )}
              {(cardUpload.previewUrl || cardUpload.loading || cardUpload.result || cardUpload.error) && (
                <div className="card-upload-status">
                  {cardUpload.previewUrl && <img src={cardUpload.previewUrl} alt={`Ảnh ${cardUpload.type === 'citizen' ? 'CCCD' : 'BHYT'} đã chọn`} />}
                  <div>
                    <strong>{cardUpload.loading ? 'Đang nhận diện thông tin trên ảnh...' : cardUpload.error ? 'Chưa thể nhận diện ảnh' : 'Đã nhận diện xong'}</strong>
                    {cardUpload.fileName && <span>{cardUpload.fileName}</span>}
                    {cardUpload.result && (
                      <>
                        <span>Độ tin cậy: {Math.round(cardUpload.result.confidence * 100)}%</span>
                        {cardUpload.result.missingFields?.length > 0 && <span>Chưa đọc được: {cardUpload.result.missingFields.join(', ')}.</span>}
                        {cardUpload.result.warnings?.length > 0 && <span>{cardUpload.result.warnings.join(' ')}</span>}
                      </>
                    )}
                    {cardUpload.error && <span>{cardUpload.error}</span>}
                  </div>
                </div>
              )}
            </div>
            <div className="profile-form-grid" ref={profileFormRef}>
              <div>
                <h3>Thông tin hồ sơ khám điện tử</h3>
                <label className={fieldErrors['profile.fullName'] ? `${lop_tu_dong_dien('fullName')} has-field-error` : lop_tu_dong_dien('fullName')}>Họ và tên <span>*</span><input value={form.profile.fullName} onChange={(event) => cap_nhat_ho_so('fullName', event.target.value)} placeholder="Họ và tên" />{fieldErrors['profile.fullName'] && <small className="field-error">{fieldErrors['profile.fullName']}</small>}</label>
                <label className={fieldErrors['profile.phone'] ? 'has-field-error' : ''}>Số điện thoại <span>*</span><input inputMode="tel" value={form.profile.phone} onChange={(event) => cap_nhat_ho_so('phone', event.target.value)} placeholder="Số điện thoại" />{fieldErrors['profile.phone'] && <small className="field-error">{fieldErrors['profile.phone']}</small>}</label>
                <label className={fieldErrors['profile.dateOfBirth'] ? `${lop_tu_dong_dien('dateOfBirth')} has-field-error` : lop_tu_dong_dien('dateOfBirth')}>Ngày sinh <span>*</span><input type="date" value={form.profile.dateOfBirth} onChange={(event) => cap_nhat_ho_so('dateOfBirth', event.target.value)} />{fieldErrors['profile.dateOfBirth'] && <small className="field-error">{fieldErrors['profile.dateOfBirth']}</small>}</label>
                <label className={lop_tu_dong_dien('citizenId')}>Số CMND/CCCD<input value={form.profile.citizenId} onChange={(event) => cap_nhat_ho_so('citizenId', event.target.value)} placeholder="Số CMND/CCCD" /></label>
                <div className={`gender-field ${lop_tu_dong_dien('gender')}`}>
                  <span>Giới tính</span>
                  <button className={form.profile.gender === 'male' ? 'active' : ''} type="button" onClick={() => cap_nhat_ho_so('gender', 'male')}>Nam</button>
                  <button className={form.profile.gender === 'female' ? 'active' : ''} type="button" onClick={() => cap_nhat_ho_so('gender', 'female')}>Nữ</button>
                </div>
                <label>Địa chỉ email của bạn<input type="text" value={form.email} disabled /></label>
                <label>Dân tộc<select value={form.profile.ethnicity} onChange={(event) => cap_nhat_ho_so('ethnicity', event.target.value)}>{ethnicGroups.map((item) => <option key={item}>{item}</option>)}</select></label>
              </div>
              <div>
                <h3>Thông tin bổ sung</h3>
                <label className={lop_tu_dong_dien('healthInsuranceNumber')}>Mã thẻ Bảo hiểm y tế<input value={form.profile.healthInsuranceNumber} onChange={(event) => cap_nhat_ho_so('healthInsuranceNumber', event.target.value)} placeholder="Mã số trên thẻ Bảo hiểm y tế" /></label>
                <label className={fieldErrors['profile.province'] ? `${lop_tu_dong_dien('province')} has-field-error` : lop_tu_dong_dien('province')}>Tỉnh / Thành phố <span>*</span><select value={form.profile.province} onChange={(event) => cap_nhat_ho_so('province', event.target.value)}><option value="">Chọn tỉnh/thành phố của bạn</option>{addressData.map((province) => <option key={province.name}>{province.name}</option>)}</select>{fieldErrors['profile.province'] && <small className="field-error">{fieldErrors['profile.province']}</small>}</label>
                <label className={lop_tu_dong_dien('district')}>Phường/Xã/Khu vực<select value={form.profile.district} onChange={(event) => cap_nhat_ho_so('district', event.target.value)}><option value="">Chọn phường/xã/khu vực</option>{(selectedProvince?.districts || []).map((district) => <option key={district.name}>{district.name}</option>)}</select></label>
                <label className={lop_tu_dong_dien('ward')}>Tổ/Ấp/Đơn vị chi tiết<select value={form.profile.ward} onChange={(event) => cap_nhat_ho_so('ward', event.target.value)}><option value="">Chọn thông tin chi tiết</option>{(selectedDistrict?.wards || []).map((ward) => <option key={ward}>{ward}</option>)}</select></label>
                <label className={fieldErrors['profile.address'] ? `${lop_tu_dong_dien('address')} has-field-error` : lop_tu_dong_dien('address')}>Địa chỉ cụ thể <span>*</span><input value={form.profile.address} onChange={(event) => cap_nhat_ho_so('address', event.target.value)} placeholder="Số nhà, tên đường" />{fieldErrors['profile.address'] && <small className="field-error">{fieldErrors['profile.address']}</small>}</label>
                <label>Mã giới thiệu<input value={form.profile.referralCode} onChange={(event) => cap_nhat_ho_so('referralCode', event.target.value)} placeholder="Mã của người giới thiệu" /></label>
                <label>Nghề nghiệp<select value={form.profile.occupation} onChange={(event) => cap_nhat_ho_so('occupation', event.target.value)}><option value="">Chọn nghề nghiệp</option>{occupations.map((item) => <option key={item}>{item}</option>)}</select></label>
              </div>
            </div>
            {message && <div className="auth-message">{message}</div>}
            <button className="finish-profile-button" type="submit" disabled={!canFinishProfile}>
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
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                bat_dau_dang_ky();
              }}
            >
              <label>
                Email
                <input className={fieldErrors.email ? 'has-error' : ''} type="text" inputMode="email" value={form.email} onChange={(event) => cap_nhat_form('email', event.target.value)} placeholder="Nhập email để nhận OTP" />
                {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
              </label>
              {message && <div className="auth-message">{message}</div>}
              <button type="submit" disabled={!canSubmitSignupEmail}>{isLoading ? 'Đang gửi OTP...' : 'Đăng ký'}</button>
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

          <form onSubmit={handleSubmit} className="auth-form" autoComplete="off" noValidate>
            <label>
              Email
              <input
                autoComplete="email"
                name="midhealth_login_email"
                type="text"
                inputMode="email"
                value={form.email}
                onChange={(event) => cap_nhat_form('email', event.target.value)}
                placeholder="Email"
                className={fieldErrors.email ? 'has-error' : ''}
              />
              {fieldErrors.email && <small className="field-error">{fieldErrors.email}</small>}
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
                className={fieldErrors.password ? 'has-error' : ''}
              />
              {fieldErrors.password && <small className="field-error">{fieldErrors.password}</small>}
            </label>
            <div className="auth-row">
              <label className="checkbox-line">
                <input type="checkbox" checked={form.remember} onChange={(event) => cap_nhat_form('remember', event.target.checked)} />
                Ghi nhớ mật khẩu
              </label>
              <button className="link-button" type="button" onClick={handleResetPassword}>Quên mật khẩu?</button>
            </div>
            {message && <div className="auth-message">{message}</div>}
            <button type="submit" disabled={!canSubmitSignin}>{isLoading ? 'Đang xử lý...' : 'Đăng nhập'}</button>
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
