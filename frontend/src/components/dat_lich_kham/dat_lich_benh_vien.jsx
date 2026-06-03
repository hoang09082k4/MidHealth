import { useEffect, useMemo, useRef, useState } from 'react';
import TrangPhieuKham, { PhieuKhamChiTiet, co_gia_tri, tao_dong_phieu_kham } from './phieu_kham';
import { createAppointment, createPayPalOrder, listAppointments, listPatientProfiles, savePatientProfile } from '../../lib/appointments';
import { useReferenceData } from '../../lib/reference_data';
import { calculateAppointmentPrice, formatCurrency } from '../../lib/pricing';
import {
  chuan_hoa_bhyt,
  chuan_hoa_cmnd_cccd,
  chuan_hoa_so_dien_thoai,
  kiem_tra_bhyt,
  kiem_tra_ngay_sinh,
} from '../../data/du_lieu_ho_so';

function anh_benh_vien(path) {
  if (!path) return '';
  if (/^(https?:)?\/\//.test(path) || path.startsWith('/')) return path;
  return `/image_benh_vien/${path}`;
}

function tuoi_tu_ngay_sinh(dateText) {
  const [day, month, year] = dateText.split('/').map(Number);
  const birthDate = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const hasNotBirthday = today.getMonth() < birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate());
  return hasNotBirthday ? age - 1 : age;
}

function tao_ma_phieu() {
  const now = new Date();
  const year = String(now.getFullYear()).slice(2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `YMA${year}${month}${day}${Math.floor(1000 + Math.random() * 9000)}`;
}

function tao_ma_benh_nhan() {
  return `YMP${Math.floor(1000000000 + Math.random() * 9000000000)}`;
}

function lay_ten_tat(fullName) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'BN';
  return parts.slice(-2).map((part) => part[0]).join('').toUpperCase();
}

function luu_lich_kham(appointment) {
  const current = JSON.parse(localStorage.getItem('midhealth_appointments') || '[]');
  localStorage.setItem('midhealth_appointments', JSON.stringify([appointment, ...current.filter((item) => (item.id || item.ticket) !== (appointment.id || appointment.ticket))]));
}

const MAX_ATTACHMENT_COUNT = 5;
const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024;
const ACCEPTED_ATTACHMENT_TYPES = new Set(['image/png', 'image/jpeg']);

