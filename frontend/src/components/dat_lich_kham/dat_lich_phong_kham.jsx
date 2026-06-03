import { useEffect, useMemo, useRef, useState } from 'react';
import TrangPhieuKham, { PhieuKhamChiTiet, co_gia_tri, tao_dong_phieu_kham } from './phieu_kham-dien-tu';
import { createAppointment, listAppointments, listPatientProfiles, savePatientProfile } from '../../lib/appointments';
import { useReferenceData } from '../../lib/reference_data';
import {
  chuan_hoa_bhyt,
  chuan_hoa_cmnd_cccd,
  chuan_hoa_so_dien_thoai,
  kiem_tra_bhyt,
  kiem_tra_ngay_sinh,
} from '../../data/du_lieu_ho_so';

function anh_phong_kham(path) {
  if (!path) return '';
  if (/^(https?:)?\/\//.test(path) || path.startsWith('/')) return path;
  return `/image_phong_kham/${path}`;
}

function lay_ten_tat(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'BN';
  return parts.slice(-2).map((part) => part[0]).join('').toUpperCase();
}

function luu_lich_kham(appointment) {
  const current = JSON.parse(localStorage.getItem('midhealth_appointments') || '[]');
  localStorage.setItem('midhealth_appointments', JSON.stringify([appointment, ...current.filter((item) => (item.id || item.ticket) !== (appointment.id || appointment.ticket))]));
}

function doc_lich_hen_cuc_bo() {
  try {
    const appointments = JSON.parse(localStorage.getItem('midhealth_appointments') || '[]');
    return Array.isArray(appointments) ? appointments : [];
  } catch {
    return [];
  }
}

function gia_tri_ngay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function hien_thi_ngay(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
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

function slot_chua_qua_gio(slot) {
  if (!slot?.date || !slot?.startTime) return false;
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

function tao_lich_phong_kham_tinh(clinicId, monthDate) {
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const times = ['07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '17:00', '17:30', '18:00', '18:30'];
  const slots = [];

  Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), index + 1);
    if (date.getDay() === 0) return;
    const dateValue = gia_tri_ngay(date);
    times.forEach((start) => {
      const end = cong_phut(start, 30);
      slots.push({
        id: `static-clinic-${clinicId}-${dateValue}-${start}`,
        clinicId,
        date: dateValue,
        startTime: start,
        endTime: end,
        label: `${start} - ${end}`,
        session: start < '12:00' ? 'morning' : 'afternoon',
        capacity: 4,
        bookedCount: 0,
        status: 'available',
      });
    });
  });

  return slots.filter(slot_chua_qua_gio);
}

function chuyen_ho_so_tu_api(profile) {
  return {
    id: profile.id,
    name: profile.full_name || profile.fullName || profile.name || '',
    birthDate: hien_thi_ngay(profile.date_of_birth || profile.birthDate || ''),
    phone: profile.phone || '',
    gender: profile.gender === 'female' ? 'Nữ' : profile.gender === 'male' ? 'Nam' : profile.gender || '',
    citizenId: profile.citizen_id || profile.citizenId || '',
    email: profile.email || '',
    province: profile.province || '',
    district: profile.district || '',
    ward: profile.ward || '',
    address: profile.address || '',
    ethnicity: profile.ethnicity || '',
    job: profile.occupation || profile.job || '',
    insuranceCode: profile.health_insurance_number || profile.insuranceCode || '',
    relationship: profile.relationship || '',
  };
}

function tao_ho_so_tu_tai_khoan(user) {
  return {
    id: '',
    name: '',
    birthDate: '',
    phone: '',
    gender: '',
    email: '',
    address: '',
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
    relationship: 'Khác',
    isMain: false,
  };
}

function chuan_hoa_ho_so(profile) {
  return {
    ...profile,
    phone: chuan_hoa_so_dien_thoai(profile.phone || ''),
    citizenId: chuan_hoa_cmnd_cccd(profile.citizenId || ''),
    insuranceCode: chuan_hoa_bhyt(profile.insuranceCode || ''),
  };
}

