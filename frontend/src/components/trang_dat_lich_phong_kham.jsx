import { useMemo, useRef, useState } from 'react';
import TrangPhieuKham from './trang_phieu_kham';

function anh_phong_kham(path) {
  return `/image_phong_kham/${path}`;
}

function tao_ma_phieu() {
  const now = new Date();
  return `PK${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${Math.floor(1000 + Math.random() * 9000)}`;
}

function tao_ma_benh_nhan() {
  return `PKP${Math.floor(1000000000 + Math.random() * 9000000000)}`;
}

function lay_ten_tat(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'BN';
  return parts.slice(-2).map((part) => part[0]).join('').toUpperCase();
}

const NGAY_KHAM = [
  { value: '2026-05-27', day: 27, display: '27/05/2026', today: true },
  { value: '2026-05-28', day: 28, display: '28/05/2026' },
  { value: '2026-05-29', day: 29, display: '29/05/2026' },
  { value: '2026-05-30', day: 30, display: '30/05/2026' },
  { value: '2026-05-31', day: 31, display: '31/05/2026', disabled: true },
];

const KHUNG_GIO_PHONG_KHAM = ['13:30 - 16:30', '17:00 - 19:30'];

function ModalAnhPhongKham({ images, activeIndex, onSelect, onClose }) {
  const activeImage = images[activeIndex] || images[0];
  if (!activeImage) return null;

  return (
    <div className="gallery-modal-backdrop" onClick={onClose}>
      <div className="gallery-modal" onClick={(event) => event.stopPropagation()}>
        <div className="gallery-modal-head">
          <h3>Hình ảnh phòng khám</h3>
          <button type="button" onClick={onClose}>×</button>
        </div>
        <img className="gallery-modal-main" src={activeImage.src} alt={activeImage.alt} />
        <div className="gallery-modal-thumbs">
          {images.map((image, index) => (
            <button className={index === activeIndex ? 'active' : ''} key={`${image.src}_${index}`} type="button" onClick={() => onSelect(index)}>
              <img src={image.src} alt={image.alt} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BuocPhongKham({ step, unlockedStep, onStepClick }) {
  const steps = ['Chuyên Khoa', 'Bác Sĩ', 'Ngày Khám', 'Giờ Khám', 'Bệnh Nhân'];
  return (
    <div className="hospital-stepper clinic-stepper">
      {steps.slice(0, unlockedStep).map((label, index) => {
        const number = index + 1;
        const isDone = number < step || (number < unlockedStep && number !== step);
        return (
          <button className={number === step ? 'active' : isDone ? 'done' : ''} key={label} type="button" onClick={() => onStepClick(number)}>
            <i>{isDone ? '✓' : number}</i>{label}
          </button>
        );
      })}
    </div>
  );
}

function LichPhongKham({ selectedDate, onSelectDate }) {
  return (
    <div className="hospital-calendar clinic-calendar">
      <div className="hospital-calendar-head">
        <button type="button" disabled>‹</button>
        <button type="button">›</button>
        <strong>Tháng 5, 2026</strong>
      </div>
      <div className="hospital-calendar-weekdays">
        {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="hospital-calendar-grid">
        {Array.from({ length: 24 }).map((_, index) => <button className="disabled" disabled key={`blank_${index}`} type="button">{index + 1}</button>)}
        {NGAY_KHAM.map((date) => (
          <button
            className={`${date.today ? 'today' : ''} ${selectedDate?.value === date.value ? 'selected' : ''}`}
            disabled={date.disabled}
            key={date.value}
            type="button"
            onClick={() => onSelectDate(date)}
          >
            {date.day}
          </button>
        ))}
      </div>
      <div className="hospital-calendar-legend"><span /> Hôm nay <span /> Có thể chọn <span /> Đã đầy lịch</div>
    </div>
  );
}

function ThongTinDatKhamPhongKham({ clinic, specialty, doctor, date, time, patient }) {
  return (
    <aside className="hospital-booking-summary detailed">
      <h2>Thông tin đặt khám</h2>
      <div><p>Chuyên Khoa</p><strong>{specialty || '--'}</strong></div>
      <div><p>Bác Sĩ</p><strong>{doctor || '--'}</strong></div>
      <div><p>Ngày và giờ khám</p><strong>{date ? `Ngày Khám ${date.display}` : '--'}</strong>{time && <strong>Giờ Khám {time}</strong>}</div>
      <div><p>Bệnh Nhân</p><strong>{patient ? `${patient.name} - ${patient.phone}` : '--'}</strong></div>
      <div><p>Địa điểm</p><strong>{clinic.address}</strong></div>
    </aside>
  );
}

function TrangDatLichPhongKham({ clinic, user, onBackHome }) {
  const [screen, setScreen] = useState('detail');
  const [step, setStep] = useState(1);
  const [unlockedStep, setUnlockedStep] = useState(1);
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [note, setNote] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [galleryIndex, setGalleryIndex] = useState(null);
  const [isIntroExpanded, setIsIntroExpanded] = useState(false);
  const [appointment, setAppointment] = useState(null);
  const fileInputRef = useRef(null);

  const patientProfile = useMemo(() => ({
    name: user?.displayName || user?.email?.split('@')[0] || 'Tinh',
    birthDate: '21/12/2020',
    phone: '0398729285',
    gender: 'Nam',
    address: 'Chưa cập nhật',
  }), [user]);

  const clinicImages = useMemo(() => (
    (clinic.gallery?.length ? clinic.gallery : [clinic.avatar]).map((image, index) => ({
      src: anh_phong_kham(image),
      alt: `${clinic.name} ${index + 1}`,
    }))
  ), [clinic]);

  const scrollToSection = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const resetAfterStep = (fromStep) => {
    if (fromStep <= 1) {
      setSelectedDoctor(null);
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedPatient(null);
    }
    if (fromStep <= 2) {
      setSelectedDate(null);
      setSelectedTime(null);
      setSelectedPatient(null);
    }
    if (fromStep <= 3) {
      setSelectedTime(null);
      setSelectedPatient(null);
    }
    if (fromStep <= 4) setSelectedPatient(null);
  };

  const chooseStep = (choiceStep, applyFn) => {
    applyFn();
    resetAfterStep(choiceStep);
    const nextStep = Math.min(choiceStep + 1, 5);
    setUnlockedStep((current) => Math.max(current, nextStep));
    setStep(nextStep);
  };

  const canContinue = step === 1 ? selectedSpecialty
    : step === 2 ? selectedDoctor
      : step === 3 ? selectedDate
        : step === 4 ? selectedTime
          : selectedPatient;

  const handleFiles = (fileList) => {
    const files = Array.from(fileList || []);
    const validFiles = files.filter((file) => ['image/png', 'image/jpeg'].includes(file.type) && file.size <= 15 * 1024 * 1024);
    setAttachedFiles((current) => [...current, ...validFiles].slice(0, 5));
  };

  const handleBack = () => {
    if (screen === 'booking' && step === 1) {
      setScreen('detail');
      return;
    }
    setStep((current) => Math.max(1, current - 1));
  };

  const handleNext = () => {
    if (!canContinue) return;
    if (step < 5) {
      setStep((current) => current + 1);
      setUnlockedStep((current) => Math.max(current, step + 1));
      return;
    }

    setAppointment({
      id: `clinic_${Date.now()}`,
      type: 'clinic',
      status: 'Đã đặt lịch',
      ticket: `PK-${Date.now()}`,
      appointmentCode: tao_ma_phieu(),
      patientCode: tao_ma_benh_nhan(),
      number: Math.floor(10 + Math.random() * 60),
      doctorName: selectedDoctor,
      doctorShortName: selectedDoctor,
      doctorImage: anh_phong_kham(clinic.avatar),
      department: selectedSpecialty,
      serviceName: selectedSpecialty,
      hospitalName: clinic.name,
      address: clinic.address,
      dateDisplay: selectedDate.display,
      dateValue: selectedDate.value,
      time: selectedTime,
      patientName: selectedPatient.name,
      birthDate: selectedPatient.birthDate,
      gender: selectedPatient.gender,
      phone: selectedPatient.phone,
      patientAddress: selectedPatient.address,
      note,
      attachments: attachedFiles.map((file) => file.name),
    });
  };

  if (appointment) return <TrangPhieuKham appointment={appointment} user={user} onLogout={onBackHome} />;

  if (screen === 'booking') {
    return (
      <section className="hospital-booking-page clinic-booking-page">
        <div className="hospital-booking-title">
          <button type="button" onClick={handleBack}>‹</button>
          <h1>{clinic.name}</h1>
        </div>
        <div className="hospital-booking-grid">
          <article className="hospital-patient-panel hospital-step-panel">
            <header><BuocPhongKham step={step} unlockedStep={unlockedStep} onStepClick={setStep} /></header>
            <div className="hospital-patient-content hospital-step-content" key={step}>
              {step === 1 && (
                <>
                  <h2>Chọn chuyên khoa...</h2>
                  <div className="hospital-option-list">
                    {clinic.specialties.map((specialty) => (
                      <button className={selectedSpecialty === specialty ? 'hospital-option-card selected' : 'hospital-option-card'} key={specialty} type="button" onClick={() => chooseStep(1, () => setSelectedSpecialty(specialty))}>
                        <span><strong>{specialty}</strong></span><i />
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h2>Chọn bác sĩ...</h2>
                  <div className="hospital-option-list">
                    {clinic.doctors.map((doctor) => (
                      <button className={selectedDoctor === doctor ? 'hospital-option-card selected clinic-doctor-option' : 'hospital-option-card clinic-doctor-option'} key={doctor} type="button" onClick={() => chooseStep(2, () => setSelectedDoctor(doctor))}>
                        <span><img src={anh_phong_kham(clinic.avatar)} alt="" /><strong>{doctor}</strong></span><i />
                      </button>
                    ))}
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <h2>Chọn thời gian khám...</h2>
                  <LichPhongKham selectedDate={selectedDate} onSelectDate={(date) => chooseStep(3, () => setSelectedDate(date))} />
                </>
              )}

              {step === 4 && (
                <>
                  <h2>Chọn giờ khám...</h2>
                  <section className="hospital-time-section">
                    <h3>☼ Buổi chiều</h3>
                    <div className="hospital-time-grid clinic-time-grid">
                      {KHUNG_GIO_PHONG_KHAM.map((time) => <button className={selectedTime === time ? 'selected' : ''} key={time} type="button" onClick={() => chooseStep(4, () => setSelectedTime(time))}>{time}</button>)}
                    </div>
                  </section>
                </>
              )}

              {step === 5 && (
                <>
                  <h2>Chọn hồ sơ cần khám...</h2>
                  <button className={selectedPatient ? 'hospital-patient-card selected' : 'hospital-patient-card'} type="button" onClick={() => setSelectedPatient(patientProfile)}>
                    <div className="hospital-patient-avatar">{lay_ten_tat(patientProfile.name)}</div>
                    <div>
                      <h3>{patientProfile.name}</h3>
                      <p>Ngày sinh: <b>{patientProfile.birthDate}</b></p>
                      <p>Số điện thoại: <b>{patientProfile.phone}</b></p>
                      <small>Chính</small>
                      <span>Xem chi tiết hồ sơ</span>
                    </div>
                    <i />
                  </button>
                  <div className="hospital-add-profile"><button type="button">+ Thêm hồ sơ mới</button></div>
                  <div className="hospital-extra-info">
                    <h3>Thông tin bổ sung (không bắt buộc)...</h3>
                    <label>Nội dung<textarea value={note} placeholder="Triệu chứng, thuốc đang dùng, tiền sử, ..." onChange={(event) => setNote(event.target.value)} /></label>
                    <button className="hospital-upload-box" type="button" onClick={() => fileInputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFiles(event.dataTransfer.files); }}>
                      <span>▧</span><strong>Chọn tập tin</strong> hoặc kéo & thả tối đa 5 ảnh.<small>Size thấp hơn 15MB, định dạng file png, jpg.</small>
                    </button>
                    <input accept="image/png,image/jpeg" hidden multiple ref={fileInputRef} type="file" onChange={(event) => handleFiles(event.target.files)} />
                    {attachedFiles.length > 0 && <div className="hospital-file-list">{attachedFiles.map((file) => <span key={`${file.name}_${file.size}`}>{file.name}</span>)}</div>}
                  </div>
                </>
              )}
            </div>
            <footer>
              <button type="button" onClick={handleBack}>Quay lại</button>
              <button type="button" disabled={!canContinue} onClick={handleNext}>{step === 5 ? 'Xác nhận đặt khám' : 'Tiếp tục'}</button>
            </footer>
          </article>

          <ThongTinDatKhamPhongKham clinic={clinic} specialty={selectedSpecialty} doctor={selectedDoctor} date={selectedDate} time={selectedTime} patient={selectedPatient} />
        </div>
      </section>
    );
  }

  return (
    <section className="hospital-detail-page clinic-detail-page">
      <div className="hospital-detail-head">
        <div className="breadcrumb">Trang chủ <span>/</span> Phòng khám</div>
        <button className="favorite-button hospital-favorite" type="button">♡ Yêu thích</button>
        <div className="hospital-title-row">
          <img src={anh_phong_kham(clinic.avatar)} alt={clinic.name} />
          <div>
            <h1>{clinic.name}</h1>
            <p>{clinic.subtitle}</p>
            <button type="button">◆ Địa chỉ</button>
          </div>
        </div>
      </div>
      <nav className="hospital-tabs">
        <button type="button" onClick={() => scrollToSection('clinic-info')}>Thông tin</button>
        <button type="button" onClick={() => scrollToSection('clinic-services')}>Dịch vụ</button>
      </nav>
      <div className="hospital-gallery clinic-gallery">
        <button className="main" type="button" onClick={() => setGalleryIndex(0)}>
          <img src={clinicImages[0].src} alt={clinicImages[0].alt} />
        </button>
        <button type="button" onClick={() => setGalleryIndex(Math.min(1, clinicImages.length - 1))}>
          <img src={(clinicImages[1] || clinicImages[0]).src} alt={(clinicImages[1] || clinicImages[0]).alt} />
        </button>
        <button className="gallery-count" type="button" onClick={() => setGalleryIndex(0)}>📷 {clinicImages.length}</button>
      </div>
      <button className="hospital-detail-book" type="button" onClick={() => setScreen('booking')}>Đặt khám ngay</button>
      <section className="hospital-info-grid" id="clinic-info">
        <article>
          <h2>Giới thiệu</h2>
          <div className={isIntroExpanded ? 'hospital-intro expanded' : 'hospital-intro'}><p>{clinic.intro}</p></div>
          <button type="button" onClick={() => setIsIntroExpanded((value) => !value)}>{isIntroExpanded ? 'Thu gọn' : '...Xem thêm'}</button>
        </article>
        <article>
          <h2>Giờ làm việc</h2>
          <dl>{clinic.hours.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.time}</dd></div>)}</dl>
        </article>
      </section>
      <section className="hospital-info-grid" id="clinic-services">
        <article>
          <h2>Dịch vụ</h2>
          <div className="hospital-tag-list">{clinic.services.map((item) => <span key={item}>✓ {item}</span>)}</div>
        </article>
      </section>
      {galleryIndex !== null && <ModalAnhPhongKham images={clinicImages} activeIndex={galleryIndex} onSelect={setGalleryIndex} onClose={() => setGalleryIndex(null)} />}
    </section>
  );
}

export default TrangDatLichPhongKham;
