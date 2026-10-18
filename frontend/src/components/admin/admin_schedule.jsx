import { useEffect, useRef, useState } from 'react';
const blankSlot = { date: '', startTime: '08:00', endTime: '08:30', capacity: 1 };
const clinicToday = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
export default function AdminSchedule({ request }) {
  const [doctors, setDoctors] = useState([]), [doctorId, setDoctorId] = useState('');
  const [data, setData] = useState(null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(''), [slot, setSlot] = useState(blankSlot);
  const [leave, setLeave] = useState({ startDate: '', endDate: '', reason: '' });
  const generation = useRef(0);
  const base = '/api/admin/doctors/' + doctorId;
  const load = async () => {
    const result = await request(base + '/slots'); setData(result);
    setLeave({ startDate: result.doctor.unavailable_from || '', endDate: result.doctor.unavailable_to || '', reason: result.doctor.unavailable_note || '' });
  };
  useEffect(() => { let active = true; request('/api/admin/clinic/catalog').then(result => { if (active) setDoctors(result.doctors); }).catch(e => { if (active) setMessage(e.message); }); return () => { active = false; }; }, []);
  useEffect(() => {
    const version = ++generation.current; setData(null); setSlot(blankSlot); setMessage('');
    if (!doctorId) return;
    setLoading(true);
    request(base + '/slots').then(result => {
      if (version !== generation.current) return; setData(result);
      setLeave({ startDate: result.doctor.unavailable_from || '', endDate: result.doctor.unavailable_to || '', reason: result.doctor.unavailable_note || '' });
    }).catch(e => { if (version === generation.current) setMessage(e.message); }).finally(() => { if (version === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [doctorId]);
  const save = async (path, payload, method = 'PATCH') => {
    setBusy(true); setMessage('');
    try {
      await request(base + path, { method, body: JSON.stringify(payload) });
      setSlot(blankSlot); setMessage('Đã lưu lịch làm việc.');
      try { await load(); }
      catch (error) { setMessage(`Đã lưu thay đổi nhưng chưa tải lại được lịch: ${error.message}`); }
    } catch (e) { setMessage(e.message); } finally { setBusy(false); }
  };
  return <section className="admin-card"><div className="admin-section-heading"><div><h2>Lịch làm việc và khung giờ</h2><p>Admin mở lịch khám, điều chỉnh sức chứa và quản lý ngày nghỉ của bác sĩ. Giờ hiển thị theo Việt Nam (GMT+7).</p></div></div>
    <label className="admin-doctor-picker">Bác sĩ<select value={doctorId} disabled={busy} onChange={e => setDoctorId(e.target.value)}><option value="">Chọn bác sĩ</option>{doctors.map(d => <option value={d.id} key={d.id}>{d.full_name}{!d.is_active ? ' · Đã ẩn' : ''}</option>)}</select></label>
    {message && <p className="clinic-alert" role="status">{message}</p>}{loading && <p role="status">Đang tải lịch...</p>}
    {!doctorId && <div className="admin-empty-panel"><strong>Chọn bác sĩ để quản lý lịch</strong><p>Khung giờ được mở sẽ hiển thị trên trang đặt khám của phòng khám.</p></div>}
    {data && <>{!data.doctor.is_active && <p className="admin-alert" role="status">Bác sĩ đang tạm ẩn. Bạn có thể xem hoặc đóng khung giờ đã mở; không thể thêm hay chỉnh sửa lịch khám.</p>}<form className="clinic-form-grid admin-schedule-form" onSubmit={e => { e.preventDefault(); save(slot.id ? '/slots/' + slot.id : '/slots', slot, slot.id ? 'PATCH' : 'POST'); }}><fieldset disabled={busy} className="admin-form-fieldset">
      <h3 className="clinic-form-wide">{slot.id ? 'Chỉnh sửa khung giờ' : 'Mở khung giờ khám'}</h3>
      <label>Ngày khám<input type="date" required min={clinicToday()} value={slot.date} onChange={e => setSlot({ ...slot, date: e.target.value })} /></label><label>Bắt đầu<input type="time" required value={slot.startTime} onChange={e => setSlot({ ...slot, startTime: e.target.value })} /></label><label>Kết thúc<input type="time" required min={slot.startTime || undefined} value={slot.endTime} onChange={e => setSlot({ ...slot, endTime: e.target.value })} /></label><label>Số chỗ<input type="number" required min="1" max="100" step="1" value={slot.capacity} onChange={e => setSlot({ ...slot, capacity: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
      <div className="clinic-actions"><button className="clinic-primary" disabled={busy || !data.doctor.is_active}>{slot.id ? 'Lưu thay đổi' : 'Mở khung giờ'}</button>{slot.id && <button type="button" className="clinic-secondary" onClick={() => setSlot(blankSlot)}>Hủy chỉnh sửa</button>}</div>
    </fieldset></form><h3>Khung giờ trong 30 ngày tới</h3><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Ngày / giờ</th><th>Đã đặt</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{data.slots.map(item => <tr key={item.id}><td><strong>{item.slot_date.split('-').reverse().join('/')}</strong><small>{item.start_time.slice(0, 5)} – {item.end_time?.slice(0, 5)}</small></td><td>{item.booked_count} / {item.capacity}</td><td><span className={'admin-status admin-status-' + (item.is_active ? 'active' : 'disabled')}>{item.is_active ? 'Đang mở' : 'Đã đóng'}</span></td><td className="admin-actions"><button disabled={busy || !data.doctor.is_active} onClick={() => setSlot({ id: item.id, date: item.slot_date, startTime: item.start_time.slice(0, 5), endTime: item.end_time?.slice(0, 5), capacity: item.capacity })}>Chỉnh sửa</button><button disabled={busy || (!data.doctor.is_active && !item.is_active)} onClick={() => save('/slots/' + item.id, { isActive: !item.is_active })}>{item.is_active ? 'Đóng' : 'Mở lại'}</button></td></tr>)}</tbody></table></div>{!data.slots.length && <p className="admin-empty-panel">Chưa mở khung giờ trong khoảng này.</p>}
    <form className="clinic-form-grid admin-schedule-form" onSubmit={e => { e.preventDefault(); save('/unavailability', { ...leave, enabled: true }); }}><fieldset disabled={busy} className="admin-form-fieldset"><h3 className="clinic-form-wide">Ngày nghỉ của bác sĩ</h3><label>Từ ngày<input type="date" required min={clinicToday()} value={leave.startDate} onChange={e => setLeave({ ...leave, startDate: e.target.value, endDate: e.target.value > leave.endDate ? '' : leave.endDate })} /></label><label>Đến ngày<input type="date" required min={leave.startDate || clinicToday()} value={leave.endDate} onChange={e => setLeave({ ...leave, endDate: e.target.value })} /></label><label>Ghi chú<input maxLength="500" value={leave.reason} onChange={e => setLeave({ ...leave, reason: e.target.value })} /></label><div className="clinic-actions"><button disabled={busy} className="clinic-primary">Lưu ngày nghỉ</button><button disabled={busy} type="button" className="clinic-secondary" onClick={() => save('/unavailability', { enabled: false })}>Xóa ngày nghỉ</button></div><p className="clinic-form-wide">Lịch hẹn đã đặt vẫn được giữ để admin chủ động liên hệ và xử lý.</p></fieldset></form></>}
  </section>;
}
