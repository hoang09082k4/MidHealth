import {
  articles,
  securityItems,
  trustItems,
} from '../../data';
import { fallbackCatalog } from '../../lib/catalog';
import MucBaoMatFooter from './bao_mat_footer';
import MucTinTuong from './tin_tuong';
import MucTinYTe from '../tin_y_te/tin_y_te';
import TheBacSi from '../the_hien_thi/the_bac_si';
import TheBenhVien from '../the_hien_thi/the_benh_vien';
import TheChuyenKhoa from '../the_hien_thi/the_chuyen_khoa';
import ThePhongKham from '../the_hien_thi/the_phong_kham';
import TieuDeMuc from './tieu_de_muc';

function TrangChu({ catalog = fallbackCatalog, onBookDoctor, onBookHospital, onBookClinic, onSelectSpecialty, onOpenHealthNews }) {
  const { doctors, hospitals, clinics, specialties } = catalog;

  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <h1>Website đặt khám MidHealth</h1>
          <p>Đặt khám với bác sĩ, bệnh viện và phòng khám uy tín. Có số thứ tự, khung giờ rõ ràng trước khi đến khám.</p>
          <label className="hero-search">
            <span aria-hidden="true">⌕</span>
            <input placeholder="Triệu chứng, bác sĩ, bệnh viện..." />
          </label>
        </div>
        <div className="hero-family" aria-hidden="true">
          <div className="person person-one">Bố</div>
          <div className="person person-two">Mẹ</div>
          <div className="person person-three">Bé</div>
          <div className="person person-four">Ông</div>
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
