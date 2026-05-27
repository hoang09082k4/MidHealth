function anh_phong_kham(path) {
  return `/image_phong_kham/${path}`;
}

function ThePhongKham({ clinic, onBook }) {
  return (
    <article className="clinic-card" onClick={() => onBook?.(clinic)}>
      <div className="clinic-avatar">
        <img src={anh_phong_kham(clinic.avatar)} alt={clinic.name} />
      </div>
      <div className="clinic-content">
        <h3>{clinic.name}</h3>
        <p>{clinic.address}</p>
      </div>
    </article>
  );
}

export default ThePhongKham;
