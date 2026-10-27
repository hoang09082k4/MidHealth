import { useMemo, useState } from 'react';
import { analyzeSymptoms } from '../../lib/booking_recommendations';
import TheBacSi from './the_bac_si';

const SPECIALTY_PREVIEW_LIMIT = 6;
const ASSET_PATH_LIMIT = 2048;
const normalize = value => String(value || '').replace(/[đĐ]/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function resolveAssetPath(prefix, value = '') {
  const path = String(value || '').trim();
  if (!path) return '';
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(path)) return path;
  if (/^data:?image/i.test(path)) return '';
  if (path.length > ASSET_PATH_LIMIT && !/^(https?:)?\/\//i.test(path)) return '';
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('/')) return path;
  return `${String(prefix || '').replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function TheChuyenKhoa({ specialties = [], doctors = [], onSelectSpecialty, onBookDoctor, clinic }) {
  const visibleSpecialties = specialties.filter(specialty => !/ti[eê]m\s*ch[uủ]ng/i.test(specialty.name || ''));
  const [isExpanded, setIsExpanded] = useState(false);
  const [symptomText, setSymptomText] = useState('');
  const symptomResult = useMemo(() => analyzeSymptoms(symptomText, visibleSpecialties), [symptomText, visibleSpecialties]);
  const hasUnaccentedHongAmbiguity = normalize(symptomText).includes('dau hong') && !/đau\s+(?:họng|hông)/iu.test(symptomText);
  const hasMoreSpecialties = visibleSpecialties.length > SPECIALTY_PREVIEW_LIMIT;
  const displayedSpecialties = isExpanded ? visibleSpecialties : visibleSpecialties.slice(0, SPECIALTY_PREVIEW_LIMIT);

  const doctorsFor = specialtyName => doctors.filter(doctor => {
    const doctorSpecialty = doctor.specialty || visibleSpecialties.find(item => item.id === doctor.specialtyId)?.name || '';
    return normalize(doctorSpecialty) === normalize(specialtyName);
  });

  const handleSelect = (event, specialty) => {
    if (!onSelectSpecialty) return;
    event.preventDefault();
    onSelectSpecialty(specialty);
  };

  return <section className="content-section specialty-section" id="specialty">
    <div className="plain-head">
      <span className="clinic-eyebrow">DỊCH VỤ TẠI PHÒNG KHÁM</span>
      <h2>Chuyên khoa khám</h2>
      <p>Chọn chuyên khoa hoặc nhập triệu chứng để tìm bác sĩ.</p>
    </div>

    <section className="specialty-symptom-guide" aria-label="Gợi ý bác sĩ theo triệu chứng">
      <label htmlFor="specialty-symptom-input">Gợi ý bác sĩ theo triệu chứng</label>
      <input id="specialty-symptom-input" type="search" value={symptomText} onChange={event => setSymptomText(event.target.value)} placeholder="Ví dụ: ho khan, ngứa da, đau họng và đau mắt" />
      {hasUnaccentedHongAmbiguity && <small className="specialty-ambiguity-note">“dau hong” có thể là đau họng hoặc đau hông; ghi rõ vị trí để gợi ý sát hơn.</small>}
      {symptomResult.urgent.map(item => <p className={item.level === 'emergency' ? 'booking-emergency-note' : 'booking-urgent-note'} role="alert" key={item.id}>{item.message}</p>)}
      {symptomResult.groups.map(group => {
        const matches = group.specialty ? doctorsFor(group.specialty) : [];
        const isEmergency = symptomResult.urgent.some(item => item.level === 'emergency');
        const isUrgent = symptomResult.urgent.length > 0;
        return <div className="specialty-symptom-result" key={group.id}>
          <strong>{group.area}{group.unavailableSpecialty ? ` · Chưa có khoa ${group.unavailableSpecialty}` : ''}</strong>
          {group.specialty && group.isFallback && <small>Bác sĩ {group.specialty} có thể đánh giá ban đầu.</small>}
          {matches.length > 0 && !isUrgent && <div className="specialty-suggested-doctors">{matches.map(doctor => <TheBacSi key={doctor.id} doctor={doctor} onBook={item => onBookDoctor(item, symptomText.trim())} />)}</div>}
          {matches.length > 0 && isEmergency && <small className="specialty-emergency-block">Đến cơ sở cấp cứu; không đặt lịch thường.</small>}
          {matches.length > 0 && !isEmergency && isUrgent && <small className="specialty-emergency-block">Liên hệ phòng khám để được hướng dẫn khám trong ngày.</small>}
          {group.specialty && !matches.length && !isUrgent && <small className="specialty-no-doctor">Chưa có bác sĩ đang nhận khám ở chuyên khoa này.</small>}
          {!group.specialty && !isUrgent && <a className="specialty-contact-link" href={clinic?.phone ? `tel:${clinic.phone}` : '#lien-he'}>{clinic?.phone ? `Liên hệ ${clinic.phone}` : 'Liên hệ phòng khám'}</a>}
        </div>;
      })}
      {symptomText.trim().length >= 2 && !symptomResult.groups.length && !symptomResult.urgent.some(item => item.level === 'emergency') && <div className="specialty-symptom-result"><strong>Nội tổng quát</strong><small>Chọn bác sĩ Nội tổng quát để được đánh giá ban đầu.</small>{doctorsFor('Nội tổng quát').map(doctor => <div className="specialty-suggested-doctors" key={doctor.id}><TheBacSi doctor={doctor} onBook={item => onBookDoctor(item, symptomText.trim())} /></div>)}</div>}
    </section>

    <div className="specialty-grid">
      {displayedSpecialties.map((specialty, index) => <a className="specialty-item" href="#specialty-search" key={specialty.id || `${specialty.name}-${index}`} onClick={event => handleSelect(event, specialty)}>
        {specialty.image ? <img src={resolveAssetPath('/images_chuyen_khoa', specialty.image)} alt="" loading="lazy" /> : <span className="clinic-specialty-symbol" aria-hidden="true">+</span>}
        <span>{specialty.name}</span>
      </a>)}
    </div>
    {!visibleSpecialties.length && <p className="clinic-empty">Chuyên khoa của phòng khám đang được cập nhật.</p>}
    {hasMoreSpecialties && <div className="specialty-actions"><button className="specialty-toggle" type="button" onClick={() => setIsExpanded(current => !current)}>{isExpanded ? 'Thu gọn' : 'Xem thêm'}<span className={isExpanded ? 'toggle-arrow up' : 'toggle-arrow'} aria-hidden="true" /></button></div>}
  </section>;
}

export default TheChuyenKhoa;
