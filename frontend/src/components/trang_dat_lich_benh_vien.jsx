import { useEffect, useMemo, useRef, useState } from 'react';
import TrangPhieuKham, { PhieuKhamChiTiet, co_gia_tri, tao_dong_phieu_kham } from './trang_phieu_kham';
import {
  DAN_TOC_VIET_NAM,
  DIA_CHI_FALLBACK,
  NGHE_NGHIEP,
  chuan_hoa_bhyt,
  chuan_hoa_cmnd_cccd,
  chuan_hoa_so_dien_thoai,
  kiem_tra_bhyt,
  kiem_tra_ngay_sinh,
} from '../data/du_lieu_ho_so';

function anh_benh_vien(path) {
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
  if (hospital.name.includes('Nhi đồng')) {
    return [
      { name: 'Khám theo yêu cầu - Khu Lý Tự Trọng', fee: '5.000', description: 'Áp dụng các chuyên khoa Nhi được bệnh viện hỗ trợ đặt online' },
      { name: 'Khám Tâm lý - Khu Nguyễn Du', fee: '5.000', description: 'Khám Tâm lý tại tầng 5, khu Nguyễn Du' },
    ];
  }

  if (hospital.name.includes('Răng Hàm Mặt')) {
    return [
      { name: 'Khám VIP Răng Hàm Mặt', fee: 'Thanh toán tại viện', description: 'Không áp dụng bảo hiểm y tế, không áp dụng tái khám theo hẹn' },
    ];
  }

  if (hospital.name.includes('Y Học Cổ Truyền')) {
    return [
      { name: 'Khám bệnh nhân cũ', fee: 'Thanh toán tại viện', description: 'Chỉ áp dụng bệnh nhân đã có mã bệnh nhân tại bệnh viện' },
    ];
  }

  if (hospital.name.includes('Quân Y 175')) {
    return [
      { name: 'Khám chuyên khoa ngoài giờ', fee: 'Thanh toán tại viện', description: 'Khám tại khu khám bệnh theo yêu cầu theo lịch bệnh viện' },
      { name: 'Khám chuyên khoa giờ hành chính', fee: 'Thanh toán tại viện', description: 'Áp dụng các chuyên khoa hỗ trợ đặt lịch trực tuyến' },
    ];
  }

  if (hospital.name.includes('Ung Bướu')) {
    return [
      { name: 'Khám chuyên khoa Ung bướu', fee: 'Thanh toán tại viện', description: 'Chuẩn bị hồ sơ bệnh án, kết quả xét nghiệm hoặc toa thuốc cũ nếu có' },
    ];
  }

  return [
    { name: 'Khám BHYT thường', fee: '20.000', description: 'Thanh toán trực tiếp tại Bệnh viện' },
  ];
}

