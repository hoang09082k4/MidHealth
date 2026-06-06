import { useEffect, useMemo, useState } from 'react';
import TheBacSi from '../the_hien_thi/the_bac_si';
import TheChuyenKhoa from '../the_hien_thi/the_chuyen_khoa';
import { doctorImagePath } from '../../lib/doctor_images';
import { listAppointments } from '../../lib/appointments';

const BOOKING_TABS = [
  { key: 'doctor', label: 'Đặt khám Bác sĩ', icon: 'doctor' },
  { key: 'hospital', label: 'Đặt khám Bệnh viện', icon: 'hospital' },
  { key: 'clinic', label: 'Đặt khám Phòng khám', icon: 'clinic' },
];

const PAGE_SIZE = 8;

const TAB_CONTENT = {
  doctor: {
    title: 'Đặt khám bác sĩ',
    subtitle: 'Đặt khám với hơn 1000 bác sĩ đã kết nối chính thức với MidHealth để có số thứ tự và khung giờ khám trước.',
  },
  hospital: {
    title: 'Đặt khám bệnh viện',
    subtitle: 'Chủ động chọn lịch hẹn - Đi khám không đợi chờ',
  },
  clinic: {
    title: 'Đặt khám phòng khám',
    subtitle: 'Đặt khám dễ dàng và tiện lợi hơn với các phòng khám cùng nhiều chuyên khoa',
  },
};

