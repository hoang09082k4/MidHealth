import { useClinic } from '../../lib/clinic';
﻿import { useEffect, useMemo, useRef, useState } from 'react';
import {
  chuan_hoa_bhyt,
  chuan_hoa_cmnd_cccd,
  chuan_hoa_so_dien_thoai,
  kiem_tra_bhyt,
  kiem_tra_ngay_sinh,
} from '../../lib/patient_profile';
import { createAppointment, createPayPalOrder, listDoctorSlots, listPatientProfiles, savePatientProfile } from '../../lib/appointments';
import { doctorImageName, doctorImagePath } from '../../lib/doctor_images';
import { useReferenceData } from '../../lib/reference_data';
import { rankAvailableSlots, hasEmergencyHint } from '../../lib/booking_recommendations';
import TrangPhieuKham, { PhieuKhamChiTiet, co_gia_tri, tao_dong_phieu_kham } from '../phieu_kham/phieu_kham_dien_tu';

const CANVAS_FONT = 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const DAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const DAYS_PER_PAGE = 6;
const DAYS_LOOKAHEAD = 12;

function todayValue() {
  return clinicNow().date;
}

function clinicNow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map(part => [part.type, part.value]));
  return { date: parts.year + '-' + parts.month + '-' + parts.day, time: parts.hour + ':' + parts.minute };
}
function currentMinuteKey() {
  const now = clinicNow();
  return now.date + 'T' + now.time;
}

function toDateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

