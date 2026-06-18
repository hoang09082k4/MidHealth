import { useState } from 'react';

const SPECIALTY_PREVIEW_LIMIT = 6;
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

function TheChuyenKhoa({ specialties = [], onSelectSpecialty }) {
  const visibleSpecialties = specialties.filter((specialty) => !/ti[eê]m\s*ch[uủ]ng/i.test(specialty.name || ''));
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMoreSpecialties = visibleSpecialties.length > SPECIALTY_PREVIEW_LIMIT;
  const displayedSpecialties = isExpanded ? visibleSpecialties : visibleSpecialties.slice(0, SPECIALTY_PREVIEW_LIMIT);

  const handleSelect = (event, specialty) => {
    if (!onSelectSpecialty) return;
    event.preventDefault();
    onSelectSpecialty(specialty);
  };

  return (
    <section className="content-section specialty-section" id="specialty">
      <div className="plain-head">
        <h2>Đa dạng chuyên khoa khám</h2>
        <p>Đặt khám dễ dàng và tiện lợi hơn với đầy đủ các chuyên khoa</p>
      </div>

      <div className="specialty-grid">
        {displayedSpecialties.map((specialty, index) => (
          <a
            className="specialty-item"
            href="#specialty-search"
            key={specialty.id || `${specialty.name}-${index}`}
            onClick={(event) => handleSelect(event, specialty)}
          >
            <img src={resolveAssetPath('/images_chuyen_khoa', specialty.image)} alt={specialty.name} />
            <span>{specialty.name}</span>
          </a>
        ))}
      </div>

      {hasMoreSpecialties && (
        <div className="specialty-actions">
          <button className="specialty-toggle" type="button" onClick={() => setIsExpanded((current) => !current)}>
            {isExpanded ? 'Thu gọn' : 'Xem thêm'}
            <span className={isExpanded ? 'toggle-arrow up' : 'toggle-arrow'} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}

export default TheChuyenKhoa;
