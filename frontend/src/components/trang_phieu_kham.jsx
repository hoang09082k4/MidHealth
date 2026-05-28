import { useEffect, useMemo, useState } from 'react';
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

function tao_ten_benh_nhan(user) {
  return user?.displayName || user?.email?.split('@')[0] || 'Bệnh nhân';
}

function tao_ho_so_mac_dinh(appointment, user) {
  return {
    fullName: appointment?.patientName || tao_ten_benh_nhan(user),
    phone: appointment?.phone || '',
    birthDate: appointment?.birthDate || '',
    gender: appointment?.gender || 'Nam',
    province: '',
    district: '',
    ward: '',
    address: appointment?.patientAddress === 'Chưa cập nhật' ? '' : appointment?.patientAddress || '',
    citizenId: '',
    ethnicity: 'Kinh',
    job: '',
    insuranceCode: '',
    email: user?.email || '',
    relationship: 'Tôi',
  };
}

function tao_ho_so_moi() {
  return {
    fullName: '',
    phone: '',
    birthDate: '01/01/1990',
    gender: 'Nam',
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
  };
}

function chuan_hoa_dia_chi_api(items) {
  return items.map((province) => ({
    name: province.name,
    districts: (province.districts || []).map((district) => ({
      name: district.name,
      wards: (district.wards || []).map((ward) => ward.name),
    })),
  }));
}

function lay_ten_tat(fullName) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'HS';
  return parts.slice(-2).map((part) => part[0]).join('').toUpperCase();
}

function HangThongTin({ label, value, highlight }) {
  return (
    <div className="ticket-info-row">
      <span>{label}</span>
      <strong className={highlight ? 'green-text' : ''}>{value || '--'}</strong>
    </div>
  );
}

function co_gia_tri(value) {
  return value !== undefined
    && value !== null
    && String(value).trim() !== ''
    && !['--', '---', 'Chưa cập nhật'].includes(String(value).trim());
}

function lay_gia_tri_ho_so(profile, appointment, keys) {
  for (const key of keys) {
    if (co_gia_tri(profile?.[key])) return profile[key];
    if (co_gia_tri(appointment?.[key])) return appointment[key];
  }
  return '';
}

function lay_dia_chi_ho_so(profile, appointment) {
  const addressParts = [
    profile?.address,
    profile?.ward,
    profile?.district,
    profile?.province,
  ].filter(co_gia_tri);

  if (addressParts.length) return addressParts.join(', ');
  return appointment?.patientAddress || appointment?.address || '';
}

function lay_nguoi_giam_ho_ho_so(profile) {
  if (Array.isArray(profile?.guardians) && profile.guardians.length) {
    return profile.guardians
      .map((guardian) => [
        guardian.name,
        guardian.phone,
        guardian.relationship,
        guardian.citizenId ? `CCCD: ${guardian.citizenId}` : '',
        guardian.email,
      ].filter(co_gia_tri).join(' - '))
      .filter(co_gia_tri);
  }

  const guardian = [
    profile?.guardianName,
    profile?.guardianPhone,
    profile?.relationship,
    profile?.guardianCitizenId ? `CCCD: ${profile.guardianCitizenId}` : '',
    profile?.guardianEmail,
  ].filter(co_gia_tri).join(' - ');

  return co_gia_tri(guardian) ? [guardian] : [];
}

function HienThiDongPhieu({ rows }) {
  return rows
    .filter((row) => co_gia_tri(row.value))
    .map((row) => (
      <HangThongTin
        key={row.label}
        label={row.label}
        value={row.value}
        highlight={row.highlight}
      />
    ));
}

