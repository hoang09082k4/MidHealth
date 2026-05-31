function anh_phong_kham(path) {
  if (!path) return '';
  if (/^(https?:)?\/\//.test(path) || path.startsWith('/')) return path;
  return `/image_phong_kham/${path}`;
}

function ThePhongKham({ clinic, onBook }) {
  const imageSrc = anh_phong_kham(clinic.avatar || clinic.image || clinic.logo || clinic.banner);

  return (
    <article className="clinic-card" onClick={() => onBook?.(clinic)}>
      <div className="clinic-avatar">
        {imageSrc ? <img src={imageSrc} alt={clinic.name} /> : <span>{clinic.name?.slice(0, 1) || 'P'}</span>}
      </div>
      <div className="clinic-content">
        <h3>{clinic.name}</h3>
        <p>{clinic.address}</p>
      </div>
    </article>
  );
}

export default ThePhongKham;
