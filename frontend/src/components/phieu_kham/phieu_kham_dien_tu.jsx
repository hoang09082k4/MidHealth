import { useEffect, useMemo, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import {
  chuan_hoa_bhyt,
  chuan_hoa_cmnd_cccd,
  chuan_hoa_so_dien_thoai,
  kiem_tra_bhyt,
  kiem_tra_ngay_sinh,
} from '../../data/du_lieu_ho_so';
import { cancelAppointment, listAppointments, listPatientProfiles, savePatientProfile } from '../../lib/appointments';
import { mergeAppointments, readLocalAppointments, saveLocalAppointments } from '../../lib/local_appointments';
import { loadNotifications, markNotificationsRead } from '../../lib/notifications';
import { useReferenceData } from '../../lib/reference_data';

function tao_ten_benh_nhan(user) {
  if (!user) return '';
  return user.displayName || user.phoneNumber || user.email?.split('@')[0] || '';
}

function tao_ho_so_mac_dinh(appointment, user) {
  const patientProfile = appointment?.patientProfile || {};
  return {
    id: patientProfile.id || 'me',
    fullName: patientProfile.fullName || patientProfile.name || tao_ten_benh_nhan(user),
    phone: patientProfile.phone || appointment?.phone || user?.phoneNumber || '',
    birthDate: patientProfile.birthDate || appointment?.birthDate || '',
    gender: patientProfile.gender || appointment?.gender || '',
    province: patientProfile.province || '',
    district: patientProfile.district || '',
    ward: patientProfile.ward || '',
    address: patientProfile.address || (appointment?.patientAddress === 'Chưa cập nhật' ? '' : appointment?.patientAddress || ''),
    citizenId: patientProfile.citizenId || '',
    ethnicity: patientProfile.ethnicity || 'Kinh',
    nationality: patientProfile.nationality || 'Việt Nam',
    job: patientProfile.job || patientProfile.occupation || '',
    insuranceCode: patientProfile.insuranceCode || patientProfile.healthInsuranceNumber || '',
    email: patientProfile.email || user?.email || '',
    relationship: patientProfile.relationship || 'Tôi',
  };
}

function chuyen_ho_so_tu_api(profile) {
  const rawBirthDate = profile.birthDate || profile.birth_date || profile.date_of_birth || profile.dateOfBirth || '';
  const birthDate = /^\d{4}-\d{2}-\d{2}$/.test(rawBirthDate)
    ? rawBirthDate.split('-').reverse().join('/')
    : rawBirthDate;
  return {
    id: profile.id || `profile_${Date.now()}`,
    fullName: profile.full_name || profile.fullName || profile.name || '',
    phone: profile.phone || '',
    birthDate,
    gender: profile.gender === 'female' ? 'Nữ' : profile.gender === 'male' ? 'Nam' : profile.gender || '',
    province: profile.province || '',
    district: profile.district || '',
    ward: profile.ward || '',
    address: profile.address || '',
    citizenId: profile.citizen_id || profile.citizenId || '',
    ethnicity: profile.ethnicity || 'Kinh',
    nationality: profile.nationality || 'Việt Nam',
    job: profile.occupation || profile.job || '',
    insuranceCode: profile.health_insurance_number || profile.healthInsuranceNumber || profile.insuranceCode || '',
    email: profile.email || '',
    relationship: profile.relationship || (profile.is_primary || profile.isMain ? 'Tôi' : 'Khác'),
  };
}

function khoa_ho_so(profile) {
  return profile.id || `${profile.fullName || ''}-${profile.phone || ''}`;
}

function gop_ho_so(profiles) {
  const seen = new Set();
  return profiles.filter((profile) => {
    const key = khoa_ho_so(profile);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tao_ho_so_moi() {
  return {
    fullName: '',
    phone: '',
    birthDate: '',
    gender: '',
    province: '',
    district: '',
    ward: '',
    address: '',
    citizenId: '',
    ethnicity: 'Kinh',
    nationality: '',
    job: '',
    insuranceCode: '',
    email: '',
    relationship: 'Khác',
  };
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

function gop_lich_kham(appointments) {
  return mergeAppointments(appointments);
}

function chuyen_ngay_loc(dateValue) {
  if (!dateValue) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
  const match = String(dateValue).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

function loai_noi_kham(appointment) {
  if (appointment.type === 'doctor') return 'doctor';
  if (appointment.type === 'clinic') return 'clinic';
  if (appointment.type === 'hospital') return 'hospital';
  return 'all';
}

function loai_dich_vu(appointment) {
  const content = [appointment.serviceName, appointment.department, appointment.doctorName, appointment.hospitalName].join(' ').toLowerCase();
  if (content.includes('tư vấn') || content.includes('tu van')) return 'consult';
  if (content.includes('tại nhà') || content.includes('tai nha')) return 'home';
  return 'exam';
}

const FILTER_DEFAULT = {
  fromDate: '',
  toDate: '',
  status: 'all',
  serviceType: 'all',
  placeType: 'all',
};

const PAYMENT_FILTER_DEFAULT = {
  fromDate: '',
  toDate: '',
  status: 'all',
};

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
      { label: 'Mã phiếu khám điện tử', value: appointment.appointmentCode },
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
      { label: 'Quốc tịch', value: lay_gia_tri_ho_so(patientProfile, appointment, ['nationality']) || 'Việt Nam' },
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

function TrangPhieuKhamDienTu({ appointment, user, initialTab = 'lich_kham', onTabChange, onLogout }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedAppointment, setSelectedAppointment] = useState(appointment);
  const [appointments, setAppointments] = useState(() => gop_lich_kham([appointment, ...readLocalAppointments(user)].filter(Boolean)));
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState(FILTER_DEFAULT);
  const [filters, setFilters] = useState(FILTER_DEFAULT);
  const [appointmentError, setAppointmentError] = useState('');
  const [paymentSearchTerm, setPaymentSearchTerm] = useState('');
  const [isPaymentFilterOpen, setIsPaymentFilterOpen] = useState(false);
  const [paymentFilterDraft, setPaymentFilterDraft] = useState(PAYMENT_FILTER_DEFAULT);
  const [paymentFilters, setPaymentFilters] = useState(PAYMENT_FILTER_DEFAULT);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [profileSearchTerm, setProfileSearchTerm] = useState('');
  const [profiles, setProfiles] = useState(() => [tao_ho_so_mac_dinh(appointment, user)]);
  const [selectedProfileId, setSelectedProfileId] = useState('me');
  const [profileDraft, setProfileDraft] = useState(() => tao_ho_so_mac_dinh(appointment, user));
  const { addressData, ethnicGroups, occupations } = useReferenceData();
  const [profileError, setProfileError] = useState('');
  const [profileFieldErrors, setProfileFieldErrors] = useState({});
  const [passwordDraft, setPasswordDraft] = useState({ currentPassword: '', newPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [selectedNotificationId, setSelectedNotificationId] = useState('');

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
  const visibleProfiles = useMemo(() => {
    const keyword = profileSearchTerm.trim().toLowerCase();
    if (!keyword) return profiles;
    return profiles.filter((item) => [
      item.fullName,
      item.phone,
      item.birthDate,
      item.citizenId,
      item.relationship,
    ].join(' ').toLowerCase().includes(keyword));
  }, [profileSearchTerm, profiles]);
  const visibleAppointments = useMemo(() => appointments.filter((item) => {
    const appointmentDate = chuyen_ngay_loc(item.dateValue || item.dateDisplay);
    const searchable = [
      item.appointmentCode,
      item.ticket,
      item.serviceName,
      item.patientName,
      item.doctorName,
      item.doctorShortName,
      item.hospitalName,
      item.department,
    ].join(' ').toLowerCase();
    const keyword = searchTerm.trim().toLowerCase();

    if (keyword && !searchable.includes(keyword)) return false;
    if (filters.fromDate && appointmentDate && appointmentDate < filters.fromDate) return false;
    if (filters.toDate && appointmentDate && appointmentDate > filters.toDate) return false;
    if (filters.status !== 'all' && item.status !== filters.status) return false;
    if (filters.serviceType !== 'all' && loai_dich_vu(item) !== filters.serviceType) return false;
    if (filters.placeType !== 'all' && loai_noi_kham(item) !== filters.placeType) return false;
    return true;
  }), [appointments, filters, searchTerm]);
  const visiblePayments = useMemo(() => appointments
    .map((item) => ({
      ...item,
      paymentCode: item.paymentCode || item.transactionCode || item.appointmentCode || item.ticket,
      paymentAmount: item.paymentAmount || item.amount || item.price || item.fee,
      paymentStatus: item.paymentStatus || item.payment_status || (item.isPaid ? 'Đã thanh toán' : ''),
      paymentDate: item.paymentDate || item.paidAt || item.dateDisplay,
    }))
    .filter((item) => co_gia_tri(item.paymentStatus) || co_gia_tri(item.paymentAmount))
    .filter((item) => {
      const paymentDate = chuyen_ngay_loc(item.paymentDate || item.dateValue || item.dateDisplay);
      const keyword = paymentSearchTerm.trim().toLowerCase();
      const searchable = [
        item.paymentCode,
        item.serviceName,
        item.patientName,
        item.doctorName,
        item.hospitalName,
        item.paymentStatus,
      ].join(' ').toLowerCase();

      if (keyword && !searchable.includes(keyword)) return false;
      if (paymentFilters.fromDate && paymentDate && paymentDate < paymentFilters.fromDate) return false;
      if (paymentFilters.toDate && paymentDate && paymentDate > paymentFilters.toDate) return false;
      if (paymentFilters.status !== 'all' && item.paymentStatus !== paymentFilters.status) return false;
      return true;
    }), [appointments, paymentFilters, paymentSearchTerm]);
  const activeAppointment = selectedAppointment || visibleAppointments[0] || appointments[0] || appointment;
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
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setAppointments(gop_lich_kham([appointment, ...readLocalAppointments(user)].filter(Boolean)));
    setSelectedAppointment(appointment || null);
  }, [appointment, user]);

  useEffect(() => {
    let isMounted = true;
    loadNotifications(user).then((items) => {
      if (!isMounted) return;
      setNotifications(items);
      setSelectedNotificationId((current) => current || items[0]?.id || '');
    });

    return () => {
      isMounted = false;
    };
  }, [user, appointments]);

  const changeTab = (nextTab) => {
    setActiveTab(nextTab);
    onTabChange?.(nextTab);
  };

  useEffect(() => {
    let isMounted = true;

    if (!user) return () => {
      isMounted = false;
    };

    listAppointments(user)
      .then((items) => {
        if (!isMounted) return;
        setAppointments((current) => {
          const nextAppointments = gop_lich_kham([appointment, ...items, ...current].filter(Boolean));
          saveLocalAppointments(user, nextAppointments);
          return nextAppointments;
        });
      })
      .catch((error) => {
        if (isMounted) setAppointmentError(error.message || 'Không thể tải danh sách lịch hẹn.');
      });

    return () => {
      isMounted = false;
    };
  }, [appointment, user]);

  useEffect(() => {
    const defaultProfile = tao_ho_so_mac_dinh(appointment, user);
    setProfiles((current) => gop_ho_so([defaultProfile, ...current]));
    setSelectedProfileId((current) => current || defaultProfile.id);

    if (!user) return;

    let isMounted = true;
    listPatientProfiles(user)
      .then((items) => {
        if (!isMounted) return;
        const apiProfiles = items.map(chuyen_ho_so_tu_api);
        const nextProfiles = gop_ho_so(apiProfiles.length ? apiProfiles : [defaultProfile]);
        setProfiles(nextProfiles);
        setSelectedProfileId((current) => (
          nextProfiles.some((item) => item.id === current) ? current : nextProfiles[0]?.id || defaultProfile.id
        ));
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [appointment, user]);

  useEffect(() => {
    if (!selectedAppointment && visibleAppointments.length > 0) {
      setSelectedAppointment(visibleAppointments[0]);
      return;
    }
    if (selectedAppointment && visibleAppointments.length > 0 && !visibleAppointments.some((item) => (item.id || item.appointmentCode) === (selectedAppointment.id || selectedAppointment.appointmentCode))) {
      setSelectedAppointment(visibleAppointments[0]);
    }
  }, [selectedAppointment, visibleAppointments]);

  const handleCancel = async () => {
    const targetAppointment = selectedAppointment || activeAppointment;
    if (!targetAppointment) return;
    if (!window.confirm('Bạn muốn hủy lịch khám này?')) return;

    try {
      if (targetAppointment.id && user) {
        await cancelAppointment(user, targetAppointment.id);
      }
      setSelectedAppointment((current) => ({ ...current, status: 'Đã hủy' }));
      setAppointments((current) => {
        const nextAppointments = current.map((item) => (
          (item.id || item.appointmentCode) === (targetAppointment.id || targetAppointment.appointmentCode)
            ? { ...item, status: 'Đã hủy' }
            : item
        ));
        saveLocalAppointments(user, nextAppointments);
        return nextAppointments;
      });
    } catch (error) {
      setProfileError(error.message || 'Không thể hủy lịch khám. Vui lòng thử lại.');
    }
  };

  const handleLogout = async () => {
    setIsLogoutConfirmOpen(true);
  };

  const confirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout?.();
    } finally {
      setIsLoggingOut(false);
      setIsLogoutConfirmOpen(false);
    }
  };

  const openEditProfile = () => {
    setProfileDraft(profile);
    setProfileError('');
    setProfileFieldErrors({});
    setProfileMessage('');
    setIsAddingProfile(false);
    setIsEditingProfile(true);
  };

  const openAddProfile = () => {
    setProfileDraft(tao_ho_so_moi());
    setProfileError('');
    setProfileFieldErrors({});
    setProfileMessage('');
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

  const submitProfile = async (event) => {
    event.preventDefault();
    const errors = validateProfileDraft();
    setProfileFieldErrors(errors);
    if (Object.keys(errors).length) {
      setProfileError('Vui lòng nhập đúng các thông tin có dấu *, số điện thoại 10 số, ngày sinh dd/mm/yyyy. CCCD/CMND và BHYT nếu nhập phải đúng định dạng.');
      return;
    }

    let savedProfile = null;
    setIsProfileSaving(true);
    setProfileMessage('');
    try {
      if (user) {
        savedProfile = await savePatientProfile(user, profileDraft);
      }
    } catch (error) {
      setProfileError(error.message || 'Không thể lưu hồ sơ khám điện tử.');
      setIsProfileSaving(false);
      return;
    }

    const normalizedSavedProfile = savedProfile
      ? { ...profileDraft, ...chuyen_ho_so_tu_api(savedProfile) }
      : profileDraft;

    if (isAddingProfile) {
      const newProfile = { ...normalizedSavedProfile, id: savedProfile?.id || `profile_${Date.now()}` };
      setProfiles((current) => [...current, newProfile]);
      setSelectedProfileId(newProfile.id);
      setIsAddingProfile(false);
      setIsProfileSaving(false);
      setProfileMessage('Đã thêm hồ sơ bệnh nhân.');
      return;
    }

    setProfiles((current) => current.map((item) => (
      item.id === selectedProfileId ? { ...item, ...normalizedSavedProfile, id: savedProfile?.id || item.id } : item
    )));
    setSelectedAppointment((current) => ({
      ...(current || activeAppointment || {}),
      patientName: profileDraft.fullName,
      phone: profileDraft.phone,
      birthDate: profileDraft.birthDate,
      gender: profileDraft.gender,
      patientAddress: [profileDraft.address, profileDraft.ward, profileDraft.district, profileDraft.province].filter(Boolean).join(', ') || 'Chưa cập nhật',
      patientProfile: { ...(current?.patientProfile || {}), ...profileDraft },
    }));
    setAppointments((current) => {
      const nextAppointments = current.map((item) => (
        (item.id || item.appointmentCode) === (activeAppointment.id || activeAppointment.appointmentCode)
          ? {
            ...item,
            patientName: profileDraft.fullName,
            phone: profileDraft.phone,
            birthDate: profileDraft.birthDate,
            gender: profileDraft.gender,
            patientAddress: [profileDraft.address, profileDraft.ward, profileDraft.district, profileDraft.province].filter(Boolean).join(', ') || 'Chưa cập nhật',
            patientProfile: { ...(item.patientProfile || {}), ...profileDraft },
          }
          : item
      ));
      saveLocalAppointments(user, nextAppointments);
      return nextAppointments;
    });
    setIsEditingProfile(false);
    setIsProfileSaving(false);
    setProfileMessage('Đã cập nhật hồ sơ bệnh nhân.');
  };

  const updatePaymentFilterDraft = (event) => {
    const { name, value } = event.target;
    setPaymentFilterDraft((current) => ({ ...current, [name]: value }));
  };

  const applyPaymentFilters = () => {
    setPaymentFilters(paymentFilterDraft);
    setIsPaymentFilterOpen(false);
  };

  const clearPaymentFilters = () => {
    setPaymentFilterDraft(PAYMENT_FILTER_DEFAULT);
    setPaymentFilters(PAYMENT_FILTER_DEFAULT);
    setPaymentSearchTerm('');
    setIsPaymentFilterOpen(false);
  };

  const updatePasswordDraft = (event) => {
    const { name, value } = event.target;
    setPasswordDraft((current) => ({ ...current, [name]: value }));
    setPasswordMessage('');
  };

  const submitPasswordChange = async (event) => {
    event.preventDefault();
    if (!user?.email) {
      setPasswordMessage('Tài khoản này không hỗ trợ đổi mật khẩu bằng email/mật khẩu.');
      return;
    }
    if (!passwordDraft.currentPassword || passwordDraft.newPassword.length < 6) {
      setPasswordMessage('Vui lòng nhập mật khẩu hiện tại và mật khẩu mới từ 6 ký tự.');
      return;
    }

    setIsPasswordSaving(true);
    setPasswordMessage('');
    try {
      const credential = EmailAuthProvider.credential(user.email, passwordDraft.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordDraft.newPassword);
      setPasswordDraft({ currentPassword: '', newPassword: '' });
      setPasswordMessage('Đã thay đổi mật khẩu.');
    } catch (error) {
      setPasswordMessage(error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential'
        ? 'Mật khẩu hiện tại chưa đúng.'
        : 'Không thể đổi mật khẩu. Vui lòng thử lại.');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const updateFilterDraft = (event) => {
    const { name, value } = event.target;
    setFilterDraft((current) => ({ ...current, [name]: value }));
  };

  const applyFilters = () => {
    setFilters(filterDraft);
    setIsFilterOpen(false);
  };

  const clearFilters = () => {
    setFilterDraft(FILTER_DEFAULT);
    setFilters(FILTER_DEFAULT);
    setSearchTerm('');
    setIsFilterOpen(false);
  };

  const unreadNotificationCount = notifications.filter((item) => !item.read).length;
  const activeNotification = notifications.find((item) => item.id === selectedNotificationId) || notifications[0];

  const selectNotification = (notification) => {
    setSelectedNotificationId(notification.id);
    if (!notification.read) {
      markNotificationsRead(user, [notification.id]);
      setNotifications((current) => current.map((item) => (
        item.id === notification.id ? { ...item, read: true } : item
      )));
    }
  };

  const markAllNotificationsRead = () => {
    markNotificationsRead(user, notifications.map((item) => item.id));
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  };

  const menu = [
    ['lich_kham', 'Lịch khám'],
    ['lich_su_thanh_toan', 'Lịch sử thanh toán'],
    ['ho_so', 'Hồ sơ khám điện tử'],
    ['thong_bao', 'Thông báo', unreadNotificationCount],
    ['tai_khoan', 'Tài khoản'],
  ];

  return (
    <>
      <section className="account-page">
        <aside className="account-sidebar">
          {menu.map(([key, label, count]) => (
            <button className={activeTab === key ? 'active' : ''} key={key} type="button" onClick={() => changeTab(key)}>
              <span>{label}</span>
              {count ? <b className="account-sidebar-badge">{count > 9 ? '9+' : count}</b> : null}
            </button>
          ))}
          <button type="button" onClick={handleLogout}>Đăng xuất</button>
        </aside>

        <main className="account-content">
        {activeTab === 'lich_kham' && (
          <>
            <div className="account-title-row">
              <h2>Lịch khám</h2>
              <button type="button" onClick={() => { setFilterDraft(filters); setIsFilterOpen((current) => !current); }}>Lọc</button>
            </div>
            {isFilterOpen && (
              <div className="appointment-filter-panel">
                <label>
                  Ngày bắt đầu
                  <input name="fromDate" type="date" value={filterDraft.fromDate} onChange={updateFilterDraft} />
                </label>
                <label>
                  Ngày kết thúc
                  <input name="toDate" type="date" value={filterDraft.toDate} onChange={updateFilterDraft} />
                </label>
                <label>
                  Trạng thái
                  <select name="status" value={filterDraft.status} onChange={updateFilterDraft}>
                    <option value="all">Tất cả</option>
                    <option value="Đã đặt lịch">Đã đặt lịch</option>
                    <option value="Đã hủy">Đã hủy</option>
                    <option value="Đã khám">Đã khám</option>
                  </select>
                </label>
                <label>
                  Dịch vụ
                  <select name="serviceType" value={filterDraft.serviceType} onChange={updateFilterDraft}>
                    <option value="all">Tất cả</option>
                    <option value="exam">Lịch khám</option>
                    <option value="consult">Lịch tư vấn</option>
                    <option value="home">Tại nhà</option>
                  </select>
                </label>
                <label>
                  Nơi khám
                  <select name="placeType" value={filterDraft.placeType} onChange={updateFilterDraft}>
                    <option value="all">Tất cả</option>
                    <option value="doctor">Bác sĩ</option>
                    <option value="clinic">Phòng khám</option>
                    <option value="hospital">Bệnh viện</option>
                  </select>
                </label>
                <div className="appointment-filter-actions">
                  <button type="button" onClick={clearFilters}>Bỏ lọc</button>
                  <button type="button" onClick={applyFilters}>Áp dụng</button>
                </div>
              </div>
            )}
            <div className="schedule-layout">
              <div>
                <input className="account-search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Mã giao dịch, tên dịch vụ, tên bệnh nhân,..." />
                {appointmentError && <p className="appointment-load-error">{appointmentError}</p>}
                {visibleAppointments.length > 0 ? visibleAppointments.map((item) => {
                  const itemKey = item.id || item.appointmentCode || item.ticket;
                  const selectedKey = activeAppointment?.id || activeAppointment?.appointmentCode || activeAppointment?.ticket;
                  return (
                    <button className={itemKey === selectedKey ? 'appointment-list-item active' : 'appointment-list-item'} key={itemKey} type="button" onClick={() => setSelectedAppointment(item)}>
                      <span>
                        <strong>{item.doctorShortName || item.doctorName || item.hospitalName}</strong>
                        <small>{item.time} - {item.dateDisplay}</small>
                        <small>{item.patientName || patientName}</small>
                        <em className={item.status === 'Đã hủy' ? 'danger-badge' : item.status === 'Đã khám' ? 'done-badge' : ''}>{item.status}</em>
                      </span>
                      <b>STT<br />{item.number || '--'}</b>
                    </button>
                  );
                }) : (
                  <div className="empty-payment"><span>▤</span><p>Không có lịch khám phù hợp</p></div>
                )}
              </div>
              <div>
                {activeAppointment && <PhieuKhamChiTiet appointment={activeAppointment} compact />}
                {activeAppointment?.status !== 'Đã hủy' && activeAppointment?.status !== 'Đã khám' && (
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
              <button type="button" onClick={() => { setPaymentFilterDraft(paymentFilters); setIsPaymentFilterOpen((current) => !current); }}>Lọc</button>
            </div>
            {isPaymentFilterOpen && (
              <div className="appointment-filter-panel">
                <label>
                  Ngày bắt đầu
                  <input name="fromDate" type="date" value={paymentFilterDraft.fromDate} onChange={updatePaymentFilterDraft} />
                </label>
                <label>
                  Ngày kết thúc
                  <input name="toDate" type="date" value={paymentFilterDraft.toDate} onChange={updatePaymentFilterDraft} />
                </label>
                <label>
                  Trạng thái
                  <select name="status" value={paymentFilterDraft.status} onChange={updatePaymentFilterDraft}>
                    <option value="all">Tất cả</option>
                    <option value="Đã thanh toán">Đã thanh toán</option>
                    <option value="Chờ thanh toán">Chờ thanh toán</option>
                    <option value="Đã hoàn tiền">Đã hoàn tiền</option>
                  </select>
                </label>
                <div className="appointment-filter-actions">
                  <button type="button" onClick={clearPaymentFilters}>Bỏ lọc</button>
                  <button type="button" onClick={applyPaymentFilters}>Áp dụng</button>
                </div>
              </div>
            )}
            <input
              className="account-search"
              value={paymentSearchTerm}
              placeholder="Mã giao dịch, tên dịch vụ, tên bệnh nhân, số điện thoại ..."
              onChange={(event) => setPaymentSearchTerm(event.target.value)}
            />
            {visiblePayments.length > 0 ? visiblePayments.map((item) => (
              <button className="appointment-list-item" key={item.paymentCode} type="button" onClick={() => setSelectedAppointment(item)}>
                <span>
                  <strong>{item.serviceName || item.doctorName || item.hospitalName || 'Dịch vụ khám'}</strong>
                  <small>{item.paymentCode}</small>
                  <small>{item.paymentDate || item.dateDisplay}</small>
                  <em className={item.paymentStatus === 'Đã thanh toán' ? 'done-badge' : ''}>{item.paymentStatus}</em>
                </span>
                <b>{item.paymentAmount ? `${Number(item.paymentAmount).toLocaleString('vi-VN')}đ` : '--'}</b>
              </button>
            )) : (
              <div className="empty-payment"><span>▤</span><p>Chưa có thông tin thanh toán</p></div>
            )}
          </>
        )}

        {activeTab === 'thong_bao' && (
          <>
            <div className="account-title-row">
              <h2>Thông báo</h2>
              {notifications.length > 0 ? <button type="button" onClick={markAllNotificationsRead}>Đánh dấu đã đọc</button> : null}
            </div>
            {notifications.length > 0 ? (
              <div className="notification-account-layout">
                <div className="notification-account-list">
                  {notifications.map((notification) => (
                    <button
                      key={notification.id}
                      className={[
                        'notification-account-item',
                        notification.id === activeNotification?.id ? 'active' : '',
                        notification.read ? 'read' : '',
                      ].filter(Boolean).join(' ')}
                      type="button"
                      onClick={() => selectNotification(notification)}
                    >
                      <span>
                        <strong>{notification.title}</strong>
                        <small>{notification.summary || notification.message}</small>
                        {notification.patientName ? <em>{notification.patientName}</em> : null}
                      </span>
                      {!notification.read ? <b>mới</b> : null}
                    </button>
                  ))}
                </div>

                {activeNotification ? (
                  <article className="notification-detail-card">
                    <div>
                      <span className={activeNotification.read ? 'notification-status read' : 'notification-status'}>{activeNotification.read ? 'Đã đọc' : 'Chưa đọc'}</span>
                      <h3>{activeNotification.title}</h3>
                      <p>{activeNotification.detailMessage || activeNotification.message}</p>
                    </div>
                    <div className="notification-detail-summary">
                      {activeNotification.appointmentCode ? <span><small>Mã phiếu</small><strong>{activeNotification.appointmentCode}</strong></span> : null}
                      {activeNotification.patientName ? <span><small>Bệnh nhân</small><strong>{activeNotification.patientName}</strong></span> : null}
                      {activeNotification.schedule ? <span><small>Thời gian</small><strong>{activeNotification.schedule}</strong></span> : null}
                    </div>
                    {(activeNotification.sections || []).map((section) => (
                      <section className="notification-detail-section" key={section.title}>
                        <h4>{section.title}</h4>
                        {section.rows.map(([label, value]) => (
                          <div className="notification-detail-row" key={label}>
                            <span>{label}</span>
                            <strong>{value}</strong>
                          </div>
                        ))}
                      </section>
                    ))}
                    {activeNotification.notes?.length ? (
                      <section className="notification-detail-section note">
                        <h4>Lưu ý</h4>
                        {activeNotification.notes.map((note) => <p key={note}>{note}</p>)}
                      </section>
                    ) : null}
                    <div className="notification-detail-actions">
                      <button type="button" onClick={() => changeTab('lich_kham')}>Xem lịch khám</button>
                    </div>
                  </article>
                ) : null}
              </div>
            ) : (
              <div className="empty-payment"><span>▤</span><p>Chưa có thông báo mới</p></div>
            )}
          </>
        )}

        {activeTab === 'ho_so' && (
          <>
            <h2>Hồ sơ khám điện tử</h2>
            {profileMessage ? <p className="profile-save-message" role="status">{profileMessage}</p> : null}
            <div className={(isEditingProfile || isAddingProfile) ? 'profile-account-layout editing' : 'profile-account-layout'}>
              <div>
                <input
                  className="account-search"
                  value={profileSearchTerm}
                  placeholder="Tìm nhanh hồ sơ khám điện tử"
                  onChange={(event) => setProfileSearchTerm(event.target.value)}
                />
                {visibleProfiles.map((item) => (
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
                      <strong>{item.fullName || 'Hồ sơ khám điện tử mới'}</strong>
                      <small>{item.birthDate}</small>
                    </span>
                  </button>
                ))}
                <button className="add-profile-button" type="button" onClick={openAddProfile}>Thêm hồ sơ khám điện tử</button>
              </div>

              {(isEditingProfile || isAddingProfile) ? (
                <form className="profile-edit-card" onSubmit={submitProfile}>
                  <h3>{isAddingProfile ? 'Thêm hồ sơ khám điện tử mới' : 'Điều chỉnh thông tin'}</h3>
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
                    <OChonHoSo label="Phường/Xã/Khu vực" name="district" value={profileDraft.district} placeholder="Chọn phường/xã/khu vực" onChange={updateProfileDraft}>
                      {(selectedProvince?.districts || []).map((district) => <option key={district.name}>{district.name}</option>)}
                    </OChonHoSo>
                    <OChonHoSo label="Tổ/Ấp/Đơn vị chi tiết" name="ward" value={profileDraft.ward} placeholder="Chọn thông tin chi tiết" onChange={updateProfileDraft}>
                      {(selectedDistrict?.wards || []).map((ward) => <option key={ward}>{ward}</option>)}
                    </OChonHoSo>
                  </div>

                  <ONhapHoSo label="Địa chỉ cụ thể" name="address" value={profileDraft.address} placeholder="Số nhà, tên đường" onChange={updateProfileDraft} />
                  <div className="profile-edit-grid-2">
                    <ONhapHoSo label="Số CMND/CCCD" name="citizenId" value={profileDraft.citizenId} placeholder="Số CMND hoặc CCCD" onChange={updateProfileDraft} error={profileFieldErrors.citizenId} />
                    <OChonHoSo label="Dân tộc" name="ethnicity" value={profileDraft.ethnicity} placeholder="Chọn dân tộc" onChange={updateProfileDraft}>
                      {ethnicGroups.map((ethnicity) => <option key={ethnicity}>{ethnicity}</option>)}
                    </OChonHoSo>
                  </div>
                  <ONhapHoSo label="Quốc tịch" name="nationality" value={profileDraft.nationality || ''} placeholder="Quốc tịch" onChange={updateProfileDraft} />
                  <OChonHoSo label="Nghề nghiệp" name="job" value={profileDraft.job} placeholder="Chọn nghề nghiệp" onChange={updateProfileDraft}>
                    {occupations.map((job) => <option key={job}>{job}</option>)}
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
                    <button type="submit" disabled={isProfileSaving}>
                      {isProfileSaving ? 'Đang lưu...' : isAddingProfile ? 'Thêm hồ sơ khám điện tử mới' : 'Cập nhật'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="profile-detail-card">
                  <div className="profile-detail-head">
                    <div className="patient-avatar">{lay_ten_tat(patientName)}</div>
                    <span><strong>{patientName.toUpperCase()}</strong><small>Mã BN: {activeAppointment?.patientCode || appointment?.patientCode}</small></span>
                  </div>
                  <p className="profile-warning">Hoàn thiện thông tin để đặt khám và quản lý hồ sơ khám điện tử được tốt hơn.</p>
                  <HangThongTin label="Họ và tên" value={patientName} />
                  <HangThongTin label="Điện thoại" value={profile.phone} />
                  <HangThongTin label="Ngày sinh" value={profile.birthDate} />
                  <HangThongTin label="Giới tính" value={profile.gender} />
                  <HangThongTin label="Email" value={profile.email || '--'} />
                  <HangThongTin label="Địa chỉ" value={[profile.address, profile.ward, profile.district, profile.province].filter(Boolean).join(', ') || '--'} />
                  <HangThongTin label="Tỉnh / Thành phố" value={profile.province || '--'} />
                  <HangThongTin label="Phường/Xã/Khu vực" value={profile.district || '--'} />
                  <HangThongTin label="Tổ/Ấp/Đơn vị chi tiết" value={profile.ward || '--'} />
                  <HangThongTin label="Mã BHYT" value={profile.insuranceCode || '--'} />
                  <HangThongTin label="Số CMND/CCCD" value={profile.citizenId || '--'} />
                  <HangThongTin label="Dân tộc" value={profile.ethnicity} />
                  <HangThongTin label="Quốc tịch" value={profile.nationality || 'Việt Nam'} />
                  <HangThongTin label="Nghề nghiệp" value={profile.job || '--'} />
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
                <HangThongTin label="Quốc tịch" value={profile.nationality || 'Việt Nam'} />
                <button type="button" onClick={() => { changeTab('ho_so'); openEditProfile(); }}>Thay đổi thông tin</button>
              </div>
              <form className="profile-detail-card" onSubmit={submitPasswordChange}>
                <h3>Thay đổi mật khẩu</h3>
                <label>
                  Mật khẩu hiện tại
                  <input
                    name="currentPassword"
                    type="password"
                    value={passwordDraft.currentPassword}
                    placeholder="Mật khẩu hiện tại của bạn"
                    onChange={updatePasswordDraft}
                  />
                </label>
                <label>
                  Mật khẩu mới
                  <input
                    name="newPassword"
                    type="password"
                    value={passwordDraft.newPassword}
                    placeholder="Nhập mật khẩu mới"
                    onChange={updatePasswordDraft}
                  />
                </label>
                {passwordMessage && <p className="profile-form-error">{passwordMessage}</p>}
                <button type="submit" disabled={isPasswordSaving}>
                  {isPasswordSaving ? 'Đang đổi...' : 'Thay đổi'}
                </button>
              </form>
            </div>
          </>
        )}
        </main>
      </section>

      {isLogoutConfirmOpen && (
        <div className="doctor-modal-backdrop">
          <article className="logout-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title">
            <header>
              <h2 id="logout-confirm-title">Thông báo</h2>
            </header>
            <section>
              <p>Bạn muốn đăng xuất khỏi tài khoản MidHealth?</p>
            </section>
            <footer>
              <button type="button" disabled={isLoggingOut} onClick={() => setIsLogoutConfirmOpen(false)}>Không</button>
              <button type="button" disabled={isLoggingOut} onClick={confirmLogout}>
                {isLoggingOut ? 'Đang đăng xuất...' : 'Có'}
              </button>
            </footer>
          </article>
        </div>
      )}
    </>
  );
}

export { PhieuKhamChiTiet, co_gia_tri, tao_dong_phieu_kham };
export default TrangPhieuKhamDienTu;
