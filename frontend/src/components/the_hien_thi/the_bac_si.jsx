import { doctorImagePath } from '../../lib/doctor_images';

function TheBacSi({ doctor, onBook }) {
  const summary = doctor.shortDescription || (doctor.yearsExperience != null
    ? `${doctor.yearsExperience} năm kinh nghiệm`
    : doctor.workplace || 'Bác sĩ của phòng khám');
  return (
    <article className="doctor-card">
      <div className="doctor-avatar" aria-hidden="true">
        <img src={doctorImagePath(doctor)} alt="" loading="lazy" onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = '/image_chung/doctor-placeholder.svg'; }} />
      </div>
      <div className="doctor-card-body">
        <h3>{doctor.name}</h3>
        <p>{doctor.specialty}</p>
        <small style={doctor.shortDescription ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } : undefined}>{summary}</small>
      </div>
      <button className="card-action" type="button" disabled={doctor.bookable === false} onClick={() => onBook?.(doctor)}>
        {doctor.bookable === false ? 'Chưa mở đặt lịch' : 'Xem hồ sơ & lịch khám'}
        <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

export default TheBacSi;