function hien_thi_dung_luong(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function doc_lich_hen_cuc_bo() {
  try {
    const appointments = JSON.parse(localStorage.getItem('midhealth_appointments') || '[]');
    return Array.isArray(appointments) ? appointments : [];
  } catch {
    return [];
  }
}

function dia_chi_day_du(profile) {
  return [profile.address, profile.ward, profile.district, profile.province].filter(Boolean).join(', ') || 'Chưa cập nhật';
}

function tai_anh_phieu(appointment) {
  const { bookingRows, patientRows } = tao_dong_phieu_kham(appointment);
  const visibleBookingRows = bookingRows.filter((row) => co_gia_tri(row.value));
  const visiblePatientRows = patientRows.filter((row) => co_gia_tri(row.value));
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = Math.max(760, 400 + (visibleBookingRows.length + visiblePatientRows.length) * 42);
  const context = canvas.getContext('2d');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#86efac';
  context.beginPath();
  context.arc(canvas.width / 2, 46, 30, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ffffff';
  context.font = 'bold 34px Arial';
  context.textAlign = 'center';
  context.fillText('✓', canvas.width / 2, 58);

  context.fillStyle = '#111827';
  context.font = 'bold 24px Arial';
  context.fillText('Đặt lịch thành công!', canvas.width / 2, 120);
  context.font = '16px Arial';
  context.fillText('STT', canvas.width / 2 - 80, 168);
  context.fillStyle = '#16a34a';
  context.font = 'bold 36px Arial';
  context.fillText(String(appointment.number), canvas.width / 2 - 80, 208);

  const drawSection = (title, rows, yStart) => {
    let y = yStart;
    context.textAlign = 'left';
    context.fillStyle = '#111827';
    context.font = 'bold 18px Arial';
    context.fillText(title, 32, y);
    y += 30;
    rows.forEach((row) => {
      context.strokeStyle = '#e5e7eb';
      context.beginPath();
      context.moveTo(32, y + 8);
      context.lineTo(canvas.width - 32, y + 8);
      context.stroke();
      context.fillStyle = '#111827';
      context.font = '16px Arial';
      context.fillText(row.label, 32, y + 34);
      context.fillStyle = row.highlight ? '#16a34a' : '#111827';
      context.fillText(String(row.value), 330, y + 34);
      y += 42;
    });
    return y + 24;
  };

  context.strokeStyle = '#e5e7eb';
  context.beginPath();
  context.moveTo(32, 230);
  context.lineTo(canvas.width - 32, 230);
  context.stroke();
  context.fillStyle = '#111827';
  context.textAlign = 'left';
  context.font = 'bold 18px Arial';
  context.fillText(appointment.doctorShortName, 90, 270);
  context.fillStyle = '#4b5563';
  context.font = '16px Arial';
  context.fillText(appointment.address, 90, 296);

  const nextY = drawSection('Thông tin đặt khám', visibleBookingRows, 350);
  drawSection('Thông tin bệnh nhân', visiblePatientRows, nextY);

  const link = document.createElement('a');
  link.download = `${appointment.appointmentCode}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function ManHinhDatLichThanhCong({ appointment, image, fallback, onViewTicket }) {
  return (
    <section className="booking-success-page">
      <article className="booking-success-card">
        <div className="success-check">✓</div>
        <h1>Đặt lịch thành công!</h1>
        <div className="success-ticket-head">
          <div>
            <span>STT</span>
            <strong>{appointment.number}</strong>
          </div>
        </div>
        <div className="success-doctor-row">
          <div className="doctor-avatar booking-avatar">
            {image ? <img src={image} alt={appointment.doctorShortName} /> : <span>{fallback}</span>}
          </div>
          <div>
            <h3>{appointment.doctorShortName}</h3>
            <p>{appointment.address}</p>
          </div>
        </div>

        <PhieuKhamChiTiet appointment={appointment} />

        <div className="success-actions">
          <button type="button" onClick={onViewTicket}>Xem phiếu khám</button>
          <button type="button" onClick={() => tai_anh_phieu(appointment)}>Lưu lại phiếu</button>
        </div>
      </article>
    </section>
  );
}

function lay_dich_vu_benh_vien(hospital) {
  return [
    {
      id: 'no-health-insurance',
      name: 'Không BHYT',
      fee: 'Thanh toán toàn bộ phí khám',
      description: `Không áp dụng giảm trừ bảo hiểm y tế khi khám tại ${hospital.name}`,
      specialtyId: null,
      insuranceType: 'none',
    },
    {
      id: 'standard-health-insurance',
      name: 'BHYT thường',
      fee: 'Áp dụng mức quỹ BHYT chi trả 80%',
      description: `Áp dụng cho dịch vụ khám tại ${hospital.name}`,
      specialtyId: null,
      insuranceType: 'standard',
    },
  ];
}

function lay_chuyen_khoa_benh_vien(hospital) {
  return (hospital.specialties || []).map((specialty) => ({
    name: specialty,
    description: `Khám và tư vấn chuyên khoa ${specialty.toLowerCase()} tại ${hospital.name}`,
    price: calculateAppointmentPrice(specialty, false).originalAmount,
  }));
}

function gia_tri_ngay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function hien_thi_ngay(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

function gio_hien_tai() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function slot_con_hieu_luc(slot) {
  if (!slot?.date || !slot?.startTime) return false;
  if ((slot.bookedCount || 0) >= (slot.capacity || 1) || slot.status === 'full') return false;
  const todayValue = gia_tri_ngay();
  if (slot.date < todayValue) return false;
  if (slot.date > todayValue) return true;
  return String(slot.startTime).slice(0, 5) > gio_hien_tai();
}

function cong_phut(time, minutes) {
  const [hour, minute] = String(time).split(':').map(Number);
  const date = new Date(2000, 0, 1, hour, minute + minutes);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function tao_lich_benh_vien_tinh(hospitalId, monthDate) {
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const times = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '13:00', '13:30', '14:00', '14:30', '15:00'];
  const slots = [];

  Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), index + 1);
    if (date.getDay() === 0) return;
    const dateValue = gia_tri_ngay(date);
    times.forEach((start) => {
      const end = cong_phut(start, 30);
      slots.push({
        id: `static-hospital-${hospitalId}-${dateValue}-${start}`,
        hospitalId,
        date: dateValue,
        startTime: start,
        endTime: end,
        label: `${start} - ${end}`,
        session: start < '12:00' ? 'morning' : 'afternoon',
        capacity: 8,
        bookedCount: 0,
        status: 'available',
      });
    });
  });

  return slots.filter(slot_con_hieu_luc);
}

function lich_hen_dang_hieu_luc(appointment) {
  const status = String(appointment?.status || '').toLowerCase();
  return !status.includes('hủy') && !status.includes('cancel');
}

function ngay_lich_hen(appointment) {
  return appointment?.dateValue || appointment?.appointmentDate || appointment?.appointment_date || appointment?.date || '';
}

function gio_bat_dau_lich_hen(appointment) {
  return String(
    appointment?.startTime
    || appointment?.appointmentStartTime
    || appointment?.appointment_start_time
    || appointment?.appointmentTime
    || appointment?.time
    || '',
  ).match(/\d{2}:\d{2}/)?.[0] || '';
}

function cung_benh_vien(appointment, hospital) {
  const appointmentHospital = appointment?.hospitalName || appointment?.facilityName || appointment?.doctorName || '';
  return appointmentHospital === hospital.name;
}

function ten_thang(date) {
  return `Tháng ${date.getMonth() + 1}, ${date.getFullYear()}`;
}

function dau_thang(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function cong_thang(value, amount) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

const QUAN_HE_GIAM_HO = ['Cha', 'Mẹ', 'Con', 'Chồng', 'Vợ', 'Khác'];

function tao_ho_so_mac_dinh(user) {
  return {
    name: '',
    birthDate: '',
    phone: '',
    gender: '',
    citizenId: '',
    email: '',
    province: '',
    district: '',
    ward: '',
    address: '',
    ethnicity: 'Kinh',
    job: '',
    insuranceCode: '',
    guardianName: '',
    guardianPhone: '',
    guardianCitizenId: '',
    guardianEmail: '',
    relationship: 'Khác',
    guardians: [],
    isMain: true,
  };
}

function tao_ho_so_moi(user) {
  return {
    name: '',
    birthDate: '',
    phone: '',
    gender: '',
    citizenId: '',
    email: '',
    province: '',
    district: '',
    ward: '',
    address: '',
    ethnicity: 'Kinh',
    job: '',
    insuranceCode: '',
    guardianName: '',
    guardianPhone: '',
    guardianCitizenId: '',
    guardianEmail: '',
    relationship: 'Khác',
    guardians: [],
    isMain: false,
  };
}

function chuan_hoa_ho_so(profile) {
  return {
    ...profile,
    phone: chuan_hoa_so_dien_thoai(profile.phone),
    citizenId: chuan_hoa_cmnd_cccd(profile.citizenId),
    insuranceCode: chuan_hoa_bhyt(profile.insuranceCode),
    guardianPhone: chuan_hoa_so_dien_thoai(profile.guardianPhone),
    guardianCitizenId: chuan_hoa_cmnd_cccd(profile.guardianCitizenId),
    guardians: (profile.guardians || []).map((guardian) => ({
      ...guardian,
      phone: chuan_hoa_so_dien_thoai(guardian.phone || ''),
      citizenId: chuan_hoa_cmnd_cccd(guardian.citizenId || ''),
    })),
  };
}

function tao_nguoi_giam_ho() {
  return {
    id: `guardian_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: '',
    phone: '',
    citizenId: '',
    email: '',
    relationship: 'Khác',
  };
}

function lay_nguoi_giam_ho(profile) {
  if (profile.guardians?.length) return profile.guardians;
  if (profile.guardianName || profile.guardianPhone) {
    return [{
      id: 'guardian_legacy',
      name: profile.guardianName,
      phone: profile.guardianPhone,
      citizenId: profile.guardianCitizenId,
      email: profile.guardianEmail,
      relationship: profile.relationship || 'Khác',
    }];
  }
  return [];
}

function chuyen_ho_so_tu_api(profile) {
  return chuan_hoa_ho_so({
    id: profile.id,
    name: profile.full_name || profile.fullName || profile.name || '',
    birthDate: hien_thi_ngay(profile.date_of_birth || profile.birthDate || ''),
    phone: profile.phone || '',
    gender: profile.gender === 'female' ? 'Nữ' : profile.gender === 'male' ? 'Nam' : profile.gender || 'Nam',
    citizenId: profile.citizen_id || profile.citizenId || '',
    email: profile.email || '',
    province: profile.province || '',
    district: profile.district || '',
    ward: profile.ward || '',
    address: profile.address || '',
    ethnicity: profile.ethnicity || 'Kinh',
    job: profile.occupation || profile.job || '',
    insuranceCode: profile.health_insurance_number || profile.insuranceCode || '',
    relationship: profile.relationship || 'Khác',
    guardians: (profile.patient_guardians || profile.guardians || []).map((guardian) => ({
      id: guardian.id || `guardian_${guardian.phone}`,
      name: guardian.full_name || guardian.name || '',
      phone: guardian.phone || '',
      citizenId: guardian.citizen_id || guardian.citizenId || '',
      email: guardian.email || '',
      relationship: guardian.relationship || 'Khác',
    })),
    isMain: Boolean(profile.is_primary || profile.isMain),
  });
}

function doc_ho_so_tu_lich_cuc_bo() {
  try {
    const appointments = JSON.parse(localStorage.getItem('midhealth_appointments') || '[]');
    if (!Array.isArray(appointments)) return [];
    return appointments
      .map((appointment) => appointment.patientProfile ? {
        ...appointment.patientProfile,
        name: appointment.patientProfile.name || appointment.patientName,
        phone: appointment.patientProfile.phone || appointment.phone,
      } : {
        name: appointment.patientName || '',
        birthDate: appointment.birthDate || '',
        phone: appointment.phone || '',
        gender: appointment.gender || 'Nam',
        address: appointment.patientAddress || '',
      })
      .filter((profile) => profile.name && profile.phone)
      .map(chuyen_ho_so_tu_api);
  } catch {
    return [];
  }
}

function gop_ho_so(profiles) {
  const seen = new Set();
  return profiles.filter((profile) => {
    const key = `${profile.id || ''}|${profile.name}|${profile.phone}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function danh_sach_thieu_ho_so(profile, hospital, service) {
  const missing = [];
  const age = tuoi_tu_ngay_sinh(profile.birthDate);

  if (!profile.name.trim()) missing.push('Họ và tên');
  if (profile.phone.length !== 10) missing.push('Số điện thoại 10 số');
  if (!kiem_tra_ngay_sinh(profile.birthDate)) missing.push('Ngày sinh đúng dd/mm/yyyy');
  if (!profile.gender) missing.push('Giới tính');
  if (!profile.citizenId || ![9, 12].includes(profile.citizenId.length)) missing.push('Số CCCD/CMND');
  if (!profile.province || !profile.district || !profile.ward || !profile.address.trim()) missing.push('Địa chỉ đầy đủ');
  if (service?.name?.includes('BHYT') && (!profile.insuranceCode || !kiem_tra_bhyt(profile.insuranceCode))) missing.push('Mã thẻ BHYT hợp lệ');
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) missing.push('Email hợp lệ');
  if (age < 16) {
    const guardians = lay_nguoi_giam_ho(profile);
    const hasValidGuardian = guardians.some((guardian) => (
      guardian.name?.trim()
      && guardian.phone?.length === 10
      && guardian.relationship
    ));
    if (!hasValidGuardian) missing.push('Ít nhất 1 người giám hộ hợp lệ');
  }

  return missing;
}

function ModalLuuY({ hospital, onClose }) {
  return (
    <div className="notice-modal-backdrop">
      <article className="notice-modal">
        <header>Lưu ý!</header>
        <div className="notice-modal-body">
          {hospital.notes?.map((group) => (
            <section key={group.title}>
              <h3>{group.title}</h3>
              {group.lines.map((line) => <p key={line}>{line}</p>)}
            </section>
          ))}
        </div>
        <footer>
          <button type="button" onClick={onClose}>Tôi đã hiểu!</button>
        </footer>
      </article>
    </div>
  );
}

function ModalThongBao({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="small-notice-backdrop">
      <article className="small-notice">
        <h3>Thông báo</h3>
        <p>{message}</p>
        <button type="button" onClick={onClose}>Đã hiểu</button>
      </article>
    </div>
  );
}

function ModalXacNhanDoiLuaChon({ onCancel, onConfirm }) {
  return (
    <div className="small-notice-backdrop">
      <article className="change-choice-modal">
        <h3>Bạn muốn đổi lựa chọn trước đó?</h3>
        <p>Đổi lựa chọn ở đây sẽ xóa các thông tin đã chọn ở những bước sau.</p>
        <div>
          <button type="button" onClick={onCancel}>Hủy</button>
          <button type="button" onClick={onConfirm}>Tiếp tục đổi</button>
        </div>
      </article>
    </div>
  );
}

function ModalAnhBenhVien({ images, activeIndex, onSelect, onClose }) {
  const activeImage = images[activeIndex] || images[0];

  return (
    <div className="gallery-modal-backdrop" onClick={onClose}>
      <div className="gallery-modal" onClick={(event) => event.stopPropagation()}>
        <div className="gallery-modal-head">
          <h3>Hình ảnh bệnh viện</h3>
          <button type="button" onClick={onClose}>×</button>
        </div>
        <img className="gallery-modal-main" src={activeImage.src} alt={activeImage.alt} />
        <div className="gallery-modal-thumbs">
          {images.map((image, index) => (
            <button
              className={index === activeIndex ? 'active' : ''}
              key={`${image.src}-${index}`}
              type="button"
              onClick={() => onSelect(index)}
            >
              <img src={image.src} alt={image.alt} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DongHoSo({ label, value }) {
  return (
    <div className="hospital-profile-row">
      <span>{label}</span>
      <strong>{value || '--'}</strong>
    </div>
  );
}

function Field({ label, name, value, required, placeholder, onChange, error }) {
  return (
    <label className={error ? 'hospital-profile-field has-error' : 'hospital-profile-field'}>
      <span>{label}{required && <b> *</b>}</span>
      <input name={name} value={value || ''} placeholder={placeholder || label} onChange={onChange} />
      {error && <small>{error}</small>}
    </label>
  );
}

function SelectField({ label, name, value, children, placeholder, onChange, error }) {
  return (
    <label className={error ? 'hospital-profile-field has-error' : 'hospital-profile-field'}>
      <span>{label}</span>
      <select name={name} value={value || ''} onChange={onChange}>
        <option value="">{placeholder || label}</option>
        {children}
      </select>
      {error && <small>{error}</small>}
    </label>
  );
}

function ModalHoSo({ mode, profile, errors = {}, canSave, onClose, onEdit, onChange, onSave, onAddGuardian, onGuardianChange, onRemoveGuardian }) {
  const { addressData, ethnicGroups, occupations } = useReferenceData();
  const selectedProvince = addressData.find((item) => item.name === profile.province);
  const selectedDistrict = selectedProvince?.districts.find((item) => item.name === profile.district);
  const isAdding = mode === 'add';
  const isEditing = mode === 'edit' || isAdding;
  const guardians = lay_nguoi_giam_ho(profile);

  return (
    <div className="notice-modal-backdrop">
      <article className={isAdding ? 'hospital-profile-modal adding' : 'hospital-profile-modal'}>
        <header>
          <h2>{isAdding ? 'Thêm hồ sơ mới' : isEditing ? 'Chỉnh sửa hồ sơ' : 'Thông tin hồ sơ'}</h2>
          <button type="button" onClick={onClose}>×</button>
        </header>

        {!isEditing ? (
          <div className="hospital-profile-view">
            <div className="hospital-profile-avatar">{lay_ten_tat(profile.name)}</div>
            <div className="hospital-profile-table">
              <DongHoSo label="Họ và tên" value={profile.name} />
              <DongHoSo label="Số điện thoại" value={profile.phone} />
              <DongHoSo label="Ngày sinh" value={profile.birthDate} />
              <DongHoSo label="Giới tính" value={profile.gender} />
              <DongHoSo label="Số CCCD" value={profile.citizenId} />
              <DongHoSo label="Địa chỉ email" value={profile.email} />
              <DongHoSo label="Địa chỉ" value={dia_chi_day_du(profile)} />
              <DongHoSo label="Dân tộc" value={profile.ethnicity} />
              <DongHoSo label="Nghề nghiệp" value={profile.job} />
              <DongHoSo label="Số bảo hiểm y tế" value={profile.insuranceCode} />
              {guardians.map((guardian, index) => (
                <DongHoSo
                  key={guardian.id || index}
                  label={`Người giám hộ ${index + 1}`}
                  value={[guardian.name, guardian.phone, guardian.relationship].filter(Boolean).join(' - ')}
                />
              ))}
            </div>
          </div>
        ) : (
          <form className="hospital-profile-form" onSubmit={onSave}>
            {!isAdding && <div className="hospital-profile-camera">
              <div>{lay_ten_tat(profile.name)}</div>
              <span>📷</span>
            </div>}
            <Field label="Họ và tên" name="name" value={profile.name} required placeholder="Họ và tên" onChange={onChange} error={errors.name} />
            <Field label="Số điện thoại" name="phone" value={profile.phone} required placeholder="Số điện thoại" onChange={onChange} error={errors.phone} />
            <Field label="Ngày sinh" name="birthDate" value={profile.birthDate} required placeholder="dd/mm/yyyy" onChange={onChange} error={errors.birthDate} />
            <div className={errors.gender ? 'hospital-profile-radio has-error' : 'hospital-profile-radio'}>
              <span>Giới tính <b>*</b></span>
              {['Nam', 'Nữ'].map((gender) => (
                <label key={gender}>
                  <input checked={profile.gender === gender} name="gender" type="radio" value={gender} onChange={onChange} />
                  {gender}
                </label>
              ))}
              {errors.gender && <small>{errors.gender}</small>}
            </div>
            <SelectField label="Tỉnh / thành phố" name="province" value={profile.province} placeholder="Chọn tỉnh / thành phố" onChange={onChange} error={errors.province}>
              {addressData.map((province) => <option key={province.name}>{province.name}</option>)}
            </SelectField>
            <SelectField label="Quận / huyện" name="district" value={profile.district} placeholder="Chọn quận / huyện" onChange={onChange} error={errors.district}>
              {(selectedProvince?.districts || []).map((district) => <option key={district.name}>{district.name}</option>)}
            </SelectField>
            <SelectField label="Phường / xã" name="ward" value={profile.ward} placeholder="Chọn phường / xã" onChange={onChange} error={errors.ward}>
              {(selectedDistrict?.wards || []).map((ward) => <option key={ward}>{ward}</option>)}
            </SelectField>
            <Field label="Địa chỉ cụ thể" name="address" value={profile.address} required placeholder="Số nhà, tên đường" onChange={onChange} error={errors.address} />
            <Field label="Số CMND/CCCD" name="citizenId" value={profile.citizenId} placeholder="Số CMND hoặc CCCD" onChange={onChange} error={errors.citizenId} />
            <SelectField label="Dân tộc" name="ethnicity" value={profile.ethnicity} placeholder="Chọn dân tộc" onChange={onChange}>
              {ethnicGroups.map((item) => <option key={item}>{item}</option>)}
            </SelectField>
            <SelectField label="Nghề nghiệp" name="job" value={profile.job} placeholder="Chọn nghề nghiệp" onChange={onChange}>
              {occupations.map((item) => <option key={item}>{item}</option>)}
            </SelectField>
            <Field label="Số bảo hiểm y tế" name="insuranceCode" value={profile.insuranceCode} placeholder="Số trên thẻ bảo hiểm y tế" onChange={onChange} error={errors.insuranceCode} />
            <Field label="Email" name="email" value={profile.email} placeholder="Địa chỉ email của bạn" onChange={onChange} error={errors.email} />

            {isAdding && (
              <div className="hospital-profile-radio relation">
                <span>Mối quan hệ <b>*</b></span>
                {QUAN_HE_GIAM_HO.map((relationship) => (
                  <label key={relationship}>
                    <input checked={profile.relationship === relationship} name="relationship" type="radio" value={relationship} onChange={onChange} />
                    {relationship}
                  </label>
                ))}
              </div>
            )}

            {guardians.map((guardian, index) => (
              <div className="guardian-block" key={guardian.id}>
                <div className="guardian-head">
                  <h3>Người giám hộ {index + 1}</h3>
                  <button type="button" onClick={() => onRemoveGuardian(guardian.id)}>×</button>
                </div>
                <Field label="Họ và tên" name="name" value={guardian.name} required placeholder="Nhập họ và tên" onChange={(event) => onGuardianChange(guardian.id, event)} error={errors[`guardian_${guardian.id}_name`]} />
                <Field label="Số điện thoại" name="phone" value={guardian.phone} required placeholder="Nhập số điện thoại" onChange={(event) => onGuardianChange(guardian.id, event)} error={errors[`guardian_${guardian.id}_phone`]} />
                <Field label="Số CCCD" name="citizenId" value={guardian.citizenId} placeholder="Số trên thẻ CCCD" onChange={(event) => onGuardianChange(guardian.id, event)} />
                <Field label="Địa chỉ email" name="email" value={guardian.email} placeholder="Nhập địa chỉ email" onChange={(event) => onGuardianChange(guardian.id, event)} />
                <div className={errors[`guardian_${guardian.id}_relationship`] ? 'hospital-profile-radio relation has-error' : 'hospital-profile-radio relation'}>
                  <span>Mối quan hệ <b>*</b></span>
                  {QUAN_HE_GIAM_HO.map((relationship) => (
                    <label key={relationship}>
                      <input checked={guardian.relationship === relationship} name="relationship" type="radio" value={relationship} onChange={(event) => onGuardianChange(guardian.id, event)} />
                      {relationship}
                    </label>
                  ))}
                  {errors[`guardian_${guardian.id}_relationship`] && <small>{errors[`guardian_${guardian.id}_relationship`]}</small>}
                </div>
              </div>
            ))}

            <button className="guardian-add-button" type="button" onClick={onAddGuardian}>+ Thêm người giám hộ</button>
            {errors.form && <p className="hospital-profile-form-error">{errors.form}</p>}
          </form>
        )}

        <footer>
          <button type="button" onClick={onClose}>{isEditing ? 'Hủy' : 'Đóng'}</button>
          <button type="button" disabled={isEditing && !canSave} onClick={isEditing ? onSave : onEdit}>{isAdding ? 'Thêm hồ sơ mới' : isEditing ? 'Lưu' : 'Chỉnh sửa'}</button>
        </footer>
      </article>
    </div>
  );
}

function BuocDatKham({ step, unlockedStep, onStepClick }) {
  const labels = ['Dịch vụ', 'Chuyên khoa', 'Ngày Khám', 'Giờ Khám', 'Bệnh nhân'];
  return (
    <div className="hospital-stepper">
      {labels.slice(0, unlockedStep).map((label, index) => {
        const number = index + 1;
        const active = step === number;
        return (
          <button className={active ? 'active' : 'done'} key={label} type="button" onClick={() => onStepClick(number)}>
            <i>{active ? number : '✓'}</i>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function ThongTinDatKham({ service, specialty, date, time, patient, note = '', attachments = [] }) {
  const hasStandardInsurance = service?.name === 'BHYT thường';
  const price = calculateAppointmentPrice(specialty?.name, hasStandardInsurance);

  return (
    <aside className="hospital-booking-summary detailed">
      <h2>Thông tin đặt khám</h2>
      <div><p>Dịch vụ</p><strong>{service?.name || '--'}</strong></div>
      <div><p>Chuyên khoa</p><strong>{specialty?.name || '--'}</strong></div>
      <div>
        <p>Chi phí</p>
        <strong>{specialty ? formatCurrency(price.finalAmount) : '--'}</strong>
        {specialty && hasStandardInsurance && <strong>Đã giảm {formatCurrency(price.insuranceDiscount)} từ BHYT thường</strong>}
      </div>
      <div>
        <p>Ngày và giờ khám</p>
        <strong>{date ? date.display : '--'}</strong>
        {time && <strong>Giờ khám {time.label || time}</strong>}
      </div>
      <div><p>Bệnh nhân</p><strong>{patient ? `${patient.name} - ${patient.phone}` : '--'}</strong></div>
      <div>
        <p>Thông tin bổ sung</p>
        <strong>{note?.trim() || attachments.length ? `${note?.trim() ? 'Có ghi chú' : '--'}${attachments.length ? `, ${attachments.length} ảnh` : ''}` : '--'}</strong>
        {attachments.length > 0 && (
          <ul className="hospital-summary-files">
            {attachments.map((file) => <li key={file.id}>{file.name}</li>)}
          </ul>
        )}
      </div>
    </aside>
  );
}

function LichThang({ monthDate, selectedDate, slotDates, bookedDateMap, isLoading, error, onMonthChange, onSelectDate }) {
  const todayValue = gia_tri_ngay();
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const offset = (firstDay.getDay() + 6) % 7;
  const cells = [
    ...Array.from({ length: offset }, (_, index) => ({ key: `blank-${index}`, blank: true })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), index + 1);
      const value = gia_tri_ngay(date);
      const stats = slotDates.get(value);
      const booked = bookedDateMap.get(value) || [];
      const availableCount = stats?.available || 0;
      const totalCount = stats?.total || 0;
      const isPast = value < todayValue;
      return {
        key: value,
        value,
        day: index + 1,
        display: hien_thi_ngay(value),
        label: `Ngày khám ${hien_thi_ngay(value)}`,
        today: value === todayValue,
        bookedCount: booked.length,
        available: !isPast && availableCount > 0,
        full: !isPast && totalCount > 0 && availableCount === 0,
        disabled: isPast || availableCount === 0,
      };
    }),
  ];
  const hasAnySchedule = Array.from(slotDates.keys()).some((value) => value.startsWith(`${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`));

  return (
    <div className="hospital-calendar">
      <div className="hospital-calendar-head">
        <button type="button" disabled={gia_tri_ngay(cong_thang(monthDate, -1)) < gia_tri_ngay(dau_thang())} onClick={() => onMonthChange(-1)}>â†</button>
        <strong>{ten_thang(monthDate)}</strong>
        <button type="button" onClick={() => onMonthChange(1)}>â†’</button>
      </div>
      <div className="hospital-calendar-week">
        {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'].map((dayName) => <b key={dayName}>{dayName}</b>)}
      </div>
      {isLoading && <p className="hospital-calendar-message">Đang tải lịch khám...</p>}
      {!isLoading && error && <p className="hospital-calendar-message error">{error}</p>}
      {!isLoading && !error && !hasAnySchedule && <p className="hospital-calendar-message">Tháng này chưa có lịch khám phù hợp.</p>}
      <div className="hospital-calendar-grid">
        {cells.map((cell) => {
          if (cell.blank) return <span className="calendar-day blank" key={cell.key} />;
          const className = [
            'calendar-day',
            cell.available ? 'available' : 'disabled',
            cell.full ? 'full' : '',
            cell.bookedCount ? 'booked' : '',
            selectedDate?.value === cell.value ? 'selected' : '',
            cell.today ? 'today' : '',
          ].filter(Boolean).join(' ');
          return (
            <button className={className} disabled={cell.disabled} key={cell.key} type="button" onClick={() => onSelectDate(cell)}>
              {cell.day === 1 ? `1 tháng ${monthDate.getMonth() + 1}` : cell.day}
            </button>
          );
        })}
      </div>
      <div className="hospital-calendar-legend">
        <span><i className="today-box" /> Hôm nay</span>
        <span><i /> Có thể chọn</span>
        <span><i className="full-box" /> Đã đầy lịch</span>
        <span><i className="booked-box" /> Đã đặt</span>
      </div>
    </div>
  );
}

function TrangDatLichBenhVien({ hospital, initialScreen = 'detail', user, onBackHome, onScreenChange }) {
  const [showNotice, setShowNotice] = useState(true);
  const [screen, setScreen] = useState(initialScreen);
  const [isIntroExpanded, setIsIntroExpanded] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(null);
  const [step, setStep] = useState(1);
  const [unlockedStep, setUnlockedStep] = useState(1);
  const serviceOptions = useMemo(() => lay_dich_vu_benh_vien(hospital), [hospital]);
  const specialtyOptions = useMemo(() => lay_chuyen_khoa_benh_vien(hospital), [hospital]);
  const [insuranceChoice, setInsuranceChoice] = useState(null);
  const selectedService = useMemo(() => (
    serviceOptions.find((service) => service.insuranceType === insuranceChoice) || null
  ), [insuranceChoice, serviceOptions]);
  const hasStandardInsurance = insuranceChoice === 'standard';
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [calendarMonth, setCalendarMonth] = useState(() => dau_thang());
  const [hospitalSlots, setHospitalSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [bookedAppointments, setBookedAppointments] = useState(() => doc_lich_hen_cuc_bo());
  const [patientProfile, setPatientProfile] = useState(() => tao_ho_so_mac_dinh(user));
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [existingProfiles, setExistingProfiles] = useState(() => doc_ho_so_tu_lich_cuc_bo());
  const [isSearchingExistingProfile, setIsSearchingExistingProfile] = useState(false);
  const [profileSearchTerm, setProfileSearchTerm] = useState('');
  const [profileDraft, setProfileDraft] = useState(null);
  const [profileErrors, setProfileErrors] = useState({});
  const [profileModalMode, setProfileModalMode] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showPatientType, setShowPatientType] = useState(false);
  const [warning, setWarning] = useState('');
  const [pendingChange, setPendingChange] = useState(null);
  const [note, setNote] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const attachedFilesRef = useRef([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [appointment, setAppointment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);
  const hospitalImages = useMemo(() => {
    const gallery = (hospital.gallery || []).map((image, index) => ({
      src: anh_benh_vien(image),
      alt: `${hospital.name} ${index + 1}`,
    }));
    const fallbackImages = [
      { src: anh_benh_vien(hospital.background), alt: hospital.name },
      { src: anh_benh_vien(hospital.avatar), alt: `${hospital.name} logo` },
    ].filter((image) => image.src);
    const seen = new Set();
    return [...gallery, ...fallbackImages].filter((image) => {
      if (seen.has(image.src)) return false;
      seen.add(image.src);
      return true;
    });
  }, [hospital]);

  useEffect(() => {
    onScreenChange?.(screen);
  }, [screen]);

  useEffect(() => {
    setScreen(initialScreen);
  }, [hospital.id, initialScreen]);

  const slotDates = useMemo(() => {
    const stats = new Map();
    hospitalSlots.forEach((slot) => {
      const current = stats.get(slot.date) || { total: 0, available: 0 };
      current.total += 1;
      if ((slot.bookedCount || 0) < (slot.capacity || 1) && slot.status !== 'full') current.available += 1;
      stats.set(slot.date, current);
    });
    return stats;
  }, [hospitalSlots]);

  const hospitalBookedAppointments = useMemo(() => (
    bookedAppointments
      .filter(lich_hen_dang_hieu_luc)
      .filter((item) => cung_benh_vien(item, hospital))
      .filter((item) => ngay_lich_hen(item) >= gia_tri_ngay())
  ), [bookedAppointments, hospital]);

  const bookedDateMap = useMemo(() => {
    const map = new Map();
    hospitalBookedAppointments.forEach((appointmentItem) => {
      const dateValue = ngay_lich_hen(appointmentItem);
      if (!dateValue) return;
      const current = map.get(dateValue) || [];
      current.push(appointmentItem);
      map.set(dateValue, current);
    });
    return map;
  }, [hospitalBookedAppointments]);

  const bookedSlotKeys = useMemo(() => new Set(hospitalBookedAppointments
    .map((appointmentItem) => `${ngay_lich_hen(appointmentItem)}|${gio_bat_dau_lich_hen(appointmentItem)}`)
    .filter((key) => !key.endsWith('|'))), [hospitalBookedAppointments]);

  const slotsForSelectedDate = useMemo(() => (
    selectedDate
      ? hospitalSlots.filter((slot) => slot.date === selectedDate.value && slot_con_hieu_luc(slot))
      : []
  ), [hospitalSlots, selectedDate]);

  const morningSlots = useMemo(() => slotsForSelectedDate.filter((slot) => slot.session === 'morning'), [slotsForSelectedDate]);
  const afternoonSlots = useMemo(() => slotsForSelectedDate.filter((slot) => slot.session !== 'morning'), [slotsForSelectedDate]);
  const activePatient = selectedPatient || patientProfile;
  const activePatientMissingFields = useMemo(() => (
    activePatient ? danh_sach_thieu_ho_so(activePatient, hospital, selectedService) : []
  ), [activePatient, hospital, selectedService]);
  const searchableProfiles = useMemo(() => {
    const keyword = profileSearchTerm.trim().toLowerCase();
    return gop_ho_so([patientProfile, ...existingProfiles])
      .filter((profile) => {
        if (!keyword) return true;
        return [profile.name, profile.phone, profile.birthDate, profile.citizenId]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(keyword);
      });
  }, [existingProfiles, patientProfile, profileSearchTerm]);
  const canSaveProfileDraft = useMemo(() => {
    if (!profileDraft) return false;
    return profileDraft.name.trim()
      && profileDraft.phone.length === 10
      && kiem_tra_ngay_sinh(profileDraft.birthDate)
      && profileDraft.gender
      && profileDraft.province
      && profileDraft.district
      && profileDraft.ward
      && profileDraft.address.trim()
      && [9, 12].includes(profileDraft.citizenId.length)
      && (!profileDraft.insuranceCode || kiem_tra_bhyt(profileDraft.insuranceCode))
      && (!profileDraft.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileDraft.email));
  }, [profileDraft]);

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    attachedFilesRef.current = attachedFiles;
  }, [attachedFiles]);

  useEffect(() => () => {
    attachedFilesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  useEffect(() => {
    setStep(1);
    setUnlockedStep(1);
    setInsuranceChoice(null);
    setSelectedSpecialty(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedPatient(null);
    setPendingChange(null);
    setWarning('');
    setIsIntroExpanded(false);
    setGalleryIndex(null);
    setCalendarMonth(dau_thang());
    setHospitalSlots([]);
    setSlotError('');
  }, [hospital.name, serviceOptions, specialtyOptions]);

  useEffect(() => {
    if (!selectedPatient && patientProfile?.name) {
      setSelectedPatient(patientProfile);
    }
  }, [patientProfile, selectedPatient]);

  useEffect(() => {
    let isMounted = true;
    const localProfiles = doc_ho_so_tu_lich_cuc_bo();
    setExistingProfiles(localProfiles);

    if (!user) return () => {
      isMounted = false;
    };

    listPatientProfiles(user)
      .then((profiles) => {
        if (!isMounted) return;
        const normalizedProfiles = gop_ho_so([...profiles.map(chuyen_ho_so_tu_api), ...localProfiles]);
        setExistingProfiles(normalizedProfiles);
        if (profiles[0]) {
          const savedProfile = chuyen_ho_so_tu_api(profiles[0]);
          setPatientProfile(savedProfile);
          setSelectedPatient((current) => current || savedProfile);
        }
      })
      .catch(() => {
        if (isMounted) setExistingProfiles(localProfiles);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    const localAppointments = doc_lich_hen_cuc_bo();
    setBookedAppointments(localAppointments);

    if (!user) return () => {
      isMounted = false;
    };

    listAppointments(user)
      .then((appointments) => {
        if (!isMounted) return;
        setBookedAppointments([
          ...(appointments || []),
          ...localAppointments,
        ]);
      })
      .catch(() => {
        if (isMounted) setBookedAppointments(localAppointments);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!hospital.id || !selectedService || !selectedSpecialty) return () => {
      setHospitalSlots([]);
    };

    setIsLoadingSlots(false);
    setSlotError('');
    const usableSlots = tao_lich_benh_vien_tinh(hospital.id, calendarMonth);
    setHospitalSlots(usableSlots);
    const firstAvailable = usableSlots.find(slot_con_hieu_luc);
    setSelectedDate((current) => {
      if (current && usableSlots.some((slot) => slot.date === current.value && slot_con_hieu_luc(slot))) return current;
      return firstAvailable ? {
        value: firstAvailable.date,
        day: Number(String(firstAvailable.date).slice(-2)),
        display: hien_thi_ngay(firstAvailable.date),
        label: `Ngày khám ${hien_thi_ngay(firstAvailable.date)}`,
      } : null;
    });
    setSelectedTime(null);

    return () => {};
  }, [hospital.id, selectedService, selectedSpecialty, calendarMonth]);

  useEffect(() => {
    if (selectedTime && bookedSlotKeys.has(`${selectedTime.date}|${selectedTime.startTime}`)) {
      setSelectedTime(null);
    }
  }, [bookedSlotKeys, selectedTime]);

  const canContinue = step === 1 ? selectedService
    : step === 2 ? selectedSpecialty
      : step === 3 ? selectedDate
        : step === 4 ? selectedTime && !bookedSlotKeys.has(`${selectedTime.date}|${selectedTime.startTime}`)
          : selectedPatient;
  const canGoPreviousStep = step > 1;

  const resetAfterStep = (fromStep) => {
    if (fromStep <= 1) {
      setSelectedSpecialty(null);
      setSelectedDate(null);
      setSelectedTime(null);
    }
    if (fromStep <= 2) {
      setSelectedDate(null);
      setSelectedTime(null);
    }
    if (fromStep <= 3) {
      setSelectedTime(null);
    }
    setNote('');
    clearAttachedFiles();
  };

  const unlockNextStep = (currentStep) => {
    const nextStep = Math.min(currentStep + 1, 5);
    setUnlockedStep((current) => Math.max(current, nextStep));
    setStep(nextStep);
  };

  const applyChoice = (choiceStep, applyFn, shouldReset = false) => {
    applyFn();
    if (shouldReset) {
      resetAfterStep(choiceStep);
      setUnlockedStep(Math.min(choiceStep + 1, 5));
    }
    unlockNextStep(choiceStep);
  };

  const chooseWithResetConfirm = (choiceStep, isChanged, applyFn) => {
    if (isChanged && unlockedStep > choiceStep) {
      setPendingChange({ choiceStep, applyFn });
      return;
    }
    applyChoice(choiceStep, applyFn, false);
  };

  const confirmPendingChange = () => {
    if (!pendingChange) return;
    applyChoice(pendingChange.choiceStep, pendingChange.applyFn, true);
    setPendingChange(null);
  };

  const clearAttachedFiles = () => {
    attachedFilesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    attachedFilesRef.current = [];
    setAttachedFiles([]);
  };

  const openProfileModal = (mode = 'view', profile = activePatient) => {
    setProfileDraft(mode === 'add' ? tao_ho_so_moi(user) : { ...(profile || patientProfile) });
    setProfileErrors({});
    setProfileModalMode(mode);
  };

  const updateProfileDraft = (event) => {
    const { name, value } = event.target;
    setProfileErrors((current) => ({ ...current, [name]: '' }));
    setProfileDraft((current) => {
      const next = { ...current, [name]: value };
      if (name === 'province') {
        next.district = '';
        next.ward = '';
      }
      if (name === 'district') next.ward = '';
      return chuan_hoa_ho_so(next);
    });
  };

  const addGuardian = () => {
    setProfileErrors({});
    setProfileDraft((current) => chuan_hoa_ho_so({
      ...current,
      guardians: [...lay_nguoi_giam_ho(current), tao_nguoi_giam_ho()],
    }));
  };

  const updateGuardian = (guardianId, event) => {
    const { name, value } = event.target;
    setProfileErrors((current) => ({ ...current, [`guardian_${guardianId}_${name}`]: '' }));
    setProfileDraft((current) => chuan_hoa_ho_so({
      ...current,
      guardians: lay_nguoi_giam_ho(current).map((guardian) => (
        guardian.id === guardianId ? { ...guardian, [name]: value } : guardian
      )),
    }));
  };

  const removeGuardian = (guardianId) => {
    setProfileErrors({});
    setProfileDraft((current) => {
      const guardians = lay_nguoi_giam_ho(current).filter((guardian) => guardian.id !== guardianId);
      return chuan_hoa_ho_so({
        ...current,
        guardians,
        ...(guardians.length ? {} : {
          guardianName: '',
          guardianPhone: '',
          guardianCitizenId: '',
          guardianEmail: '',
          relationship: 'Khác',
        }),
      });
    });
  };

  const validateProfileDraft = (profile) => {
    const errors = {};
    if (!profile.name.trim()) errors.name = 'Vui lòng nhập họ và tên';
    if (profile.phone.length !== 10) errors.phone = 'Vui lòng nhập số điện thoại 10 số';
    if (!kiem_tra_ngay_sinh(profile.birthDate)) errors.birthDate = 'Vui lòng nhập ngày sinh đúng dd/mm/yyyy';
    if (!profile.gender) errors.gender = 'Vui lòng chọn giới tính';
    if (!profile.province) errors.province = 'Vui lòng chọn tỉnh / thành phố';
    if (!profile.district) errors.district = 'Vui lòng chọn quận / huyện';
    if (!profile.ward) errors.ward = 'Vui lòng chọn phường / xã';
    if (!profile.address.trim()) errors.address = 'Vui lòng nhập địa chỉ cụ thể';
    if (!profile.citizenId || ![9, 12].includes(profile.citizenId.length)) errors.citizenId = 'Vui lòng nhập CMND/CCCD gồm 9 hoặc 12 số';
    if (profile.insuranceCode && !kiem_tra_bhyt(profile.insuranceCode)) errors.insuranceCode = 'Mã BHYT chưa đúng định dạng';
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) errors.email = 'Email chưa đúng định dạng';

    lay_nguoi_giam_ho(profile).forEach((guardian) => {
      if (!guardian.name?.trim()) errors[`guardian_${guardian.id}_name`] = 'Vui lòng nhập họ và tên người giám hộ';
      if (guardian.phone?.length !== 10) errors[`guardian_${guardian.id}_phone`] = 'Vui lòng nhập số điện thoại 10 số';
      if (!guardian.relationship) errors[`guardian_${guardian.id}_relationship`] = 'Vui lòng chọn mối quan hệ';
    });

    return errors;
  };

  const saveProfile = async (event) => {
    event?.preventDefault?.();
    const errors = validateProfileDraft(profileDraft);
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const guardians = lay_nguoi_giam_ho(profileDraft);
    const firstGuardian = guardians[0] || {};
    let nextProfile = {
      ...profileDraft,
      guardians,
      guardianName: firstGuardian.name || '',
      guardianPhone: firstGuardian.phone || '',
      guardianCitizenId: firstGuardian.citizenId || '',
      guardianEmail: firstGuardian.email || '',
      relationship: profileDraft.relationship || firstGuardian.relationship || 'Khác',
    };

    setIsSavingProfile(true);
    try {
      if (user) {
        const savedProfile = await savePatientProfile(user, nextProfile);
        nextProfile = chuyen_ho_so_tu_api({ ...nextProfile, ...savedProfile });
      }
    } catch (error) {
      setProfileErrors((current) => ({
        ...current,
        form: error.message || 'Không thể lưu hồ sơ. Vui lòng thử lại.',
      }));
      return;
    } finally {
      setIsSavingProfile(false);
    }

    setPatientProfile(nextProfile);
    setSelectedPatient(nextProfile);
    setExistingProfiles((current) => gop_ho_so([nextProfile, ...current]));
    setShowPatientType(false);
    setIsSearchingExistingProfile(false);
    setProfileSearchTerm('');
    setProfileModalMode(null);
  };

  const selectExistingProfile = (profile) => {
    const normalizedProfile = chuyen_ho_so_tu_api(profile);
    setPatientProfile(normalizedProfile);
    setSelectedPatient(normalizedProfile);
    setShowPatientType(false);
    setIsSearchingExistingProfile(false);
    setProfileSearchTerm('');
  };

  const openHospitalMap = () => {
    const latitude = Number(hospital.latitude);
    const longitude = Number(hospital.longitude);
    let mapQuery = '';
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      mapQuery = `${latitude},${longitude}`;
    } else if (hospital.address?.trim()) {
      mapQuery = hospital.address.trim();
    }

    if (!mapQuery) {
      setWarning('Chưa có địa chỉ bệnh viện');
      return;
    }

    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`, '_blank', 'noopener,noreferrer');
  };

  const handleBack = () => {
    if (step === 1) {
      setScreen('detail');
      return;
    }
    setStep((current) => current - 1);
  };

  const handleNext = async () => {
    if (!canContinue) return;
    if (step < 5) {
      unlockNextStep(step);
      return;
    }

    const missing = danh_sach_thieu_ho_so(selectedPatient, hospital, selectedService);
    if (missing.length > 0) {
      setWarning(`Hồ sơ còn thiếu hoặc chưa hợp lệ: ${missing.join(', ')}. Vui lòng bấm "Xem chi tiết hồ sơ" để cập nhật trước khi xác nhận đặt khám.`);
      return;
    }

    setIsSubmitting(true);
    setWarning('');
    try {
      const nextAppointment = await createAppointment(user, {
        type: 'hospital',
        hospitalId: hospital.id,
        facilityId: hospital.id,
        facilityName: hospital.name,
        hospitalName: hospital.name,
        doctorName: hospital.name,
        doctorShortName: hospital.name,
        doctorImage: anh_benh_vien(hospital.avatar),
        department: selectedSpecialty.name,
        specialtyName: selectedSpecialty.name,
        serviceName: selectedService.name,
        serviceId: selectedService.id,
        hasStandardInsurance,
        address: hospital.address,
        dateDisplay: selectedDate.display,
        dateValue: selectedDate.value,
        appointmentSlotId: selectedTime.id,
        time: selectedTime.label || `${selectedTime.startTime} - ${selectedTime.endTime}`,
        startTime: selectedTime.startTime,
        endTime: selectedTime.endTime,
        patientName: selectedPatient.name,
        birthDate: selectedPatient.birthDate,
        gender: selectedPatient.gender,
        phone: selectedPatient.phone,
        patientAddress: dia_chi_day_du(selectedPatient),
        patientProfile: selectedPatient,
        note,
        attachments: attachedFiles.map((file) => file.name),
      });
      setAppointment(nextAppointment);
      luu_lich_kham(nextAppointment);
      setBookedAppointments((current) => [nextAppointment, ...current]);
      const paymentOrder = await createPayPalOrder(user, nextAppointment.id);
      if (paymentOrder.approvalUrl) {
        window.location.assign(paymentOrder.approvalUrl);
        return;
      }
      setScreen('success');
    } catch (error) {
      setWarning(error.message || 'Không thể xác nhận đặt khám. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFiles = (fileList) => {
    const files = Array.from(fileList);
    if (!files.length) return;

    const current = attachedFilesRef.current;
    const existingKeys = new Set(current.map((item) => `${item.name}_${item.size}_${item.lastModified}`));
    const remainingSlots = MAX_ATTACHMENT_COUNT - current.length;
    const accepted = [];
    const rejected = [];

    files.forEach((file) => {
      const key = `${file.name}_${file.size}_${file.lastModified}`;
      if (!ACCEPTED_ATTACHMENT_TYPES.has(file.type)) {
        rejected.push(`${file.name}: sai định dạng`);
        return;
      }
      if (file.size > MAX_ATTACHMENT_SIZE) {
        rejected.push(`${file.name}: quá 15MB`);
        return;
      }
      if (existingKeys.has(key)) {
        rejected.push(`${file.name}: đã chọn`);
        return;
      }
      if (accepted.length >= remainingSlots) {
        rejected.push(`${file.name}: vượt quá ${MAX_ATTACHMENT_COUNT} ảnh`);
        return;
      }
      accepted.push({
        id: `${key}_${Date.now()}_${accepted.length}`,
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        previewUrl: URL.createObjectURL(file),
      });
      existingKeys.add(key);
    });

    const nextFiles = [...current, ...accepted];
    attachedFilesRef.current = nextFiles;
    setAttachedFiles(nextFiles);
    setWarning(rejected.length > 0 ? `Một số tập tin không được thêm: ${rejected.join('; ')}.` : '');
  };

  const removeAttachedFile = (fileId) => {
    setAttachedFiles((current) => {
      const removed = current.find((item) => item.id === fileId);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      const nextFiles = current.filter((item) => item.id !== fileId);
      attachedFilesRef.current = nextFiles;
      return nextFiles;
    });
  };

  if (screen === 'ticket' && appointment) {
    return <TrangPhieuKham appointment={appointment} user={user} onLogout={onBackHome} />;
  }

  if (screen === 'success' && appointment) {
    return (
      <ManHinhDatLichThanhCong
        appointment={appointment}
        image={appointment.doctorImage}
        fallback={lay_ten_tat(appointment.doctorShortName)}
        onViewTicket={() => setScreen('ticket')}
      />
    );
  }

  if (screen === 'booking') {
    return (
      <section className="hospital-booking-page">
        <div className="hospital-booking-title">
          <button type="button" onClick={handleBack}>â†</button>
          <h1>{hospital.name}</h1>
        </div>
        <div className="hospital-booking-grid">
          <article className="hospital-patient-panel hospital-step-panel">
            <header><BuocDatKham step={step} unlockedStep={unlockedStep} onStepClick={setStep} /></header>
            <div className="hospital-patient-content hospital-step-content" key={step}>
              {step === 1 && (
                <>
                  <h2>Chọn dịch vụ...</h2>
                  <div className="hospital-fee-note">BHYT thường được tính theo mức quỹ BHYT chi trả 80%, người bệnh thanh toán 20% phí khám chuyên khoa.</div>
                  <div className="hospital-insurance-list">
                    {serviceOptions.map((service) => (
                      <button
                        className={selectedService?.id === service.id ? 'hospital-insurance-check selected' : 'hospital-insurance-check'}
                        key={service.id}
                        type="button"
                        onClick={() => chooseWithResetConfirm(1, selectedService?.id !== service.id, () => setInsuranceChoice(service.insuranceType))}
                      >
                        <span>
                          <strong>{service.name}</strong>
                          <small>{service.fee}</small>
                        </span>
                        <i />
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h2>Chọn chuyên khoa...</h2>
                  <div className="hospital-option-list">
                    {specialtyOptions.length > 0 ? specialtyOptions.map((specialty) => (
                      <button className={selectedSpecialty?.name === specialty.name ? 'hospital-option-card selected' : 'hospital-option-card'} key={specialty.name} type="button" onClick={() => chooseWithResetConfirm(2, selectedSpecialty?.name !== specialty.name, () => setSelectedSpecialty(specialty))}>
                        <span><strong>{specialty.name}</strong><small>{specialty.description}</small></span>
                        <b className="hospital-option-price">{formatCurrency(calculateAppointmentPrice(specialty.name, hasStandardInsurance).finalAmount)}</b>
                        <i />
                      </button>
                    )) : <p className="hospital-empty-options">Bệnh viện này chưa có chuyên khoa đặt khám trên hệ thống.</p>}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h2>Chọn thời gian khám...</h2>
                  <LichThang
                    error={slotError}
                    bookedDateMap={bookedDateMap}
                    isLoading={isLoadingSlots}
                    monthDate={calendarMonth}
                    selectedDate={selectedDate}
                    slotDates={slotDates}
                    onMonthChange={(amount) => setCalendarMonth((current) => cong_thang(current, amount))}
                    onSelectDate={(date) => chooseWithResetConfirm(3, selectedDate?.value !== date.value, () => setSelectedDate(date))}
                  />
                </>
              )}

              {step === 4 && (
                <>
                  <h2>Chọn giờ khám...</h2>
                  {selectedDate && bookedDateMap.has(selectedDate.value) && (
                    <p className="hospital-booked-note">
                      Bạn đã có lịch đặt vào ngày này. Khung giờ đã đặt sẽ được đánh dấu và không thể chọn lại.
                    </p>
                  )}
                  <section className="hospital-time-section">
                    <h3>Buổi sáng</h3>
                    <div className="hospital-time-grid">
                      {morningSlots.length > 0 ? morningSlots.map((slot) => {
                        const isBooked = bookedSlotKeys.has(`${slot.date}|${slot.startTime}`);
                        return (
                          <button
                            className={[selectedTime?.id === slot.id ? 'selected' : '', isBooked ? 'booked' : ''].filter(Boolean).join(' ')}
                            disabled={isBooked}
                            key={slot.id}
                            type="button"
                            onClick={() => chooseWithResetConfirm(4, selectedTime?.id !== slot.id, () => setSelectedTime(slot))}
                          >
                            <span>{slot.label}</span>
                            {isBooked && <small>Đã đặt</small>}
                          </button>
                        );
                      }) : <p className="hospital-time-empty">Không có khung giờ buổi sáng.</p>}
                    </div>
                  </section>
                  <section className="hospital-time-section">
                    <h3>Buổi chiều</h3>
                    <div className="hospital-time-grid">
                      {afternoonSlots.length > 0 ? afternoonSlots.map((slot) => {
                        const isBooked = bookedSlotKeys.has(`${slot.date}|${slot.startTime}`);
                        return (
                          <button
                            className={[selectedTime?.id === slot.id ? 'selected' : '', isBooked ? 'booked' : ''].filter(Boolean).join(' ')}
                            disabled={isBooked}
                            key={slot.id}
                            type="button"
                            onClick={() => chooseWithResetConfirm(4, selectedTime?.id !== slot.id, () => setSelectedTime(slot))}
                          >
                            <span>{slot.label}</span>
                            {isBooked && <small>Đã đặt</small>}
                          </button>
                        );
                      }) : <p className="hospital-time-empty">Không có khung giờ buổi chiều.</p>}
                    </div>
                  </section>
                </>
              )}

              {step === 5 && (
                <>
                  <h2>Chọn hồ sơ cần khám...</h2>
                  <button
                    className={[
                      selectedPatient ? 'hospital-patient-card selected' : 'hospital-patient-card',
                      activePatientMissingFields.length > 0 ? 'has-warning' : '',
                    ].filter(Boolean).join(' ')}
                    type="button"
                    onClick={() => setSelectedPatient(activePatient)}
                  >
                    <div className="hospital-patient-avatar">{lay_ten_tat(activePatient.name)}</div>
                    <div>
                      <h3>{activePatient.name || 'Chưa có hồ sơ bệnh nhân'}</h3>
                      <p>Ngày sinh: <b>{activePatient.birthDate || '--'}</b></p>
                      <p>Số điện thoại: <b>{activePatient.phone || '--'}</b></p>
                      <small className={activePatientMissingFields.length > 0 ? 'warning' : ''}>
                        {activePatientMissingFields.length > 0 ? 'Cần cập nhật' : 'Chính'}
                      </small>
                      <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); openProfileModal('view', activePatient); }}>Xem chi tiết hồ sơ</span>
                    </div>
                    <i />
                  </button>

                  {selectedPatient && activePatientMissingFields.length > 0 && (
                    <div className="hospital-missing-profile">
                      <span>Vui lòng nhập đầy đủ thông tin trong hồ sơ. Còn thiếu: {activePatientMissingFields.join(', ')}.</span>
                      <button type="button" onClick={() => openProfileModal('edit', activePatient)}>Cập nhật ngay</button>
                    </div>
                  )}

                  <div className="hospital-add-profile">
                    <button type="button" onClick={() => setShowPatientType((current) => !current)}>+ Thêm hồ sơ mới</button>
                    {showPatientType && (
                      <div className="hospital-patient-popover">
                        <strong>Bạn đã từng khám?</strong>
                        <button type="button" onClick={() => setIsSearchingExistingProfile((current) => !current)}>Đã từng khám, tìm hồ sơ <span>⌕</span></button>
                        {isSearchingExistingProfile && (
                          <div className="hospital-profile-search">
                            <input value={profileSearchTerm} placeholder="Nhập tên, SĐT, ngày sinh..." onChange={(event) => setProfileSearchTerm(event.target.value)} />
                            <div>
                              {searchableProfiles.length > 0 ? searchableProfiles.map((profile) => (
                                <button key={`${profile.id || profile.name}-${profile.phone}`} type="button" onClick={() => selectExistingProfile(profile)}>
                                  <span>
                                    <b>{profile.name}</b>
                                    <small>{profile.birthDate || '--'} - {profile.phone || '--'}</small>
                                  </span>
                                </button>
                              )) : <p>Không tìm thấy hồ sơ phù hợp.</p>}
                            </div>
                          </div>
                        )}
                        <button type="button" onClick={() => { setShowPatientType(false); setIsSearchingExistingProfile(false); openProfileModal('add'); }}>Chưa từng khám, tạo hồ sơ mới <span>⛶</span></button>
                      </div>
                    )}
                  </div>

                  <div className="hospital-extra-info">
                    <h3>Thông tin bổ sung (không bắt buộc)...</h3>
                    <label>Nội dung<textarea value={note} placeholder="Triệu chứng, thuốc đang dùng, tiền sử, ..." onChange={(event) => setNote(event.target.value)} /></label>
                    <button
                      className={[
                        'hospital-upload-box',
                        isDraggingFiles ? 'dragging' : '',
                        attachedFiles.length >= MAX_ATTACHMENT_COUNT ? 'full' : '',
                      ].filter(Boolean).join(' ')}
                      disabled={attachedFiles.length >= MAX_ATTACHMENT_COUNT}
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      onDragEnter={(event) => { event.preventDefault(); setIsDraggingFiles(true); }}
                      onDragLeave={(event) => { event.preventDefault(); setIsDraggingFiles(false); }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        setIsDraggingFiles(false);
                        handleFiles(event.dataTransfer.files);
                      }}
                    >
                      <span>â–§</span>
                      <strong>{attachedFiles.length >= MAX_ATTACHMENT_COUNT ? 'Đã đủ 5 ảnh' : 'Chọn tập tin'}</strong>
                      <em>hoặc kéo & thả tối đa {MAX_ATTACHMENT_COUNT} ảnh</em>
                      <small>Size thấp hơn 15MB, định dạng file png, jpg.</small>
                    </button>
                    <input
                      accept="image/png,image/jpeg"
                      hidden
                      multiple
                      ref={fileInputRef}
                      type="file"
                      onChange={(event) => {
                        handleFiles(event.target.files);
                        event.target.value = '';
                      }}
                    />
                    {attachedFiles.length > 0 && (
                      <div className="hospital-file-list">
                        {attachedFiles.map((file) => (
                          <figure key={file.id}>
                            <img src={file.previewUrl} alt={file.name} />
                            <figcaption>
                              <strong>{file.name}</strong>
                              <small>{hien_thi_dung_luong(file.size)}</small>
                            </figcaption>
                            <button type="button" aria-label={`Xóa ${file.name}`} onClick={() => removeAttachedFile(file.id)}>×</button>
                          </figure>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <footer>
              <button className={canGoPreviousStep ? 'hospital-back-button active' : 'hospital-back-button'} type="button" onClick={handleBack}>Quay lại</button>
              <button type="button" disabled={!canContinue || isSubmitting} onClick={handleNext}>{step === 5 ? (isSubmitting ? 'Đang tạo thanh toán...' : 'Xác nhận và thanh toán PayPal') : 'Tiếp tục'}</button>
            </footer>
          </article>

          <ThongTinDatKham
            attachments={attachedFiles}
            date={selectedDate}
            note={note}
            patient={selectedPatient}
            service={selectedService}
            specialty={selectedSpecialty}
            time={selectedTime}
          />
        </div>
        <ModalThongBao message={warning} onClose={() => setWarning('')} />
        {pendingChange && (
          <ModalXacNhanDoiLuaChon
            onCancel={() => setPendingChange(null)}
            onConfirm={confirmPendingChange}
          />
        )}
        {profileModalMode && profileDraft && (
          <ModalHoSo
            mode={profileModalMode}
            profile={profileDraft}
            errors={profileErrors}
            canSave={Boolean(canSaveProfileDraft) && !isSavingProfile}
            onChange={updateProfileDraft}
            onClose={() => setProfileModalMode(null)}
            onEdit={() => setProfileModalMode('edit')}
            onSave={saveProfile}
            onAddGuardian={addGuardian}
            onGuardianChange={updateGuardian}
            onRemoveGuardian={removeGuardian}
          />
        )}
      </section>
    );
  }

  return (
    <section className="hospital-detail-page">
      <div className="hospital-detail-head">
        <div className="breadcrumb">Trang chủ <span>/</span> Bệnh viện</div>
        <button className="favorite-button hospital-favorite" type="button">♡ Yêu thích</button>
        <div className="hospital-title-row">
          <img src={anh_benh_vien(hospital.avatar)} alt={hospital.name} />
          <div>
            <h1>{hospital.name}</h1>
            <p>{hospital.subtitle}</p>
            <button type="button" onClick={openHospitalMap}>◆ Địa chỉ</button>
          </div>
        </div>
      </div>
      <nav className="hospital-tabs">
        <button type="button" onClick={() => scrollToSection('hospital-info')}>Thông tin</button>
        <button type="button" onClick={() => scrollToSection('hospital-specialties')}>Chuyên khám</button>
      </nav>
      <div className="hospital-gallery">
        <button className="main" type="button" onClick={() => setGalleryIndex(0)}>
          <img src={hospitalImages[0].src} alt={hospitalImages[0].alt} />
        </button>
        <button type="button" onClick={() => setGalleryIndex(1)}>
          <img src={hospitalImages[1].src} alt={hospitalImages[1].alt} />
        </button>
        <button className="gallery-placeholder" type="button" onClick={() => setGalleryIndex(0)}>Y</button>
        <button className="gallery-count" type="button" onClick={() => setGalleryIndex(0)}>📷 {hospitalImages.length}</button>
      </div>
      <button className="hospital-detail-book" type="button" onClick={() => setScreen('booking')}>Đặt khám ngay</button>
      <section className="hospital-info-grid" id="hospital-info">
        <article>
          <h2>Giới thiệu</h2>
          <div className={isIntroExpanded ? 'hospital-intro expanded' : 'hospital-intro'}>
            <p>{hospital.intro}</p>
            {isIntroExpanded && hospital.notes?.map((note) => (
              <div className="hospital-intro-note" key={note.title}>
                <strong>{note.title}</strong>
                {note.lines.map((line) => <p key={line}>{line}</p>)}
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setIsIntroExpanded((value) => !value)}>
            {isIntroExpanded ? 'Thu gọn' : '...Xem thêm'}
            <i className={`ui-chevron ${isIntroExpanded ? 'up' : 'down'}`} aria-hidden="true" />
          </button>
        </article>
        <article>
          <h2>Giờ làm việc</h2>
          <dl>{hospital.hours.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.time}</dd></div>)}</dl>
        </article>
      </section>
      <section className="hospital-info-grid" id="hospital-specialties">
        <article>
          <h2>Chuyên khoa</h2>
          <div className="hospital-tag-list">{hospital.specialties.map((item) => <span key={item}>✓ {item}</span>)}</div>
        </article>
        <article>
          <h2>Chuyên khám</h2>
          <div className="hospital-tag-list">{hospital.specialties.slice(0, 6).map((item) => <span key={item}>{item}</span>)}</div>
        </article>
      </section>
      <ModalThongBao message={warning} onClose={() => setWarning('')} />
      {showNotice && <ModalLuuY hospital={hospital} onClose={() => setShowNotice(false)} />}
      {galleryIndex !== null && (
        <ModalAnhBenhVien
          images={hospitalImages}
          activeIndex={galleryIndex}
          onSelect={setGalleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      )}
    </section>
  );
}

export default TrangDatLichBenhVien;