function lay_chuyen_khoa_benh_vien(hospital) {
  if (hospital.name.includes('Nhi đồng')) {
    return [
      { name: 'Sơ sinh - Khu Lý Tự Trọng', description: 'Khám sơ sinh và theo dõi sức khỏe trẻ nhỏ' },
      { name: 'Dinh dưỡng - Khu Lý Tự Trọng', description: 'Tư vấn dinh dưỡng, cân nặng, chiều cao cho trẻ' },
      { name: 'Nhiễm - Khu Lý Tự Trọng', description: 'Khám bệnh lý nhiễm trùng ở trẻ em' },
      { name: 'Tai Mũi Họng - Khu Lý Tự Trọng', description: 'Khám tai mũi họng dành cho bệnh nhi' },
      { name: 'Hô hấp - Khu Lý Tự Trọng', description: 'Khám hen, viêm phế quản, ho kéo dài và bệnh lý hô hấp' },
      { name: 'Tâm lý - Khu Nguyễn Du', description: 'Khám Tâm lý tại tầng 5, khu Nguyễn Du' },
    ];
  }

  if (hospital.name.includes('Răng Hàm Mặt')) {
    return [
      { name: 'Khám VIP Răng Hàm Mặt', description: 'Khám răng hàm mặt loại hình VIP, không áp dụng BHYT' },
      { name: 'Nha khoa tổng quát', description: 'Khám răng miệng tổng quát và tư vấn điều trị' },
      { name: 'Phẫu thuật hàm mặt', description: 'Tư vấn phẫu thuật và điều trị bệnh lý hàm mặt' },
      { name: 'Chỉnh nha', description: 'Tư vấn niềng răng, chỉnh nha và thẩm mỹ răng' },
    ];
  }

  if (hospital.name.includes('Y Học Cổ Truyền')) {
    return [
      { name: 'Y học cổ truyền', description: 'Khám bệnh nhân cũ đã có mã bệnh nhân tại bệnh viện' },
      { name: 'Phục hồi chức năng', description: 'Tư vấn phục hồi chức năng kết hợp y học cổ truyền' },
      { name: 'Cơ xương khớp', description: 'Khám đau nhức cơ xương khớp bằng y học cổ truyền' },
    ];
  }

  if (hospital.name.includes('Quân Y 175')) {
    return [
      { name: 'Chấn thương chỉnh hình', description: 'Khám tại khu khám bệnh theo yêu cầu khi còn lịch' },
      { name: 'Nội tổng quát', description: 'Khám nội khoa tổng quát' },
      { name: 'Tim mạch', description: 'Khám và tư vấn bệnh lý tim mạch' },
      { name: 'Hô hấp', description: 'Khám bệnh lý hô hấp, không áp dụng tầm soát lao nhập cảnh' },
    ];
  }

  return (hospital.specialties || []).map((specialty) => ({
    name: specialty,
    description: `Khám và tư vấn chuyên khoa ${specialty.toLowerCase()} tại ${hospital.name}`,
  }));
}

const NGAY_KHAM = [
  { value: '2026-05-25', day: 25, display: '25/05/2026', label: 'Ngày Khám 25/05/2026', today: true },
  { value: '2026-05-26', day: 26, display: '26/05/2026', label: 'Ngày Khám 26/05/2026' },
  { value: '2026-05-27', day: 27, display: '27/05/2026', label: 'Ngày Khám 27/05/2026' },
  { value: '2026-05-28', day: 28, display: '28/05/2026', label: 'Ngày Khám 28/05/2026' },
  { value: '2026-05-29', day: 29, display: '29/05/2026', label: 'Ngày Khám 29/05/2026' },
];

const KHUNG_GIO = {
  morning: ['07:00 - 07:30', '07:30 - 08:00', '08:00 - 08:30', '08:30 - 09:00', '09:00 - 09:30', '09:30 - 10:00', '10:00 - 10:30', '10:30 - 11:00'],
  afternoon: ['13:00 - 13:30', '13:30 - 14:00', '14:00 - 14:30', '14:30 - 15:00', '15:00 - 15:30', '15:30 - 16:00'],
};

const QUAN_HE_GIAM_HO = ['Cha', 'Mẹ', 'Con', 'Chồng', 'Vợ', 'Khác'];

function tao_ho_so_mac_dinh(user) {
  return {
    name: user?.displayName || user?.email?.split('@')[0] || 'Lê Vũ Hoàng',
    birthDate: '09/08/2004',
    phone: '0343413231',
    gender: 'Nam',
    citizenId: '',
    email: user?.email || '',
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
  if (hospital.name.includes('Nhi đồng') && age >= 16) missing.push('Bệnh nhân dưới 16 tuổi');
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
      <input name={name} value={value} placeholder={placeholder} onChange={onChange} />
      {error && <small>{error}</small>}
    </label>
  );
}

function SelectField({ label, name, value, children, placeholder, onChange, error }) {
  return (
    <label className={error ? 'hospital-profile-field has-error' : 'hospital-profile-field'}>
      <span>{label}</span>
      <select name={name} value={value} onChange={onChange}>
        <option value="">{placeholder}</option>
        {children}
      </select>
      {error && <small>{error}</small>}
    </label>
  );
}

