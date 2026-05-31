import { doctorImagePath } from '../../lib/doctor_images';

function TheBacSi({ doctor, onBook }) {
  return (
    <article className="doctor-card">
      <div className="doctor-avatar" aria-hidden="true">
        <img src={doctorImagePath(doctor)} alt="" />
      </div>
      <div className="doctor-card-body">
        <h3>{doctor.name}</h3>
        <p>{doctor.specialty}</p>
        <small>{doctor.workplace}</small>
      </div>
      <button className="card-action" type="button" onClick={() => onBook?.(doctor)}>
        Đặt lịch khám
        <span>→</span>
      </button>
    </article>
  );
}

export default TheBacSi;
