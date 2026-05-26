import { useState } from 'react';

function MucChuyenKhoa({ specialties }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const visibleSpecialties = isExpanded ? specialties : specialties.slice(0, 6);
  const hasMore = specialties.length > 6;

  return (
    <section className="content-section specialty-section">
      <div className="plain-head">
        <h2>Đặt lịch theo Chuyên khoa</h2>
        <p>Danh sách bác sĩ, bệnh viện, phòng khám theo chuyên khoa</p>
      </div>
      <div className="specialty-grid">
        {visibleSpecialties.map((specialty) => (
          <a className="specialty-item" href="#booking" key={specialty.name}>
            <img src={`/images_chuyen_khoa/${specialty.image}`} alt={specialty.name} />
            <span>{specialty.name}</span>
          </a>
        ))}
      </div>
      {hasMore && (
        <button
          className="specialty-toggle"
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? 'Thu gọn' : 'Xem thêm'}
          <span aria-hidden="true">{isExpanded ? '⌃' : '→'}</span>
        </button>
      )}
    </section>
  );
}

export default MucChuyenKhoa;