function ModalHoSo({ mode, profile, errors = {}, onClose, onEdit, onChange, onSave, onAddGuardian, onGuardianChange, onRemoveGuardian }) {
  const selectedProvince = DIA_CHI_FALLBACK.find((item) => item.name === profile.province);
  const selectedDistrict = selectedProvince?.districts.find((item) => item.name === profile.district);
  const isEditing = mode === 'edit';
  const guardians = lay_nguoi_giam_ho(profile);

  return (
    <div className="notice-modal-backdrop">
      <article className="hospital-profile-modal">
        <header>
          <h2>{isEditing ? 'Chỉnh sửa hồ sơ' : 'Thông tin hồ sơ'}</h2>
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
            <div className="hospital-profile-camera">
              <div>{lay_ten_tat(profile.name)}</div>
              <span>ðŸ“·</span>
            </div>
            <Field label="Họ và tên" name="name" value={profile.name} required placeholder="Nhập họ và tên" onChange={onChange} error={errors.name} />
            <Field label="Số điện thoại" name="phone" value={profile.phone} required placeholder="Nhập số điện thoại" onChange={onChange} error={errors.phone} />
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
            <Field label="Số CCCD" name="citizenId" value={profile.citizenId} placeholder="CCCD/Mã định danh bệnh nhân" onChange={onChange} />
            <Field label="Địa chỉ email" name="email" value={profile.email} placeholder="Nhập địa chỉ email" onChange={onChange} />
            <SelectField label="Tỉnh / thành phố" name="province" value={profile.province} placeholder="Chọn tỉnh / thành phố" onChange={onChange}>
              {DIA_CHI_FALLBACK.map((province) => <option key={province.name}>{province.name}</option>)}
            </SelectField>
            <SelectField label="Quận / huyện" name="district" value={profile.district} placeholder="Chọn quận / huyện" onChange={onChange}>
              {(selectedProvince?.districts || []).map((district) => <option key={district.name}>{district.name}</option>)}
            </SelectField>
            <SelectField label="Phường / xã" name="ward" value={profile.ward} placeholder="Chọn phường / xã" onChange={onChange}>
              {(selectedDistrict?.wards || []).map((ward) => <option key={ward}>{ward}</option>)}
            </SelectField>
            <Field label="Số nhà, tên đường" name="address" value={profile.address} placeholder="Số nhà, tên đường" onChange={onChange} />
            <SelectField label="Dân tộc" name="ethnicity" value={profile.ethnicity} placeholder="Chọn dân tộc" onChange={onChange}>
              {DAN_TOC_VIET_NAM.map((item) => <option key={item}>{item}</option>)}
            </SelectField>
            <SelectField label="Nghề nghiệp" name="job" value={profile.job} placeholder="Chọn nghề nghiệp" onChange={onChange}>
              {NGHE_NGHIEP.map((item) => <option key={item}>{item}</option>)}
            </SelectField>
            <Field label="Số bảo hiểm y tế" name="insuranceCode" value={profile.insuranceCode} placeholder="Số trên thẻ bảo hiểm y tế" onChange={onChange} />

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
          </form>
        )}

        <footer>
          <button type="button" onClick={onClose}>{isEditing ? 'Hủy' : 'Đóng'}</button>
          <button type="button" onClick={isEditing ? onSave : onEdit}>{isEditing ? 'Lưu' : 'Chỉnh sửa'}</button>
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

function ThongTinDatKham({ service, specialty, date, time, patient }) {
  return (
    <aside className="hospital-booking-summary detailed">
      <h2>Thông tin đặt khám</h2>
      <div><p>Dịch vụ</p><strong>{service?.name || '--'}</strong></div>
      <div><p>Chuyên khoa</p><strong>{specialty?.name || '--'}</strong></div>
      <div>
        <p>Ngày và giờ khám</p>
        <strong>{date ? date.label : '--'}</strong>
        {time && <strong>Giờ Khám {time}</strong>}
      </div>
      <div><p>Bệnh nhân</p><strong>{patient ? `${patient.name} - ${patient.phone}` : '--'}</strong></div>
    </aside>
  );
}