function gop_ho_so(profiles) {
  const seen = new Set();
  return profiles.filter((profile) => {
    const key = `${profile.id || ''}|${profile.name || ''}|${profile.phone || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return profile.name || profile.phone;
  });
}

function dia_chi_day_du(profile) {
  return [profile.address, profile.ward, profile.district, profile.province].filter(Boolean).join(', ') || 'Chưa cập nhật';
}

function danh_sach_thieu_ho_so(profile) {
  const missing = [];
  if (!profile?.name?.trim()) missing.push('Họ và tên');
  if (!profile?.phone || profile.phone.length !== 10) missing.push('Số điện thoại 10 số');
  if (!kiem_tra_ngay_sinh(profile?.birthDate || '')) missing.push('Ngày sinh đúng dd/mm/yyyy');
  if (!profile?.gender) missing.push('Giới tính');
  if (profile?.citizenId && ![9, 12].includes(profile.citizenId.length)) missing.push('Số CCCD/CMND hợp lệ');
  if (profile?.insuranceCode && !kiem_tra_bhyt(profile.insuranceCode)) missing.push('Mã BHYT hợp lệ');
  if (profile?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) missing.push('Email hợp lệ');
  return missing;
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

function cung_phong_kham(appointment, clinic) {
  const name = appointment?.clinicName || appointment?.facilityName || appointment?.hospitalName || appointment?.doctorName || '';
  return name === clinic.name;
}

function tai_anh_phieu(appointment) {
  const { bookingRows, patientRows } = tao_dong_phieu_kham(appointment);
  const rows = [...bookingRows, ...patientRows].filter((row) => co_gia_tri(row.value));
  const canvas = document.createElement('canvas');
  canvas.width = 920;
  canvas.height = Math.max(760, 390 + rows.length * 36);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#16c784';
  ctx.beginPath();
  ctx.arc(460, 70, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 34px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('✓', 460, 82);
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 26px Arial';
  ctx.fillText('Đặt lịch thành công!', 460, 135);
  ctx.font = '700 42px Arial';
  ctx.fillStyle = '#16c784';
  ctx.fillText(String(appointment.number), 460, 210);
  ctx.font = '700 20px Arial';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('STT', 460, 172);
  ctx.textAlign = 'left';
  rows.forEach((row, index) => {
    const y = 290 + index * 34;
    ctx.fillStyle = '#64748b';
    ctx.font = '18px Arial';
    ctx.fillText(row.label, 80, y);
    ctx.fillStyle = row.highlight ? '#16a34a' : '#0f172a';
    ctx.font = '700 18px Arial';
    ctx.fillText(String(row.value), 360, y);
  });
  const link = document.createElement('a');
  link.download = `${appointment.appointmentCode || 'phieu-kham-dien-tu'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function ManHinhDatLichThanhCong({ appointment, image, fallback, onViewTicket }) {
  return (
    <section className="booking-success-page">
      <article className="booking-success-card">
        <div className="success-check">✓</div>
        <h1>Đặt lịch thành công!</h1>
        <div className="success-ticket-head"><div><span>STT</span><strong>{appointment.number}</strong></div></div>
        <div className="success-doctor-row">
          {image ? <img src={image} alt={appointment.doctorName} /> : <div className="profile-avatar small">{fallback}</div>}
          <div>
            <h2>{appointment.doctorName}</h2>
            <p>{appointment.address}</p>
          </div>
        </div>
        <PhieuKhamChiTiet appointment={appointment} />
        <div className="success-actions">
          <button type="button" onClick={onViewTicket}>Xem phiếu khám điện tử</button>
          <button type="button" onClick={() => tai_anh_phieu(appointment)}>Lưu lại phiếu</button>
        </div>
      </article>
    </section>
  );
}

function ModalAnhPhongKham({ images, activeIndex, onSelect, onClose }) {
  const activeImage = images[activeIndex] || images[0];
  if (!activeImage) return null;

  return (
    <div className="gallery-modal-backdrop" onClick={onClose}>
      <div className="gallery-modal" onClick={(event) => event.stopPropagation()}>
        <div className="gallery-modal-head">
          <h3>Hình ảnh phòng khám</h3>
          <button type="button" onClick={onClose}>×</button>
        </div>
        <img className="gallery-modal-main" src={activeImage.src} alt={activeImage.alt} />
        <div className="gallery-modal-thumbs">
          {images.map((image, index) => (
            <button className={index === activeIndex ? 'active' : ''} key={`${image.src}_${index}`} type="button" onClick={() => onSelect(index)}>
              <img src={image.src} alt={image.alt} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BuocPhongKham({ steps, step, unlockedStep, completedKeys, onStepClick }) {
  return (
    <div className="hospital-stepper clinic-stepper">
      {steps.slice(0, unlockedStep).map((item, index) => {
        const number = index + 1;
        const isActive = number === step;
        const isDone = number < step || (number < unlockedStep && number !== step) || completedKeys.has(item.key);
        const className = [isActive ? 'active' : '', isDone ? 'done' : ''].filter(Boolean).join(' ');
        return (
          <button className={className} key={item.key} type="button" onClick={() => onStepClick(number)}>
            <i>{isDone ? '✓' : number}</i>{item.label}
          </button>
        );
      })}
    </div>
  );
}

function LichPhongKham({ monthDate, selectedDate, slotDates, isLoading, error, onMonthChange, onSelectDate }) {
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
      const availableCount = stats?.available || 0;
      const totalCount = stats?.total || 0;
      const isPast = value < todayValue;
      return {
        key: value,
        value,
        day: index + 1,
        display: hien_thi_ngay(value),
        today: value === todayValue,
        available: !isPast && availableCount > 0,
        full: !isPast && totalCount > 0 && availableCount === 0,
        disabled: isPast || availableCount === 0,
      };
    }),
  ];
  const monthPrefix = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
  const hasAnySchedule = Array.from(slotDates.keys()).some((value) => value.startsWith(monthPrefix));

  return (
    <div className="hospital-calendar clinic-calendar">
      <div className="hospital-calendar-head">
        <button type="button" disabled={gia_tri_ngay(cong_thang(monthDate, -1)) < gia_tri_ngay(dau_thang())} onClick={() => onMonthChange(-1)}><i className="ui-chevron left" aria-hidden="true" /></button>
        <strong>{ten_thang(monthDate)}</strong>
        <button type="button" onClick={() => onMonthChange(1)}><i className="ui-chevron right" aria-hidden="true" /></button>
      </div>
      <div className="hospital-calendar-week">
        {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'].map((day) => <b key={day}>{day}</b>)}
      </div>
      {isLoading && <p className="hospital-calendar-message">Đang tải lịch khám...</p>}
      {!isLoading && error && <p className="hospital-calendar-message error">{error}</p>}
      {!isLoading && !error && !hasAnySchedule && <p className="hospital-calendar-message">Hiện chưa có lịch khám cho ngày này.</p>}
      <div className="hospital-calendar-grid">
        {cells.map((cell) => {
          if (cell.blank) return <span className="calendar-day blank" key={cell.key} />;
          const className = [
            'calendar-day',
            cell.available ? 'available' : 'disabled',
            cell.full ? 'full' : '',
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
      </div>
    </div>
  );
}

function ThongTinDatKhamPhongKham({ clinic, service, specialty, date, time, patient }) {
  return (
    <aside className="hospital-booking-summary detailed">
      <h2>Thông tin đặt khám</h2>
      <div><p>Phòng khám</p><strong>{clinic.name}</strong></div>
      <div><p>Dịch vụ</p><strong>{service?.name || '--'}</strong></div>
      <div><p>Chuyên khoa</p><strong>{specialty?.name || '--'}</strong></div>
      <div><p>Ngày và giờ khám</p><strong>{date ? date.display : '--'}</strong>{time && <strong>Giờ khám {time.label}</strong>}</div>
      <div><p>Bệnh nhân</p><strong>{patient ? `${patient.name || '--'} - ${patient.phone || '--'}` : '--'}</strong></div>
      <div><p>Địa điểm</p><strong>{clinic.address}</strong></div>
    </aside>
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
      <input name={name} value={value || ''} placeholder={placeholder} onChange={onChange} />
      {error && <small>{error}</small>}
    </label>
  );
}

function SelectField({ label, name, value, children, placeholder, onChange, error }) {
  return (
    <label className={error ? 'hospital-profile-field has-error' : 'hospital-profile-field'}>
      <span>{label}</span>
      <select name={name} value={value || ''} onChange={onChange}>
        <option value="">{placeholder}</option>
        {children}
      </select>
      {error && <small>{error}</small>}
    </label>
  );
}

function ModalHoSoPhongKham({ mode, profile, errors = {}, canSave, isSaving, onClose, onEdit, onChange, onSave }) {
  const { addressData, ethnicGroups, occupations } = useReferenceData();
  const selectedProvince = addressData.find((item) => item.name === profile.province);
  const selectedDistrict = selectedProvince?.districts.find((item) => item.name === profile.district);
  const isAdding = mode === 'add';
  const isEditing = mode === 'edit' || isAdding;

  return (
    <div className="notice-modal-backdrop">
      <article className={isAdding ? 'hospital-profile-modal adding' : 'hospital-profile-modal'}>
        <header>
          <h2>{isEditing ? (isAdding ? 'Thêm hồ sơ mới' : 'Cập nhật hồ sơ') : 'Chi tiết hồ sơ'}</h2>
          <button type="button" onClick={onClose}>×</button>
        </header>

        {isEditing ? (
          <div className="hospital-profile-form">
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
            <SelectField label="Tỉnh / Thành phố" name="province" value={profile.province} placeholder="Chọn Tỉnh / Thành phố" onChange={onChange}>
              {addressData.map((province) => <option key={province.name}>{province.name}</option>)}
            </SelectField>
            <SelectField label="Quận / Huyện" name="district" value={profile.district} placeholder="Chọn Quận / Huyện" onChange={onChange}>
              {(selectedProvince?.districts || []).map((district) => <option key={district.name}>{district.name}</option>)}
            </SelectField>
            <SelectField label="Phường / Xã" name="ward" value={profile.ward} placeholder="Chọn Phường / Xã" onChange={onChange}>
              {(selectedDistrict?.wards || []).map((ward) => <option key={ward}>{ward}</option>)}
            </SelectField>
            <Field label="Địa chỉ cụ thể" name="address" value={profile.address} placeholder="Số nhà, tên đường" onChange={onChange} />
            <Field label="Số CMND/CCCD" name="citizenId" value={profile.citizenId} placeholder="Số CMND hoặc CCCD" onChange={onChange} error={errors.citizenId} />
            <SelectField label="Dân tộc" name="ethnicity" value={profile.ethnicity} placeholder="Chọn dân tộc" onChange={onChange}>
              {ethnicGroups.map((item) => <option key={item}>{item}</option>)}
            </SelectField>
            <SelectField label="Nghề nghiệp" name="job" value={profile.job} placeholder="Chọn nghề nghiệp" onChange={onChange}>
              {occupations.map((item) => <option key={item}>{item}</option>)}
            </SelectField>
            <Field label="Mã thẻ BHYT" name="insuranceCode" value={profile.insuranceCode} placeholder="Mã số trên thẻ bảo hiểm y tế" onChange={onChange} error={errors.insuranceCode} />
            <Field label="Email" name="email" value={profile.email} placeholder="Địa chỉ email" onChange={onChange} error={errors.email} />
          </div>
        ) : (
          <div className="hospital-profile-view">
            <div className="hospital-profile-avatar">{lay_ten_tat(profile.name)}</div>
            <div className="hospital-profile-table">
              <DongHoSo label="Họ và tên" value={profile.name} />
              <DongHoSo label="Ngày sinh" value={profile.birthDate} />
              <DongHoSo label="Số điện thoại" value={profile.phone} />
              <DongHoSo label="Giới tính" value={profile.gender} />
              <DongHoSo label="Số CCCD" value={profile.citizenId} />
              <DongHoSo label="Địa chỉ email" value={profile.email} />
              <DongHoSo label="Địa chỉ" value={dia_chi_day_du(profile)} />
              <DongHoSo label="Dân tộc" value={profile.ethnicity} />
              <DongHoSo label="Nghề nghiệp" value={profile.job} />
              <DongHoSo label="Mã BHYT" value={profile.insuranceCode} />
            </div>
          </div>
        )}

        {Object.values(errors).some(Boolean) && <p className="hospital-profile-form-error">Vui lòng kiểm tra lại thông tin hồ sơ.</p>}
        <footer>
          <button type="button" onClick={onClose}>Thoát</button>
          {isEditing ? (
            <button type="button" disabled={!canSave || isSaving} onClick={onSave}>{isSaving ? 'Đang lưu...' : 'Lưu hồ sơ'}</button>
          ) : (
            <button type="button" onClick={onEdit}>Thay đổi thông tin</button>
          )}
        </footer>
      </article>
    </div>
  );
}

function TrangDatLichPhongKham({ clinic, initialScreen = 'detail', user, onBackHome, onScreenChange }) {
  const [screen, setScreen] = useState(initialScreen);
  const [step, setStep] = useState(1);
  const [unlockedStep, setUnlockedStep] = useState(1);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientProfiles, setPatientProfiles] = useState([]);
  const [profileModalMode, setProfileModalMode] = useState(null);
  const [profileDraft, setProfileDraft] = useState(null);
  const [profileErrors, setProfileErrors] = useState({});
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showPatientType, setShowPatientType] = useState(false);
  const [isSearchingExistingProfile, setIsSearchingExistingProfile] = useState(false);
  const [profileSearchTerm, setProfileSearchTerm] = useState('');
  const [clinicSlots, setClinicSlots] = useState([]);
  const [calendarMonth, setCalendarMonth] = useState(() => dau_thang());
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState('');
  const [bookedAppointments, setBookedAppointments] = useState(() => doc_lich_hen_cuc_bo());
  const [note, setNote] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [galleryIndex, setGalleryIndex] = useState(null);
  const [isIntroExpanded, setIsIntroExpanded] = useState(false);
  const [appointment, setAppointment] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warning, setWarning] = useState('');
  const fileInputRef = useRef(null);

  const serviceOptions = useMemo(() => (clinic.services || []).map((service) => ({
    id: service.id,
    name: service.name,
    description: service.description || 'Dịch vụ khám tại phòng khám',
    fee: service.fee || 'Thanh toán tại phòng khám',
    specialtyId: service.specialtyId,
  })), [clinic.services]);

  const specialtyOptions = useMemo(() => (clinic.specialties || []).map((specialty) => ({
    name: specialty,
    description: `Khám và tư vấn chuyên khoa ${String(specialty).toLowerCase()} tại ${clinic.name}`,
  })), [clinic.name, clinic.specialties]);

  const steps = useMemo(() => [
    { key: 'service', label: 'Dịch vụ' },
    ...(specialtyOptions.length ? [{ key: 'specialty', label: 'Chuyên khoa' }] : []),
    { key: 'date', label: 'Ngày khám' },
    { key: 'time', label: 'Giờ khám' },
    { key: 'patient', label: 'Bệnh nhân' },
  ], [specialtyOptions.length]);

  const currentStep = steps[step - 1]?.key || 'service';

  const clinicImages = useMemo(() => {
    const images = (clinic.gallery?.length ? clinic.gallery : [clinic.avatar]).filter(Boolean);
    return images.map((image, index) => ({
      src: anh_phong_kham(image),
      alt: `${clinic.name} ${index + 1}`,
    }));
  }, [clinic]);

  useEffect(() => {
    onScreenChange?.(screen);
  }, [screen]);

  useEffect(() => {
    setScreen(initialScreen);
  }, [clinic.id, initialScreen]);

  const slotDates = useMemo(() => {
    const stats = new Map();
    clinicSlots.forEach((slot) => {
      const current = stats.get(slot.date) || { total: 0, available: 0 };
      current.total += 1;
      if (slot_con_hieu_luc(slot)) current.available += 1;
      stats.set(slot.date, current);
    });
    return stats;
  }, [clinicSlots]);

  const clinicBookedAppointments = useMemo(() => bookedAppointments
    .filter(lich_hen_dang_hieu_luc)
    .filter((item) => cung_phong_kham(item, clinic))
    .filter((item) => ngay_lich_hen(item) >= gia_tri_ngay()), [bookedAppointments, clinic]);

  const bookedSlotKeys = useMemo(() => new Set(clinicBookedAppointments
    .map((item) => `${ngay_lich_hen(item)}|${gio_bat_dau_lich_hen(item)}`)
    .filter((key) => !key.endsWith('|'))), [clinicBookedAppointments]);

  const slotsForSelectedDate = useMemo(() => (
    selectedDate ? clinicSlots.filter((slot) => slot.date === selectedDate.value && slot_con_hieu_luc(slot)) : []
  ), [clinicSlots, selectedDate]);

  const morningSlots = useMemo(() => slotsForSelectedDate.filter((slot) => slot.session === 'morning'), [slotsForSelectedDate]);
  const afternoonSlots = useMemo(() => slotsForSelectedDate.filter((slot) => slot.session !== 'morning'), [slotsForSelectedDate]);
  const patientProfile = useMemo(() => (
    selectedPatient || patientProfiles[0] || tao_ho_so_tu_tai_khoan(user)
  ), [patientProfiles, selectedPatient, user]);
  const searchableProfiles = useMemo(() => {
    const keyword = profileSearchTerm.trim().toLowerCase();
    return gop_ho_so(patientProfiles).filter((profile) => {
      if (!keyword) return true;
      return [profile.name, profile.phone, profile.birthDate, profile.citizenId]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [patientProfiles, profileSearchTerm]);
  const completedStepKeys = useMemo(() => new Set([
    selectedService ? 'service' : '',
    selectedSpecialty ? 'specialty' : '',
    selectedDate ? 'date' : '',
    selectedTime ? 'time' : '',
    selectedPatient ? 'patient' : '',
  ].filter(Boolean)), [selectedDate, selectedPatient, selectedService, selectedSpecialty, selectedTime]);

  const canContinue = currentStep === 'service' ? selectedService
    : currentStep === 'specialty' ? selectedSpecialty
      : currentStep === 'date' ? selectedDate
        : currentStep === 'time' ? selectedTime
          : selectedPatient?.name;
  const canGoPreviousStep = step > 1;
  const canSaveProfileDraft = useMemo(() => {
    if (!profileDraft) return false;
    return profileDraft.name?.trim()
      && profileDraft.phone?.length === 10
      && kiem_tra_ngay_sinh(profileDraft.birthDate || '')
      && profileDraft.gender
      && (!profileDraft.citizenId || [9, 12].includes(profileDraft.citizenId.length))
      && (!profileDraft.insuranceCode || kiem_tra_bhyt(profileDraft.insuranceCode))
      && (!profileDraft.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileDraft.email));
  }, [profileDraft]);

  const scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const openClinicMap = () => {
    const latitude = Number(clinic.latitude);
    const longitude = Number(clinic.longitude);
    const mapQuery = Number.isFinite(latitude) && Number.isFinite(longitude)
      ? `${latitude},${longitude}`
      : clinic.address?.trim();

    if (!mapQuery) {
      setWarning('Chưa có địa chỉ phòng khám.');
      return;
    }

    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    setStep(1);
    setUnlockedStep(1);
    setSelectedService(null);
    setSelectedSpecialty(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setProfileModalMode(null);
    setProfileDraft(null);
    setProfileErrors({});
    setShowPatientType(false);
    setIsSearchingExistingProfile(false);
    setProfileSearchTerm('');
    setClinicSlots([]);
    setSlotError('');
  }, [clinic.id]);

  useEffect(() => {
    if (!selectedPatient && patientProfiles[0]) {
      setSelectedPatient(patientProfiles[0]);
    }
  }, [patientProfiles, selectedPatient]);

  useEffect(() => {
    let isMounted = true;
    const fallbackProfile = tao_ho_so_tu_tai_khoan(user);

    if (!user) {
      setPatientProfiles(fallbackProfile.name ? [fallbackProfile] : []);
      return () => {
        isMounted = false;
      };
    }

    listPatientProfiles(user)
      .then((profiles) => {
        if (!isMounted) return;
        const mapped = (profiles || []).map(chuyen_ho_so_tu_api).filter((profile) => profile.name);
        const nextProfiles = gop_ho_so(mapped.length ? mapped : (fallbackProfile.name ? [fallbackProfile] : []));
        setPatientProfiles(nextProfiles);
        setSelectedPatient((current) => current || nextProfiles[0] || null);
      })
      .catch(() => {
        if (isMounted) setPatientProfiles(fallbackProfile.name ? [fallbackProfile] : []);
      });

    listAppointments(user)
      .then((items) => {
        if (isMounted) setBookedAppointments((current) => [...items, ...current]);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    const readyForSlots = clinic.id && selectedService && (!specialtyOptions.length || selectedSpecialty);
    if (!readyForSlots) {
      setClinicSlots([]);
      return () => {};
    }

    setIsLoadingSlots(false);
    setSlotError('');
    setClinicSlots(tao_lich_phong_kham_tinh(clinic.id, calendarMonth));

    return () => {};
  }, [clinic.id, selectedService, selectedSpecialty, specialtyOptions.length, calendarMonth]);

  const resetAfterStep = (stepKey) => {
    if (stepKey === 'service') {
      setSelectedSpecialty(null);
      setSelectedDate(null);
      setSelectedTime(null);
      setClinicSlots([]);
    }
    if (stepKey === 'specialty') {
      setSelectedDate(null);
      setSelectedTime(null);
      setClinicSlots([]);
    }
    if (stepKey === 'date') {
      setSelectedTime(null);
    }
  };

  const chooseStep = (applyFn) => {
    applyFn();
    resetAfterStep(currentStep);
    const nextStep = Math.min(step + 1, steps.length);
    setUnlockedStep((current) => Math.max(current, nextStep));
    setStep(nextStep);
  };

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    const validFiles = files.filter((file) => ['image/png', 'image/jpeg'].includes(file.type) && file.size <= 15 * 1024 * 1024);
    setAttachedFiles((current) => [...current, ...validFiles].slice(0, 5));
  };

  const handleBack = () => {
    if (screen === 'booking' && step === 1) {
      setScreen('detail');
      return;
    }
    setStep((current) => Math.max(1, current - 1));
  };

  const openProfileModal = (mode, profile = null) => {
    const nextProfile = profile || selectedPatient || tao_ho_so_moi(user);
    setProfileDraft(chuan_hoa_ho_so(nextProfile));
    setProfileErrors({});
    setProfileModalMode(mode);
  };

  const updateProfileDraft = (event) => {
    const { name, value } = event.target;
    setProfileErrors((current) => ({ ...current, [name]: undefined }));
    let nextValue = value;
    if (name === 'phone') nextValue = chuan_hoa_so_dien_thoai(value);
    if (name === 'citizenId') nextValue = chuan_hoa_cmnd_cccd(value);
    if (name === 'insuranceCode') nextValue = chuan_hoa_bhyt(value);

    setProfileDraft((current) => ({
      ...current,
      [name]: nextValue,
      ...(name === 'province' ? { district: '', ward: '' } : {}),
      ...(name === 'district' ? { ward: '' } : {}),
    }));
  };

  const validateProfileDraft = () => {
    const errors = {};
    if (!profileDraft?.name?.trim()) errors.name = 'Vui lòng nhập họ và tên';
    if (!profileDraft?.phone || profileDraft.phone.length !== 10) errors.phone = 'Vui lòng nhập số điện thoại 10 số';
    if (!kiem_tra_ngay_sinh(profileDraft?.birthDate || '')) errors.birthDate = 'Vui lòng nhập ngày sinh đúng dd/mm/yyyy';
    if (!profileDraft?.gender) errors.gender = 'Vui lòng chọn giới tính';
    if (profileDraft?.citizenId && ![9, 12].includes(profileDraft.citizenId.length)) errors.citizenId = 'CMND/CCCD phải gồm 9 hoặc 12 số';
    if (profileDraft?.insuranceCode && !kiem_tra_bhyt(profileDraft.insuranceCode)) errors.insuranceCode = 'Mã BHYT chưa đúng định dạng';
    if (profileDraft?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileDraft.email)) errors.email = 'Email chưa đúng định dạng';
    return errors;
  };

  const saveProfile = async () => {
    const errors = validateProfileDraft();
    setProfileErrors(errors);
    if (Object.keys(errors).length) return;

    setIsSavingProfile(true);
    setWarning('');
    try {
      const saved = user ? await savePatientProfile(user, {
        ...profileDraft,
        fullName: profileDraft.name,
      }) : null;
      const nextProfile = chuan_hoa_ho_so({
        ...profileDraft,
        id: saved?.id || (profileModalMode === 'add' ? `profile_${Date.now()}` : profileDraft.id),
      });

      setPatientProfiles((current) => {
        const withoutOld = current.filter((item) => item.id !== nextProfile.id && !(item.id === profileDraft.id && profileDraft.id));
        return gop_ho_so([nextProfile, ...withoutOld]);
      });
      setSelectedPatient(nextProfile);
      setShowPatientType(false);
      setIsSearchingExistingProfile(false);
      setProfileSearchTerm('');
      setProfileModalMode(null);
      setProfileDraft(null);
    } catch (error) {
      setWarning(error.message || 'Không thể lưu hồ sơ bệnh nhân.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const selectExistingProfile = (profile) => {
    const normalizedProfile = chuan_hoa_ho_so(profile);
    setSelectedPatient(normalizedProfile);
    setPatientProfiles((current) => gop_ho_so([normalizedProfile, ...current]));
    setShowPatientType(false);
    setIsSearchingExistingProfile(false);
    setProfileSearchTerm('');
  };

  const handleNext = async () => {
    if (!canContinue) return;
    if (step < steps.length) {
      setStep((current) => current + 1);
      setUnlockedStep((current) => Math.max(current, step + 1));
      return;
    }

    const missingProfileFields = danh_sach_thieu_ho_so(selectedPatient);
    if (missingProfileFields.length) {
      setWarning(`Hồ sơ còn thiếu hoặc chưa hợp lệ: ${missingProfileFields.join(', ')}. Vui lòng bấm "Xem chi tiết hồ sơ" để cập nhật trước khi xác nhận đặt khám.`);
      return;
    }

    setIsSubmitting(true);
    setWarning('');
    try {
      const nextAppointment = await createAppointment(user, {
        type: 'clinic',
        clinicId: clinic.id,
        facilityId: clinic.id,
        clinicName: clinic.name,
        facilityName: clinic.name,
        hospitalName: clinic.name,
        doctorName: clinic.name,
        doctorShortName: clinic.name,
        doctorImage: anh_phong_kham(clinic.avatar),
        department: selectedSpecialty?.name || selectedService.name,
        specialtyName: selectedSpecialty?.name,
        serviceName: selectedService.name,
        serviceId: selectedService.id,
        address: clinic.address,
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
      setScreen('success');
    } catch (error) {
      setWarning(error.message || 'Không thể xác nhận đặt khám. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!clinic) {
    return <section className="hospital-detail-page clinic-detail-page"><p className="hospital-empty-options">Hiện chưa có phòng khám phù hợp.</p></section>;
  }

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
      <section className="hospital-booking-page clinic-booking-page">
        <div className="hospital-booking-title">
          <button type="button" onClick={handleBack}><i className="ui-chevron left" aria-hidden="true" /></button>
          <h1>{clinic.name}</h1>
        </div>
        <div className="hospital-booking-grid">
          <article className="hospital-patient-panel hospital-step-panel">
            <header><BuocPhongKham steps={steps} step={step} unlockedStep={unlockedStep} completedKeys={completedStepKeys} onStepClick={setStep} /></header>
            <div className="hospital-patient-content hospital-step-content" key={currentStep}>
              {currentStep === 'service' && (
                <>
                  <h2>Chọn dịch vụ khám...</h2>
                  {selectedService && <div className="hospital-fee-note">Lưu ý: {selectedService.fee} ({selectedService.description})</div>}
                  <div className="hospital-option-list">
                    {serviceOptions.length > 0 ? serviceOptions.map((service) => (
                      <button className={selectedService?.id === service.id ? 'hospital-option-card selected' : 'hospital-option-card'} key={service.id || service.name} type="button" onClick={() => chooseStep(() => setSelectedService(service))}>
                        <span><strong>{service.name}</strong><small>{service.description}</small></span><i />
                      </button>
                    )) : <p className="hospital-empty-options">Phòng khám này chưa có dịch vụ đặt khám trên hệ thống.</p>}
                  </div>
                </>
              )}

              {currentStep === 'specialty' && (
                <>
                  <h2>Chọn chuyên khoa...</h2>
                  <div className="hospital-option-list">
                    {specialtyOptions.length > 0 ? specialtyOptions.map((specialty) => (
                      <button className={selectedSpecialty?.name === specialty.name ? 'hospital-option-card selected' : 'hospital-option-card'} key={specialty.name} type="button" onClick={() => chooseStep(() => setSelectedSpecialty(specialty))}>
                        <span><strong>{specialty.name}</strong><small>{specialty.description}</small></span><i />
                      </button>
                    )) : <p className="hospital-empty-options">Phòng khám này chưa có chuyên khoa riêng.</p>}
                  </div>
                </>
              )}

              {currentStep === 'date' && (
                <>
                  <h2>Chọn ngày khám...</h2>
                  <LichPhongKham
                    error={slotError}
                    isLoading={isLoadingSlots}
                    monthDate={calendarMonth}
                    selectedDate={selectedDate}
                    slotDates={slotDates}
                    onMonthChange={(amount) => setCalendarMonth((current) => cong_thang(current, amount))}
                    onSelectDate={(date) => chooseStep(() => setSelectedDate(date))}
                  />
                </>
              )}

              {currentStep === 'time' && (
                <>
                  <h2>Chọn giờ khám...</h2>
                  <section className="hospital-time-section">
                    <h3>Buổi sáng</h3>
                    <div className="hospital-time-grid clinic-time-grid">
                      {morningSlots.length > 0 ? morningSlots.map((slot) => {
                        const isBooked = bookedSlotKeys.has(`${slot.date}|${slot.startTime}`);
                        return (
                          <button className={[selectedTime?.id === slot.id ? 'selected' : '', isBooked ? 'booked' : ''].filter(Boolean).join(' ')} disabled={isBooked} key={slot.id} type="button" onClick={() => chooseStep(() => setSelectedTime(slot))}>
                            <span>{slot.label}</span>
                            {isBooked && <small>Đã đặt</small>}
                          </button>
                        );
                      }) : <p className="hospital-time-empty">Không có khung giờ buổi sáng.</p>}
                    </div>
                  </section>
                  <section className="hospital-time-section">
                    <h3>Buổi chiều</h3>
                    <div className="hospital-time-grid clinic-time-grid">
                      {afternoonSlots.length > 0 ? afternoonSlots.map((slot) => {
                        const isBooked = bookedSlotKeys.has(`${slot.date}|${slot.startTime}`);
                        return (
                          <button className={[selectedTime?.id === slot.id ? 'selected' : '', isBooked ? 'booked' : ''].filter(Boolean).join(' ')} disabled={isBooked} key={slot.id} type="button" onClick={() => chooseStep(() => setSelectedTime(slot))}>
                            <span>{slot.label}</span>
                            {isBooked && <small>Đã đặt</small>}
                          </button>
                        );
                      }) : <p className="hospital-time-empty">Hiện chưa có lịch khám cho ngày này.</p>}
                    </div>
                  </section>
                </>
              )}

              {currentStep === 'patient' && (
                <>
                  <h2>Chọn hồ sơ cần khám...</h2>
                  <button className={selectedPatient ? 'hospital-patient-card selected' : 'hospital-patient-card'} type="button" onClick={() => setSelectedPatient(patientProfile)}>
                    <div className="hospital-patient-avatar">{lay_ten_tat(patientProfile.name)}</div>
                    <div>
                      <h3>{patientProfile.name || 'Chưa có hồ sơ bệnh nhân'}</h3>
                      <p>Ngày sinh: <b>{patientProfile.birthDate || '--'}</b></p>
                      <p>Số điện thoại: <b>{patientProfile.phone || '--'}</b></p>
                      <small>{patientProfile.relationship || 'Chính'}</small>
                      <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); openProfileModal('view', patientProfile); }}>Xem chi tiết hồ sơ</span>
                    </div>
                    <i />
                  </button>
                  {selectedPatient && danh_sach_thieu_ho_so(selectedPatient).length > 0 && (
                    <div className="hospital-missing-profile">
                      Hồ sơ cần bổ sung: {danh_sach_thieu_ho_so(selectedPatient).join(', ')}.
                      <button type="button" onClick={() => openProfileModal('edit', selectedPatient)}>Cập nhật ngay</button>
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
                        <button type="button" onClick={() => { setShowPatientType(false); setIsSearchingExistingProfile(false); openProfileModal('add', tao_ho_so_moi(user)); }}>Chưa từng khám, tạo hồ sơ mới <span>⛶</span></button>
                      </div>
                    )}
                  </div>
                  <div className="hospital-extra-info">
                    <h3>Thông tin bổ sung (không bắt buộc)...</h3>
                    <label>Nội dung<textarea value={note} placeholder="Triệu chứng, thuốc đang dùng, tiền sử, ..." onChange={(event) => setNote(event.target.value)} /></label>
                    <button className="hospital-upload-box" type="button" onClick={() => fileInputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFiles(event.dataTransfer.files); }}>
                      <span>▧</span><strong>Chọn tập tin</strong> hoặc kéo & thả tối đa 5 ảnh.<small>Size thấp hơn 15MB, định dạng file png, jpg.</small>
                    </button>
                    <input accept="image/png,image/jpeg" hidden multiple ref={fileInputRef} type="file" onChange={(event) => handleFiles(event.target.files)} />
                    {attachedFiles.length > 0 && <div className="hospital-file-list">{attachedFiles.map((file) => <span key={`${file.name}_${file.size}`}>{file.name}</span>)}</div>}
                  </div>
                </>
              )}
            </div>
            {warning && <p className="booking-error">{warning}</p>}
            <footer>
              <button className={canGoPreviousStep ? 'hospital-back-button active' : 'hospital-back-button'} type="button" onClick={handleBack}>Quay lại</button>
              <button type="button" disabled={!canContinue || isSubmitting} onClick={handleNext}>{step === steps.length ? (isSubmitting ? 'Đang đặt khám...' : 'Xác nhận đặt khám') : 'Tiếp tục'}</button>
            </footer>
          </article>

          <ThongTinDatKhamPhongKham clinic={clinic} service={selectedService} specialty={selectedSpecialty} date={selectedDate} time={selectedTime} patient={selectedPatient} />
        </div>
        {profileModalMode && profileDraft && (
          <ModalHoSoPhongKham
            mode={profileModalMode}
            profile={profileDraft}
            errors={profileErrors}
            canSave={Boolean(canSaveProfileDraft)}
            isSaving={isSavingProfile}
            onChange={updateProfileDraft}
            onClose={() => setProfileModalMode(null)}
            onEdit={() => setProfileModalMode('edit')}
            onSave={saveProfile}
          />
        )}
      </section>
    );
  }

  return (
    <section className="hospital-detail-page clinic-detail-page">
      <div className="hospital-detail-head">
        <div className="breadcrumb">Trang chủ <span>/</span> Phòng khám</div>
        <button className="favorite-button hospital-favorite" type="button">♡ Yêu thích</button>
        <div className="hospital-title-row">
          <img src={anh_phong_kham(clinic.avatar)} alt={clinic.name} />
          <div>
            <h1>{clinic.name}</h1>
            <p>{clinic.subtitle}</p>
            <button type="button" onClick={openClinicMap}>◆ Địa chỉ</button>
          </div>
        </div>
      </div>
      {warning && <p className="booking-error">{warning}</p>}
      <nav className="hospital-tabs">
        <button type="button" onClick={() => scrollToSection('clinic-info')}>Thông tin</button>
        <button type="button" onClick={() => scrollToSection('clinic-services')}>Dịch vụ</button>
      </nav>
      {clinicImages.length > 0 && (
        <div className="hospital-gallery clinic-gallery">
          <button className="main" type="button" onClick={() => setGalleryIndex(0)}>
            <img src={clinicImages[0].src} alt={clinicImages[0].alt} />
          </button>
          <button type="button" onClick={() => setGalleryIndex(Math.min(1, clinicImages.length - 1))}>
            <img src={(clinicImages[1] || clinicImages[0]).src} alt={(clinicImages[1] || clinicImages[0]).alt} />
          </button>
          <button className="gallery-count" type="button" onClick={() => setGalleryIndex(0)}>📷 {clinicImages.length}</button>
        </div>
      )}
      <button className="hospital-detail-book" type="button" disabled={!serviceOptions.length} onClick={() => setScreen('booking')}>Đặt khám ngay</button>
      {!serviceOptions.length && <p className="hospital-empty-options">Hiện chưa có phòng khám phù hợp.</p>}
      <section className="hospital-info-grid" id="clinic-info">
        <article>
          <h2>Giới thiệu</h2>
          <div className={isIntroExpanded ? 'hospital-intro expanded' : 'hospital-intro'}><p>{clinic.intro}</p></div>
          <button type="button" onClick={() => setIsIntroExpanded((value) => !value)}>{isIntroExpanded ? 'Thu gọn' : '...Xem thêm'} <i className={`ui-chevron ${isIntroExpanded ? 'up' : 'down'}`} aria-hidden="true" /></button>
        </article>
        <article>
          <h2>Giờ làm việc</h2>
          <dl>{(clinic.hours || []).map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.time}</dd></div>)}</dl>
        </article>
      </section>
      <section className="hospital-info-grid" id="clinic-services">
        <article>
          <h2>Dịch vụ</h2>
          <div className="hospital-tag-list">
            {serviceOptions.length > 0 ? serviceOptions.map((item) => <span key={item.id || item.name}>✓ {item.name}</span>) : <span>Hiện chưa có dịch vụ đặt khám.</span>}
          </div>
        </article>
      </section>
      {galleryIndex !== null && <ModalAnhPhongKham images={clinicImages} activeIndex={galleryIndex} onSelect={setGalleryIndex} onClose={() => setGalleryIndex(null)} />}
    </section>
  );
}

export default TrangDatLichPhongKham;
