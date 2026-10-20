import { useEffect, useState } from 'react';
import { apiBaseUrl } from '../../lib/api_base';
import './staff_workspace.css';

const clinicToday = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export default function StaffWorkspace({ user, onLogout }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [checkInMessage, setCheckInMessage] = useState('');
  const [searchedCode, setSearchedCode] = useState('');
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [createdAppointment, setCreatedAppointment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [patientQuery, setPatientQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [patientSearchDone, setPatientSearchDone] = useState(false);
  const [patientSearchError, setPatientSearchError] = useState('');
  const [patientId, setPatientId] = useState('');
  const [patientDraft, setPatientDraft] = useState({ id: '', fullName: '', email: '', phone: '', birthDate: '', gender: 'other', healthInsuranceNumber: '', medicalHistory: '', bloodGroup: '', allergies: '' });
  const [date, setDate] = useState(clinicToday);
  const [slots, setSlots] = useState([]);
  const [slotId, setSlotId] = useState('');
  const [reason, setReason] = useState('');
  const [cashReceived, setCashReceived] = useState(false);
  const selectedSlot = slots.find(slot => slot.id === slotId);
  const needsDeposit = Number(selectedSlot?.deposit_amount || 0) > 0;

  async function request(path, options = {}) {
    const send = async token => {
      const response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      let body = {};
      try { body = await response.json(); } catch { /* The API may return an empty error response. */ }
      return { response, body };
    };
    let token = await user.getIdToken();
    let { response, body } = await send(token);
    if (response.status === 401) {
      try { token = await user.getIdToken(true); }
      catch { throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng xuất rồi đăng nhập lại.'); }
      ({ response, body } = await send(token));
    }
    if (!response.ok) {
      const messages = {
        'Deposit must be paid before check-in': 'Chưa thể tiếp nhận: tiền cọc chưa được xác nhận đã thanh toán. Vui lòng đối soát thanh toán trước.',
        'Check-in is only available on appointment day': 'Không thể tiếp nhận lịch này hôm nay vì ngày khám đã hẹn không phải hôm nay. Vui lòng xử lý đổi lịch theo quy trình phòng khám.',
        'Appointment is not open for check-in': 'Lịch chưa ở trạng thái được phép tiếp nhận hoặc bác sĩ đang báo vắng. Hãy kiểm tra trạng thái lịch.',
        'Patient identity does not match': 'Họ tên hoặc ngày sinh không khớp hồ sơ đặt lịch. Hãy kiểm tra lại giấy tờ và thông tin hồ sơ.',
      };
      throw new Error(messages[body.message] || body.message || 'Không thể xử lý yêu cầu.');
    }
    return body.data;
  }

  async function load(searchCode = '') {
    setBusy(true);
    setCheckInMessage('');
    try {
      const query = searchCode ? `?code=${encodeURIComponent(searchCode.trim())}` : '';
      const appointments = await request(`/api/staff/appointments${query}`);
      setRows(appointments);
      setSearchedCode(searchCode.trim().toUpperCase());
      setMessage(searchCode
        ? appointments.length
          ? 'Đã tìm thấy lịch. Hãy đối chiếu giấy tờ rồi nhập họ tên và ngày sinh của người bệnh bên dưới.'
          : 'Không tìm thấy lịch theo mã này. Kiểm tra lại mã trên phiếu khám.'
        : '');
    } catch (error) { setSearchedCode(''); setRows([]); setMessage(error.message); }
    finally { setBusy(false); }
  }

  useEffect(() => { load(); }, [user]);

  async function checkIn(event) {
    event.preventDefault();
    setBusy(true);
    setCheckInMessage('');
    try {
      await request('/api/staff/check-in', { method: 'POST', body: JSON.stringify({ code, patientName: name, birthDate }) });
      await load(code);
      setMessage('');
      setCheckInMessage('Đã check-in thành công. Bệnh nhân đã được ghi nhận đến khám và có thể chờ gọi vào khám.');
    } catch (error) { setCheckInMessage(error.message); }
    finally { setBusy(false); }
  }

  async function findPatients(event) {
    event.preventDefault();
    setBusy(true);
    setPatientSearchDone(false);
    setPatientSearchError('');
    try {
      const results = await request(`/api/staff/patients?query=${encodeURIComponent(patientQuery)}`);
      setPatients(results);
      setPatientSearchDone(true);
      setMessage('');
    } catch (error) {
      setPatients([]);
      setPatientSearchError(error.message);
      setMessage('');
    } finally { setBusy(false); }
  }

  function openPatientProfile(patient) {
    setPatientId(patient.id);
    setPatientDraft({ id: patient.id, fullName: patient.full_name, email: patient.email || '', phone: patient.phone || '', healthInsuranceNumber: patient.health_insurance_number || '',
      birthDate: patient.date_of_birth || '', gender: patient.gender || 'other', medicalHistory: patient.medical_history || '',
      bloodGroup: patient.blood_group || '', allergies: patient.allergies || '' });
    document.getElementById('staff-patient-editor')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function saveCounterPatient(event) {
    event.preventDefault(); setBusy(true);
    try {
      const result = await request(patientDraft.id ? `/api/staff/patients/${patientDraft.id}` : '/api/staff/patients', {
        method: patientDraft.id ? 'PATCH' : 'POST', body: JSON.stringify(patientDraft),
      });
      const id = result.patientId || result.id;
      setPatientId(id);
      setPatients(current => [{ id, full_name: patientDraft.fullName, date_of_birth: patientDraft.birthDate, phone: patientDraft.phone,
        gender: patientDraft.gender, email: patientDraft.email, medical_history: patientDraft.medicalHistory,
        health_insurance_number: patientDraft.healthInsuranceNumber, blood_group: patientDraft.bloodGroup, allergies: patientDraft.allergies }, ...current.filter(patient => patient.id !== id)]);
      setMessage(patientDraft.id ? 'Đã cập nhật hồ sơ người bệnh.' : 'Đã tạo hồ sơ người bệnh, chưa tạo tài khoản đăng nhập. Tiếp tục chọn khung giờ để lập lượt khám.');
      setPatientDraft({ id: '', fullName: '', email: '', phone: '', birthDate: '', gender: 'other', healthInsuranceNumber: '', medicalHistory: '', bloodGroup: '', allergies: '' });
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function loadSlots() {
    setBusy(true);
    try { setSlots(await request(`/api/staff/slots?date=${encodeURIComponent(date)}`)); setMessage(''); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function bookAtCounter(event) {
    event.preventDefault(); setBusy(true);
    try {
      const result = await request('/api/staff/bookings', { method: 'POST', body: JSON.stringify({ patientId, slotId, reason, cashDepositReceived: cashReceived }) });
      const patient = patients.find(item => item.id === patientId);
      setCreatedAppointment({ code: result.appointment_code, name: patient?.full_name || '', email: patient?.email || '',
        date, time: selectedSlot ? `${selectedSlot.start_time.slice(0, 5)}–${selectedSlot.end_time.slice(0, 5)}` : '',
        doctor: selectedSlot?.doctors?.full_name || '' });
      setCode(result.appointment_code);
      setName(patient?.full_name || '');
      setBirthDate(patient?.date_of_birth || '');
      setCashReceived(false); setSlotId('');
      await load(result.appointment_code);
      await loadSlots();
      document.getElementById('staff-checkin-heading')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMessage(`${needsDeposit ? 'Đã tạo lịch và ghi nhận tiền cọc tại quầy.' : 'Đã tạo lịch khám miễn phí.'} Mã hẹn: ${result.appointment_code}. Hãy đối chiếu họ tên và ngày sinh trên giấy tờ rồi xác nhận check-in nếu lịch khám là hôm nay; lịch ngày khác sẽ được tiếp nhận vào đúng ngày hẹn.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  const formatDate = value => value ? value.split('-').reverse().join('/') : '—';
  const paymentLabels = { paid: 'Đã thanh toán', pending: 'Đang đối soát', unpaid: 'Chưa thanh toán', failed: 'Thanh toán thất bại', refunded: 'Đã hoàn tiền' };
  const visitLabels = { pending: 'Chờ xác nhận', confirmed: 'Chờ đến khám', completed: 'Đã khám', cancelled: 'Đã hủy', no_show: 'Không đến khám' };
  const normalizedCode = code.trim().toUpperCase();
  const selectedAppointment = searchedCode && searchedCode === normalizedCode
    ? rows.find(row => row.code === searchedCode)
    : null;
  const checkInBlockers = [];
  if (normalizedCode && !selectedAppointment) checkInBlockers.push(searchedCode ? 'Không tìm thấy lịch theo mã này.' : 'Bấm “Tra cứu lịch” để tìm lịch trước.');
  if (selectedAppointment?.checked_in_at) checkInBlockers.push('Lịch này đã được tiếp nhận trước đó.');
  else if (selectedAppointment?.status === 'pending' && selectedAppointment.payment_status !== 'paid') {
    const deposit = Number(selectedAppointment.deposit_amount || 0);
    checkInBlockers.push(`Chưa thể check-in: lịch đang chờ thanh toán cọc${deposit > 0 ? ` ${deposit.toLocaleString('vi-VN')} ₫` : ''}. Người bệnh cần thanh toán trên tài khoản rồi tra cứu lại.`);
  } else if (selectedAppointment && selectedAppointment.status !== 'confirmed') checkInBlockers.push('Lịch chưa được xác nhận.');
  if (selectedAppointment && selectedAppointment.status === 'confirmed' && !selectedAppointment.checked_in_at) {
    if (selectedAppointment.clinician_absent) checkInBlockers.push('Bác sĩ đang được ghi nhận vắng mặt.');
    if (Number(selectedAppointment.final_amount || 0) > 0 && selectedAppointment.payment_status !== 'paid') checkInBlockers.push('Tiền cọc chưa được xác nhận đã thanh toán.');
    if (selectedAppointment.appointment_date !== clinicToday()) checkInBlockers.push(`Ngày khám là ${formatDate(selectedAppointment.appointment_date)}; chỉ tiếp nhận đúng ngày hẹn.`);
  }
  const canCheckIn = Boolean(selectedAppointment && checkInBlockers.length === 0);
  return <main className="staff-workspace">
    <header className="staff-workspace-header">
      <div className="staff-brand-lockup">
        <span className="staff-brand-mark" aria-hidden="true">MH</span>
        <div><strong>MidHealth</strong><span>Khu vực tiếp tân</span></div>
      </div>
      <div className="staff-header-main">
        <span className="staff-eyebrow">VẬN HÀNH PHÒNG KHÁM</span>
        <h1>Tiếp nhận bệnh nhân</h1>
        <p>Tra cứu lịch hẹn, xác minh người bệnh và hỗ trợ đăng ký tại quầy.</p>
      </div>
      <div className="staff-header-actions">
        {user?.displayName && <span className="staff-user-chip">{user.displayName}</span>}
        <button className="staff-logout-button" type="button" onClick={onLogout}>Đăng xuất</button>
      </div>
    </header>

    <div className="staff-workspace-content">
      {message && <p className="staff-feedback" role="status" aria-live="polite">{message}</p>}
      {createdAppointment && <aside className="staff-appointment-receipt" aria-live="polite">
        <div><strong>Mã hẹn đã tạo</strong><b>{createdAppointment.code}</b><span>{createdAppointment.name} · {formatDate(createdAppointment.date)} {createdAppointment.time}{createdAppointment.doctor ? ` · ${createdAppointment.doctor}` : ''}</span>
          <small>{createdAppointment.email ? `Thông tin lịch và mã hẹn sẽ được gửi tới ${createdAppointment.email} sau khi lịch được xác nhận, nếu dịch vụ email đang hoạt động.` : 'Người bệnh chưa cung cấp email: hãy ghi mã hẹn lên phiếu hoặc nhắn lại cho người bệnh trước khi kết thúc tiếp nhận.'}</small></div>
        <button className="staff-button staff-button-secondary" type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(createdAppointment.code); setMessage('Đã sao chép mã hẹn.'); }
          catch { setMessage('Không sao chép được mã tự động. Vui lòng ghi lại mã hẹn hiển thị bên cạnh.'); }
        }}>Sao chép mã</button>
      </aside>}
      <section className="staff-panel" aria-labelledby="staff-checkin-heading">
        <div className="staff-panel-heading">
          <div><span className="staff-step">01</span><div><h2 id="staff-checkin-heading">Tra cứu và tiếp nhận</h2><p>Đối chiếu mã hẹn, họ tên và ngày sinh trên giấy tờ trước khi check-in.</p></div></div>
        </div>
        <div className="staff-process-hint"><strong>Khách đã đặt lịch trên website?</strong><span>Nhập mã hẹn trên phiếu khám để tra cứu, rồi đối chiếu họ tên và ngày sinh trên giấy tờ trước khi xác nhận. Chỉ check-in được lịch đã xác nhận, đã thanh toán cọc (nếu có) và đúng ngày khám.</span></div>
        <form className="staff-search-form" onSubmit={event => { event.preventDefault(); load(code); }}>
          <label className="staff-search-field"><span>Mã lịch hẹn</span><input aria-label="Mã lịch hẹn" placeholder="Ví dụ: MHA261008-123" value={code} onChange={event => { setCode(event.target.value); setName(''); setBirthDate(''); setSearchedCode(''); setCheckInMessage(''); }} /></label>
          <button className="staff-button staff-button-primary" type="submit" disabled={busy}>Tra cứu lịch</button>
          <button className="staff-button staff-button-secondary" type="button" disabled={busy} onClick={() => { setCode(''); load(); }}>Xem gần đây</button>
        </form>
        <form className="staff-checkin-form" onSubmit={checkIn}>
          <label><span>Họ tên trên giấy tờ</span><input aria-label="Họ tên bệnh nhân" placeholder="Nhập đúng họ tên người bệnh" required value={name} onChange={event => setName(event.target.value)} /></label>
          <label><span>Ngày sinh trên giấy tờ</span><input aria-label="Ngày sinh trên giấy tờ của bệnh nhân" type="date" required value={birthDate} onChange={event => setBirthDate(event.target.value)} /></label>
          <button className="staff-button staff-button-primary" type="submit" disabled={busy || !canCheckIn}>Xác nhận check-in</button>
        </form>
        {normalizedCode && <p className={`staff-checkin-eligibility ${canCheckIn ? 'is-ready' : 'is-blocked'}`} role="status">{canCheckIn ? 'Lịch đủ điều kiện. Đối chiếu họ tên và ngày sinh trên giấy tờ rồi xác nhận.' : checkInBlockers.join(' ')}</p>}
        <p className="staff-checkin-caption">Ngày sinh dùng để xác minh người đến khám có khớp hồ sơ đặt lịch; nhập ngày sinh của bệnh nhân theo giấy tờ, không nhập ngày khám.</p>
        {checkInMessage && <p className={`staff-checkin-feedback ${checkInMessage.startsWith('Đã check-in') ? 'is-success' : 'is-error'}`} role={checkInMessage.startsWith('Đã check-in') ? 'status' : 'alert'} aria-live="polite">{checkInMessage}</p>}
        <div className="staff-list-heading"><div><h3>Lịch hẹn gần đây</h3><p>{busy ? 'Đang cập nhật danh sách…' : `${rows.length} lịch hẹn`}</p></div></div>
        <div className="staff-table-scroll">
          <table className="staff-appointments-table"><thead><tr><th>Mã hẹn</th><th>Người bệnh</th><th>Thời gian khám</th><th>Bác sĩ</th><th>Thanh toán</th><th>Tiếp nhận</th></tr></thead>
            <tbody>{rows.map(row => <tr key={row.id}>
              <td><span className="staff-appointment-code">{row.code}</span></td>
              <td><strong>{row.patient_name || 'Chưa có thông tin'}</strong></td>
              <td>{formatDate(row.appointment_date)} <span className="staff-muted">{row.appointment_time_text}</span></td>
              <td>{row.doctors?.full_name || 'Chưa phân công'}</td>
              <td><span className={`staff-status staff-payment-${row.payment_status || 'unknown'}`}>{paymentLabels[row.payment_status] || 'Chưa có thông tin'}</span></td>
              <td><span className={`staff-status ${row.checked_in_at ? 'staff-status-success' : row.status === 'confirmed' ? 'staff-status-info' : 'staff-status-neutral'}`}>{row.checked_in_at ? 'Đã tiếp nhận' : visitLabels[row.status] || row.status || 'Chưa rõ'}</span></td>
            </tr>)}</tbody>
          </table>
          {!busy && rows.length === 0 && <div className="staff-empty-state"><strong>Chưa có lịch hẹn để hiển thị</strong><span>Tra cứu bằng mã hẹn hoặc tải lại danh sách gần đây.</span></div>}
        </div>
      </section>

      <section className="staff-panel" aria-labelledby="staff-counter-heading">
        <div className="staff-panel-heading">
          <div><span className="staff-step">02</span><div><h2 id="staff-counter-heading">Đăng ký khám tại quầy</h2><p>Tìm hồ sơ trước; nếu chưa có thì tạo hồ sơ không cần tài khoản, chọn lịch còn chỗ, ghi nhận tiền cọc và xác nhận tiếp nhận đúng ngày khám.</p></div></div>
        </div>
        <div className="staff-subsection"><h3>Tìm hồ sơ người bệnh trước</h3><p className="staff-form-hint">Tìm bằng họ tên, số điện thoại hoặc email và xác minh ít nhất hai thông tin trước khi tạo hồ sơ mới để tránh trùng người bệnh.</p>
          <form className="staff-inline-form" onSubmit={findPatients}><label><span>Họ tên, số điện thoại hoặc email</span><input aria-label="Tìm bệnh nhân" placeholder="Nhập họ tên, số điện thoại hoặc email" required minLength={2} value={patientQuery} onChange={event => { setPatientQuery(event.target.value); setPatientSearchDone(false); setPatientSearchError(''); setPatients([]); }} /></label><button className="staff-button staff-button-secondary" type="submit" disabled={busy}>Tìm hồ sơ</button></form>
        </div>
        {patients.length > 0 && <div className="staff-patient-results" aria-label="Kết quả tìm hồ sơ người bệnh">{patients.map(patient => <article key={patient.id} className={`staff-patient-result ${patientId === patient.id ? 'is-selected' : ''}`}>
          <div><strong>{patient.full_name}</strong><span>Ngày sinh: {patient.date_of_birth || 'Chưa cập nhật'} · {patient.phone || 'Chưa có số điện thoại'}</span><span>{patient.email || 'Chưa có email'}</span></div>
          <button className="staff-button staff-button-secondary" type="button" onClick={() => openPatientProfile(patient)}>{patientId === patient.id ? 'Đang mở hồ sơ' : 'Mở hồ sơ'}</button>
        </article>)}</div>}
        {patientSearchError && <div className="staff-error-state" role="alert">{patientSearchError} <button className="staff-button staff-button-secondary" type="button" disabled={busy} onClick={() => findPatients({ preventDefault() {} })}>{'Th\u1eed t\u00ecm l\u1ea1i'}</button></div>}
        {patientSearchDone && patients.length === 0 && <div className="staff-empty-state"><strong>Không tìm thấy hồ sơ phù hợp</strong><span>Kiểm tra lại họ tên, số điện thoại hoặc email; nếu chưa có hồ sơ, tạo hồ sơ mới bên dưới.</span></div>}
        <div className="staff-subsection" id="staff-patient-editor"><h3>{patientDraft.id ? 'Cập nhật hồ sơ' : 'Tạo hồ sơ người bệnh'}</h3>{!patientDraft.id && <p className="staff-form-hint">Người bệnh đến trực tiếp không cần tạo tài khoản. Email là email liên hệ, không phải tài khoản đăng nhập. Nếu sau này người bệnh đăng ký website bằng email đã xác minh này, họ cần nhập trùng họ tên, ngày sinh và số điện thoại để hệ thống nối lịch sử quầy vào tài khoản; nếu không khớp, nhân viên cần xác minh thủ công.</p>}
          {!patientDraft.id && <p className="staff-form-hint">Có thể ghi nhận mã thẻ BHYT để nhân viên đối chiếu khi tiếp đón. Mã thẻ được lưu trong hồ sơ; website hiện chưa kết nối Cổng BHXH để xác minh giá trị thẻ, mức hưởng hoặc quyết toán BHYT.</p>}
          <form className="staff-form-grid" onSubmit={saveCounterPatient}>
            <label><span>Họ và tên</span><input aria-label="Họ tên hồ sơ" placeholder="Họ tên người bệnh" required minLength={2} value={patientDraft.fullName} onChange={event => setPatientDraft({ ...patientDraft, fullName: event.target.value })} /></label>
            <label><span>Email liên hệ (không bắt buộc)</span><input aria-label="Email liên hệ không bắt buộc" type="email" placeholder="Để trống nếu người bệnh không cung cấp" value={patientDraft.email} onChange={event => setPatientDraft({ ...patientDraft, email: event.target.value })} /></label>
            <label><span>Số điện thoại</span><input aria-label="Điện thoại hồ sơ" type="tel" placeholder="Số điện thoại" required value={patientDraft.phone} onChange={event => setPatientDraft({ ...patientDraft, phone: event.target.value })} /></label>
            <label><span>Mã thẻ BHYT (không bắt buộc)</span><input aria-label="Mã thẻ BHYT người bệnh" inputMode="text" autoComplete="off" maxLength={24} placeholder="Nhập mã trên thẻ nếu người bệnh cung cấp" value={patientDraft.healthInsuranceNumber} onChange={event => setPatientDraft({ ...patientDraft, healthInsuranceNumber: event.target.value })} /></label>
            <label><span>Ngày sinh</span><input aria-label="Ngày sinh hồ sơ" type="date" required value={patientDraft.birthDate} onChange={event => setPatientDraft({ ...patientDraft, birthDate: event.target.value })} /></label>
            <label><span>Giới tính</span><select aria-label="Giới tính hồ sơ" value={patientDraft.gender} onChange={event => setPatientDraft({ ...patientDraft, gender: event.target.value })}><option value="female">Nữ</option><option value="male">Nam</option><option value="other">Khác</option></select></label>
            <label><span>Nhóm máu (nếu biết)</span><select aria-label="Nhóm máu hồ sơ" value={patientDraft.bloodGroup} onChange={event => setPatientDraft({ ...patientDraft, bloodGroup: event.target.value })}><option value="">Chưa rõ</option>{['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(group => <option key={group}>{group}</option>)}</select></label>
            <label><span>Tiền sử bệnh (không bắt buộc)</span><input aria-label="Tiền sử bệnh hồ sơ" placeholder="Chỉ ghi thông tin người bệnh cung cấp" value={patientDraft.medicalHistory} onChange={event => setPatientDraft({ ...patientDraft, medicalHistory: event.target.value })} /></label>
            <label><span>Dị ứng (không bắt buộc)</span><input aria-label="Dị ứng hồ sơ" placeholder="Chỉ ghi thông tin người bệnh cung cấp" value={patientDraft.allergies} onChange={event => setPatientDraft({ ...patientDraft, allergies: event.target.value })} /></label>
            <div className="staff-form-actions"><button className="staff-button staff-button-primary" type="submit" disabled={busy || (!patientDraft.id && !patientSearchDone)}>{patientDraft.id ? 'Lưu hồ sơ' : 'Tạo hồ sơ người bệnh'}</button>{patientDraft.id && <button className="staff-button staff-button-secondary" type="button" onClick={() => setPatientDraft({ id: '', fullName: '', email: '', phone: '', birthDate: '', gender: 'other', healthInsuranceNumber: '', medicalHistory: '', bloodGroup: '', allergies: '' })}>Hủy chỉnh sửa</button>}</div>
          </form>
        </div>
        <div className="staff-subsection"><h3>Chọn lịch khám và xác nhận tại quầy</h3>
          <form className="staff-form-grid staff-booking-form" onSubmit={bookAtCounter}>
            <label className="staff-field-wide"><span>Hồ sơ người bệnh</span><select aria-label="Hồ sơ bệnh nhân" required value={patientId} onChange={event => { const id = event.target.value; setPatientId(id); const selected = patients.find(patient => patient.id === id); if (selected) setPatientDraft({ id, fullName: selected.full_name, email: selected.email || '', phone: selected.phone, birthDate: selected.date_of_birth, gender: selected.gender, healthInsuranceNumber: selected.health_insurance_number || '', medicalHistory: selected.medical_history || '', bloodGroup: selected.blood_group || '', allergies: selected.allergies || '' }); }}><option value="">Chọn hồ sơ đã tìm hoặc tạo</option>{patients.map(patient => <option key={patient.id} value={patient.id}>{patient.full_name} · {patient.date_of_birth} · {patient.phone}</option>)}</select></label>
            <label><span>Ngày khám</span><input aria-label="Ngày khám tại quầy" type="date" required min={clinicToday()} value={date} onChange={event => { setDate(event.target.value); setSlots([]); setSlotId(''); }} /></label>
            <div className="staff-field-button"><span aria-hidden="true">&nbsp;</span><button className="staff-button staff-button-secondary" type="button" disabled={busy} onClick={loadSlots}>Tải khung giờ</button></div>
            <label className="staff-field-wide"><span>Khung giờ còn chỗ</span><select aria-label="Khung giờ còn chỗ" required value={slotId} onChange={event => setSlotId(event.target.value)}><option value="">Chọn khung giờ</option>{slots.map(slot => <option key={slot.id} value={slot.id}>{slot.start_time.slice(0, 5)} · {slot.doctors?.full_name} · {slot.clinic_specialties?.name} · Cọc {Number(slot.deposit_amount || 0).toLocaleString('vi-VN')} ₫</option>)}</select></label>
            <label className="staff-field-wide"><span>Lý do khám (không bắt buộc)</span><input aria-label="Lý do khám không bắt buộc" placeholder="Không nhập thông tin nhạy cảm không cần thiết" maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} /></label>
            {needsDeposit && <label className="staff-cash-confirm"><input type="checkbox" required checked={cashReceived} onChange={event => setCashReceived(event.target.checked)} /> Đã nhận tiền cọc tại quầy</label>}
            <div className="staff-form-actions"><button className="staff-button staff-button-primary" type="submit" disabled={busy || !patientId || !slotId || (needsDeposit && !cashReceived)}>Tạo lịch khám</button></div>
          </form>
        </div>
      </section>
    </div>
  </main>;
}
