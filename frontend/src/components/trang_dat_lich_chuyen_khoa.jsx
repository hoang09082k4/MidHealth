import { useMemo, useState } from 'react';
import { clinics, doctors, hospitals, specialties } from '../data';

const placeTypes = ['Tất cả', 'Bác sĩ', 'Bệnh viện', 'Phòng khám'];
const cities = ['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ', 'Hải Phòng', 'An Giang'];
const districts = {
  'Hồ Chí Minh': ['Quận 1', 'Quận 3', 'Quận 5', 'Bình Thạnh', 'Bình Tân', 'Thủ Đức'],
  'Hà Nội': ['Ba Đình', 'Hoàn Kiếm', 'Đống Đa', 'Cầu Giấy', 'Hai Bà Trưng'],
  'Đà Nẵng': ['Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn'],
  'Cần Thơ': ['Ninh Kiều', 'Bình Thủy', 'Cái Răng'],
  'Hải Phòng': ['Hồng Bàng', 'Ngô Quyền', 'Lê Chân'],
  'An Giang': ['Long Xuyên', 'Châu Đốc', 'Tân Châu'],
};

function bo_dau(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function khop_tu_khoa(text, keyword) {
  return bo_dau(text).includes(bo_dau(keyword));
}

function lay_chu_cai_dau(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function tao_ket_qua() {
  return [
    ...hospitals.map((item) => ({
      ...item,
      type: 'Bệnh viện',
      tags: item.specialties || [],
      image: item.avatar ? `/image_benh_vien/${item.avatar}` : '',
    })),
    ...doctors.map((item) => ({
      ...item,
      type: 'Bác sĩ',
      tags: [item.specialty],
      address: item.workplace,
      image: item.image ? `/image_doctor/${item.image}` : '',
    })),
    ...clinics.map((item) => ({
      ...item,
      type: 'Phòng khám',
      tags: item.specialties || item.services || [],
      image: item.avatar ? `/image_phong_kham/${item.avatar}` : '',
    })),
  ];
}

function TrangDatLichChuyenKhoa({
  initialSpecialty,
  onBookDoctor,
  onBookHospital,
  onBookClinic,
}) {
  const [keyword, setKeyword] = useState('');
  const [placeType, setPlaceType] = useState('Tất cả');
  const [selectedSpecialty, setSelectedSpecialty] = useState(initialSpecialty?.name || initialSpecialty || '');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [activeModal, setActiveModal] = useState('');
  const [specialtySearch, setSpecialtySearch] = useState('');

  const results = useMemo(() => {
    return tao_ket_qua().filter((item) => {
      const content = [
        item.name,
        item.address,
        item.workplace,
        item.subtitle,
        item.type,
        ...(item.tags || []),
      ].join(' ');
      const matchKeyword = !keyword || khop_tu_khoa(content, keyword);
      const matchType = placeType === 'Tất cả' || item.type === placeType;
      const matchSpecialty = !selectedSpecialty || (item.tags || []).some((tag) => khop_tu_khoa(tag, selectedSpecialty));
      const matchCity = !selectedCity || khop_tu_khoa(item.address || '', selectedCity);
      const matchDistrict = !selectedDistrict || khop_tu_khoa(item.address || '', selectedDistrict);
      return matchKeyword && matchType && matchSpecialty && matchCity && matchDistrict;
    });
  }, [keyword, placeType, selectedSpecialty, selectedCity, selectedDistrict]);

  const filteredSpecialties = specialties.filter((specialty) => khop_tu_khoa(specialty.name, specialtySearch));

  const handleBook = (item) => {
    if (item.type === 'Bác sĩ') {
      onBookDoctor?.(item);
      return;
    }
    if (item.type === 'Bệnh viện') {
      onBookHospital?.(item);
      return;
    }
    onBookClinic?.(item);
  };

  const clearFilters = () => {
    setPlaceType('Tất cả');
    setSelectedSpecialty('');
    setSelectedCity('');
    setSelectedDistrict('');
  };

  return (
    <section className="specialty-search-page">
      <div className="specialty-search-hero">
        <label className="specialty-search-box">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Tìm theo triệu chứng, bác sĩ, bệnh viện..."
          />
          <span aria-hidden="true">⌕</span>
        </label>
        <div className="specialty-filter-row">
          <span className="sparkle" aria-hidden="true">✦</span>
          <button type="button" className="filter-chip" onClick={() => setActiveModal('place')}>
            Nơi khám: {placeType} <span aria-hidden="true">⌄</span>
          </button>
          <button type="button" className="filter-chip active" onClick={() => setActiveModal('specialty')}>
            ✚ {selectedSpecialty || 'Chọn chuyên khoa'}
          </button>
          <button type="button" className={selectedDistrict ? 'filter-chip active' : 'filter-chip'} onClick={() => setActiveModal('region')}>
            ● {selectedDistrict ? `${selectedDistrict}, ${selectedCity}` : 'Khu vực'}
          </button>
          <button type="button" className="filter-chip nearest">
            ◎ Gần nhất
          </button>
        </div>
      </div>

      <div className="specialty-results-card">
        <div className="specialty-results-head">
          <h2>Kết quả tìm kiếm</h2>
          <p>{results.length ? `Tìm thấy ${results.length} kết quả.` : 'Không có kết quả phù hợp.'}</p>
        </div>
        {results.length ? (
          <div className="specialty-result-list">
            {results.map((item) => (
              <article className="specialty-result-item" key={`${item.type}-${item.name}`}>
                <div className="result-avatar">
                  {item.image ? <img src={item.image} alt={item.name} /> : <span>{lay_chu_cai_dau(item.name)}</span>}
                </div>
                <div className="result-info">
                  <h3>{item.name}</h3>
                  <div className="result-tags">
                    {(item.tags || []).slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                  <p>{item.address || item.workplace || 'Đang cập nhật địa chỉ'}</p>
                </div>
                <div className="result-actions">
                  {item.type === 'Bác sĩ' && <button type="button" className="consult-button">Đặt lịch tư vấn</button>}
                  <button type="button" className="book-result-button" onClick={() => handleBook(item)}>Đặt khám</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="specialty-empty">
            <h3>Úi, không thấy kết quả phù hợp</h3>
            <p>Hãy tìm kiếm bằng từ khóa khác hoặc xem gợi ý bên dưới nhé.</p>
            <ul>
              <li>Hãy thử tìm kiếm theo cú pháp: triệu chứng bệnh + loại dịch vụ cần tìm kiếm.</li>
              <li>Hãy thử giảm số lượng từ trong cụm từ tìm kiếm hoặc tìm bằng cụm từ tổng quát hơn.</li>
              <li>Sử dụng tùy chọn chuyên khoa, nơi khám và khu vực để có kết quả tối ưu.</li>
              <li>Thay đổi tùy chọn tìm kiếm hoặc cụm từ khác phổ biến hơn.</li>
            </ul>
          </div>
        )}
      </div>

      {activeModal === 'place' && (
        <div className="filter-modal-backdrop" onClick={() => setActiveModal('')}>
          <div className="filter-modal place-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setActiveModal('')}>×</button>
            <h3>Lọc theo nơi khám</h3>
            {placeTypes.map((type) => (
              <button
                key={type}
                type="button"
                className={type === placeType ? 'modal-option active' : 'modal-option'}
                onClick={() => {
                  setPlaceType(type);
                  setActiveModal('');
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeModal === 'specialty' && (
        <div className="filter-modal-backdrop" onClick={() => setActiveModal('')}>
          <div className="filter-modal specialty-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setActiveModal('')}>×</button>
            <h3>Tìm theo chuyên khoa</h3>
            <label className="modal-search">
              <span aria-hidden="true">⌕</span>
              <input value={specialtySearch} onChange={(event) => setSpecialtySearch(event.target.value)} placeholder="Tìm theo tên" />
            </label>
            <div className="modal-specialty-list">
              {filteredSpecialties.map((specialty) => (
                <button
                  type="button"
                  key={specialty.name}
                  className={selectedSpecialty === specialty.name ? 'modal-specialty active' : 'modal-specialty'}
                  onClick={() => setSelectedSpecialty(specialty.name)}
                >
                  <img src={`/images_chuyen_khoa/${specialty.image}`} alt="" />
                  {specialty.name}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setSelectedSpecialty('')}>Xóa bộ lọc</button>
              <button type="button" className="primary-button" onClick={() => setActiveModal('')}>Áp dụng</button>
            </div>
          </div>
        </div>
      )}

      {activeModal === 'region' && (
        <div className="filter-modal-backdrop" onClick={() => setActiveModal('')}>
          <div className="filter-modal region-modal" onClick={(event) => event.stopPropagation()}>
            <div className="region-modal-head">
              <h3>Chọn khu vực</h3>
              <button type="button" onClick={() => { setSelectedCity(''); setSelectedDistrict(''); }}>XÓA BỘ LỌC</button>
              <button className="modal-close" type="button" onClick={() => setActiveModal('')}>×</button>
            </div>
            <div className="region-columns">
              <div>
                {cities.map((city) => (
                  <button
                    key={city}
                    type="button"
                    className={selectedCity === city ? 'region-option active' : 'region-option'}
                    onClick={() => {
                      setSelectedCity(city);
                      setSelectedDistrict('');
                    }}
                  >
                    {city}
                  </button>
                ))}
              </div>
              <div>
                {selectedCity ? (
                  districts[selectedCity].map((district) => (
                    <button
                      key={district}
                      type="button"
                      className={selectedDistrict === district ? 'region-option active' : 'region-option'}
                      onClick={() => {
                        setSelectedDistrict(district);
                        setActiveModal('');
                      }}
                    >
                      {district}
                    </button>
                  ))
                ) : (
                  <p className="region-hint">Chọn thành phố bạn cần tìm</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default TrangDatLichChuyenKhoa;