function isFutureSlot(slot, now = new Date()) {
  const currentDate = clinicNow(now).date;
  if (slot.date < currentDate) return false;
  if (slot.date > currentDate) return true;
  return slot.startTime.slice(0, 5) > clinicNow(now).time;
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
    .map((day) => ({ ...day, slots: day.slots.sort((a, b) => a.startTime.localeCompare(b.startTime)) }));
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

function doctorAddress(doctor) { return doctor?.address || 'Địa chỉ đang được cập nhật'; }

function cleanNoticeText(value = '') {
  return String(value).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim();
}

function dia_chi_day_du(profile) {
  return [profile.address, profile.ward, profile.district, profile.province].filter(Boolean).join(', ') || 'Chưa cập nhật';
}

function ma_benh_nhan(profile) {
  return profile.patientCode || 'Cấp khi đặt khám';
}

function patientProfileKey(profile) {
  return profile?.id || profile?.phone || profile?.name || 'local-default';
}

function defaultProfile(user) {
  return {
    id: '',
    name: user?.displayName || '',
    phone: user?.phoneNumber || '',
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
    medicalHistory: '', bloodGroup: '', allergies: '',
    email: user?.email || '',
    relationship: 'Tôi',
    isMain: true,
  };
}

function emptyProfile() {
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
    medicalHistory: '', bloodGroup: '', allergies: '',
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
    gender: profile.gender === 'female' ? 'Nữ' : profile.gender === 'male' ? 'Nam' : profile.gender || '',
    province: profile.province || '',
    district: profile.district || '',
    ward: profile.ward || '',
    address: profile.address || '',
    citizenId: profile.citizen_id || profile.citizenId || '',
    ethnicity: profile.ethnicity || 'Kinh',
    job: profile.occupation || profile.job || '',
    insuranceCode: profile.health_insurance_number || profile.insuranceCode || '',
    medicalHistory: profile.medical_history || profile.medicalHistory || '',
    bloodGroup: profile.blood_group || profile.bloodGroup || '',
    allergies: profile.allergies || '',
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
  if (!normalized.relationship) errors.relationship = 'Vui lòng chọn mối quan hệ';
  if (normalized.citizenId && ![9, 12].includes(normalized.citizenId.length)) errors.citizenId = 'CMND/CCCD phải gồm 9 hoặc 12 số';
  if (normalized.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) errors.email = 'Email không hợp lệ';
  if (normalized.insuranceCode && !kiem_tra_bhyt(normalized.insuranceCode)) errors.insuranceCode = 'Mã BHYT không hợp lệ';
  return { normalized, errors };
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
  ctx.font = `bold 28px ${CANVAS_FONT}`;
  ctx.fillText('MidHealth - Phiếu khám điện tử', 40, 60);
  ctx.fillStyle = '#111827';
  ctx.font = `bold 20px ${CANVAS_FONT}`;
  ctx.fillText(appointment.doctorShortName || appointment.doctorName, 40, 105);
  ctx.font = `16px ${CANVAS_FONT}`;
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
  const selectedProvince = addressData.find((item) => item.name === profile.province || item.aliases?.includes(profile.province));
  const canSave = Boolean(
    String(profile.name || '').trim()
    && String(profile.phone || '').trim()
    && String(profile.birthDate || '').trim()
    && profile.gender
    && (mode !== 'add' || profile.relationship)
  );

  return (
    <div className="doctor-modal-backdrop">
      <article className="doctor-profile-modal" role="dialog" aria-modal="true" aria-labelledby="doctor-profile-modal-title">
        <header>
          <h2 id="doctor-profile-modal-title">{mode === 'add' ? 'Thêm hồ sơ mới' : 'Chỉnh sửa hồ sơ'}</h2>
          <button type="button" aria-label="Đóng hồ sơ bệnh nhân" onClick={onClose}>×</button>
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
          <SelectField label="Phường/Xã/Khu vực" name="district" value={profile.district} placeholder="Chọn phường/xã/khu vực" onChange={onChange}>
            {(selectedProvince?.districts || []).map((district) => <option key={district.name}>{district.name}</option>)}
          </SelectField>
          <Field label="Tổ/Ấp/Đơn vị chi tiết" name="ward" value={profile.ward} placeholder="Tổ, ấp hoặc khu vực (không bắt buộc)" onChange={onChange} />
          <Field label="Địa chỉ cụ thể (không bắt buộc)" name="address" value={profile.address} placeholder="Số nhà, tên đường" error={errors.address} onChange={onChange} />
          <Field label="Số CMND/CCCD" name="citizenId" value={profile.citizenId} placeholder="Số CMND hoặc CCCD" error={errors.citizenId} onChange={onChange} />
          <SelectField label="Dân tộc" name="ethnicity" value={profile.ethnicity} placeholder="Chọn dân tộc" onChange={onChange}>
            {ethnicGroups.map((item) => <option key={item}>{item}</option>)}
          </SelectField>
          <SelectField label="Nghề nghiệp" name="job" value={profile.job} placeholder="Chọn nghề nghiệp" onChange={onChange}>
            {occupations.map((item) => <option key={item}>{item}</option>)}
          </SelectField>
          <Field label="Mã thẻ BHYT" name="insuranceCode" value={profile.insuranceCode} placeholder="Mã số trên thẻ BHYT" error={errors.insuranceCode} onChange={onChange} />
          <SelectField label="Nhóm máu" name="bloodGroup" value={profile.bloodGroup || ''} placeholder="Chưa xác định" onChange={onChange}>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(group => <option key={group}>{group}</option>)}</SelectField>
          <Field label="Tiền sử bệnh" name="medicalHistory" value={profile.medicalHistory || ''} placeholder="Bệnh đã mắc hoặc đang điều trị" onChange={onChange} />
          <Field label="Dị ứng" name="allergies" value={profile.allergies || ''} placeholder="Thuốc, thức ăn hoặc chất gây dị ứng" onChange={onChange} />
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

function TrangDatLichBacSi({ doctor, services = [], initialScreen = 'detail', initialReason = '', user, onBackHome, onScreenChange, onSignOut, onOpenAuth }) {
  const clinic = useClinic();
  const specialtyFee = ((doctor.specialtyId && services.find(service => service.specialtyId === doctor.specialtyId))
    || services.find(service => service.name === doctor.specialty))?.fee;
  const consultationFee = doctor.consultationFee ?? specialtyFee;
  const [reason, setReason] = useState(initialReason);
  const [screen, setScreen] = useState(initialScreen === 'success' ? 'detail' : initialScreen);
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
  const [profilesLoading, setProfilesLoading] = useState(Boolean(user));
  const [profilesError, setProfilesError] = useState('');
  const [profilesReload, setProfilesReload] = useState(0);
  const [profileDraft, setProfileDraft] = useState(null);
  const [profileMode, setProfileMode] = useState('');
  const [profileErrors, setProfileErrors] = useState({});
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const profileSaveInFlightRef = useRef(false);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appointment, setAppointment] = useState(null);
  const [expandedPatientId, setExpandedPatientId] = useState(null);
  const [showAddProfileMenu, setShowAddProfileMenu] = useState(false);

  const notice = cleanNoticeText(doctor.notice || doctor.unavailable_note || '');
  const currentSlots = selectedDate?.slots || [];
  const visibleSlots = showMoreSlots ? currentSlots : currentSlots.slice(0, 8);
  const recommendedSlots = useMemo(() => rankAvailableSlots(currentSlots), [currentSlots]);
  const recommendedSlotId = recommendedSlots[0]?.id;

  useEffect(() => {
    onScreenChange?.(screen);
  }, [screen]);

  useEffect(() => {
    setScreen(initialScreen === 'success' && !appointment ? 'detail' : initialScreen);
  }, [doctor.id, initialScreen]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockKey(currentMinuteKey()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsSlotLoading(true);
    setSlotMessage('');
    setRawSlots([]);

    if (doctor.bookable === false) { setIsSlotLoading(false); setSlotMessage('Phòng khám chưa mở lịch trực tuyến cho hồ sơ này. Vui lòng xem lại sau.'); return; }
    listDoctorSlots(doctor.id, { fromDate: rangeStart, days: DAYS_LOOKAHEAD })
      .then((slots) => {
        if (!isMounted) return;
        setRawSlots(Array.isArray(slots) ? slots : []);
        setSlotMessage((slots || []).length ? '' : 'Bác sĩ chưa mở khung giờ khám cho giai đoạn này.');
      })
      .catch((error) => {
        if (!isMounted) return;
        setRawSlots([]);
        setSlotMessage(error.message || 'Không thể tải lịch khám của bác sĩ.');
      })
      .finally(() => {
        if (isMounted) setIsSlotLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [doctor.id, rangeStart]);

  useEffect(() => {
    if (!dates.length) {
      setSelectedDate(null);
      setSelectedTime(null);
      return;
    }
    setSelectedDate((current) => (dates.find(date => date.value === current?.value) || dates[0]));
    setSelectedTime((current) => {
      if (!current) return current;
      const stillAvailable = dates.some((date) => date.slots.some((slot) => slot.id === current.id && slot.status !== 'full'));
      return stillAvailable ? current : null;
    });
    setShowMoreSlots(false);
  }, [dates]);

  useEffect(() => {
    setProfiles([]);
    setSelectedPatient(null);
    setProfilesError('');
    if (!user) { setProfilesLoading(false); return; }
    setProfilesLoading(true);
    let isMounted = true;
    listPatientProfiles(user)
      .then((items) => {
        if (!isMounted) return;
        const nextProfiles = items.map(mapApiProfile);
        setProfiles(nextProfiles);
        setSelectedPatient((current) => (
          current?.id
            ? nextProfiles.find((item) => item.id === current.id) || nextProfiles[0]
            : nextProfiles[0] || null
        ));
      })
      .catch(error => { if (isMounted) setProfilesError(error.message || 'Không thể tải hồ sơ bệnh nhân.'); })
      .finally(() => { if (isMounted) setProfilesLoading(false); });
    return () => {
      isMounted = false;
    };
  }, [user, profilesReload]);

  const chooseDate = (date) => {
    setSelectedDate(date);
    setSelectedTime((current) => (current?.date === date.value ? current : null));
    setShowMoreSlots(false);
  };

  const chooseSlot = (slot) => {
    if (slot.status === 'full') return;
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
    setProfileDraft(profiles.length ? emptyProfile() : defaultProfile(user));
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
    if (profileSaveInFlightRef.current) return;
    const { normalized, errors } = validateProfile(profileDraft);
    setProfileErrors(errors);
    if (Object.keys(errors).length) return;

    if (!user) {
      setProfileErrors({ form: 'Bạn cần đăng nhập để lưu hồ sơ bệnh nhân.' });
      return;
    }

    profileSaveInFlightRef.current = true;
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
        return exists ? current.map((item) => (item.id === nextProfile.id ? nextProfile : item)) : [nextProfile, ...current.filter(item => item.id)];
      });
      setSelectedPatient(nextProfile);
      setExpandedPatientId(patientProfileKey(nextProfile));
      setProfileMode('');
      setProfileDraft(null);
    } catch (error) {
      setProfileErrors({ form: error.message || 'Không thể lưu hồ sơ.' });
    } finally {
      profileSaveInFlightRef.current = false;
      setIsProfileSaving(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!user) { onOpenAuth?.(); return; }
    if (isLoading) return;
    if (profilesLoading || profilesError) return;
    if (!selectedDate || !selectedTime) {
      setMessage('Vui lòng chọn ngày và khung giờ khám.');
      setEditingSchedule(true);
      return;
    }
    if (!selectedPatient) {
      setMessage('Vui lòng chọn hồ sơ bệnh nhân.');
      return;
    }

    const validation = validateProfile(selectedPatient);
    if (Object.keys(validation.errors).length) { openEditProfile(selectedPatient); setProfileErrors(validation.errors); return; }
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
        facilityName: clinic.name,
        clinic: clinic.name,
        workplace: clinic.name,
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
        reason,
        note,
        room: `Phòng khám ${doctor.specialty || 'bác sĩ'}`,
      });
      setAppointment(nextAppointment);
      setScreen('success');
      if (Number(nextAppointment.depositAmount) > 0) {
        try {
          const order = await createPayPalOrder(user, nextAppointment.id);
          if (!order?.approvalUrl) throw new Error('Cổng thanh toán chưa trả về liên kết PayPal.');
          window.location.assign(order.approvalUrl);
        } catch (paymentError) {
          setMessage(`Lịch đang được giữ tạm thời. ${paymentError.message || 'Vui lòng thanh toán lại từ phiếu khám.'}`);
        }
      }
    } catch (error) {
      setMessage(error.message || 'Có lỗi xảy ra khi đặt lịch.');
      if (error.status === 409) {
        setSelectedTime(null);
        setEditingSchedule(true);
        try {
          const freshSlots = await listDoctorSlots(doctor.id, { fromDate: rangeStart, days: DAYS_LOOKAHEAD });
          setRawSlots(Array.isArray(freshSlots) ? freshSlots : []);
        } catch {
          setSlotMessage('Không thể cập nhật khung giờ. Vui lòng tải lại trang trước khi đặt tiếp.');
        }
      }
    } finally {
      setIsLoading(false);
    }
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
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank', 'noopener,noreferrer');
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
          <div className="slot-title">Khung giờ khám (GMT+7){recommendedSlotId && <span className="slot-recommendation-note"> · Gợi ý: giờ còn nhiều chỗ hơn</span>}</div>
          <div className="time-slot-grid compact">
            {visibleSlots.map((slot) => (
              <button className={`${selectedTime?.id === slot.id ? 'selected' : ''} ${slot.id === recommendedSlotId ? 'recommended' : ''}`} key={slot.id} type="button" disabled={slot.status === 'full'} onClick={() => chooseSlot(slot)}>
                {slot.label}{slot.status === 'full' ? ' · Hết chỗ' : slot.id === recommendedSlotId ? ' · Gợi ý' : ''}
              </button>
            ))}
          </div>
          {currentSlots.length > 8 && <button className="clinic-secondary" type="button" onClick={() => setShowMoreSlots(current => !current)}>{showMoreSlots ? 'Thu gọn khung giờ' : `Xem tất cả ${currentSlots.length} khung giờ`}</button>}
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
            <strong>{profile.name || 'Chưa có hồ sơ bệnh nhân'}</strong>
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
          <div className="success-check" aria-hidden="true">{appointment.rawStatus === 'pending' ? '…' : '✓'}</div>
          <h1>{appointment.rawStatus === 'pending' ? 'Chờ thanh toán tiền cọc' : 'Đặt lịch thành công!'}</h1>
          {appointment.rawStatus === 'pending' && <p>Cọc cần thanh toán: <strong>{Number(appointment.depositAmount || 0).toLocaleString('vi-VN')} ₫</strong>. Lịch chỉ được xác nhận sau khi PayPal báo thanh toán thành công.</p>}
          {message && <div className="booking-message" role="alert">{message}</div>}
          {appointment.rawStatus !== 'pending' && <p>Vui lòng đến trước giờ khám khoảng 15 phút, mang giấy tờ định danh và cung cấp họ tên, ngày sinh cho quầy tiếp nhận. Nếu dự kiến đến trễ, hãy liên hệ phòng khám.</p>}
          {appointment.number && <div className="success-ticket-head"><div><span>STT</span><strong>{appointment.number}</strong></div></div>}
          <div className="success-doctor-row">
            <div className="doctor-avatar booking-avatar">
              <img src={anh_bac_si(doctor)} alt={doctor.name} />
            </div>
            <div><h3>{appointment.doctorShortName}</h3><p>{appointment.address}</p></div>
          </div>
          <PhieuKhamChiTiet appointment={appointment} />
          <div className="success-actions">
            {appointment.rawStatus === 'pending' && <button type="button" onClick={async () => {
              try {
                const order = await createPayPalOrder(user, appointment.id);
                if (!order?.approvalUrl) throw new Error('Cổng thanh toán chưa trả về liên kết PayPal.');
                window.location.assign(order.approvalUrl);
              } catch (error) { setMessage(error.message || 'Không thể mở PayPal.'); }
            }}>Thanh toán cọc qua PayPal</button>}
            <button type="button" onClick={() => setScreen('account')}>Xem phiếu khám điện tử</button>
            {appointment.rawStatus !== 'pending' && <button type="button" onClick={() => tai_anh_phieu(appointment)}>Lưu lại phiếu</button>}
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

            {selectedTime && !editingSchedule && !user && <div className="clinic-empty"><p>Đăng nhập để chọn hồ sơ bệnh nhân và đặt lịch khám.</p><button className="clinic-primary" type="button" onClick={onOpenAuth}>Đăng nhập để tiếp tục</button></div>}
            {selectedTime && !editingSchedule && user && (
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
                    {profilesLoading && <p role="status">Đang tải hồ sơ bệnh nhân...</p>}
                    {profilesError && <div className="booking-message" role="alert">{profilesError} <button type="button" onClick={() => setProfilesReload((current) => current + 1)}>Thử tải lại</button></div>}
                    {!profilesLoading && !profilesError && !profiles.length && <p>Tài khoản đã được tạo nhưng hồ sơ đăng ký chưa được lưu. Vui lòng hoàn tất hồ sơ để đặt lịch.</p>}
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
                    <h3 className="optional-title">Thông tin khám</h3>
                    {selectedPatient && (selectedPatient.medicalHistory || selectedPatient.allergies || selectedPatient.bloodGroup) && <aside className="booking-patient-health-note">
                      <strong>Thông tin sức khỏe trong hồ sơ đã chọn</strong>
                      {selectedPatient.allergies && <p><b>Dị ứng bạn đã khai:</b> {selectedPatient.allergies}</p>}
                      {selectedPatient.medicalHistory && <p><b>Tiền sử bạn đã khai:</b> {selectedPatient.medicalHistory}</p>}
                      {selectedPatient.bloodGroup && <p><b>Nhóm máu đã ghi nhận:</b> {selectedPatient.bloodGroup}</p>}
                      <small>Hãy kiểm tra thông tin còn chính xác và báo trực tiếp với nhân viên y tế khi khám. Đây là thông tin do bạn cung cấp, không thay thế xác minh chuyên môn.</small>
                    </aside>}
                    <label className="booking-note">Triệu chứng hoặc lý do khám (không bắt buộc)<textarea maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Mô tả ngắn điều bạn muốn bác sĩ hỗ trợ; không cần tự kết luận bệnh" /></label>
                    {hasEmergencyHint(reason) && <p className="booking-emergency-note" role="alert">Thông tin bạn nhập có dấu hiệu cần được đánh giá khẩn cấp. Hãy gọi 115 hoặc đến cơ sở cấp cứu gần nhất, không chờ lịch khám thông thường.</p>}
                    <label className="booking-note">
                      Ghi chú (không bắt buộc)
                      <textarea maxLength={5000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Thông tin bạn muốn phòng khám lưu ý" />
                    </label>
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
                    <dt>Khung giờ</dt><dd>{selectedTime.label} (GMT+7)</dd><dt>Chi phí khám</dt><dd>{consultationFee != null ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(consultationFee) : 'Liên hệ phòng khám'}</dd>
                    <dt>Tiền cọc ({Number(clinic.depositPercent || 30)}%)</dt><dd>{consultationFee != null ? `${Math.ceil(Number(consultationFee) * Number(clinic.depositPercent || 30) / 100).toLocaleString('vi-VN')} ₫` : 'Được xác nhận trước khi thanh toán'}</dd>
                    <dt>Bệnh nhân</dt><dd>{selectedPatient?.name || '--'}</dd>
                  </dl>
                )}
                <button type="button" disabled={!selectedTime || editingSchedule || isLoading || (user && (profilesLoading || Boolean(profilesError) || !selectedPatient))} onClick={handleConfirmBooking}>
                  {isLoading ? 'Đang đặt lịch...' : user ? 'Tiếp tục thanh toán cọc' : 'Đăng nhập để đặt lịch'}
                </button>
                <p>Trước khi tiếp tục, vui lòng xem <a href="/thong-tin/dieu-khoan-su-dung" target="_blank" rel="noopener noreferrer">điều khoản sử dụng</a> và <a href="/thong-tin/thanh-toan-va-hoan-tien" target="_blank" rel="noopener noreferrer">chính sách thanh toán</a>.</p>
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
          <h1>{doctor.name}</h1>
          <p className="doctor-credentials"><strong>{doctor.title && doctor.title !== 'BS' ? doctor.title : 'Bác sĩ'}</strong>{doctor.yearsExperience != null && <span>{doctor.yearsExperience} năm kinh nghiệm</span>}</p>
          <dl>
            <dt>Chuyên khoa</dt><dd>{doctor.specialty}</dd>

            <dt>Nơi công tác</dt><dd>{doctor.workplace}</dd>
            {doctor.contactPhone && <><dt>Điện thoại liên hệ</dt><dd><a href={`tel:${doctor.contactPhone.replace(/[^+\d]/g, '')}`}>{doctor.contactPhone}</a></dd></>}
            {doctor.contactEmail && <><dt>Email liên hệ</dt><dd><a href={`mailto:${doctor.contactEmail}`}>{doctor.contactEmail}</a></dd></>}
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
          <p>Hỗ trợ đặt khám<br /><strong>{clinic.phone || clinic.email}</strong></p>
          <button type="button" disabled={!selectedTime} onClick={() => { setEditingSchedule(!selectedTime); setScreen('booking'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            ĐẶT KHÁM NGAY
          </button>
        </div>
      </article>
      <article className="doctor-info-content compact">
        <h2>Giới thiệu</h2>
        <p>{doctor.intro || doctor.shortDescription || 'Thông tin chuyên môn chi tiết của bác sĩ đang được cập nhật.'}</p>
        <h2>Chuyên khám</h2>
        <p>{doctor.specialty || 'Thông tin chuyên khoa đang được cập nhật.'}</p>
        {doctor.education && <><h2>Đào tạo, bằng cấp</h2><p>{doctor.education}</p></>}
        {doctor.expertise && <><h2>Lĩnh vực chuyên sâu</h2><p>{doctor.expertise}</p></>}
        <div className="map-card">
          <h3>Địa chỉ</h3>
          <p>{doctorAddress(doctor)}</p>
          <button type="button" disabled={!doctor.address} onClick={openDoctorMap}>🗺 Mở bản đồ</button>
        </div>
      </article>
    </section>
  );
}

export default TrangDatLichBacSi;
