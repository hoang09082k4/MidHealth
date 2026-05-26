function TheBacSi({ doctor, onBook }) {
  return (
    <article className="doctor-card">
      <div className="doctor-avatar" aria-hidden="true">
        {doctor.image ? (
          <img src={`/image_doctor/${doctor.image}`} alt="" />
        ) : (
          <span>{doctor.initials}</span>
        )}
      </div>
      <h3>{doctor.name}</h3>
      <p>{doctor.specialty}</p>
      <small>{doctor.workplace}</small>
      <button className="card-action" type="button" onClick={() => onBook?.(doctor)}>
        Đặt lịch khám
        <span>→</span>
      </button>
    </article>
  );
}

export default TheBacSi;
