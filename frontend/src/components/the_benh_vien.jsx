function duong_dan_anh(path) {
  if (!path) return '';
  if (/^(https?:)?\/\//.test(path) || path.startsWith('/')) return path;
  return `/image_benh_vien/${path}`;
}

function TheBenhVien({ hospital, onBook }) {
  return (
    <article className="hospital-card" onClick={() => onBook?.(hospital)}>
      <div className="hospital-cover" style={{ backgroundImage: `url("${duong_dan_anh(hospital.background)}")` }}>
        <div className="hospital-logo">
          {hospital.avatar ? <img src={duong_dan_anh(hospital.avatar)} alt={hospital.name} /> : hospital.logo}
        </div>
      </div>
      <div className="hospital-content">
        <h3>{hospital.name}</h3>
        <p>{hospital.address}</p>
        <dl>
          {hospital.hours.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.time}</dd>
            </div>
          ))}
        </dl>
      </div>
      <button className="hospital-book-button" type="button">Đặt khám ngay</button>
    </article>
  );
}

export default TheBenhVien;
