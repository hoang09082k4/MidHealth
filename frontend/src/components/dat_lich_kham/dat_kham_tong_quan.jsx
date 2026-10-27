import { useEffect, useMemo, useState } from 'react';
import { fallbackCatalog } from '../../lib/catalog';
import TheBacSi from '../the_hien_thi/the_bac_si';
import { useClinic } from '../../lib/clinic';
import { listAppointments } from '../../lib/appointments';

const normalizeText = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();

function TrangDatKhamTongQuan({ catalog = fallbackCatalog, initialSpecialty, activeTab = 'doctor', onBookDoctor, user }) {
  const clinic = useClinic();
  const [keyword, setKeyword] = useState('');
  const [specialty, setSpecialty] = useState(initialSpecialty?.name || '');
  const [recentFollowUps, setRecentFollowUps] = useState([]);
  const [page, setPage] = useState(1);
  useEffect(() => { setSpecialty(initialSpecialty?.name || ''); setPage(1); }, [initialSpecialty?.name]);
  useEffect(() => {
    let active = true;
    setRecentFollowUps([]);
    if (!user) return () => { active = false; };
    listAppointments(user).then(items => {
      if (!active) return;
      const catalogNames = new Set([...catalog.specialties.map(item => item.name), ...catalog.doctors.map(item => item.specialty)].filter(Boolean));
      const recommendations = (items || []).filter(item => item.rawStatus === 'completed' && item.visitResult?.followUp?.trim())
        .slice(0, 30).map(item => ({
          id: item.id,
          patientName: item.patientName,
          instruction: item.visitResult.followUp.trim(),
          specialty: [...catalogNames].find(name => normalizeText(name) === normalizeText(item.department)) || '',
          date: item.dateValue,
        })).slice(0, 3);
      setRecentFollowUps(recommendations);
    }).catch(() => { if (active) setRecentFollowUps([]); });
    return () => { active = false; };
  }, [user, catalog.specialties, catalog.doctors]);
  const names = [...new Set([...catalog.specialties.map(item => item.name), ...catalog.doctors.map(item => item.specialty)].filter(Boolean))];
  const doctors = useMemo(() => catalog.doctors.filter(item => (
    (!specialty || normalizeText(item.specialty).includes(normalizeText(specialty)))
    && normalizeText(item.name + ' ' + item.specialty).includes(normalizeText(keyword))
  )), [catalog.doctors, specialty, keyword]);
  const pages = Math.ceil(doctors.length / 12);
  return <section className="booking-overview-page clinic-directory">
    <div className="section-head"><span className="clinic-eyebrow">{clinic.name}</span><h1>{activeTab === 'specialty' || initialSpecialty ? 'Đặt khám theo chuyên khoa' : 'Đội ngũ bác sĩ'}</h1><p>Chọn chuyên khoa, xem bác sĩ và đặt khung giờ khám tại phòng khám.</p></div>
    <div className="doctor-directory-filters">
      <label className="doctor-directory-search"><input type="search" aria-label="Tìm bác sĩ" placeholder="Tên bác sĩ hoặc chuyên khoa" value={keyword} onChange={event => { setKeyword(event.target.value); setPage(1); }} /></label>
      <select aria-label="Chuyên khoa" value={specialty} onChange={event => { setSpecialty(event.target.value); setPage(1); }}><option value="">Tất cả chuyên khoa</option>{names.map(name => <option key={name}>{name}</option>)}</select>
      {(keyword || specialty) && <button className="clinic-secondary" onClick={() => { setKeyword(''); setSpecialty(''); setPage(1); }}>Xóa bộ lọc</button>}
    </div>
    {recentFollowUps.length > 0 && <section className="booking-personal-followups" aria-labelledby="booking-followup-title">
      <h2 id="booking-followup-title">Nhắc theo dặn dò từ lần khám trước</h2>
      <p>Chỉ hiển thị nội dung bác sĩ đã ghi trong hồ sơ của bạn. Nếu cần tái khám, bạn có thể xem lại chuyên khoa đã khám.</p>
      {recentFollowUps.map(item => <article key={item.id}><div><strong>{item.patientName || 'Hồ sơ bệnh nhân'}{item.specialty ? ` · ${item.specialty}` : ''}{item.date ? ` · Ngày khám ${item.date.split('-').reverse().join('/')}` : ''}</strong><p>{item.instruction}</p></div>{item.specialty && <button type="button" className="clinic-secondary" onClick={() => { setSpecialty(item.specialty); setPage(1); }}>Xem chuyên khoa</button>}</article>)}
    </section>}
    <p className="clinic-result-count" role="status">{doctors.length} bác sĩ{specialty ? ` · ${specialty}` : ' của phòng khám'}</p>
    {doctors.length ? <div className="doctor-directory-grid">{doctors.slice((page - 1) * 12, page * 12).map(doctor => <TheBacSi key={doctor.id} doctor={doctor} onBook={onBookDoctor} />)}</div>
      : <div className="clinic-empty"><h2>{['unavailable', 'cached'].includes(catalog.source) ? 'Chưa tải được danh sách bác sĩ thật' : 'Chưa có bác sĩ phù hợp'}</h2><p>{['unavailable', 'cached'].includes(catalog.source) ? 'Dữ liệu bác sĩ chưa kết nối. Vui lòng thử tải lại hoặc liên hệ phòng khám; hệ thống không hiển thị hồ sơ mô phỏng như bác sĩ thật.' : 'Thử chuyên khoa khác hoặc liên hệ phòng khám để được hỗ trợ.'}</p></div>}
    {pages > 1 && <nav className="booking-pagination" aria-label="Phân trang bác sĩ"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}>Tiếp</button></nav>}
    {catalog.services?.length > 0 && <section className="content-section"><div className="section-head"><h2>Chuyên khoa và chi phí khám</h2><p>Chi phí theo chuyên khoa, chưa áp dụng bảo hiểm.</p></div><div className="clinic-services">{catalog.services.filter(item => !specialty || item.name === specialty).map(item => <article key={item.id}><h3>{item.name}</h3><p>{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.fee)}</p><button className="clinic-secondary" onClick={() => { setSpecialty(item.name); setPage(1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Xem bác sĩ</button></article>)}</div></section>}
  </section>;
}
export default TrangDatKhamTongQuan;
