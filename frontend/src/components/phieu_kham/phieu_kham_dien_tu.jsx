import { useEffect, useMemo, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import {
  chuan_hoa_bhyt,
  chuan_hoa_cmnd_cccd,
  chuan_hoa_so_dien_thoai,
  kiem_tra_bhyt,
  kiem_tra_ngay_sinh,
} from '../../lib/patient_profile';
import { cancelAppointment, createPayPalOrder, listAppointments, listPatientProfiles, listDoctorSlots, rescheduleAppointment, savePatientProfile } from '../../lib/appointments';
import { buildNotifications, markNotificationsRead } from '../../lib/notifications';
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
    medicalHistory: patientProfile.medicalHistory || patientProfile.medical_history || '',
    bloodGroup: patientProfile.bloodGroup || patientProfile.blood_group || '',
    allergies: patientProfile.allergies || '',
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
    medicalHistory: profile.medical_history || profile.medicalHistory || '',
    bloodGroup: profile.blood_group || profile.bloodGroup || '',
    allergies: profile.allergies || '',
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
    medicalHistory: '', bloodGroup: '', allergies: '',
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

function chuyen_ngay_loc(dateValue) {
  if (!dateValue) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
  const match = String(dateValue).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}



const FILTER_DEFAULT = {
  fromDate: '',
  toDate: '',
  status: 'all',
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
      { label: 'Nơi khám', value: appointment.hospitalName },
      { label: 'Điện thoại phòng khám', value: appointment.clinicPhone },
      { label: 'Ngày khám', value: appointment.dateDisplay },
      { label: 'Giờ khám', value: appointment.time ? `${appointment.time} (GMT+7)` : '', highlight: true },
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
      { label: 'Nhóm máu', value: lay_gia_tri_ho_so(patientProfile, appointment, ['bloodGroup']) || 'Chưa ghi nhận' },
      { label: 'Tiền sử bệnh', value: lay_gia_tri_ho_so(patientProfile, appointment, ['medicalHistory']) || 'Chưa ghi nhận' },
      { label: 'Dị ứng', value: lay_gia_tri_ho_so(patientProfile, appointment, ['allergies']) || 'Chưa ghi nhận' },
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
          <p className={['Đã hủy', 'Không đến khám'].includes(appointment.status) ? 'danger-text' : 'green-text'}>{appointment.status || 'Đã đặt lịch'}</p>
          <h3>{doctorName}</h3>
          <span>{appointment.address}</span>
        </div>
      </div>

      <section>
        <h4>Thông tin đặt khám</h4>
        <HienThiDongPhieu rows={bookingRows} />
        {appointment.status === 'Đã đặt lịch' && <p>Vui lòng đến trước giờ hẹn khoảng 15 phút. Nếu dự kiến trễ, hãy liên hệ phòng khám; sau 15 phút kể từ giờ hẹn cộng thời gian bác sĩ trễ đã thông báo, phòng khám có thể ghi nhận không đến nếu bạn chưa check-in.</p>}
      </section>

      <section>
        <h4>Thông tin bệnh nhân</h4>
        <HienThiDongPhieu rows={patientRows} />
      </section>

      {appointment.checkedInAt && <p className="green-text">Đã đối chiếu họ tên và ngày sinh tại quầy tiếp nhận.</p>}
      {appointment.rescheduledAt && appointment.status === 'Đã đặt lịch' && <p>Lịch khám đã được phòng khám chuyển sang bác sĩ hoặc khung giờ đang hiển thị. Nếu bạn không đồng ý, vui lòng liên hệ phòng khám.</p>}
      {appointment.clinicianAbsent && <p className="danger-text">Bác sĩ vắng mặt. Vui lòng liên hệ phòng khám để đổi lịch hoặc hủy và xử lý thanh toán.</p>}
      {appointment.clinicianAbsent && appointment.clinicPhone && <a href={`tel:${String(appointment.clinicPhone).replace(/[^+\d]/g, '')}`}>Gọi phòng khám: {appointment.clinicPhone}</a>}
      {appointment.delayMinutes > 0 && <p>Giờ khám dự kiến trễ khoảng {appointment.delayMinutes} phút. {appointment.delayNote}</p>}
      {appointment.status === 'Không đến khám' && <p>Nếu bạn đã đến phòng khám, vui lòng liên hệ quầy tiếp nhận để kiểm tra lại trạng thái.</p>}
      {appointment.status === 'Đã hủy' && appointment.paymentStatus === 'paid' && <p className="danger-text">Lịch đã hủy nhưng khoản thanh toán vẫn được ghi nhận. Vui lòng liên hệ phòng khám để được xử lý hoàn tiền.</p>}

      <section>
        <h4>Kết quả</h4>
        {appointment.visitResult ? <HienThiDongPhieu rows={[
          ['Bác sĩ', appointment.visitResult.clinicianName],
          ['Tóm tắt lần khám', appointment.visitResult.summary],
          ['Kết luận', appointment.visitResult.diagnosis],
          ['Điều trị và chăm sóc', appointment.visitResult.carePlan],
          ['Tái khám và lưu ý', appointment.visitResult.followUp],
        ].filter(([, value]) => value)} /> : appointment.specialtyResults?.length
          ? <div className="empty-result"><span>▤</span><small>Đã có kết quả chuyên khoa bên dưới. Kết luận chung sẽ hiển thị sau khi bác sĩ hoàn tất hồ sơ.</small></div>
          : <div className="empty-result"><span>▤</span><small>Chưa có kết quả khám. Phiếu này chỉ xác nhận lịch hẹn.</small></div>}
      </section>
      {appointment.specialtyResults?.length > 0 && <section className="patient-specialty-results">
        <h4>Kết quả khám chuyên khoa</h4>
        <p>Các kết quả đã được bác sĩ lưu cho lịch khám này.</p>
        {appointment.specialtyResults.map((result, index) => <article className="patient-specialty-result" key={`${appointment.id}-${result.stage}-${index}`}>
          <div className="patient-specialty-result-heading"><strong>{result.specialtyName || `Lượt chuyên khoa ${index + 1}`}</strong><span>{result.resultAuthor || result.doctorName || 'Bác sĩ điều trị'}</span></div>
          {(result.resultUpdatedAt || result.completedAt) && <small>Cập nhật {new Date(result.resultUpdatedAt || result.completedAt).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })}</small>}
          {result.result ? <HienThiDongPhieu rows={[
            ['Lý do khám', result.result.chiefComplaint], ['Triệu chứng và diễn biến', result.result.symptoms], ['Tiền sử liên quan', result.result.history],
            ['Huyết áp', result.result.bloodPressure], ['Mạch', result.result.pulse], ['Nhiệt độ', result.result.temperature], ['SpO₂', result.result.oxygenSaturation],
            ['Khám thực thể', result.result.examination], ['Chẩn đoán chuyên khoa', result.result.diagnosis], ['Nhận định', result.result.assessment],
            ['Kế hoạch xử trí', result.result.carePlan], ['Tư vấn và hướng dẫn', result.result.patientInstructions], ['Tái khám / dấu hiệu cần lưu ý', result.result.followUp],
          ].filter(([, value]) => value)} /> : <>{result.symptoms && <p><strong>Triệu chứng và diễn biến:</strong> {result.symptoms}</p>}{result.diagnosis && <p><strong>Chẩn đoán chuyên khoa:</strong> {result.diagnosis}</p>}</>}
          {(result.resultHistory?.length || 0) > 1 && <details><summary>Lịch sử chỉnh sửa ({result.resultHistory.length - 1})</summary>{result.resultHistory.slice(0, -1).map((revision, revisionIndex) => <article key={`${revision.updatedAt}-${revisionIndex}`}><p><strong>{revision.authorName}</strong> · {revision.updatedAt && new Date(revision.updatedAt).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })} — bản trước đã được thay thế bằng bản cập nhật mới hơn.</p><HienThiDongPhieu rows={[
            ['Lý do khám', revision.details.chiefComplaint], ['Triệu chứng', revision.details.symptoms], ['Tiền sử liên quan', revision.details.history], ['Khám thực thể', revision.details.examination],
            ['Chẩn đoán', revision.details.diagnosis], ['Nhận định', revision.details.assessment], ['Kế hoạch xử trí', revision.details.carePlan], ['Tư vấn', revision.details.patientInstructions], ['Tái khám', revision.details.followUp],
          ].filter(([, value]) => value)} /></article>)}</details>}
        </article>)}
      </section>}
      {appointment.healthProfileUpdates?.length > 0 && <section className="patient-specialty-results">
        <h4>Cập nhật hồ sơ sức khỏe</h4>
        <p>Thông tin được bác sĩ ghi nhận sau khi trao đổi hoặc đối chiếu trong lần khám này.</p>
        {appointment.healthProfileUpdates.map((update, index) => <article className="patient-specialty-result" key={`${appointment.id}-health-${index}`}>
          <div className="patient-specialty-result-heading"><strong>{update.authorName}</strong><span>{update.createdAt && new Date(update.createdAt).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
          <p>{update.content}</p>
        </article>)}
      </section>}
      {appointment.visitResult && <section><h4>Đơn thuốc</h4>{appointment.prescription?.length
        ? <ul>{appointment.prescription.map((item, index) => <li key={`${item.medicineName}-${index}`}><strong>{item.medicineName}</strong>: {item.dosage}, {item.frequency}, {item.duration}; số lượng {item.quantity}.</li>)}</ul>
        : <p>Bác sĩ không kê thuốc trong lần khám này.</p>}</section>}
    </article>
  );
}