function duong_dan_anh(prefix, path = '') {
  if (!path) return '';
  if (/^(https?:)?\/\//.test(path) || path.startsWith('/')) return path;
  return `${prefix}/${path}`;
}

function bo_dau(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function ten_ngan_bac_si(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : 'Bác sĩ';
}

function duong_dan_anh_bac_si(path = '') {
  if (!path) return '';
  if (/^(https?:)?\/\//.test(path) || path.startsWith('/')) return path;
  return `/image_doctor/${path}`;
}

function TieuDeTrangDatKham({ title, onAction }) {
  return (
    <div className="section-head booking-overview-head">
      <div>
        <h2>{title}</h2>
      </div>
      <button className="pill-button" type="button" onClick={onAction}>
        Xem tất cả
        <i className="ui-chevron right" aria-hidden="true" />
      </button>
    </div>
  );
}

function BookingTabIcon({ name }) {
  if (name === 'hospital') {
    return (
      <svg className="booking-tab-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 21V5.8c0-.9.7-1.6 1.6-1.6h11.8c.9 0 1.6.7 1.6 1.6V21" />
        <path d="M3 21h18" />
        <path d="M9 21v-4.2h6V21" />
        <path d="M12 7.2v5.6" />
        <path d="M9.2 10h5.6" />
      </svg>
    );
  }

  if (name === 'clinic') {
    return (
      <svg className="booking-tab-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8.5 7V5.6c0-.9.7-1.6 1.6-1.6h3.8c.9 0 1.6.7 1.6 1.6V7" />
        <path d="M5.8 7h12.4c1 0 1.8.8 1.8 1.8v9.4c0 1-.8 1.8-1.8 1.8H5.8c-1 0-1.8-.8-1.8-1.8V8.8C4 7.8 4.8 7 5.8 7Z" />
        <path d="M12 10.5v6" />
        <path d="M9 13.5h6" />
      </svg>
    );
  }

  return (
    <svg className="booking-tab-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4v5.5a4 4 0 0 0 8 0V4" />
      <path d="M6 4H4.8" />
      <path d="M14 4h1.2" />
      <path d="M10 13.5v1.2a4.8 4.8 0 0 0 9.6 0v-2.2" />
      <circle cx="19.6" cy="10.2" r="2.2" />
    </svg>
  );
}

function TrangDatKhamTongQuan({
  catalog,
  activeTab = 'doctor',
  onBookDoctor,
  onBookHospital,
  onBookClinic,
  onSelectSpecialty,
  onChangeTab,
  onOpenSearch,
  user,
}) {
  const { doctors = [], hospitals = [], clinics = [], specialties = [] } = catalog;
  const [recentDoctorAppointment, setRecentDoctorAppointment] = useState(null);
  const [hospitalPage, setHospitalPage] = useState(1);
  const [clinicPage, setClinicPage] = useState(1);
  const currentContent = TAB_CONTENT[activeTab] || TAB_CONTENT.doctor;
  const activeHospitalItems = useMemo(() => paginate(hospitals, hospitalPage), [hospitalPage, hospitals]);
  const activeClinicItems = useMemo(() => paginate(clinics, clinicPage), [clinicPage, clinics]);
  const recentDoctor = useMemo(() => {
    if (!recentDoctorAppointment) return null;
    const appointmentDoctorName = bo_dau(recentDoctorAppointment.doctorName || recentDoctorAppointment.doctorShortName);
    return doctors.find((doctor) => bo_dau(doctor.name) === appointmentDoctorName)
      || doctors.find((doctor) => bo_dau(doctor.name).includes(appointmentDoctorName) || appointmentDoctorName.includes(bo_dau(doctor.name)))
      || null;
  }, [doctors, recentDoctorAppointment]);

  const changeTab = (tabKey) => {
    onChangeTab?.(tabKey);
  };

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setRecentDoctorAppointment(null);
      return () => {
        isMounted = false;
      };
    }

    listAppointments(user)
      .then((items) => {
        if (!isMounted) return;
        const latestDoctorAppointment = (items || []).find((item) => (
          item.type === 'doctor'
          && !['Đã hủy', 'cancelled', 'canceled'].includes(item.status)
          && (item.doctorName || item.doctorShortName)
        ));
        setRecentDoctorAppointment(latestDoctorAppointment || null);
      })
      .catch(() => {
        if (isMounted) setRecentDoctorAppointment(null);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  return (
    <section className="booking-overview-page">
      <section className="hero booking-overview-hero">
        <div className="hero-content booking-overview-hero-content">
          <h1>{currentContent.title}</h1>
          <p>{currentContent.subtitle}</p>
          <form className="hero-search" onSubmit={(event) => event.preventDefault()}>
            <span aria-hidden="true">?</span>
            <input aria-label="Tìm kiếm bác sĩ, bệnh viện, phòng khám" placeholder="Triệu chứng, bác sĩ, bệnh viện..." />
            <button type="submit" aria-label="Tìm kiếm">?</button>
          </form>
          {recentDoctorAppointment ? (
            <div className="booking-repeat">
              <strong>Đặt lại lịch khám</strong>
              <button type="button" onClick={() => recentDoctor && onBookDoctor?.(recentDoctor)} disabled={!recentDoctor}>
                <img src={duong_dan_anh_bac_si(recentDoctorAppointment.doctorImage) || (recentDoctor ? doctorImagePath(recentDoctor) : '')} alt="" />
                <span>{ten_ngan_bac_si(recentDoctorAppointment.doctorShortName || recentDoctorAppointment.doctorName)}</span>
                <small>Đặt lịch</small>
              </button>
            </div>
          ) : null}
        </div>
        <div className="hero-banner-visual" aria-hidden="true">
          <img src="/image_chung/image_banner.png" alt="" />
        </div>
      </section>

      <nav className="booking-tabs" aria-label="Danh mục đặt khám">
        {BOOKING_TABS.map((tab) => (
          <button
            className={activeTab === tab.key ? 'active' : ''}
            key={tab.key}
            type="button"
            onClick={() => changeTab(tab.key)}
          >
            <BookingTabIcon name={tab.icon} />
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'hospital' ? (
        <FacilityOverviewList
          title="Đặt khám trực tuyến với các Bệnh viện"
          subtitle="Chủ động chọn lịch hẹn - Đi khám không đợi chờ"
          items={activeHospitalItems}
          page={hospitalPage}
          totalPages={Math.ceil(hospitals.length / PAGE_SIZE)}
          imagePrefix="/image_benh_vien"
          onOpen={onBookHospital}
          onPageChange={setHospitalPage}
        />
      ) : activeTab === 'clinic' ? (
        <FacilityOverviewList
          title="Đa dạng phòng khám"
          subtitle="Đặt khám dễ dàng và tiện lợi hơn với các phòng khám cùng nhiều chuyên khoa"
          items={activeClinicItems}
          page={clinicPage}
          totalPages={Math.ceil(clinics.length / PAGE_SIZE)}
          imagePrefix="/image_phong_kham"
          onOpen={onBookClinic}
          onPageChange={setClinicPage}
        />
      ) : (
        <>
          <section className="content-section" id="overview-doctor">
            <TieuDeTrangDatKham title="Đặt khám bác sĩ" onAction={() => onOpenSearch?.('doctor')} />
            <div className="horizontal-list doctor-list">
              {doctors.map((doctor) => <TheBacSi doctor={doctor} key={doctor.name} onBook={onBookDoctor} />)}
            </div>
          </section>

          <TheChuyenKhoa specialties={specialties} onSelectSpecialty={onSelectSpecialty} />
        </>
      )}
    </section>
  );
}

function paginate(items, page) {
  const start = (page - 1) * PAGE_SIZE;
  return items.slice(start, start + PAGE_SIZE);
}

function tao_moc_phan_trang(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

  const pages = new Set([1, totalPages, page, page - 1, page + 1]);
  if (page <= 4) {
    [2, 3, 4, 5].forEach((item) => pages.add(item));
  }
  if (page >= totalPages - 3) {
    [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1].forEach((item) => pages.add(item));
  }

  const sortedPages = [...pages].filter((item) => item >= 1 && item <= totalPages).sort((a, b) => a - b);
  return sortedPages.reduce((items, item, index) => {
    if (index > 0 && item - sortedPages[index - 1] > 1) items.push('ellipsis');
    items.push(item);
    return items;
  }, []);
}

function FacilityOverviewList({ title, subtitle, items, page, totalPages, imagePrefix, onOpen, onPageChange }) {
  return (
    <section className="booking-facility-page">
      <div className="booking-facility-head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className="booking-facility-list">
        {items.map((item) => {
          const imageSrc = duong_dan_anh(imagePrefix, item.avatar || item.image || item.logo || item.banner);
          return (
            <button className="booking-facility-item" key={item.id || item.name} type="button" onClick={() => onOpen?.(item)}>
              <span className="booking-facility-logo">
                {imageSrc ? <img src={imageSrc} alt="" /> : <b>{item.name?.slice(0, 1) || 'M'}</b>}
              </span>
              <span className="booking-facility-info">
                <strong>{item.name}</strong>
                <small>{item.address || 'Đang cập nhật địa chỉ'}</small>
              </span>
            </button>
          );
        })}
      </div>
      <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
    </section>
  );
}

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  const visiblePages = tao_moc_phan_trang(page, totalPages);

  return (
    <div className="booking-pagination">
      {visiblePages.map((pageNumber, index) => (
        pageNumber === 'ellipsis'
          ? <span key={`ellipsis-${index}`}>...</span>
          : (
            <button className={pageNumber === page ? 'active' : ''} key={pageNumber} type="button" onClick={() => onPageChange(pageNumber)}>
              {pageNumber}
            </button>
          )
      ))}
      <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(page + 1, totalPages))}>
        <i className="ui-chevron right" aria-hidden="true" />
      </button>
    </div>
  );
}

export default TrangDatKhamTongQuan;
