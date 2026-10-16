import { createContext, useContext } from 'react';

export const defaultClinic = {
  name: 'MidHealth', intro: '', address: '', phone: '', email: 'cskh@midhealth.vn',
  logo: '/image_chung/favicon.svg', hours: [], socialLinks: [], timezone: 'Asia/Ho_Chi_Minh', depositPercent: 30,
};
export const ClinicContext = createContext(defaultClinic);
export const useClinic = () => useContext(ClinicContext);

export function ClinicContact() {
  const clinic = useClinic();
  return <div className="clinic-contact-grid">
    <div><h3>Địa chỉ phòng khám</h3><p>{clinic.address || 'Địa chỉ đang được cập nhật.'}</p>
      {clinic.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clinic.address)}`} target="_blank" rel="noreferrer">Xem đường đi</a>}</div>
    <div><h3>Liên hệ</h3>{clinic.phone ? <p><a href={`tel:${clinic.phone.replace(/[^+\d]/g, '')}`}>{clinic.phone}</a></p> : <p>Số điện thoại đang được cập nhật.</p>}
      {clinic.email && <a href={`mailto:${clinic.email}`}>{clinic.email}</a>}</div>
    <div><h3>Giờ làm việc</h3>{clinic.hours?.length ? clinic.hours.map((hour, index) => <p key={index}>{hour.label}: {hour.time}</p>) : <p>Giờ làm việc đang được cập nhật. Xem lịch bác sĩ để chọn khung giờ đã mở.</p>}</div>
  </div>;
}