function TrangPhieuKhamDienTu({ appointment, user, initialTab = 'lich_kham', onTabChange, onLogout }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedAppointment, setSelectedAppointment] = useState(appointment);
  const [appointments, setAppointments] = useState(() => [appointment].filter(Boolean));
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [appointmentReload, setAppointmentReload] = useState(0);
  const [paymentProvider, setPaymentProvider] = useState('');
  const [paymentError, setPaymentError] = useState('');
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
  const [cancelConfirmAppointment, setCancelConfirmAppointment] = useState(null);
  const [isCancellingAppointment, setIsCancellingAppointment] = useState(false);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [rescheduleSlotId, setRescheduleSlotId] = useState('');
  const [rescheduleError, setRescheduleError] = useState('');
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [selectedNotificationId, setSelectedNotificationId] = useState('');

  const profile = profiles.find((item) => item.id === selectedProfileId) || profiles[0];
  const selectedProvince = useMemo(
    () => addressData.find((item) => item.name === profileDraft.province || item.aliases?.includes(profileDraft.province)),
    [addressData, profileDraft.province],
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
    return true;
  }), [appointments, filters, searchTerm]);
  const visiblePayments = useMemo(() => appointments
    .map((item) => ({
      ...item,
      paymentCode: item.paymentCode || item.transactionCode || item.appointmentCode || item.ticket,
      paymentAmount: item.finalAmount ?? item.paymentAmount ?? item.amount ?? item.price ?? item.fee,
      paymentStatus: ({ paid: 'Đã thanh toán', unpaid: 'Chưa thanh toán', refunded: 'Đã hoàn tiền', pending: 'Đang xử lý', failed: 'Thất bại' })[item.paymentStatus || item.payment_status] || item.paymentStatus || item.payment_status || (item.isPaid ? 'Đã thanh toán' : ''),
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
  const activeAppointment = visibleAppointments.find(item => item.id === selectedAppointment?.id) || visibleAppointments[0] || null;
  const canChangeAppointment = activeAppointment?.id && ['Đã đặt lịch', 'Chờ thanh toán cọc'].includes(activeAppointment.status) && !appointmentsLoading && !appointmentError;
  const canPayAppointment = canChangeAppointment && ['unpaid', 'pending', 'failed'].includes(activeAppointment.paymentStatus) && Number(activeAppointment.depositAmount) > 0;
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
    setAppointments([appointment].filter(Boolean));
    setSelectedAppointment(appointment || null);
  }, [appointment, user]);

  useEffect(() => {
    const items = buildNotifications(appointments, user);
    setNotifications(items);
    setSelectedNotificationId(current => items.some(item => item.id === current) ? current : items[0]?.id || '');
  }, [user, appointments]);

  const changeTab = (nextTab) => {
    setActiveTab(nextTab);
    onTabChange?.(nextTab);
  };

  useEffect(() => {
    let isMounted = true;
    setAppointmentError('');
    setAppointmentsLoading(true);
    if (!user) return () => {
      isMounted = false;
    };

    listAppointments(user)
      .then((items) => {
        if (!isMounted) return;
        setAppointments(items);
      })
      .catch((error) => {
        if (isMounted) setAppointmentError(error.message || 'Không thể tải danh sách lịch hẹn.');
      })
      .finally(() => { if (isMounted) setAppointmentsLoading(false); });

    return () => {
      isMounted = false;
    };
  }, [appointment, user, appointmentReload]);

  useEffect(() => {
    const defaultProfile = tao_ho_so_mac_dinh(appointment, user);
    setProfiles([defaultProfile]);
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
      .catch(error => { if (isMounted) setProfileError(error.message || 'Không thể tải hồ sơ bệnh nhân.'); });

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
    const targetAppointment = activeAppointment;
    if (!targetAppointment) return;
    setCancelConfirmAppointment(targetAppointment);
  };

  const confirmCancelAppointment = async () => {
    const targetAppointment = cancelConfirmAppointment;
    if (!targetAppointment) return;
    setIsCancellingAppointment(true);
    try {
      if (!targetAppointment.id || !user) throw new Error('Vui lòng đăng nhập và tải lại lịch khám trước khi hủy.');
      await cancelAppointment(user, targetAppointment.id);
      setSelectedAppointment((current) => current?.id === targetAppointment.id ? { ...current, status: 'Đã hủy' } : current);
      setAppointments((current) => {
        const nextAppointments = current.map((item) => (
          (item.id || item.appointmentCode) === (targetAppointment.id || targetAppointment.appointmentCode)
            ? { ...item, status: 'Đã hủy' }
            : item
        ));
        return nextAppointments;
      });
      setCancelConfirmAppointment(null);
    } catch (error) {
      setAppointmentError(error.message || 'Không thể hủy lịch khám. Vui lòng thử lại.');
    } finally {
      setIsCancellingAppointment(false);
    }
  };

  const openReschedule = async () => {
    if (!activeAppointment?.doctorId || !activeAppointment.id) { setAppointmentError('Không đủ thông tin để tải lịch đổi. Vui lòng làm mới danh sách lịch khám.'); return; }
    setIsRescheduleOpen(true); setRescheduleError(''); setRescheduleSlotId(''); setRescheduleLoading(true);
    try {
      const now = new Date();
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).map(part => [part.type, part.value]));
      const fromDate = `${parts.year}-${parts.month}-${parts.day}`;
      const slots = await listDoctorSlots(activeAppointment.doctorId, { fromDate, days: 14 });
      const available = (slots || []).filter(slot => slot.status !== 'full' && slot.id !== activeAppointment.appointmentSlotId);
      setRescheduleSlots(available);
      if (!available.length) setRescheduleError('Bác sĩ chưa có khung giờ trống khác trong 14 ngày tới. Vui lòng liên hệ phòng khám.');
    } catch (error) { setRescheduleError(error.message || 'Không tải được lịch trống.'); }
    finally { setRescheduleLoading(false); }
  };

  const confirmReschedule = async () => {
    if (!activeAppointment?.id || !rescheduleSlotId || isRescheduling) return;
    setIsRescheduling(true); setRescheduleError('');
    try {
      await rescheduleAppointment(user, activeAppointment.id, rescheduleSlotId);
      setIsRescheduleOpen(false); setRescheduleSlots([]); setRescheduleSlotId(''); setAppointmentReload(value => value + 1);
    } catch (error) { setRescheduleError(error.message || 'Không đổi được lịch. Vui lòng tải lại lịch trống.'); }
    finally { setIsRescheduling(false); }
  };

  const startPayment = async () => {
    if (!canPayAppointment || paymentProvider) return;
    setPaymentProvider('paypal');
    setPaymentError('');
    try {
      const result = await createPayPalOrder(user, activeAppointment.id);
      if (result.status === 'paid') { setAppointmentReload(current => current + 1); return; }
      const redirect = new URL(result.approvalUrl);
      const allowedDomain = 'paypal.com';
      if (redirect.protocol !== 'https:' || !(redirect.hostname === allowedDomain || redirect.hostname.endsWith(`.${allowedDomain}`))) {
        throw new Error('Cổng thanh toán chưa trả về đường dẫn hợp lệ. Vui lòng thử lại sau.');
      }
      window.location.assign(redirect.href);
    } catch (error) {
      setPaymentError(error.message || 'Chưa thể mở cổng thanh toán.');
    } finally {
      setPaymentProvider('');
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
      if (!user) throw new Error('Vui lòng đăng nhập để lưu hồ sơ bệnh nhân.');
      savedProfile = await savePatientProfile(user, profileDraft);
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
    setSelectedProfileId(normalizedSavedProfile.id);
    setAppointmentReload(current => current + 1);
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

        <div className="account-content">
        {appointmentError && <p className="appointment-load-error" role="alert">{appointmentError} <button type="button" disabled={appointmentsLoading} onClick={() => setAppointmentReload(current => current + 1)}>Thử lại</button></p>}
        {profileError && !isEditingProfile && !isAddingProfile && <p className="profile-form-error" role="alert">{profileError}</p>}
        {activeTab === 'lich_kham' && (
          <>
            <div className="account-title-row">
              <h2>Lịch khám</h2>
              <button type="button" disabled={appointmentsLoading} onClick={() => setAppointmentReload(current => current + 1)}>{appointmentsLoading ? 'Đang tải...' : 'Làm mới'}</button>
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
                    <option value="Không đến khám">Không đến khám</option>
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
                {appointmentsLoading && <p role="status">Đang tải lịch khám...</p>}
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
                  !appointmentsLoading && !appointmentError && <div className="empty-payment"><span>▤</span><p>Không có lịch khám phù hợp</p></div>
                )}
              </div>
              <div>
                {activeAppointment && <PhieuKhamChiTiet appointment={activeAppointment} compact />}
                {activeAppointment && <p>Chi phí khám: <strong>{Number(activeAppointment.finalAmount || 0).toLocaleString('vi-VN')} ₫</strong> · Cọc: <strong>{Number(activeAppointment.depositAmount || 0).toLocaleString('vi-VN')} ₫</strong> · {({ paid: 'Đã thanh toán cọc', unpaid: 'Chưa thanh toán cọc', pending: 'Đang đối soát PayPal', failed: 'Chưa hoàn tất', refunded: 'Đã hoàn tiền' })[activeAppointment.paymentStatus] || 'Chưa có thông tin thanh toán'}</p>}
                {canPayAppointment && <div className="clinic-actions"><button className="clinic-primary" type="button" disabled={Boolean(paymentProvider)} onClick={startPayment}>{paymentProvider ? 'Đang mở PayPal…' : 'Thanh toán PayPal'}</button></div>}
                {paymentError && <p className="appointment-load-error" role="alert">{paymentError}</p>}
                {canChangeAppointment && activeAppointment.paymentStatus !== 'pending' && <button className="clinic-secondary" type="button" disabled={Boolean(paymentProvider) || isRescheduling} onClick={openReschedule}>Đổi giờ khám</button>}
                {canChangeAppointment && ['unpaid', 'failed'].includes(activeAppointment.paymentStatus) && (
                  <button className="cancel-appointment" type="button" disabled={Boolean(paymentProvider) || isCancellingAppointment} onClick={handleCancel}>Hủy lịch</button>
                )}
                {canChangeAppointment && activeAppointment.paymentStatus === 'pending' && <p>Thanh toán đang được đối soát. Vui lòng liên hệ phòng khám nếu bạn cần hủy lịch.</p>}
                {canChangeAppointment && ['paid', 'refunded'].includes(activeAppointment.paymentStatus) && <p>Lịch đã có giao dịch thanh toán. Vui lòng liên hệ phòng khám để được hỗ trợ hủy lịch và xử lý khoản đã thanh toán.</p>}
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
                <b>{item.paymentAmount != null ? `${Number(item.paymentAmount).toLocaleString('vi-VN')}đ` : '--'}</b>
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
                      <p className="notification-detail-compact">{activeNotification.summary || activeNotification.message}</p>
                      {activeNotification.patientName ? <p className="notification-detail-patient">{activeNotification.patientName}</p> : null}
                    </div>
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
                    <ONhapHoSo label="Tổ/Ấp/Đơn vị chi tiết" name="ward" value={profileDraft.ward} placeholder="Tổ, ấp hoặc khu vực (không bắt buộc)" onChange={updateProfileDraft} />
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
                  <OChonHoSo label="Nhóm máu" name="bloodGroup" value={profileDraft.bloodGroup || ''} placeholder="Chưa xác định" onChange={updateProfileDraft}>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(group => <option key={group}>{group}</option>)}</OChonHoSo>
                  <ONhapHoSo label="Tiền sử bệnh" name="medicalHistory" value={profileDraft.medicalHistory || ''} placeholder="Bệnh đã mắc hoặc đang điều trị" onChange={updateProfileDraft} />
                  <ONhapHoSo label="Dị ứng" name="allergies" value={profileDraft.allergies || ''} placeholder="Thuốc, thức ăn hoặc chất gây dị ứng" onChange={updateProfileDraft} />
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
        </div>
      </section>

      {isLogoutConfirmOpen && (
        <div className="app-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isLoggingOut) setIsLogoutConfirmOpen(false); }}>
          <article className="app-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title">
            <header>
              <span>MidHealth</span>
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
      {cancelConfirmAppointment && (
        <div className="app-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isCancellingAppointment) setCancelConfirmAppointment(null); }}>
          <article className="app-confirm-modal danger" role="dialog" aria-modal="true" aria-labelledby="cancel-appointment-title">
            <header>
              <span>Cần xác nhận</span>
              <h2 id="cancel-appointment-title">Hủy lịch khám</h2>
            </header>
            <section>
              <p>Lịch chưa thanh toán sẽ được hủy và khung giờ được trả lại. Bạn có chắc muốn tiếp tục?</p>
              <small>{cancelConfirmAppointment.appointmentCode || cancelConfirmAppointment.doctorName || cancelConfirmAppointment.hospitalName || ''}</small>
            </section>
            <footer>
              <button type="button" disabled={isCancellingAppointment} onClick={() => setCancelConfirmAppointment(null)}>Không hủy</button>
              <button type="button" className="confirm danger" disabled={isCancellingAppointment} onClick={confirmCancelAppointment}>
                {isCancellingAppointment ? 'Đang hủy...' : 'Hủy lịch'}
              </button>
            </footer>
          </article>
        </div>
      )}
      {isRescheduleOpen && <div className="app-confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !isRescheduling) setIsRescheduleOpen(false); }}>
        <article className="app-confirm-modal appointment-reschedule-modal" role="dialog" aria-modal="true" aria-labelledby="reschedule-appointment-title">
          <header><span>Đổi lịch hẹn</span><h2 id="reschedule-appointment-title">Chọn giờ khám mới</h2></header>
          <section>
            <p>Chọn một khung giờ còn trống với cùng bác sĩ. Lịch cũ chỉ được thay sau khi hệ thống xác nhận giữ được khung giờ mới.</p>
            {rescheduleLoading && <p role="status">Đang tải lịch trống…</p>}
            {!rescheduleLoading && rescheduleSlots.length > 0 && <label className="reschedule-slot-field">Khung giờ mới<select value={rescheduleSlotId} onChange={event => setRescheduleSlotId(event.target.value)}><option value="">Chọn ngày và giờ</option>{rescheduleSlots.map(slot => <option value={slot.id} key={slot.id}>{slot.date.split('-').reverse().join('/')} · {slot.label}</option>)}</select></label>}
            {rescheduleError && <p className="appointment-load-error" role="alert">{rescheduleError}</p>}
          </section>
          <footer><button type="button" disabled={isRescheduling} onClick={() => setIsRescheduleOpen(false)}>Giữ lịch hiện tại</button><button className="confirm" type="button" disabled={isRescheduling || rescheduleLoading || !rescheduleSlotId} onClick={confirmReschedule}>{isRescheduling ? 'Đang đổi lịch…' : 'Xác nhận đổi giờ'}</button></footer>
        </article>
      </div>}
    </>
  );
}

export { PhieuKhamChiTiet, co_gia_tri, tao_dong_phieu_kham };
export default TrangPhieuKhamDienTu;
