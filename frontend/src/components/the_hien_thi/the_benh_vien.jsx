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

function TheBenhVien({ hospital, onBook }) {
  const backgroundImage = resolveAssetPath('/image_benh_vien', hospital.background);
  const avatarImage = resolveAssetPath('/image_benh_vien', hospital.avatar);

  return (
    <article className="hospital-card" onClick={() => onBook?.(hospital)}>
      <div className="hospital-cover" style={backgroundImage ? { backgroundImage: `url("${backgroundImage}")` } : undefined}>
        <div className="hospital-logo">
          {avatarImage ? <img src={avatarImage} alt={hospital.name} /> : hospital.logo}
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
