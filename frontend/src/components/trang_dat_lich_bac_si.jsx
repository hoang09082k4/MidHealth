import { useMemo, useState } from 'react';
import TrangPhieuKham, { PhieuKhamChiTiet, co_gia_tri, tao_dong_phieu_kham } from './trang_phieu_kham';
import { createAppointment } from '../lib/appointments';

function tao_ngay_kham() {
  const labels = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const today = new Date();

  return Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');

    return {
      label: `${labels[date.getDay()]}, ${day}-${month}`,
      value: date.toISOString().slice(0, 10),
      display: `${day}/${month}/${date.getFullYear()}`,
      slots: index === 5 ? 24 : index === 1 ? 35 : 36,
    };
  });
}

function tao_khung_gio() {
  const slots = [];
  let hour = 17;
  let minute = 0;

  while (hour < 20) {
    const start = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    minute += 5;
    if (minute === 60) {
      hour += 1;
      minute = 0;
    }
    const end = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    slots.push(`${start}-${end}`);
  }

  return slots;
}

function anh_bac_si(doctor) {
  return doctor.image ? `/image_doctor/${doctor.image}` : '';
}

function lay_ten_tat(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'BN';
  return words.slice(-2).map((word) => word[0]).join('').toUpperCase();
}

function tao_ma_phieu(number) {
  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `YMA${y}${m}${d}${String(50000 + number).padStart(5, '0')}`;
}

function luu_lich_kham(appointment) {
  const current = JSON.parse(localStorage.getItem('midhealth_appointments') || '[]');
  localStorage.setItem('midhealth_appointments', JSON.stringify([appointment, ...current.filter((item) => item.ticket !== appointment.ticket)]));
}

