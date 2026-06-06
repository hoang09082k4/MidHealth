import { useEffect, useMemo, useState } from 'react';
import {
  chuan_hoa_bhyt,
  chuan_hoa_cmnd_cccd,
  chuan_hoa_so_dien_thoai,
  kiem_tra_bhyt,
  kiem_tra_ngay_sinh,
} from '../../data/du_lieu_ho_so';
import { createAppointment, listPatientProfiles, savePatientProfile } from '../../lib/appointments';
import { doctorImageName, doctorImagePath } from '../../lib/doctor_images';
import { useReferenceData } from '../../lib/reference_data';
import TrangPhieuKham, { PhieuKhamChiTiet, co_gia_tri, tao_dong_phieu_kham } from '../phieu_kham/phieu_kham_dien_tu';

const DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const DEFAULT_ADDRESS = '250 Đ. Nguyễn Xí, Bình Lợi Trung, Hồ Chí Minh';
const DAYS_PER_PAGE = 6;
const DAYS_LOOKAHEAD = 12;
const LAM_VIET_TRUNG_ADDRESS = 'Phòng mạch: 53 Phạm Hữu Chí, Phường 12, Quận 5, Hồ Chí Minh';

function todayValue() {
  const date = new Date();
  return toDateValue(date);
}

function currentMinuteKey() {
  const date = new Date();
  return `${toDateValue(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function toDateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toTimeValue(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function addDays(value, amount) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return toDateValue(date);
}

function formatDateDisplay(value) {
  const [year, month, day] = String(value).split('-');
  return `${day}/${month}/${year}`;
}

function formatDateLabel(value) {
  const date = new Date(`${value}T00:00:00`);
  return `${DAY_LABELS[date.getDay()]}, ${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addMinutes(time, minutes) {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date(2000, 0, 1, hour, minute + minutes);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function fallbackSlots(doctorId, fromDate, days = DAYS_LOOKAHEAD) {
  const slots = [];
  Array.from({ length: days }).forEach((_, index) => {
    const date = addDays(fromDate, index);
    const seed = `${doctorId || 'doctor'}-${date}`.split('').reduce((total, char) => total + char.charCodeAt(0), 0);
    const base = seed % 2 === 0
      ? ['07:30', '08:30', '09:30', '10:30', '13:30', '14:30', '15:30', '16:30']
      : ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
    base.slice(0, 10).forEach((start) => {
      const end = addMinutes(start, 15);
      slots.push({
        id: `fallback-${doctorId}-${date}-${start}`,
        doctorId,
        date,
        startTime: start,
        endTime: end,
        label: `${start}-${end}`,
        session: start < '12:00' ? 'morning' : start < '17:30' ? 'afternoon' : 'evening',
      });
    });
  });
  return slots;
}

function isFutureSlot(slot, now = new Date()) {
  const currentDate = toDateValue(now);
  if (slot.date < currentDate) return false;
  if (slot.date > currentDate) return true;
  return slot.startTime > toTimeValue(now);
}

function groupSlots(slots, now = new Date()) {
  const groups = new Map();
  slots.filter((slot) => isFutureSlot(slot, now)).forEach((slot) => {
    const current = groups.get(slot.date) || {
      value: slot.date,
      label: formatDateLabel(slot.date),
      display: formatDateDisplay(slot.date),
      slots: [],
    };
    if (!current.slots.some((item) => item.label === slot.label)) current.slots.push(slot);
    groups.set(slot.date, current);
  });
  return Array.from(groups.values())
    .sort((a, b) => a.value.localeCompare(b.value))
    .map((day) => ({ ...day, slots: day.slots.sort((a, b) => a.startTime.localeCompare(b.startTime)).slice(0, 12) }));
}

function anh_bac_si(doctor) {
  return doctorImagePath(doctor);
}

function lay_ten_tat(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'BN';
  return words.slice(-2).map((word) => word[0]).join('').toUpperCase();
}

function shortDoctorName(name = '') {
  return name.replace(/^BS\. CK2\s|^PGS\. TS\. BS\s|^BS\.CKII\s/, '');
}

function doctorAddress(doctor) {
  return doctor?.name?.includes('Lâm Việt Trung') ? LAM_VIET_TRUNG_ADDRESS : DEFAULT_ADDRESS;
}

function cleanNoticeText(value = '') {
  return String(value).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}

function dia_chi_day_du(profile) {
  return [profile.address, profile.ward, profile.district, profile.province].filter(Boolean).join(', ') || 'Chưa cập nhật';
}

function ma_benh_nhan(profile) {
  if (profile.patientCode) return profile.patientCode;
  if (profile.id && profile.id !== 'local-default') return `YM${String(profile.id).replace(/\D/g, '').slice(0, 10).padEnd(10, '0')}`;
  return 'YM2600000527';
}

function patientProfileKey(profile) {
  return profile?.id || profile?.phone || profile?.name || 'local-default';
}

function defaultProfile(user) {
  return {
    id: '',
    name: '',
    phone: '',
    birthDate: '',
    gender: '',
    province: '',
    district: '',
    ward: '',
    address: '',
    citizenId: '',
    ethnicity: 'Kinh',
    job: '',
    insuranceCode: '',
    email: '',
    relationship: 'Tôi',
    isMain: true,
  };
}

function emptyProfile(user) {
  return {
    id: '',
    name: '',
    phone: '',
    birthDate: '',
    gender: '',
    province: '',
    district: '',
    ward: '',
    address: '',
    citizenId: '',
    ethnicity: 'Kinh',
    job: '',
    insuranceCode: '',
    email: '',
    relationship: 'Khác',
    isMain: false,
  };
}

function mapApiProfile(profile) {
  return {
    id: profile.id,
    name: profile.full_name || profile.fullName || profile.name || '',
    phone: profile.phone || '',
    birthDate: profile.birthDate || (profile.date_of_birth ? formatDateDisplay(profile.date_of_birth) : ''),
    gender: profile.gender === 'female' ? 'Nữ' : profile.gender === 'male' ? 'Nam' : profile.gender || 'Nam',
    province: profile.province || '',
    district: profile.district || '',
    ward: profile.ward || '',
    address: profile.address || '',
    citizenId: profile.citizen_id || profile.citizenId || '',
    ethnicity: profile.ethnicity || 'Kinh',
    job: profile.occupation || profile.job || '',
    insuranceCode: profile.health_insurance_number || profile.insuranceCode || '',
    email: profile.email || '',
    relationship: profile.relationship || 'Tôi',
    isMain: Boolean(profile.is_primary || profile.isMain),
  };
}

function normalizeProfile(profile) {
  return {
    ...profile,
    phone: chuan_hoa_so_dien_thoai(profile.phone || ''),
    citizenId: chuan_hoa_cmnd_cccd(profile.citizenId || ''),
    insuranceCode: chuan_hoa_bhyt(profile.insuranceCode || ''),
  };
}

function validateProfile(profile) {
  const normalized = normalizeProfile(profile);
  const errors = {};
  if (!normalized.name.trim()) errors.name = 'Vui lòng nhập họ và tên';
  if (normalized.phone.length !== 10) errors.phone = 'Số điện thoại cần đủ 10 số';
  if (!kiem_tra_ngay_sinh(normalized.birthDate)) errors.birthDate = 'Ngày sinh cần đúng dd/mm/yyyy';
  if (!normalized.gender) errors.gender = 'Vui lòng chọn giới tính';
  if (!normalized.address.trim()) errors.address = 'Vui lòng nhập địa chỉ cụ thể';
  if (!normalized.relationship) errors.relationship = 'Vui lòng chọn mối quan hệ';
  if (normalized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) errors.email = 'Email không hợp lệ';
  if (normalized.insuranceCode && !kiem_tra_bhyt(normalized.insuranceCode)) errors.insuranceCode = 'Mã BHYT không hợp lệ';
  return { normalized, errors };
}

function luu_lich_kham(appointment) {
  const current = JSON.parse(localStorage.getItem('midhealth_appointments') || '[]');
  localStorage.setItem('midhealth_appointments', JSON.stringify([
    appointment,
    ...current.filter((item) => (item.id || item.ticket) !== (appointment.id || appointment.ticket)),
  ]));
}

function tai_anh_phieu(appointment) {
  const { bookingRows, patientRows } = tao_dong_phieu_kham(appointment);
  const rows = [...bookingRows, ...patientRows].filter((row) => co_gia_tri(row.value));
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = Math.max(560, 190 + rows.length * 38);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#176bdd';
  ctx.font = 'bold 28px Arial';
  ctx.fillText('MidHealth - Phiếu khám điện tử', 40, 60);
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 20px Arial';
  ctx.fillText(appointment.doctorShortName || appointment.doctorName, 40, 105);
  ctx.font = '16px Arial';
  rows.forEach((row, index) => {
    const y = 155 + index * 38;
    ctx.fillStyle = '#64748b';
    ctx.fillText(row.label, 40, y);
    ctx.fillStyle = row.highlight ? '#16a34a' : '#111827';
    ctx.fillText(String(row.value), 300, y);
  });
  const link = document.createElement('a');
  link.download = `${appointment.appointmentCode || 'phieu-kham-dien-tu'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function Field({ label, name, value, required, placeholder, error, onChange }) {
  return (
    <label className={error ? 'doctor-profile-field has-error' : 'doctor-profile-field'}>
      <span>{label}{required && <b> *</b>}</span>
      <input name={name} value={value || ''} placeholder={placeholder} onChange={onChange} />
      {error && <small>{error}</small>}
    </label>
  );
}

function SelectField({ label, name, value, required, placeholder, error, children, onChange }) {
  return (
    <label className={error ? 'doctor-profile-field has-error' : 'doctor-profile-field'}>
      <span>{label}{required && <b> *</b>}</span>
      <select className={value ? 'has-value' : ''} name={name} value={value || ''} onChange={onChange}>
        <option value="">{placeholder}</option>
        {children}
      </select>
      {error && <small>{error}</small>}
    </label>
  );
}

function ProfileModal({ mode, profile, errors, isSaving, onClose, onChange, onSave }) {
  const { addressData, ethnicGroups, occupations } = useReferenceData();
  const selectedProvince = addressData.find((item) => item.name === profile.province);
  const selectedDistrict = selectedProvince?.districts.find((item) => item.name === profile.district);
  const canSave = Boolean(
    String(profile.name || '').trim()
    && String(profile.phone || '').trim()
    && String(profile.birthDate || '').trim()
    && profile.gender
    && String(profile.address || '').trim()
    && (mode !== 'add' || profile.relationship)
  );

  return (
    <div className="doctor-modal-backdrop">
      <article className="doctor-profile-modal">
        <header>
          <h2>{mode === 'add' ? 'Thêm hồ sơ mới' : 'Chỉnh sửa hồ sơ'}</h2>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <form className="doctor-profile-form" onSubmit={onSave}>
          <Field label="Họ và tên" name="name" value={profile.name} required placeholder="Họ và tên" error={errors.name} onChange={onChange} />
          <Field label="Số điện thoại" name="phone" value={profile.phone} required placeholder="Số điện thoại" error={errors.phone} onChange={onChange} />
          <Field label="Ngày sinh" name="birthDate" value={profile.birthDate} required placeholder="dd/mm/yyyy" error={errors.birthDate} onChange={onChange} />
          <div className={errors.gender ? 'doctor-profile-radio has-error' : 'doctor-profile-radio'}>
            <span>Giới tính <b>*</b></span>
            {['Nam', 'Nữ'].map((gender) => (
              <label key={gender}>
                <input checked={profile.gender === gender} name="gender" type="radio" value={gender} onChange={onChange} />
                {gender}
              </label>
            ))}
            {errors.gender && <small>{errors.gender}</small>}
          </div>
          <SelectField label="Tỉnh / Thành phố" name="province" value={profile.province} placeholder="Chọn tỉnh / thành phố" onChange={onChange}>
            {addressData.map((province) => <option key={province.name}>{province.name}</option>)}
          </SelectField>
          <SelectField label="Quận / Huyện" name="district" value={profile.district} placeholder="Chọn quận / huyện" onChange={onChange}>
            {(selectedProvince?.districts || []).map((district) => <option key={district.name}>{district.name}</option>)}
          </SelectField>
          <SelectField label="Phường / Xã" name="ward" value={profile.ward} placeholder="Chọn phường / xã" onChange={onChange}>
            {(selectedDistrict?.wards || []).map((ward) => <option key={ward}>{ward}</option>)}
          </SelectField>
          <Field label="Địa chỉ cụ thể" name="address" value={profile.address} required placeholder="Số nhà, tên đường" error={errors.address} onChange={onChange} />
          <Field label="Số CMND/CCCD" name="citizenId" value={profile.citizenId} placeholder="Số CMND hoặc CCCD" onChange={onChange} />
          <SelectField label="Dân tộc" name="ethnicity" value={profile.ethnicity} placeholder="Chọn dân tộc" onChange={onChange}>
            {ethnicGroups.map((item) => <option key={item}>{item}</option>)}
          </SelectField>
          <SelectField label="Nghề nghiệp" name="job" value={profile.job} placeholder="Chọn nghề nghiệp" onChange={onChange}>
            {occupations.map((item) => <option key={item}>{item}</option>)}
          </SelectField>
          <Field label="Mã thẻ BHYT" name="insuranceCode" value={profile.insuranceCode} placeholder="Mã số trên thẻ BHYT" error={errors.insuranceCode} onChange={onChange} />
          <Field label="Email" name="email" value={profile.email} placeholder="Địa chỉ email của bạn" error={errors.email} onChange={onChange} />
          {mode === 'add' && (
            <div className={errors.relationship ? 'doctor-profile-radio relation has-error' : 'doctor-profile-radio relation'}>
              <span>Mối quan hệ <b>*</b></span>
              {['Cha', 'Mẹ', 'Con', 'Chồng', 'Vợ', 'Khác'].map((relationship) => (
                <label key={relationship}>
                  <input checked={profile.relationship === relationship} name="relationship" type="radio" value={relationship} onChange={onChange} />
                  {relationship}
                </label>
              ))}
              {errors.relationship && <small>{errors.relationship}</small>}
            </div>
          )}
          {errors.form && <p className="doctor-profile-form-error">{errors.form}</p>}
        </form>
        <footer>
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="button" disabled={isSaving || !canSave} onClick={onSave}>{mode === 'add' ? 'Thêm hồ sơ mới' : 'Lưu chỉnh sửa'}</button>
        </footer>
      </article>
    </div>
  );
}

function TrangDatLichBacSi({ doctor, initialScreen = 'detail', user, onBackHome, onScreenChange, onSignOut }) {
  const [screen, setScreen] = useState(initialScreen);
  const [rangeStart, setRangeStart] = useState(todayValue());
  const [rawSlots, setRawSlots] = useState([]);
  const [isSlotLoading, setIsSlotLoading] = useState(false);
  const [slotMessage, setSlotMessage] = useState('');
  const [clockKey, setClockKey] = useState(() => currentMinuteKey());
  const dates = useMemo(() => groupSlots(rawSlots, new Date()).slice(0, DAYS_PER_PAGE), [rawSlots, clockKey]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [quickBookingOpen, setQuickBookingOpen] = useState(true);
  const [patientSectionOpen, setPatientSectionOpen] = useState(true);
  const [bookingInfoOpen, setBookingInfoOpen] = useState(true);
  const [showMoreSlots, setShowMoreSlots] = useState(false);
  const [profiles, setProfiles] = useState(() => [defaultProfile(user)]);
  const [selectedPatient, setSelectedPatient] = useState(() => defaultProfile(user));
  const [profileDraft, setProfileDraft] = useState(null);
  const [profileMode, setProfileMode] = useState('');
  const [profileErrors, setProfileErrors] = useState({});
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appointment, setAppointment] = useState(null);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [expandedPatientId, setExpandedPatientId] = useState(null);
  const [showAddProfileMenu, setShowAddProfileMenu] = useState(false);

  const notice = cleanNoticeText(doctor.notice || doctor.unavailable_note || '');
  const currentSlots = selectedDate?.slots || [];
  const visibleSlots = showMoreSlots ? currentSlots : currentSlots.slice(0, 8);

  useEffect(() => {
    onScreenChange?.(screen);
  }, [screen]);

  useEffect(() => {
    setScreen(initialScreen);
  }, [doctor.id, initialScreen]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockKey(currentMinuteKey()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setIsSlotLoading(false);
    setSlotMessage('');
    setRawSlots(fallbackSlots(doctor.id, rangeStart));
  }, [doctor.id, rangeStart]);

  useEffect(() => {
    if (!dates.length) {
      setSelectedDate(null);
      setSelectedTime(null);
      return;
    }
    setSelectedDate((current) => (current && dates.some((date) => date.value === current.value) ? current : dates[0]));
    setSelectedTime((current) => {
      if (!current) return current;
      const stillAvailable = dates.some((date) => date.slots.some((slot) => slot.id === current.id));
      return stillAvailable ? current : null;
    });
    setShowMoreSlots(false);
  }, [dates]);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    listPatientProfiles(user)
      .then((items) => {
        if (!isMounted) return;
        const nextProfiles = items.length ? items.map(mapApiProfile) : [defaultProfile(user)];
        setProfiles(nextProfiles);
        setSelectedPatient((current) => (
          current?.id
            ? nextProfiles.find((item) => item.id === current.id) || current
            : nextProfiles[0]
        ));
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [user]);

  const chooseDate = (date) => {
    setSelectedDate(date);
    setSelectedTime((current) => (current?.date === date.value ? current : null));
    setShowMoreSlots(false);
  };

  const chooseSlot = (slot) => {
    setSelectedTime(slot);
    setEditingSchedule(false);
    setPatientSectionOpen(true);
    setExpandedPatientId(null);
    setMessage('');
  };

  const togglePatientSection = () => {
    setPatientSectionOpen((current) => !current);
  };

  const changeProfileDraft = (event) => {
    const { name, value } = event.target;
    setProfileDraft((current) => {
      const next = { ...current, [name]: value };
      if (name === 'province') {
        next.district = '';
        next.ward = '';
      }
      if (name === 'district') next.ward = '';
      if (name === 'phone') next.phone = chuan_hoa_so_dien_thoai(value);
      if (name === 'citizenId') next.citizenId = chuan_hoa_cmnd_cccd(value);
      if (name === 'insuranceCode') next.insuranceCode = chuan_hoa_bhyt(value);
      return next;
    });
  };

  const openAddProfile = () => {
    setShowAddProfileMenu(false);
    setProfileMode('add');
    setProfileDraft(emptyProfile(user));
    setProfileErrors({});
  };

  const openEditProfile = (profile) => {
    setShowAddProfileMenu(false);
    setProfileMode('edit');
    setProfileDraft({ ...profile });
    setProfileErrors({});
  };

  const saveProfile = async (event) => {
    event?.preventDefault();
    const { normalized, errors } = validateProfile(profileDraft);
    setProfileErrors(errors);
    if (Object.keys(errors).length) return;

    if (!user) {
      setMessage('Bạn cần đăng nhập để lưu hồ sơ bệnh nhân.');
      return;
    }

    setIsProfileSaving(true);
    try {
      const saved = await savePatientProfile(user, {
        ...normalized,
        fullName: normalized.name,
        occupation: normalized.job,
        healthInsuranceNumber: normalized.insuranceCode,
      });
      const nextProfile = mapApiProfile(saved);
      setProfiles((current) => {
        const exists = current.some((item) => item.id === nextProfile.id);
        return exists ? current.map((item) => (item.id === nextProfile.id ? nextProfile : item)) : [nextProfile, ...current];
      });
      setSelectedPatient(nextProfile);
      setExpandedPatientId(patientProfileKey(nextProfile));
      setProfileMode('');
      setProfileDraft(null);
    } catch (error) {
      setProfileErrors({ form: error.message || 'Không thể lưu hồ sơ.' });
    } finally {
      setIsProfileSaving(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedDate || !selectedTime) {
      setMessage('Vui lòng chọn ngày và khung giờ khám.');
      setEditingSchedule(true);
      return;
    }
    if (!selectedPatient) {
      setMessage('Vui lòng chọn hồ sơ bệnh nhân.');
      return;
    }

    setIsLoading(true);
    setMessage('');
    try {
      const nextAppointment = await createAppointment(user, {
        type: 'doctor',
        doctorId: doctor.id,
        doctor_id: doctor.id,
        appointmentSlotId: selectedTime.id,
        appointment_slot_id: selectedTime.id,
        doctorName: doctor.name,
        doctorShortName: shortDoctorName(doctor.name),
        doctorImage: doctorImageName(doctor),
        department: doctor.specialty,
        specialty: doctor.specialty,
        facilityName: doctor.workplace,
        clinic: doctor.workplace,
        workplace: doctor.workplace,
        hospitalName: doctor.workplace,
        address: doctorAddress(doctor),
        appointmentDate: selectedDate.value,
        dateDisplay: selectedDate.display,
        dateValue: selectedDate.value,
        appointmentTime: selectedTime.label,
        time: selectedTime.label,
        startTime: selectedTime.startTime,
        endTime: selectedTime.endTime,
        status: 'confirmed',
        patient_id: selectedPatient.id,
        patientName: selectedPatient.name,
        birthDate: selectedPatient.birthDate,
        gender: selectedPatient.gender,
        phone: selectedPatient.phone,
        patientAddress: dia_chi_day_du(selectedPatient),
        patientProfile: selectedPatient,
        note,
        room: `Phòng khám ${doctor.specialty || 'bác sĩ'}`,
        attachments: attachedFiles.map((file) => file.name),
      });
      setAppointment(nextAppointment);
      luu_lich_kham(nextAppointment);
      setScreen('success');
    } catch (error) {
      setMessage(error.message || 'Có lỗi xảy ra khi đặt lịch.');
    } finally {
      setIsLoading(false);
    }
  };

  const addFiles = (fileList) => {
    const incomingFiles = Array.from(fileList || []);
    const validFiles = [];
    let error = '';

    incomingFiles.forEach((file) => {
      if (!['image/png', 'image/jpeg'].includes(file.type)) {
        error = 'Chỉ nhận file PNG hoặc JPG.';
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        error = 'Mỗi file tối đa 15MB.';
        return;
      }
      validFiles.push(file);
    });

    setAttachedFiles((current) => {
      const nextFiles = [...current, ...validFiles].slice(0, 5);
      if (current.length + validFiles.length > 5) error = 'Chỉ được đính kèm tối đa 5 file.';
      return nextFiles;
    });
    setUploadError(error);
  };

  const renderDoctorSummary = () => (
    <div className="booking-doctor-summary">
      <div className="doctor-avatar booking-avatar">
        <img src={anh_bac_si(doctor)} alt={doctor.name} />
      </div>
      <div>
        <h3>{shortDoctorName(doctor.name)}</h3>
        <p>{doctorAddress(doctor)}</p>
      </div>
    </div>
  );

  const renderNotice = () => notice && (
    <div className="doctor-unavailable-note">
      <strong>Lưu ý</strong>
      <p>{notice}</p>
    </div>
  );

  const openDoctorMap = () => {
    const address = doctorAddress(doctor).replace(/^Phòng mạch:\s*/i, '');
    window.open(`https://www.google.com/maps/search/${encodeURIComponent(address)}`, '_blank', 'noopener,noreferrer');
  };

  const renderDatePicker = () => (
    <section className="quick-booking-block compact">
      <div className="booking-date-row compact">
        <button className="round-arrow" type="button" disabled={rangeStart <= todayValue()} onClick={() => setRangeStart(addDays(rangeStart, -DAYS_PER_PAGE))}><i className="ui-chevron left" aria-hidden="true" /></button>
        {dates.map((date) => (
          <button className={selectedDate?.value === date.value ? 'active' : ''} key={date.value} type="button" onClick={() => chooseDate(date)}>
            <strong>{date.label}</strong>
            <span>{date.slots.length} khung giờ</span>
          </button>
        ))}
        <button className="round-arrow" type="button" onClick={() => setRangeStart(addDays(rangeStart, DAYS_PER_PAGE))}><i className="ui-chevron right" aria-hidden="true" /></button>
      </div>
      {isSlotLoading && <p className="slot-load-note">Đang tải lịch khám...</p>}
      {!isSlotLoading && slotMessage && <p className="slot-load-note">{slotMessage}</p>}
      {!isSlotLoading && dates.length === 0 && <p className="empty-slot-note">Hiện chưa có lịch khám phù hợp</p>}
      {selectedDate && (
        <>
          <div className="slot-title">{visibleSlots.some((slot) => slot.session === 'morning') ? 'Buổi sáng' : 'Khung giờ khả dụng'}</div>
          <div className="time-slot-grid compact">
            {visibleSlots.map((slot) => (
              <button className={selectedTime?.id === slot.id ? 'selected' : ''} key={slot.id} type="button" onClick={() => chooseSlot(slot)}>
                {slot.label}
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );

  const renderPatientCard = (profile) => {
    const profileKey = patientProfileKey(profile);
    const expanded = expandedPatientId === profileKey;
    const selected = patientProfileKey(selectedPatient) === profileKey;

    return (
      <article className={selected ? 'doctor-patient-card selected' : 'doctor-patient-card'} key={profileKey}>
        <button
          type="button"
          onClick={() => {
            setSelectedPatient(profile);
            setExpandedPatientId(expanded ? null : profileKey);
          }}
        >
          <div className="patient-avatar-wrap">
            <div className="patient-avatar">{lay_ten_tat(profile.name)}</div>
            {profile.relationship && <em>{profile.relationship}</em>}
          </div>
          <div>
            <strong>{profile.name}</strong>
            <p>{profile.birthDate || profile.phone}</p>
          </div>
          <i className={`ui-chevron ${expanded ? 'up' : 'down'}`} aria-hidden="true" />
        </button>
        {expanded && selected && (
          <div className="doctor-patient-detail">
            <div><span>Mã bệnh nhân</span><b>{ma_benh_nhan(profile)}</b></div>
            <div><span>Họ và tên</span><b>{profile.name}</b></div>
            <div><span>Giới tính</span><b>{profile.gender}</b></div>
            <div><span>Ngày sinh</span><b>{profile.birthDate}</b></div>
            <div><span>Số điện thoại</span><b>{profile.phone}</b></div>
            <div><span>Địa chỉ</span><b>{dia_chi_day_du(profile)}</b></div>
            <button type="button" onClick={() => openEditProfile(profile)}>Điều chỉnh</button>
          </div>
        )}
      </article>
    );
  };

  if (screen === 'account' && appointment) {
    return <TrangPhieuKham appointment={appointment} user={user} onLogout={onSignOut || onBackHome} />;
  }

  if (screen === 'success' && appointment) {
    return (
      <section className="booking-success-page">
        <article className="booking-success-card">
          <div className="success-check">✓</div>
          <h1>Đặt lịch thành công!</h1>
          <div className="success-ticket-head"><div><span>STT</span><strong>{appointment.number}</strong></div></div>
          <div className="success-doctor-row">
            <div className="doctor-avatar booking-avatar">
              <img src={anh_bac_si(doctor)} alt={doctor.name} />
            </div>
            <div><h3>{appointment.doctorShortName}</h3><p>{appointment.address}</p></div>
          </div>
          <PhieuKhamChiTiet appointment={appointment} />
          <div className="success-actions">
            <button type="button" onClick={() => setScreen('account')}>Xem phiếu khám điện tử</button>
            <button type="button" onClick={() => tai_anh_phieu(appointment)}>Lưu lại phiếu</button>
          </div>
        </article>
      </section>
    );
  }

  if (screen === 'booking') {
    return (
      <section className="booking-flow-page compact">
        <div className="booking-stepper">
          <span className={selectedTime ? 'done' : 'active'}>{selectedTime ? '✓' : '1'}</span>
          <p>Thời gian khám</p>
          {selectedTime && <><i /><span className="active">2</span><p>Bệnh nhân</p></>}
        </div>
        {renderNotice()}
        <div className="booking-flow-grid">
          <div className="booking-left-panel compact">
            <button
              className="booking-collapse-title clickable"
              type="button"
              onClick={() => setEditingSchedule((current) => (selectedTime ? !current : true))}
            >
              <span>1</span> Ngày và giờ khám <i className={`ui-chevron ${!selectedTime || editingSchedule ? 'up' : 'down'}`} aria-hidden="true" />
            </button>
            {(!selectedTime || editingSchedule) && renderDatePicker()}

            {selectedTime && !editingSchedule && (
              <>
                <button
                  aria-expanded={patientSectionOpen}
                  aria-controls="doctor-patient-section"
                  className="booking-collapse-title clickable"
                  type="button"
                  onClick={togglePatientSection}
                >
                  <span>2</span> Hồ sơ bệnh nhân <i className={`ui-chevron ${patientSectionOpen ? 'up' : 'down'}`} aria-hidden="true" />
                </button>
                <div className="doctor-patient-section" hidden={!patientSectionOpen} id="doctor-patient-section">
                    <div className="doctor-patient-list">
                      {profiles.map((profile) => renderPatientCard(profile))}
                    </div>
                    <div className="doctor-add-profile-wrap">
                      <button className="doctor-add-profile" type="button" onClick={() => setShowAddProfileMenu((current) => !current)}>Thêm hồ sơ mới</button>
                      {showAddProfileMenu && (
                        <div className="doctor-add-profile-popover">
                          <button type="button" onClick={openAddProfile}>
                            <span>Chưa từng khám, tạo hồ sơ mới</span>
                            <b>⊕</b>
                          </button>
                        </div>
                      )}
                    </div>
                    <h3 className="optional-title">Thông tin bổ sung (không bắt buộc)</h3>
                    <label className="booking-note">
                      Ghi chú
                      <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Triệu chứng, thuốc đang dùng, tiền sử, ..." />
                    </label>
                    <strong className="attachment-title">Tập tin đính kèm ({attachedFiles.length}/5)</strong>
                    <label className="upload-box" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }}>
                      <input accept=".png,.jpg,.jpeg,image/png,image/jpeg" multiple type="file" onChange={(event) => addFiles(event.target.files)} />
                      <span><strong>Chọn tập tin</strong> hoặc kéo thả vào đây</span>
                      <small>.PNG, .JPG tối đa 15MB</small>
                    </label>
                    {uploadError && <p className="upload-error">{uploadError}</p>}
                </div>
              </>
            )}
          </div>
          <aside className="booking-side-card">
            <h2>
              <button className="section-toggle-button" type="button" onClick={() => setBookingInfoOpen((current) => !current)}>
                Thông tin đặt khám <i className={`ui-chevron ${bookingInfoOpen ? 'up' : 'down'}`} aria-hidden="true" />
              </button>
            </h2>
            {bookingInfoOpen && (
              <>
                {renderDoctorSummary()}
                {selectedTime && selectedDate && (
                  <dl>
                    <dt>Ngày khám</dt><dd>{selectedDate.display}</dd>
                    <dt>Khung giờ</dt><dd>{selectedTime.label}</dd>
                    <dt>Bệnh nhân</dt><dd>{selectedPatient?.name || '--'}</dd>
                  </dl>
                )}
                <button type="button" disabled={!selectedTime || editingSchedule || isLoading} onClick={handleConfirmBooking}>
                  {isLoading ? 'Đang đặt lịch...' : 'Đặt lịch'}
                </button>
                <p>Bằng cách nhấn nút xác nhận, bạn đã đồng ý với các điều khoản và điều kiện đặt khám</p>
                {message && <div className="booking-message">{message}</div>}
              </>
            )}
          </aside>
        </div>
        {profileMode && profileDraft && (
          <ProfileModal
            mode={profileMode}
            profile={profileDraft}
            errors={profileErrors}
            isSaving={isProfileSaving}
            onClose={() => setProfileMode('')}
            onChange={changeProfileDraft}
            onSave={saveProfile}
          />
        )}
      </section>
    );
  }

  return (
    <section className="doctor-detail-page compact">
      <div className="breadcrumb">Trang chủ <span>/</span> Bác sĩ</div>
      <article className="doctor-profile-card compact">
        <div className="doctor-avatar profile-avatar">
          <img src={anh_bac_si(doctor)} alt={doctor.name} />
        </div>
        <div className="doctor-profile-info">
          <button className="favorite-button" type="button">♡ Yêu thích</button>
          <h1>{doctor.name}</h1>
          <p><strong>💙 Bác sĩ</strong><span />26 năm kinh nghiệm</p>
          <dl>
            <dt>Chuyên khoa</dt><dd>{doctor.specialty}</dd>
            <dt>Chức vụ</dt><dd>Phó Giám Đốc {doctor.workplace}</dd>
            <dt>Nơi công tác</dt><dd>{doctor.workplace}</dd>
          </dl>
        </div>
        {renderNotice()}
        <div className="quick-booking-area">
          <h2>
            <button className="section-toggle-button" type="button" onClick={() => setQuickBookingOpen((current) => !current)}>
              Đặt khám nhanh <i className={`ui-chevron ${quickBookingOpen ? 'up' : 'down'}`} aria-hidden="true" />
            </button>
          </h2>
          {quickBookingOpen && renderDatePicker()}
        </div>
        <div className="sticky-booking-bar">
          <p>Hỗ trợ đặt khám<br /><strong>1900-2805</strong></p>
          <button type="button" disabled={!selectedTime} onClick={() => { setEditingSchedule(!selectedTime); setScreen('booking'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            ĐẶT KHÁM NGAY
          </button>
        </div>
      </article>
      <article className="doctor-info-content compact">
        <h2>Giới thiệu</h2>
        <p>{doctor.name} hiện đang công tác tại {doctor.workplace}. Bác sĩ trực tiếp thăm khám theo yêu cầu chất lượng cao và hỗ trợ theo dõi lịch khám rõ ràng.</p>
        <strong>Các dịch vụ của phòng khám {doctor.specialty}:</strong>
        <ul>
          <li>Khám và điều trị các bệnh lý chuyên khoa.</li>
          <li>Tư vấn sức khỏe, dinh dưỡng, chích ngừa và theo dõi phát triển.</li>
          <li>Xông khí dung và chăm sóc hô hấp.</li>
        </ul>
        <h2>Chuyên khám</h2>
        <div className="map-card">
          <h3>Địa chỉ</h3>
          <p>{doctorAddress(doctor)}</p>
          <button type="button" onClick={openDoctorMap}>🗺 Mở bản đồ</button>
        </div>
      </article>
    </section>
  );
}

export default TrangDatLichBacSi;