function LichThang({ selectedDate, onSelectDate }) {
  const availableDays = new Set(NGAY_KHAM.map((item) => item.day));
  return (
    <div className="hospital-calendar">
      <div className="hospital-calendar-head">
        <button type="button" disabled>←</button>
        <strong>Tháng 5, 2026</strong>
        <button type="button">→</button>
      </div>
      <div className="hospital-calendar-week">
        {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'].map((dayName) => <b key={dayName}>{dayName}</b>)}
      </div>
      <div className="hospital-calendar-grid">
        {Array.from({ length: 31 }).map((_, index) => {
          const day = index + 1;
          const dateOption = NGAY_KHAM.find((item) => item.day === day);
          const available = availableDays.has(day);
          const className = [
            'calendar-day',
            available ? 'available' : 'disabled',
            selectedDate?.day === day ? 'selected' : '',
            dateOption?.today ? 'today' : '',
          ].filter(Boolean).join(' ');
          return (
            <button className={className} disabled={!available} key={day} type="button" onClick={() => onSelectDate(dateOption)}>
              {day === 1 ? '1 tháng 5' : day}
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

function TrangDatLichBenhVien({ hospital, user, onBackHome }) {
  const [showNotice, setShowNotice] = useState(true);
  const [screen, setScreen] = useState('detail');
  const [isIntroExpanded, setIsIntroExpanded] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(null);
  const [step, setStep] = useState(1);
  const [unlockedStep, setUnlockedStep] = useState(1);
  const serviceOptions = useMemo(() => lay_dich_vu_benh_vien(hospital), [hospital]);
  const specialtyOptions = useMemo(() => lay_chuyen_khoa_benh_vien(hospital), [hospital]);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [patientProfile, setPatientProfile] = useState(() => tao_ho_so_mac_dinh(user));
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [profileDraft, setProfileDraft] = useState(null);
  const [profileErrors, setProfileErrors] = useState({});
  const [profileModalMode, setProfileModalMode] = useState(null);
  const [showPatientType, setShowPatientType] = useState(false);
  const [warning, setWarning] = useState('');
  const [pendingChange, setPendingChange] = useState(null);
  const [note, setNote] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [appointment, setAppointment] = useState(null);
  const fileInputRef = useRef(null);
  const hospitalImages = useMemo(() => [
    { src: anh_benh_vien(hospital.background), alt: hospital.name },
    { src: anh_benh_vien(hospital.avatar), alt: `${hospital.name} logo` },
  ], [hospital]);

  const scrollToSection = (sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    setStep(1);
    setUnlockedStep(1);
    setSelectedService(null);
    setSelectedSpecialty(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedPatient(null);
    setPendingChange(null);
    setWarning('');
    setIsIntroExpanded(false);
    setGalleryIndex(null);
  }, [hospital.name, serviceOptions, specialtyOptions]);

  const canContinue = step === 1 ? selectedService
    : step === 2 ? selectedSpecialty
      : step === 3 ? selectedDate
        : step === 4 ? selectedTime
          : selectedPatient;

  const resetAfterStep = (fromStep) => {
    if (fromStep <= 1) {
      setSelectedSpecialty(null);
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedPatient(null);
    }
    if (fromStep <= 2) {
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedPatient(null);
    }
    if (fromStep <= 3) {
      setSelectedTime(null);
      setSelectedPatient(null);
    }
    if (fromStep <= 4) setSelectedPatient(null);
    setNote('');
    setAttachedFiles([]);
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

  const openProfileModal = (mode = 'view') => {
    setProfileDraft({ ...patientProfile });
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

    lay_nguoi_giam_ho(profile).forEach((guardian) => {
      if (!guardian.name?.trim()) errors[`guardian_${guardian.id}_name`] = 'Vui lòng nhập họ và tên người giám hộ';
      if (guardian.phone?.length !== 10) errors[`guardian_${guardian.id}_phone`] = 'Vui lòng nhập số điện thoại 10 số';
      if (!guardian.relationship) errors[`guardian_${guardian.id}_relationship`] = 'Vui lòng chọn mối quan hệ';
    });

    return errors;
  };

  const saveProfile = (event) => {
    event?.preventDefault?.();
    const errors = validateProfileDraft(profileDraft);
    setProfileErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const guardians = lay_nguoi_giam_ho(profileDraft);
    const firstGuardian = guardians[0] || {};
    const nextProfile = {
      ...profileDraft,
      guardians,
      guardianName: firstGuardian.name || '',
      guardianPhone: firstGuardian.phone || '',
      guardianCitizenId: firstGuardian.citizenId || '',
      guardianEmail: firstGuardian.email || '',
      relationship: firstGuardian.relationship || 'Khác',
    };
    setPatientProfile(nextProfile);
    setSelectedPatient(nextProfile);
    setProfileModalMode(null);
  };

  const handleBack = () => {
    if (step === 1) {
      setScreen('detail');
      return;
    }
    setStep((current) => current - 1);
  };

  const handleNext = () => {
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

    const ticketNumber = Math.floor(10 + Math.random() * 60);
    setAppointment({
      id: `hospital_${Date.now()}`,
      type: 'hospital',
      status: 'Đã đặt lịch',
      ticket: `BV-${Date.now()}`,
      appointmentCode: tao_ma_phieu(),
      patientCode: tao_ma_benh_nhan(),
      number: ticketNumber,
      doctorName: hospital.name,
      doctorShortName: hospital.name,
      doctorImage: anh_benh_vien(hospital.avatar),
      department: selectedSpecialty.name,
      serviceName: selectedService.name,
      hospitalName: hospital.name,
      address: hospital.address,
      dateDisplay: selectedDate.display,
      dateValue: selectedDate.value,
      time: selectedTime,
      patientName: selectedPatient.name,
      birthDate: selectedPatient.birthDate,
      gender: selectedPatient.gender,
      phone: selectedPatient.phone,
      patientAddress: dia_chi_day_du(selectedPatient),
      patientProfile: selectedPatient,
      note,
      attachments: attachedFiles.map((file) => file.name),
    });
    setScreen('success');
  };

  const handleFiles = (fileList) => {
    const files = Array.from(fileList);
    const validFiles = files.filter((file) => ['image/png', 'image/jpeg'].includes(file.type) && file.size <= 15 * 1024 * 1024);
    if (validFiles.length !== files.length) setWarning('Chỉ hỗ trợ file PNG/JPG và mỗi file tối đa 15MB.');
    setAttachedFiles((current) => [...current, ...validFiles].slice(0, 5));
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
          <button type="button" onClick={handleBack}>←</button>
          <h1>{hospital.name}</h1>
        </div>
        <div className="hospital-booking-grid">
          <article className="hospital-patient-panel hospital-step-panel">
            <header><BuocDatKham step={step} unlockedStep={unlockedStep} onStepClick={setStep} /></header>
            <div className="hospital-patient-content hospital-step-content" key={step}>
              {step === 1 && (
                <>
                  <h2>Chọn dịch vụ...</h2>
                  {selectedService && (
                    <div className="hospital-fee-note">⚠ Lưu ý: Phí đăng kí dịch vụ: {selectedService.fee} ({selectedService.description})</div>
                  )}
                  <div className="hospital-option-list">
                    {serviceOptions.map((service) => (
                      <button
                        className={selectedService?.name === service.name ? 'hospital-option-card selected' : 'hospital-option-card'}
                        key={service.name}
                        type="button"
                        onClick={() => chooseWithResetConfirm(1, selectedService?.name !== service.name, () => setSelectedService(service))}
                      >
                        <span><strong>{service.name}</strong><small>{service.description}</small></span><i />
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h2>Chọn chuyên khoa...</h2>
                  <div className="hospital-option-list">
                    {specialtyOptions.map((specialty) => (
                      <button className={selectedSpecialty?.name === specialty.name ? 'hospital-option-card selected' : 'hospital-option-card'} key={specialty.name} type="button" onClick={() => chooseWithResetConfirm(2, selectedSpecialty?.name !== specialty.name, () => setSelectedSpecialty(specialty))}>
                        <span><strong>{specialty.name}</strong><small>{specialty.description}</small></span><i />
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h2>Chọn thời gian khám...</h2>
                  <LichThang selectedDate={selectedDate} onSelectDate={(date) => chooseWithResetConfirm(3, selectedDate?.value !== date.value, () => setSelectedDate(date))} />
                </>
              )}

              {step === 4 && (
                <>
                  <h2>Chọn giờ khám...</h2>
                  <section className="hospital-time-section">
                    <h3>☼ Buổi sáng</h3>
                    <div className="hospital-time-grid">
                      {KHUNG_GIO.morning.map((time) => <button className={selectedTime === time ? 'selected' : ''} key={time} type="button" onClick={() => chooseWithResetConfirm(4, selectedTime !== time, () => setSelectedTime(time))}>{time}</button>)}
                    </div>
                  </section>
                  <section className="hospital-time-section">
                    <h3>☼ Buổi chiều</h3>
                    <div className="hospital-time-grid">
                      {KHUNG_GIO.afternoon.map((time) => <button className={selectedTime === time ? 'selected' : ''} key={time} type="button" onClick={() => chooseWithResetConfirm(4, selectedTime !== time, () => setSelectedTime(time))}>{time}</button>)}
                    </div>
                  </section>
                </>
              )}

              {step === 5 && (
                <>
                  <h2>Chọn hồ sơ cần khám...</h2>
                  <button className={selectedPatient ? 'hospital-patient-card selected' : 'hospital-patient-card'} type="button" onClick={() => setSelectedPatient(patientProfile)}>
                    <div className="hospital-patient-avatar">{lay_ten_tat(patientProfile.name)}</div>
                    <div>
                      <h3>{patientProfile.name}</h3>
                      <p>Ngày sinh: <b>{patientProfile.birthDate}</b></p>
                      <p>Số điện thoại: <b>{patientProfile.phone}</b></p>
                      <small>Chính</small>
                      <span role="button" tabIndex={0} onClick={(event) => { event.stopPropagation(); openProfileModal('view'); }}>Xem chi tiết hồ sơ</span>
                    </div>
                    <i />
                  </button>

                  {selectedPatient && danh_sach_thieu_ho_so(selectedPatient, hospital, selectedService).length > 0 && (
                    <div className="hospital-missing-profile">
                      Hồ sơ cần bổ sung: {danh_sach_thieu_ho_so(selectedPatient, hospital, selectedService).join(', ')}.
                      <button type="button" onClick={() => openProfileModal('edit')}>Cập nhật ngay</button>
                    </div>
                  )}

                  <div className="hospital-add-profile">
                    <button type="button" onClick={() => setShowPatientType((current) => !current)}>+ Thêm hồ sơ mới</button>
                    {showPatientType && (
                      <div className="hospital-patient-popover">
                        <strong>Bạn đã từng khám?</strong>
                        <button type="button">Đã từng khám, tìm hồ sơ <span>⌕</span></button>
                        <button type="button" onClick={() => openProfileModal('edit')}>Chưa từng khám, tạo hồ sơ mới <span>⛶</span></button>
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
            <footer>
              <button type="button" onClick={handleBack}>Quay lại</button>
              <button type="button" disabled={!canContinue} onClick={handleNext}>{step === 5 ? 'Xác nhận đặt khám' : 'Tiếp tục'}</button>
            </footer>
          </article>

          <ThongTinDatKham date={selectedDate} patient={selectedPatient} service={selectedService} specialty={selectedSpecialty} time={selectedTime} />
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
            <button type="button">◆ Địa chỉ</button>
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
        <button className="gallery-count" type="button" onClick={() => setGalleryIndex(0)}>ðŸ“· {hospitalImages.length}</button>
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