function tai_anh_phieu(appointment) {
  const { bookingRows, patientRows } = tao_dong_phieu_kham(appointment);
  const visibleBookingRows = bookingRows.filter((row) => co_gia_tri(row.value));
  const visiblePatientRows = patientRows.filter((row) => co_gia_tri(row.value));
  const canvas = document.createElement('canvas');
  const width = 960;
  const height = Math.max(760, 390 + (visibleBookingRows.length + visiblePatientRows.length) * 42);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#86efac';
  context.beginPath();
  context.arc(width / 2, 46, 30, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#ffffff';
  context.font = 'bold 34px Arial';
  context.textAlign = 'center';
  context.fillText('✓', width / 2, 58);

  context.fillStyle = '#333333';
  context.font = 'bold 22px Arial';
  context.fillText('Đặt lịch thành công!', width / 2, 120);
  context.font = '16px Arial';
  context.fillText('STT', width / 2 - 80, 168);
  context.fillStyle = '#20c56f';
  context.font = 'bold 34px Arial';
  context.fillText(String(appointment.number), width / 2 - 80, 208);

  context.strokeStyle = '#eeeeee';
  context.beginPath();
  context.moveTo(30, 225);
  context.lineTo(width - 30, 225);
  context.stroke();

  context.fillStyle = '#333333';
  context.textAlign = 'left';
  context.font = 'bold 18px Arial';
  context.fillText(appointment.doctorShortName, 90, 260);
  context.fillStyle = '#666666';
  context.font = '16px Arial';
  context.fillText(appointment.address, 90, 286);

  const drawSection = (title, rows, yStart) => {
    let y = yStart;
    context.fillStyle = '#333333';
    context.font = 'bold 17px Arial';
    context.fillText(title, 30, y);
    y += 28;
    rows.forEach((row) => {
      context.strokeStyle = '#eeeeee';
      context.beginPath();
      context.moveTo(30, y + 10);
      context.lineTo(width - 30, y + 10);
      context.stroke();
      context.fillStyle = '#333333';
      context.font = '16px Arial';
      context.fillText(row.label, 30, y + 34);
      context.fillStyle = row.highlight ? '#00a651' : '#333333';
      context.fillText(String(row.value), 330, y + 34);
      y += 42;
    });
    return y + 24;
  };

  const nextY = drawSection('Thông tin đặt khám', visibleBookingRows, 340);
  drawSection('Thông tin bệnh nhân', visiblePatientRows, nextY);

  const link = document.createElement('a');
  link.download = `${appointment.appointmentCode}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function TrangDatLichBacSi({ doctor, user, onBackHome, onSignOut }) {
  const dates = useMemo(() => tao_ngay_kham(), []);
  const timeSlots = useMemo(() => tao_khung_gio(), []);
  const [screen, setScreen] = useState('detail');
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [selectedTime, setSelectedTime] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appointment, setAppointment] = useState(null);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [uploadError, setUploadError] = useState('');

  const patientName = user?.displayName || user?.email?.split('@')[0] || 'Bệnh nhân';

  const handleConfirmBooking = async () => {
    if (!selectedTime) {
      setMessage('Vui lòng chọn khung giờ khám.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const nextAppointment = await createAppointment(user, {
        type: 'doctor',
        doctorName: doctor.name,
        doctorShortName: doctor.name.replace(/^BS\. CK2\s|^PGS\. TS\. BS\s/, ''),
        doctorImage: doctor.image,
        department: doctor.specialty,
        facilityName: doctor.workplace,
        hospitalName: doctor.workplace,
        address: '250 Đ. Nguyễn Xí, Bình Lợi Trung, Hồ Chí Minh',
        dateDisplay: selectedDate.display,
        dateValue: selectedDate.value,
        time: selectedTime,
        patientName,
        birthDate: '09/08/2004',
        gender: 'Nam',
        phone: '0343413231',
        patientAddress: 'Chưa cập nhật',
        patientProfile: {
          name: patientName,
          birthDate: '09/08/2004',
          gender: 'Nam',
          phone: '0343413231',
          address: 'Chưa cập nhật',
          email: user?.email || '',
          relationship: 'Tôi',
        },
        note,
        room: 'Phòng khám Nhi khoa',
        attachments: attachedFiles.map((file) => file.name),
      });
      setAppointment(nextAppointment);
      luu_lich_kham(nextAppointment);
      setScreen('success');
    } catch (error) {
      setMessage(error.message || 'Có lỗi xảy ra khi đặt lịch.');
    } finally {
      setIsLoading(false);
    }
  };

  const addFiles = (fileList) => {
    const incomingFiles = Array.from(fileList || []);
    const validFiles = [];
    let error = '';

    incomingFiles.forEach((file) => {
      const isValidType = ['image/png', 'image/jpeg'].includes(file.type);
      const isValidSize = file.size <= 15 * 1024 * 1024;
      if (!isValidType) {
        error = 'Chỉ nhận file PNG hoặc JPG.';
        return;
      }
      if (!isValidSize) {
        error = 'Mỗi file tối đa 15MB.';
        return;
      }
      validFiles.push(file);
    });

    setAttachedFiles((current) => {
      const nextFiles = [...current, ...validFiles].slice(0, 5);
      if (current.length + validFiles.length > 5) error = 'Chỉ được đính kèm tối đa 5 file.';
      return nextFiles;
    });
    setUploadError(error);
  };

  const removeFile = (fileIndex) => {
    setAttachedFiles((current) => current.filter((_, index) => index !== fileIndex));
    setUploadError('');
  };

  if (screen === 'account' && appointment) {
    return <TrangPhieuKham appointment={appointment} user={user} onLogout={onSignOut || onBackHome} />;
  }

  if (screen === 'success' && appointment) {
    return (
      <section className="booking-success-page">
        <article className="booking-success-card">
          <div className="success-check">✓</div>
          <h1>Đặt lịch thành công!</h1>
          <div className="success-ticket-head">
          <div>
            <span>STT</span>
            <strong>{appointment.number}</strong>
          </div>
        </div>
          <div className="success-doctor-row">
            <div className="doctor-avatar booking-avatar">
              {doctor.image ? <img src={anh_bac_si(doctor)} alt={doctor.name} /> : <span>{doctor.initials}</span>}
            </div>
            <div>
              <h3>{appointment.doctorShortName}</h3>
              <p>{appointment.address}</p>
            </div>
          </div>

          <PhieuKhamChiTiet appointment={appointment} />

          <div className="success-actions">
            <button type="button" onClick={() => setScreen('account')}>Xem phiếu khám</button>
            <button type="button" onClick={() => tai_anh_phieu(appointment)}>Lưu lại phiếu</button>
          </div>
        </article>
      </section>
    );
  }

  const renderDoctorSummary = () => (
    <div className="booking-doctor-summary">
      <div className="doctor-avatar booking-avatar">
        {doctor.image ? <img src={anh_bac_si(doctor)} alt={doctor.name} /> : <span>{doctor.initials}</span>}
      </div>
      <div>
        <h3>{doctor.name.replace(/^BS\. CK2\s|^PGS\. TS\. BS\s/, '')}</h3>
        <p>250 Đ. Nguyễn Xí, Bình Lợi Trung, Hồ Chí Minh</p>
      </div>
    </div>
  );

  const renderDatePicker = () => (
    <section className="quick-booking-block">
      <div className="booking-date-row">
        <button className="round-arrow" type="button">←</button>
        {dates.map((date) => (
          <button
            className={selectedDate.value === date.value ? 'active' : ''}
            key={date.value}
            type="button"
            onClick={() => setSelectedDate(date)}
          >
            <strong>{date.label}</strong>
            <span>{date.slots} khung giờ</span>
          </button>
        ))}
        <button className="round-arrow" type="button">→</button>
      </div>
      <div className="slot-title">☼ Buổi chiều</div>
      <div className="time-slot-grid">
        {timeSlots.map((slot) => (
          <button
            className={selectedTime === slot ? 'selected' : ''}
            key={slot}
            type="button"
            onClick={() => setSelectedTime(slot)}
          >
            {slot}
          </button>
        ))}
      </div>
    </section>
  );

  if (screen === 'booking') {
    return (
      <section className="booking-flow-page">
        <div className="booking-stepper">
          <span className={selectedTime ? 'done' : 'active'}>{selectedTime ? '✓' : '1'}</span>
          <p>Thời gian khám</p>
          {selectedTime && (
            <>
              <i />
              <span className="active">2</span>
              <p>Bệnh nhân</p>
            </>
          )}
        </div>
        <div className="booking-flow-grid">
          <div className="booking-left-panel">
            <div className="booking-collapse-title"><span>1</span> Ngày và giờ khám <b>⌄</b></div>
            {!selectedTime && renderDatePicker()}
            {selectedTime && (
              <>
                <div className="booking-collapse-title"><span>2</span> Hồ sơ bệnh nhân <b>⌄</b></div>
                <div className="patient-card selected">
                  <div className="patient-avatar">{lay_ten_tat(patientName)}</div>
                  <div>
                    <strong>{patientName}</strong>
                    <p>09/08/2004</p>
                  </div>
                  <b>⌄</b>
                </div>
                <h3 className="optional-title">Thông tin bổ sung (không bắt buộc)</h3>
                <label className="booking-note">
                  Ghi chú
                  <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Triệu chứng, thuốc đang dùng, tiền sử, ..." />
                </label>
                <label
                  className="upload-box"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    addFiles(event.dataTransfer.files);
                  }}
                >
                  <input
                    accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                    multiple
                    type="file"
                    onChange={(event) => addFiles(event.target.files)}
                  />
                  <span><strong>Chọn tập tin</strong> hoặc kéo thả vào đây</span>
                  <small>.PNG, .JPG tối đa 15MB</small>
                </label>
                {uploadError && <p className="upload-error">{uploadError}</p>}
                {attachedFiles.length > 0 && (
                  <div className="upload-file-list">
                    {attachedFiles.map((file, index) => (
                      <div key={`${file.name}-${index}`}>
                        <span>{file.name}</span>
                        <small>{(file.size / 1024 / 1024).toFixed(2)}MB</small>
                        <button type="button" onClick={() => removeFile(index)}>Xóa</button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <aside className="booking-side-card">
            <h2>Thông tin đặt khám <span>⌃</span></h2>
            {renderDoctorSummary()}
            {selectedTime && (
              <dl>
                <dt>Ngày khám</dt><dd>{selectedDate.display}</dd>
                <dt>Khung giờ</dt><dd>{selectedTime}</dd>
                <dt>Bệnh nhân</dt><dd>{patientName}</dd>
              </dl>
            )}
            <button type="button" disabled={!selectedTime || isLoading} onClick={selectedTime ? handleConfirmBooking : undefined}>
              {selectedTime ? (isLoading ? 'Đang đặt lịch...' : 'Đặt lịch') : 'Xác nhận đặt khám'}
            </button>
            <p>Bằng cách nhấn nút xác nhận, bạn đã đồng ý với các điều khoản và điều kiện đặt khám</p>
            {message && <div className="booking-message">{message}</div>}
          </aside>
        </div>
      </section>
    );
  }

  return (
    <section className="doctor-detail-page">
      <div className="breadcrumb">Trang chủ <span>/</span> Bác sĩ</div>
      <article className="doctor-profile-card">
        <div className="doctor-avatar profile-avatar">
          {doctor.image ? <img src={anh_bac_si(doctor)} alt={doctor.name} /> : <span>{doctor.initials}</span>}
        </div>
        <div className="doctor-profile-info">
          <button className="favorite-button" type="button">♡ Yêu thích</button>
          <h1>{doctor.name}</h1>
          <p><strong>💙 Bác sĩ</strong><span />26 năm kinh nghiệm</p>
          <dl>
            <dt>Chuyên khoa</dt><dd>{doctor.specialty}</dd>
            <dt>Chức vụ</dt><dd>Phó Giám Đốc {doctor.workplace}</dd>
            <dt>Nơi công tác</dt><dd>{doctor.workplace}</dd>
          </dl>
        </div>
        <div className="quick-booking-area">
          <h2>Đặt khám nhanh <span>⌃</span></h2>
          {renderDatePicker()}
        </div>
        <div className="sticky-booking-bar">
          <p>Hỗ trợ đặt khám<br /><strong>1900-2805</strong></p>
          <button type="button" onClick={() => setScreen('booking')}>ĐẶT KHÁM NGAY</button>
        </div>
      </article>
      <article className="doctor-info-content">
        <h2>Giới thiệu</h2>
        <p>{doctor.name} hiện đang công tác tại {doctor.workplace}. Bác sĩ trực tiếp thăm khám theo yêu cầu chất lượng cao và hỗ trợ theo dõi lịch khám rõ ràng.</p>
        <strong>Các dịch vụ của phòng khám {doctor.specialty}:</strong>
        <ul>
          <li>Khám và điều trị các bệnh lý chuyên khoa.</li>
          <li>Tư vấn sức khỏe, dinh dưỡng, chích ngừa và theo dõi phát triển.</li>
          <li>Xông khí dung và chăm sóc hô hấp.</li>
          <li>Vật lý trị liệu hô hấp.</li>
          <li>Thay băng, cắt chỉ và tái khám.</li>
        </ul>
        <h2>Chuyên khám</h2>
        <div className="map-card">
          <h3>Địa chỉ</h3>
          <p>250 Đ. Nguyễn Xí, Bình Lợi Trung, Hồ Chí Minh</p>
          <button type="button">🗺 Mở bản đồ</button>
        </div>
        <h2>Quá trình đào tạo</h2>
        <ul>
          <li>Tốt nghiệp Đại học Y khoa Phạm Ngọc Thạch.</li>
          <li>2001: Tốt nghiệp Chuyên Khoa 1 tại Đại học Y Dược TP.HCM.</li>
          <li>Tốt nghiệp Chuyên Khoa 2 tại Đại học Y Khoa Phạm Ngọc Thạch.</li>
        </ul>
        <h2>Kinh nghiệm</h2>
        <p>{doctor.name} công tác tại {doctor.workplace}.</p>
      </article>
    </section>
  );
}

export default TrangDatLichBacSi;
