import { useEffect, useMemo, useState } from 'react';
import { doctorImagePath } from '../lib/doctor_images';
import { fallbackCatalog } from '../lib/catalog';
import { useReferenceData } from '../lib/reference_data';

const TAT_CA_KHU_VUC = 'Tất cả khu vực';

const PLACE_TYPES = [
  { value: 'all', label: 'Tất cả' },
  { value: 'doctor', label: 'Bác sĩ' },
  { value: 'hospital', label: 'Bệnh viện' },
  { value: 'clinic', label: 'Phòng khám' },
];

const LOCATION_ERROR_MESSAGE = {
  1: 'Trình duyệt chưa được cấp quyền vị trí. Vui lòng cho phép truy cập vị trí hoặc chọn khu vực thủ công.',
  2: 'Không xác định được vị trí hiện tại. Vui lòng thử lại hoặc chọn khu vực thủ công.',
  3: 'Quá thời gian xác định vị trí. Vui lòng thử lại.',
};

function bo_dau(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function khop_tu_khoa(text, keyword) {
  const normalizedText = bo_dau(text);
  const normalizedKeyword = bo_dau(keyword);
  if (!normalizedKeyword) return true;
  return normalizedText.includes(normalizedKeyword)
    || normalizedKeyword.split(' ').every((word) => normalizedText.includes(word));
}

function lay_ten_chuyen_khoa(specialty) {
  if (!specialty) return '';
  if (typeof specialty === 'string') return specialty;
  return specialty.name || '';
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

function duong_dan_anh(prefix, path = '') {
  if (!path) return '';
  if (/^(https?:)?\/\//.test(path) || path.startsWith('/')) return path;
  return `${prefix}/${path}`;
}

function to_number(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function co_toa_do(item) {
  return to_number(item.latitude) !== null && to_number(item.longitude) !== null;
}

function khoang_cach_km(from, item) {
  const lat1 = to_number(from?.latitude);
  const lon1 = to_number(from?.longitude);
  const lat2 = to_number(item.latitude);
  const lon2 = to_number(item.longitude);
  if ([lat1, lon1, lat2, lon2].some((value) => value === null)) return null;

  const radius = 6371;
  const toRad = (degree) => (degree * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hien_thi_khoang_cach(distance) {
  if (distance === null || distance === undefined) return '';
  if (distance < 1) return `${Math.round(distance * 1000)} m`;
  return `${distance.toFixed(distance < 10 ? 1 : 0)} km`;
}

function tim_noi_lam_viec(workplace = '', knownPlaces = []) {
  const normalizedWorkplace = bo_dau(workplace);
  if (!normalizedWorkplace) return null;
  return knownPlaces.find((item) => {
    const normalizedName = bo_dau(item.name);
    return normalizedName === normalizedWorkplace
      || normalizedName.includes(normalizedWorkplace)
      || normalizedWorkplace.includes(normalizedName);
  }) || null;
}

function tao_ket_qua({ hospitals = [], doctors = [], clinics = [] }) {
  const knownPlaces = [...hospitals, ...clinics];

  return [
    ...hospitals.map((item) => ({
      ...item,
      resultType: 'hospital',
      typeLabel: 'Bệnh viện',
      tags: item.specialties || [],
      image: duong_dan_anh('/image_benh_vien', item.avatar),
    })),
    ...doctors.map((item) => {
      const workplace = tim_noi_lam_viec(item.workplace, knownPlaces);
      return {
        ...item,
        resultType: 'doctor',
        typeLabel: 'Bác sĩ',
        tags: [item.specialty].filter(Boolean),
        address: workplace?.address || item.address || item.workplace || '',
        province: workplace?.province || item.province || '',
        district: workplace?.district || item.district || '',
        latitude: workplace?.latitude ?? item.latitude,
        longitude: workplace?.longitude ?? item.longitude,
        workplace: item.workplace,
        image: doctorImagePath(item),
      };
    }),
    ...clinics.map((item) => ({
      ...item,
      resultType: 'clinic',
      typeLabel: 'Phòng khám',
      tags: item.specialties || item.services?.map((service) => service.name) || [],
      image: duong_dan_anh('/image_phong_kham', item.avatar),
    })),
  ];
}

function lay_khu_vuc_tu_catalog(results, baseRegions = []) {
  const regionMap = new Map(baseRegions.map((region) => [
    region.name,
    {
      ...region,
      districts: new Set(region.districts || [TAT_CA_KHU_VUC]),
    },
  ]));

  results.forEach((item) => {
    const addressText = item.address || item.workplace || '';
    const province = item.province || tim_khu_vuc_theo_dia_chi(addressText, baseRegions)?.name || '';
    const district = item.district || '';
    if (!province && !district) return;

    const provinceKey = province || 'Khu vực khác';
    const current = regionMap.get(provinceKey) || { name: provinceKey, aliases: [], districts: new Set([TAT_CA_KHU_VUC]) };
    if (district) current.districts.add(district);
    regionMap.set(provinceKey, current);
  });

  return Array.from(regionMap.values())
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    .map((region) => ({
      ...region,
      districts: Array.from(region.districts).sort((a, b) => {
        if (a === TAT_CA_KHU_VUC) return -1;
        if (b === TAT_CA_KHU_VUC) return 1;
        return a.localeCompare(b, 'vi');
      }),
    }));
}

function tim_khu_vuc_theo_dia_chi(address = '', regions = []) {
  const normalizedAddress = bo_dau(address);
  if (!normalizedAddress) return null;
  return regions.find((region) => (
    [region.name, ...(region.aliases || [])].some((name) => khop_tu_khoa(normalizedAddress, name))
  )) || null;
}

function khop_khu_vuc(addressText, regionName, regions) {
  if (!regionName) return true;
  const region = regions.find((item) => item.name === regionName);
  const names = region ? [region.name, ...(region.aliases || [])] : [regionName];
  return names.some((name) => khop_tu_khoa(addressText, name));
}

function TrangDatLichChuyenKhoa({
  catalog = fallbackCatalog,
  initialSpecialty,
  onBookDoctor,
  onBookHospital,
  onBookClinic,
}) {
  const { clinics = [], doctors = [], hospitals = [], specialties = [] } = catalog;
  const [keyword, setKeyword] = useState('');
  const [placeType, setPlaceType] = useState('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState(lay_ten_chuyen_khoa(initialSpecialty));
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [nearestActive, setNearestActive] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [activeModal, setActiveModal] = useState('');
  const [specialtySearch, setSpecialtySearch] = useState('');
  const { regions: referenceRegions } = useReferenceData();

  const allResults = useMemo(() => tao_ket_qua({ hospitals, doctors, clinics }), [clinics, doctors, hospitals]);
  const regions = useMemo(() => lay_khu_vuc_tu_catalog(allResults, referenceRegions), [allResults, referenceRegions]);
  const currentRegion = regions.find((region) => region.name === selectedProvince);

  useEffect(() => {
    setSelectedSpecialty(lay_ten_chuyen_khoa(initialSpecialty));
    setKeyword('');
    setSelectedProvince('');
    setSelectedDistrict('');
    setNearestActive(false);
    setLocationStatus('');
  }, [initialSpecialty]);

  const results = useMemo(() => {
    const filteredResults = allResults.filter((item) => {
      const addressText = [item.address, item.workplace, item.province, item.district].filter(Boolean).join(' ');
      const content = [
        item.name,
        addressText,
        item.subtitle,
        item.typeLabel,
        ...(item.tags || []),
      ].join(' ');
      const matchKeyword = !keyword || khop_tu_khoa(content, keyword);
      const matchType = placeType === 'all' || item.resultType === placeType;
      const matchSpecialty = !selectedSpecialty || (item.tags || []).some((tag) => khop_tu_khoa(tag, selectedSpecialty));
      const matchProvince = khop_khu_vuc(addressText, selectedProvince, regions);
      const matchDistrict = !selectedDistrict || selectedDistrict === TAT_CA_KHU_VUC || khop_tu_khoa(addressText, selectedDistrict);
      return matchKeyword && matchType && matchSpecialty && matchProvince && matchDistrict;
    });

    if (!nearestActive) return filteredResults;

    return [...filteredResults].sort((first, second) => {
      const firstDistance = khoang_cach_km(userLocation, first);
      const secondDistance = khoang_cach_km(userLocation, second);
      if (firstDistance !== null && secondDistance !== null) return firstDistance - secondDistance;
      if (firstDistance !== null) return -1;
      if (secondDistance !== null) return 1;

      const firstAddress = [first.address, first.workplace, first.province, first.district].filter(Boolean).join(' ');
      const secondAddress = [second.address, second.workplace, second.province, second.district].filter(Boolean).join(' ');
      const firstScore = Number(selectedDistrict && khop_tu_khoa(firstAddress, selectedDistrict))
        + Number(selectedProvince && khop_tu_khoa(firstAddress, selectedProvince));
      const secondScore = Number(selectedDistrict && khop_tu_khoa(secondAddress, selectedDistrict))
        + Number(selectedProvince && khop_tu_khoa(secondAddress, selectedProvince));
      return secondScore - firstScore;
    });
  }, [allResults, keyword, nearestActive, placeType, selectedSpecialty, selectedProvince, selectedDistrict, userLocation]);

  const filteredSpecialties = specialties.filter((specialty) => khop_tu_khoa(specialty.name, specialtySearch));
  const hasGeoResults = allResults.some(co_toa_do);

  const handleBook = (item) => {
    if (item.resultType === 'doctor') {
      onBookDoctor?.(item);
      return;
    }
    if (item.resultType === 'hospital') {
      onBookHospital?.(item);
      return;
    }
    onBookClinic?.(item);
  };

  const clearRegionFilters = () => {
    setSelectedProvince('');
    setSelectedDistrict('');
    setNearestActive(false);
    setLocationStatus('');
  };

  const clearAllFilters = () => {
    setPlaceType('all');
    setSelectedSpecialty('');
    clearRegionFilters();
    setSpecialtySearch('');
  };

  const handleNearest = () => {
    if (nearestActive) {
      setNearestActive(false);
      setLocationStatus('');
      return;
    }

    if (!navigator.geolocation) {
      setNearestActive(true);
      setLocationStatus('Trình duyệt không hỗ trợ định vị. Bạn có thể chọn khu vực thủ công để ưu tiên kết quả gần hơn.');
      setActiveModal('region');
      return;
    }

    setLocationStatus('Đang xác định vị trí hiện tại...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setNearestActive(true);
        setLocationStatus(
          hasGeoResults
            ? `Đang ưu tiên cơ sở gần bạn nhất, sai số khoảng ${Math.round(position.coords.accuracy)} m.`
            : 'Đã lấy vị trí, nhưng catalog chưa có tọa độ cơ sở. Hãy bổ sung latitude/longitude trong DB để sắp xếp chính xác hơn.',
        );
      },
      (error) => {
        setNearestActive(false);
        setLocationStatus(LOCATION_ERROR_MESSAGE[error.code] || 'Không thể lấy vị trí hiện tại.');
        setActiveModal('region');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
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
            Nơi khám: {PLACE_TYPES.find((type) => type.value === placeType)?.label} <span aria-hidden="true">⌄</span>
          </button>
          <button type="button" className={selectedSpecialty ? 'filter-chip active' : 'filter-chip'} onClick={() => setActiveModal('specialty')}>
            ✓ {selectedSpecialty || 'Chọn chuyên khoa'}
          </button>
          <button type="button" className={selectedDistrict || selectedProvince ? 'filter-chip active' : 'filter-chip'} onClick={() => setActiveModal('region')}>
            ● {selectedDistrict ? `${selectedDistrict}, ${selectedProvince}` : selectedProvince || 'Khu vực'}
          </button>
          <button type="button" className={nearestActive ? 'filter-chip nearest active' : 'filter-chip nearest'} onClick={handleNearest}>
            ◎ Gần nhất
          </button>
          {(keyword || selectedSpecialty || selectedProvince || placeType !== 'all' || nearestActive) && (
            <button type="button" className="filter-chip clear" onClick={clearAllFilters}>Xóa lọc</button>
          )}
        </div>
        {locationStatus && <p className="specialty-location-note">{locationStatus}</p>}
      </div>

      <div className="specialty-results-card">
        <div className="specialty-results-head">
          <h2>Kết quả tìm kiếm</h2>
          <p>{results.length ? `Tìm thấy ${results.length} kết quả.` : 'Không có kết quả phù hợp.'}</p>
        </div>
        {results.length ? (
          <div className="specialty-result-list">
            {results.map((item) => {
              const distance = nearestActive ? khoang_cach_km(userLocation, item) : null;
              return (
                <article className="specialty-result-item" key={`${item.resultType}-${item.id || item.name}`}>
                  <div className="result-avatar">
                    {item.image ? <img src={item.image} alt={item.name} /> : <span>{lay_chu_cai_dau(item.name)}</span>}
                  </div>
                  <div className="result-info">
                    <div className="result-title-row">
                      <h3>{item.name}</h3>
                      <span>{item.typeLabel}</span>
                    </div>
                    <div className="result-tags">
                      {(item.tags || []).slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
                    </div>
                    <p>{item.address || item.workplace || 'Đang cập nhật địa chỉ'}</p>
                    {distance !== null && <small className="result-distance">Cách bạn khoảng {hien_thi_khoang_cach(distance)}</small>}
                  </div>
                  <div className="result-actions">
                    <button type="button" className="book-result-button" onClick={() => handleBook(item)}>Đặt khám</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="specialty-empty">
            <h3>Chưa tìm thấy kết quả phù hợp</h3>
            <p>Hãy thử giảm bớt bộ lọc hoặc dùng từ khóa tổng quát hơn.</p>
            <ul>
              <li>Tìm theo triệu chứng, tên chuyên khoa hoặc tên cơ sở.</li>
              <li>Chọn khu vực rộng hơn nếu đang lọc theo quận/huyện.</li>
              <li>Bấm “Gần nhất” và cho phép trình duyệt lấy vị trí để ưu tiên cơ sở gần bạn.</li>
            </ul>
          </div>
        )}
      </div>

      {activeModal === 'place' && (
        <div className="filter-modal-backdrop" onClick={() => setActiveModal('')}>
          <div className="filter-modal place-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setActiveModal('')}>×</button>
            <h3>Lọc theo nơi khám</h3>
            {PLACE_TYPES.map((type) => (
              <button
                key={type.value}
                type="button"
                className={type.value === placeType ? 'modal-option active' : 'modal-option'}
                onClick={() => {
                  setPlaceType(type.value);
                  setActiveModal('');
                }}
              >
                {type.label}
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
                  key={specialty.id || specialty.name}
                  className={selectedSpecialty === specialty.name ? 'modal-specialty active' : 'modal-specialty'}
                  onClick={() => setSelectedSpecialty(specialty.name)}
                >
                  {specialty.image && <img src={duong_dan_anh('/images_chuyen_khoa', specialty.image)} alt="" />}
                  {specialty.name}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => { setSelectedSpecialty(''); setSpecialtySearch(''); }}>Xóa bộ lọc</button>
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
              <button type="button" onClick={clearRegionFilters}>Xóa bộ lọc</button>
              <button className="modal-close" type="button" onClick={() => setActiveModal('')}>×</button>
            </div>
            <div className="region-columns">
              <div>
                {regions.map((region) => (
                  <button
                    key={region.name}
                    type="button"
                    className={selectedProvince === region.name ? 'region-option active' : 'region-option'}
                    onClick={() => {
                      setSelectedProvince(region.name);
                      setSelectedDistrict('');
                    }}
                  >
                    {region.name}
                  </button>
                ))}
              </div>
              <div>
                {selectedProvince ? (
                  (currentRegion?.districts || []).map((district) => (
                    <button
                      key={district}
                      type="button"
                      className={selectedDistrict === district ? 'region-option active' : 'region-option'}
                      onClick={() => {
                        setSelectedDistrict(district === TAT_CA_KHU_VUC ? '' : district);
                        setActiveModal('');
                      }}
                    >
                      {district}
                    </button>
                  ))
                ) : (
                  <p className="region-hint">Chọn tỉnh/thành phố bạn cần tìm</p>
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
