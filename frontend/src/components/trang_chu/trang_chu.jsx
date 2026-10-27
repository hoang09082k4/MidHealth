import { useMemo, useState } from 'react';
import { fallbackCatalog } from '../../lib/catalog';
import { ClinicContact, useClinic } from '../../lib/clinic';
import TheBacSi from '../the_hien_thi/the_bac_si';
import TheChuyenKhoa from '../the_hien_thi/the_chuyen_khoa';

function TrangChu({ catalog = fallbackCatalog, onBookDoctor, onSelectSpecialty, onOpenBookingOverview, onOpenPublicInfo }) {
  const clinic = useClinic();
  const doctors = catalog.doctors.filter(item => item.homepageFeatured !== false).slice(0, 6);
  const [keyword, setKeyword] = useState('');
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();
  const results = useMemo(() => {
    const query = normalize(keyword.trim()); if (!query) return [];
    return [...catalog.doctors.map(item => ({ item, kind: 'doctor', label: 'Bác sĩ', detail: item.specialty })), ...catalog.specialties.map(item => ({ item, kind: 'specialty', label: 'Chuyên khoa', detail: '' }))].filter(result => normalize(result.item.name + ' ' + result.detail).includes(query)).slice(0, 6);
  }, [catalog, keyword]);
  const openResult = result => { setKeyword(''); if (result.kind === 'doctor') onBookDoctor(result.item); else onSelectSpecialty(result.item); };
  return <>
    <section className="hero home-original-hero">
      <div className="hero-content"><h1>Đặt khám {clinic.name}</h1><p>Đặt khám cùng đội ngũ bác sĩ của phòng khám. Có số thứ tự, khung giờ rõ ràng trước khi đến khám.</p>
        <form className="hero-search" role="search" onSubmit={event => { event.preventDefault(); if (results[0]) openResult(results[0]); else if (!keyword.trim()) onOpenBookingOverview('doctor'); }}>
          <span aria-hidden="true">⌕</span><input aria-label="Tìm bác sĩ hoặc chuyên khoa" placeholder="Bác sĩ, chuyên khoa..." autoComplete="off" value={keyword} onChange={event => setKeyword(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setKeyword(''); }} /><button type="submit" aria-label="Tìm kiếm">⌕</button>
          {keyword.trim() && <div className="hero-search-results">{results.length ? results.map(result => <button className="hero-search-result" type="button" key={result.kind + result.item.id} onClick={() => openResult(result)}><span>{result.label}</span><strong>{result.item.name}</strong>{result.detail && <p>{result.detail}</p>}</button>) : <p className="hero-search-empty">Không tìm thấy bác sĩ hoặc chuyên khoa phù hợp.</p>}</div>}
        </form>
        <button className="hero-symptom-jump" type="button" onClick={() => document.getElementById('specialty')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Chưa biết chọn chuyên khoa? Gợi ý theo triệu chứng ↓</button>
      </div><div className="hero-banner-visual" aria-hidden="true"><img src="/image_chung/image_banner.png" alt="" /></div>
    </section>
    <TheChuyenKhoa specialties={catalog.specialties} doctors={catalog.doctors} onSelectSpecialty={onSelectSpecialty} onBookDoctor={onBookDoctor} clinic={clinic} />
    {doctors.length > 0 && <section className="content-section" id="doctor">
      <div className="section-head"><span className="clinic-eyebrow">ĐỒNG HÀNH CÙNG BẠN</span><h2>Đội ngũ bác sĩ của {clinic.name}</h2><p>Tìm hiểu chuyên môn, chọn bác sĩ và xem lịch tiếp nhận tại phòng khám.</p></div>
      {doctors.length ? <div className="doctor-directory-grid">{doctors.map(doctor => <TheBacSi key={doctor.id} doctor={doctor} onBook={onBookDoctor} />)}</div>
        : <p className="clinic-empty">Thông tin đội ngũ bác sĩ đang được cập nhật.</p>}
      <div className="section-footer-action"><button className="pill-button" onClick={() => onOpenBookingOverview('doctor')}>Xem tất cả bác sĩ →</button></div>
    </section>}
    <section className="content-section clinic-process">
      <div className="section-head"><h2>Đặt lịch trong vài bước</h2><p>Chuẩn bị thông tin của bạn, phòng khám sẽ tiếp nhận theo lịch hẹn.</p></div>
      <ol><li><strong>Chọn bác sĩ</strong><span>Tìm chuyên khoa phù hợp với nhu cầu của bạn.</span></li><li><strong>Chọn lịch hẹn</strong><span>Xem ngày và khung giờ phòng khám còn tiếp nhận.</span></li><li><strong>Điền thông tin</strong><span>Chọn hồ sơ người khám; có thể ghi lý do đến khám nếu muốn.</span></li><li><strong>Nhận phiếu khám</strong><span>Kiểm tra lịch hẹn và lưu phiếu trong tài khoản.</span></li></ol>
      <button className="clinic-secondary" onClick={() => onOpenPublicInfo('huong-dan-dat-kham')}>Xem hướng dẫn</button>
    </section>
    <section className="content-section"><div className="section-head"><h2>Đến với {clinic.name}</h2><p>Thông tin liên hệ và giờ tiếp nhận của phòng khám.</p></div><ClinicContact /></section>
  </>;
}
export default TrangChu;