function tao_dong_phieu_kham(appointment) {
  const patientProfile = appointment.patientProfile || {};
  const guardians = lay_nguoi_giam_ho_ho_so(patientProfile);

  return {
    bookingRows: [
      { label: 'Mã phiếu khám', value: appointment.appointmentCode },
      { label: 'STT', value: appointment.number },
      { label: 'Dịch vụ', value: appointment.serviceName },
      { label: 'Cơ sở khám', value: appointment.hospitalName },
      { label: 'Ngày khám', value: appointment.dateDisplay },
      { label: 'Giờ khám', value: appointment.time ? `${appointment.time} (Buổi chiều)` : '', highlight: true },
      { label: 'Chuyên khoa', value: appointment.department },
    ],
    patientRows: [
      { label: 'Mã bệnh nhân', value: appointment.patientCode, highlight: true },
      { label: 'Họ và tên', value: lay_gia_tri_ho_so(patientProfile, appointment, ['fullName', 'name', 'patientName']) },
      { label: 'Ngày sinh', value: lay_gia_tri_ho_so(patientProfile, appointment, ['birthDate']) },
      { label: 'Số điện thoại', value: lay_gia_tri_ho_so(patientProfile, appointment, ['phone']) },
      { label: 'Giới tính', value: lay_gia_tri_ho_so(patientProfile, appointment, ['gender']) },
      { label: 'Số CMND/CCCD', value: lay_gia_tri_ho_so(patientProfile, appointment, ['citizenId']) },
      { label: 'Email', value: lay_gia_tri_ho_so(patientProfile, appointment, ['email']) },
      { label: 'Địa chỉ', value: lay_dia_chi_ho_so(patientProfile, appointment) },
      { label: 'Dân tộc', value: lay_gia_tri_ho_so(patientProfile, appointment, ['ethnicity']) },
      { label: 'Nghề nghiệp', value: lay_gia_tri_ho_so(patientProfile, appointment, ['job']) },
      { label: 'Mã BHYT', value: lay_gia_tri_ho_so(patientProfile, appointment, ['insuranceCode']) },
      ...guardians.map((guardian, index) => ({
        label: `Người giám hộ ${index + 1}`,
        value: guardian,
      })),
      { label: 'Ghi chú', value: appointment.note },
      {
        label: 'Tệp đính kèm',
        value: Array.isArray(appointment.attachments) ? appointment.attachments.join(', ') : '',
      },
    ],
  };
}

function ONhapHoSo({ label, name, value, required, type = 'text', placeholder, onChange, error }) {
  return (
    <label className={error ? 'profile-edit-field has-error' : 'profile-edit-field'}>
      <span>{label}{required && <b> *</b>}</span>
      <input name={name} type={type} value={value} placeholder={placeholder} onChange={onChange} />
      {error && <small>{error}</small>}
    </label>
  );
}

function OChonHoSo({ label, name, value, placeholder, children, onChange }) {
  return (
    <label className="profile-edit-field">
      <span>{label}</span>
      <select name={name} value={value} onChange={onChange}>
        <option value="">{placeholder}</option>
        {children}
      </select>
    </label>
  );
}

function PhieuKhamChiTiet({ appointment, compact = false }) {
  const doctorName = appointment.doctorShortName || appointment.doctorName;
  const { bookingRows, patientRows } = tao_dong_phieu_kham(appointment);

  return (
    <article className={compact ? 'ticket-detail-card compact' : 'ticket-detail-card'}>
      <div className="ticket-detail-head">
        <div>
          <p className={appointment.status === 'Đã hủy' ? 'danger-text' : 'green-text'}>
            {appointment.status === 'Đã hủy' ? 'Đã hủy' : 'Đã đặt lịch'}
          </p>
          <h3>{doctorName}</h3>
          <span>{appointment.address}</span>
        </div>
      </div>

      <section>
        <h4>Thông tin đặt khám</h4>
        <HienThiDongPhieu rows={bookingRows} />
      </section>

      <section>
        <h4>Thông tin bệnh nhân</h4>
        <HienThiDongPhieu rows={patientRows} />
      </section>

      <section>
        <h4>Kết quả</h4>
        <div className="empty-result">
          <span>▤</span>
          <small>Đang chờ kết quả cập nhật</small>
        </div>
      </section>
    </article>
  );
}

