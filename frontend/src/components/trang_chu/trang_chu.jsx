import {
  articles,
  securityItems,
  trustItems,
} from '../../data';
import { useMemo, useState } from 'react';
import { fallbackCatalog } from '../../lib/catalog';
import MucBaoMatFooter from './bao_mat_footer';
import MucTinTuong from './tin_tuong';
import MucTinYTe from '../tin_y_te/tin_y_te';
import TheBacSi from '../the_hien_thi/the_bac_si';
import TheBenhVien from '../the_hien_thi/the_benh_vien';
import TheChuyenKhoa from '../the_hien_thi/the_chuyen_khoa';
import ThePhongKham from '../the_hien_thi/the_phong_kham';
import TieuDeMuc from './tieu_de_muc';

function normalizeSearchText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

function buildHeroSearchResults({ doctors = [], hospitals = [], clinics = [], specialties = [] }, keyword) {
  if (!keyword) return [];

  const results = [];
  const pushResult = ({ type, label, item, title, subtitle, haystack }) => {
    if (normalizeSearchText(haystack).includes(keyword)) {
      results.push({ type, label, item, title, subtitle });
    }
  };

  doctors.forEach((doctor) => {
    pushResult({
      type: 'doctor',
      label: 'Bác sĩ',
      item: doctor,
      title: doctor.name,
      subtitle: [doctor.specialty, doctor.workplace].filter(Boolean).join(' - '),
      haystack: [doctor.name, doctor.specialty, doctor.workplace, doctor.address].filter(Boolean).join(' '),
    });
  });

  hospitals.forEach((hospital) => {
    pushResult({
      type: 'hospital',
      label: 'Bệnh viện',
      item: hospital,
      title: hospital.name,
      subtitle: hospital.address,
      haystack: [hospital.name, hospital.address, ...(hospital.specialties || [])].filter(Boolean).join(' '),
    });
  });

  clinics.forEach((clinic) => {
    pushResult({
      type: 'clinic',
      label: 'Phòng khám',
      item: clinic,
      title: clinic.name,
      subtitle: clinic.address,
      haystack: [clinic.name, clinic.address, ...(clinic.services || []), ...(clinic.specialties || [])].filter(Boolean).join(' '),
    });
  });

  specialties.forEach((specialty) => {
    pushResult({
      type: 'specialty',
      label: 'Chuyên khoa',
      item: specialty,
      title: specialty.name,
      subtitle: 'Đặt lịch theo chuyên khoa',
      haystack: [specialty.name, specialty.description].filter(Boolean).join(' '),
    });
  });

  return results.slice(0, 8);
}

