const ASSET_PATH_LIMIT = 2048;

function resolveAssetPath(prefix, value = '') {
  const path = String(value || '').trim();
  if (!path) return '';
  if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(path)) return path;
  if (/^data:?image/i.test(path)) return '';
  if (path.length > ASSET_PATH_LIMIT && !/^(https?:)?\/\//i.test(path)) return '';
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('/')) return path;
  return `${String(prefix || '').replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function ThePhongKham({ clinic, onBook }) {
  const imageSrc = resolveAssetPath('/image_phong_kham', clinic.avatar || clinic.image || clinic.logo || clinic.banner);

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