function TrangPhieuKham({ appointment, user, onLogout }) {
  const [activeTab, setActiveTab] = useState('lich_kham');
  const [selectedAppointment, setSelectedAppointment] = useState(appointment);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [profiles, setProfiles] = useState(() => [{ id: 'me', ...tao_ho_so_mac_dinh(appointment, user) }]);
  const [selectedProfileId, setSelectedProfileId] = useState('me');
  const [profileDraft, setProfileDraft] = useState(() => tao_ho_so_mac_dinh(appointment, user));
  const [addressData, setAddressData] = useState(DIA_CHI_FALLBACK);
  const [profileError, setProfileError] = useState('');
  const [profileFieldErrors, setProfileFieldErrors] = useState({});

  const profile = profiles.find((item) => item.id === selectedProfileId) || profiles[0];
  const selectedProvince = useMemo(
    () => addressData.find((item) => item.name === profileDraft.province),
    [addressData, profileDraft.province],
  );
  const selectedDistrict = useMemo(
    () => selectedProvince?.districts.find((item) => item.name === profileDraft.district),
    [selectedProvince, profileDraft.district],
  );

  const patientName = profile.fullName || tao_ten_benh_nhan(user);
  const canSubmitProfile = profileDraft.fullName.trim()
    && profileDraft.phone.length === 10
    && kiem_tra_ngay_sinh(profileDraft.birthDate)
    && (!profileDraft.citizenId || [9, 12].includes(profileDraft.citizenId.length))
    && (!profileDraft.insuranceCode || kiem_tra_bhyt(profileDraft.insuranceCode));

  const validateProfileDraft = () => {
    const errors = {};
    if (!profileDraft.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên';
    if (profileDraft.phone.length !== 10) errors.phone = 'Vui lòng nhập số điện thoại 10 số';
    if (!kiem_tra_ngay_sinh(profileDraft.birthDate)) errors.birthDate = 'Vui lòng nhập ngày sinh đúng dd/mm/yyyy';
    if (!profileDraft.gender) errors.gender = 'Vui lòng chọn giới tính';
    if (profileDraft.citizenId && ![9, 12].includes(profileDraft.citizenId.length)) errors.citizenId = 'CMND/CCCD phải gồm 9 hoặc 12 số';
    if (profileDraft.insuranceCode && !kiem_tra_bhyt(profileDraft.insuranceCode)) errors.insuranceCode = 'Mã BHYT chưa đúng định dạng';
    return errors;
  };

  useEffect(() => {
    let isMounted = true;

    fetch('https://provinces.open-api.vn/api/?depth=3')
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        if (isMounted && Array.isArray(data)) setAddressData(chuan_hoa_dia_chi_api(data));
      })
      .catch(() => {
        if (isMounted) setAddressData(DIA_CHI_FALLBACK);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCancel = () => {
    setSelectedAppointment((current) => ({ ...current, status: 'Đã hủy' }));
  };

  const openEditProfile = () => {
    setProfileDraft(profile);
    setProfileError('');
    setProfileFieldErrors({});
    setIsAddingProfile(false);
    setIsEditingProfile(true);
  };

  const openAddProfile = () => {
    setProfileDraft(tao_ho_so_moi());
    setProfileError('');
    setProfileFieldErrors({});
    setIsEditingProfile(false);
    setIsAddingProfile(true);
  };

  const cancelEditProfile = () => {
    setProfileDraft(profile);
    setProfileError('');
    setProfileFieldErrors({});
    setIsEditingProfile(false);
    setIsAddingProfile(false);
  };

  const updateProfileDraft = (event) => {
    const { name, value } = event.target;
    setProfileError('');
    setProfileFieldErrors((current) => ({ ...current, [name]: undefined }));
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

  const submitProfile = (event) => {
    event.preventDefault();
    const errors = validateProfileDraft();
    setProfileFieldErrors(errors);
    if (Object.keys(errors).length) {
      setProfileError('Vui lòng nhập đúng các thông tin có dấu *, số điện thoại 10 số, ngày sinh dd/mm/yyyy. CCCD/CMND và BHYT nếu nhập phải đúng định dạng.');
      return;
    }

    if (isAddingProfile) {
      const newProfile = { ...profileDraft, id: `profile_${Date.now()}` };
      setProfiles((current) => [...current, newProfile]);
      setSelectedProfileId(newProfile.id);
      setIsAddingProfile(false);
      return;
    }

    setProfiles((current) => current.map((item) => (
      item.id === selectedProfileId ? { ...item, ...profileDraft } : item
    )));
    setSelectedAppointment((current) => ({
      ...current,
      patientName: profileDraft.fullName,
      phone: profileDraft.phone,
      birthDate: profileDraft.birthDate,
      gender: profileDraft.gender,
      patientAddress: profileDraft.address || 'Chưa cập nhật',
    }));
    setIsEditingProfile(false);
  };

  const menu = [
    ['lich_kham', 'Lịch khám'],
    ['lich_su_thanh_toan', 'Lịch sử thanh toán'],
    ['ho_so', 'Hồ sơ'],
    ['tai_khoan', 'Tài khoản'],
  ];

  return (
    <section className="account-page">
      <aside className="account-sidebar">
        {menu.map(([key, label]) => (
          <button className={activeTab === key ? 'active' : ''} key={key} type="button" onClick={() => setActiveTab(key)}>
            {label}
          </button>
        ))}
        <button type="button" onClick={onLogout}>Đăng xuất</button>
      </aside>

      <main className="account-content">
        {activeTab === 'lich_kham' && (
          <>
            <div className="account-title-row">
              <h2>Lịch khám</h2>
              <button type="button">⚱ Lọc</button>
            </div>
            <div className="schedule-layout">
              <div>
                <input className="account-search" placeholder="Mã giao dịch, tên dịch vụ, tên bệnh nhân,..." />
                <button className="appointment-list-item" type="button" onClick={() => setSelectedAppointment(appointment)}>
                  <span>
                    <strong>{appointment.doctorShortName}</strong>
                    <small>{appointment.time} - {appointment.dateDisplay}</small>
                    <small>{patientName}</small>
                    <em className={selectedAppointment.status === 'Đã hủy' ? 'danger-badge' : ''}>{selectedAppointment.status}</em>
                  </span>
                  <b>STT<br />{appointment.number}</b>
                </button>
              </div>
              <div>
                <PhieuKhamChiTiet appointment={selectedAppointment} compact />
                {selectedAppointment.status !== 'Đã hủy' && (
                  <button className="cancel-appointment" type="button" onClick={handleCancel}>Hủy lịch</button>
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'lich_su_thanh_toan' && (
          <>
            <div className="account-title-row">
              <h2>Lịch sử thanh toán</h2>
              <button type="button">⚱ Lọc</button>
            </div>
            <input className="account-search" placeholder="Mã giao dịch, tên dịch vụ, tên bệnh nhân, số điện thoại ..." />
            <div className="empty-payment"><span>▤</span><p>Chưa có thông tin thanh toán</p></div>
          </>
        )}

        {activeTab === 'ho_so' && (
          <>
            <h2>Hồ sơ</h2>
            <div className={(isEditingProfile || isAddingProfile) ? 'profile-account-layout editing' : 'profile-account-layout'}>
              <div>
                <input className="account-search" placeholder="Tìm nhanh hồ sơ" />
                {profiles.map((item) => (
                  <button
                    className={item.id === selectedProfileId ? 'profile-mini-card active' : 'profile-mini-card'}
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedProfileId(item.id);
                      setIsEditingProfile(false);
                      setIsAddingProfile(false);
                    }}
                  >
                    <div className="patient-avatar">{lay_ten_tat(item.fullName)}</div>
                    <span>
                      {item.relationship === 'Tôi' && <em>Tôi</em>}
                      <strong>{item.fullName || 'Hồ sơ mới'}</strong>
                      <small>{item.birthDate}</small>
                    </span>
                  </button>
                ))}
                <button className="add-profile-button" type="button" onClick={openAddProfile}>Thêm hồ sơ</button>
              </div>

              {(isEditingProfile || isAddingProfile) ? (
                <form className="profile-edit-card" onSubmit={submitProfile}>
                  <h3>{isAddingProfile ? 'Thêm hồ sơ mới' : 'Điều chỉnh thông tin'}</h3>
                  <div className="profile-edit-divider" />
                  <ONhapHoSo label="Họ và tên" name="fullName" value={profileDraft.fullName} required placeholder="Họ và tên" onChange={updateProfileDraft} error={profileFieldErrors.fullName} />
                  <ONhapHoSo label="Số điện thoại" name="phone" value={profileDraft.phone} required placeholder="Số điện thoại" onChange={updateProfileDraft} error={profileFieldErrors.phone} />
                  <ONhapHoSo label="Ngày sinh" name="birthDate" value={profileDraft.birthDate} required placeholder="Ngày sinh" onChange={updateProfileDraft} error={profileFieldErrors.birthDate} />

                  <div className={profileFieldErrors.gender ? 'profile-gender-row has-error' : 'profile-gender-row'}>
                    <span>Giới tính <b>*</b></span>
                    <label><input checked={profileDraft.gender === 'Nam'} name="gender" type="radio" value="Nam" onChange={updateProfileDraft} /> Nam</label>
                    <label><input checked={profileDraft.gender === 'Nữ'} name="gender" type="radio" value="Nữ" onChange={updateProfileDraft} /> Nữ</label>
                    {profileFieldErrors.gender && <small>{profileFieldErrors.gender}</small>}
                  </div>

                  <div className="profile-edit-grid-3">
                    <OChonHoSo label="Tỉnh / Thành phố" name="province" value={profileDraft.province} placeholder="Chọn Tỉnh / Thành phố" onChange={updateProfileDraft}>
                      {addressData.map((province) => <option key={province.name}>{province.name}</option>)}
                    </OChonHoSo>
                    <OChonHoSo label="Quận / Huyện" name="district" value={profileDraft.district} placeholder="Chọn Quận / Huyện" onChange={updateProfileDraft}>
                      {(selectedProvince?.districts || []).map((district) => <option key={district.name}>{district.name}</option>)}
                    </OChonHoSo>
                    <OChonHoSo label="Phường / Xã" name="ward" value={profileDraft.ward} placeholder="Chọn phường xã" onChange={updateProfileDraft}>
                      {(selectedDistrict?.wards || []).map((ward) => <option key={ward}>{ward}</option>)}
                    </OChonHoSo>
                  </div>

                  <ONhapHoSo label="Địa chỉ cụ thể" name="address" value={profileDraft.address} placeholder="Số nhà, tên đường" onChange={updateProfileDraft} />
                  <div className="profile-edit-grid-2">
                    <ONhapHoSo label="Số CMND/CCCD" name="citizenId" value={profileDraft.citizenId} placeholder="Số CMND hoặc CCCD" onChange={updateProfileDraft} error={profileFieldErrors.citizenId} />
                    <OChonHoSo label="Dân tộc" name="ethnicity" value={profileDraft.ethnicity} placeholder="Chọn dân tộc" onChange={updateProfileDraft}>
                      {DAN_TOC_VIET_NAM.map((ethnicity) => <option key={ethnicity}>{ethnicity}</option>)}
                    </OChonHoSo>
                  </div>
                  <OChonHoSo label="Nghề nghiệp" name="job" value={profileDraft.job} placeholder="Chọn nghề nghiệp" onChange={updateProfileDraft}>
                    {NGHE_NGHIEP.map((job) => <option key={job}>{job}</option>)}
                  </OChonHoSo>
                  <ONhapHoSo label="Mã thẻ BHYT" name="insuranceCode" value={profileDraft.insuranceCode} placeholder="Mã số trên thẻ Bảo hiểm y tế" onChange={updateProfileDraft} error={profileFieldErrors.insuranceCode} />
                  <ONhapHoSo label="Email" name="email" value={profileDraft.email} placeholder="Địa chỉ email của bạn" onChange={updateProfileDraft} />
                  {isAddingProfile && (
                    <div className="relationship-group">
                      <span>Mối quan hệ <b>*</b></span>
                      {['Cha', 'Mẹ', 'Con', 'Chồng', 'Vợ', 'Khác'].map((relationship) => (
                        <label key={relationship}>
                          <input
                            checked={profileDraft.relationship === relationship}
                            name="relationship"
                            type="radio"
                            value={relationship}
                            onChange={updateProfileDraft}
                          />
                          {relationship}
                        </label>
                      ))}
                    </div>
                  )}
                  {profileError && <p className="profile-form-error">{profileError}</p>}
                  <div className="profile-edit-actions">
                    <button type="button" onClick={cancelEditProfile}>{isAddingProfile ? 'Thoát' : 'Hủy'}</button>
                    <button type="submit">{isAddingProfile ? 'Thêm hồ sơ mới' : 'Cập nhật'}</button>
                  </div>
                </form>
              ) : (
                <div className="profile-detail-card">
                  <div className="profile-detail-head">
                    <div className="patient-avatar">{lay_ten_tat(patientName)}</div>
                    <span><strong>{patientName.toUpperCase()}</strong><small>Mã BN: {appointment.patientCode}</small></span>
                  </div>
                  <p className="profile-warning">Hoàn thiện thông tin để đặt khám và quản lý hồ sơ y tế được tốt hơn.</p>
                  <HangThongTin label="Họ và tên" value={patientName} />
                  <HangThongTin label="Điện thoại" value={profile.phone} />
                  <HangThongTin label="Ngày sinh" value={profile.birthDate} />
                  <HangThongTin label="Giới tính" value={profile.gender} />
                  <HangThongTin label="Địa chỉ" value={profile.address || '--'} />
                  <HangThongTin label="Mã BHYT" value={profile.insuranceCode || '--'} />
                  <HangThongTin label="Số CMND/CCCD" value={profile.citizenId || '--'} />
                  <HangThongTin label="Dân tộc" value={profile.ethnicity} />
                  <HangThongTin label="Nghề nghiệp" value={profile.job || '--'} />
                  <HangThongTin label="Email" value={profile.email || '--'} />
                  <button type="button" onClick={openEditProfile}>Thay đổi thông tin</button>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'tai_khoan' && (
          <>
            <h2>Tài khoản</h2>
            <div className="account-settings-grid">
              <div className="profile-detail-card">
                <h3>Thông tin tài khoản</h3>
                <HangThongTin label="Họ và tên" value={patientName} />
                <HangThongTin label="Số điện thoại" value={profile.phone} />
                <HangThongTin label="Ngày sinh" value={profile.birthDate} />
                <HangThongTin label="Địa chỉ" value={profile.address || '---'} />
                <HangThongTin label="CMND/CCCD" value={profile.citizenId || '---'} />
                <HangThongTin label="Mã BHYT" value={profile.insuranceCode || '---'} />
                <button type="button" onClick={() => { setActiveTab('ho_so'); openEditProfile(); }}>Thay đổi thông tin</button>
              </div>
              <div className="profile-detail-card">
                <h3>Thay đổi mật khẩu</h3>
                <label>Mật khẩu hiện tại<input type="password" placeholder="Mật khẩu hiện tại của bạn" /></label>
                <label>Mật khẩu mới<input type="password" placeholder="Nhập mật khẩu mới" /></label>
                <button type="button" disabled>Thay đổi</button>
              </div>
            </div>
          </>
        )}
      </main>
    </section>
  );
}

export { PhieuKhamChiTiet, co_gia_tri, tao_dong_phieu_kham };
export default TrangPhieuKham;