function TrangChu({ catalog = fallbackCatalog, onBookDoctor, onBookHospital, onBookClinic, onSelectSpecialty, onOpenHealthNews }) {
  const { doctors, hospitals, clinics, specialties } = catalog;
  const [heroSearchTerm, setHeroSearchTerm] = useState('');
  const heroSearchKeyword = useMemo(() => normalizeSearchText(heroSearchTerm.trim()), [heroSearchTerm]);
  const heroSearchResults = useMemo(
    () => buildHeroSearchResults({ doctors, hospitals, clinics, specialties }, heroSearchKeyword),
    [clinics, doctors, heroSearchKeyword, hospitals, specialties],
  );

  const openHeroSearchResult = (result) => {
    setHeroSearchTerm('');

    if (result.type === 'doctor') {
      onBookDoctor?.(result.item);
      return;
    }

    if (result.type === 'hospital') {
      onBookHospital?.(result.item);
      return;
    }

    if (result.type === 'clinic') {
      onBookClinic?.(result.item);
      return;
    }

    onSelectSpecialty?.(result.item);
  };

  const submitHeroSearch = (event) => {
    event.preventDefault();
    if (heroSearchResults.length > 0) {
      openHeroSearchResult(heroSearchResults[0]);
    }
  };

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <h1>Đặt khám MidHealth</h1>
          <p>Đặt khám với bác sĩ, bệnh viện và phòng khám uy tín. Có số thứ tự, khung giờ rõ ràng trước khi đến khám.</p>
          <form className="hero-search" onSubmit={submitHeroSearch}>
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Tìm kiếm bác sĩ, bệnh viện, phòng khám hoặc chuyên khoa"
              autoComplete="off"
              placeholder="Triệu chứng, bác sĩ, bệnh viện..."
              value={heroSearchTerm}
              onChange={(event) => setHeroSearchTerm(event.target.value)}
            />
            <button type="submit" aria-label="Tìm kiếm">⌕</button>
            {heroSearchTerm.trim() ? (
              <div className="hero-search-results">
                {heroSearchResults.length > 0 ? (
                  heroSearchResults.map((result) => (
                    <button
                      type="button"
                      className="hero-search-result"
                      key={`${result.type}-${result.title}`}
                      onClick={() => openHeroSearchResult(result)}
                    >
                      <span>{result.label}</span>
                      <strong>{result.title}</strong>
                      {result.subtitle ? <p>{result.subtitle}</p> : null}
                    </button>
                  ))
                ) : (
                  <p className="hero-search-empty">Không tìm thấy kết quả phù hợp.</p>
                )}
              </div>
            ) : null}
          </form>
        </div>
        <div className="hero-banner-visual" aria-hidden="true">
          <img src="/image_chung/image_banner.png" alt="" />
        </div>
      </section>

      <section className="intro" id="booking">
        <h2>Đặt lịch khám trực tuyến</h2>
        <p>Tìm Bác sĩ chính xác - Đặt lịch khám dễ dàng</p>
      </section>

      <section className="content-section" id="doctor">
        <TieuDeMuc title="Đặt khám bác sĩ" subtitle="Phiếu khám điện tử kèm số thứ tự và thời gian của bạn được xác nhận." />
        <div className="horizontal-list doctor-list">
          {doctors.map((doctor) => <TheBacSi doctor={doctor} key={doctor.name} onBook={onBookDoctor} />)}
        </div>
      </section>

      <section className="content-section">
        <TieuDeMuc title="Đặt khám bệnh viện" subtitle="Đặt khám và thanh toán để có phiếu khám điện tử trước khi đi khám các bệnh viện kết nối chính thức với MidHealth." />
        <div className="horizontal-list hospital-list">
          {hospitals.map((hospital) => <TheBenhVien hospital={hospital} key={hospital.name} onBook={onBookHospital} />)}
        </div>
      </section>

      <section className="content-section">
        <TieuDeMuc title="Đặt khám phòng khám" subtitle="Đa dạng phòng khám với nhiều chuyên khoa khác nhau như Sản - Nhi, Tai Mũi Họng, Da Liễu, Tiêu Hoá..." />
        <div className="horizontal-list clinic-list">
          {clinics.map((clinic) => <ThePhongKham clinic={clinic} key={clinic.name} onBook={onBookClinic} />)}
        </div>
      </section>

      <TheChuyenKhoa specialties={specialties} onSelectSpecialty={onSelectSpecialty} />
      <MucTinYTe route={{ name: 'list', category: 'thuoc' }} onNavigate={onOpenHealthNews} />
      <MucTinTuong trustItems={trustItems} />

      <section className="booking-panel" id="consult">
        <div>
          <h2>Đặt lịch nhanh với MidHealth</h2>
          <p>Nhập thông tin cơ bản, đội ngũ MidHealth sẽ hỗ trợ xác nhận lịch khám phù hợp.</p>
        </div>
        <form>
          <input placeholder="Họ và tên" />
          <input placeholder="Số điện thoại" />
          <select defaultValue="">
            <option value="" disabled>Chọn chuyên khoa</option>
            {specialties.slice(0, 10).map((specialty) => <option key={specialty.name}>{specialty.name}</option>)}
          </select>
          <button type="button">Gửi yêu cầu</button>
        </form>
      </section>

      <section className="article-section" id="assistant">
        <TieuDeMuc title="Cẩm nang sức khỏe" subtitle="Thông tin tham khảo giúp bạn chuẩn bị tốt hơn trước khi khám." />
        <div className="article-grid">
          {articles.map((article) => (
            <article className="article-card" key={article.title}>
              <span>{article.category}</span>
              <h3>{article.title}</h3>
              <p>{article.description}</p>
            </article>
          ))}
        </div>
      </section>

      <MucBaoMatFooter securityItems={securityItems} />
    </>
  );
}

export default TrangChu;
