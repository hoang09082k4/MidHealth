import { catalogCacheKey } from '../../lib/catalog';
import { useEffect, useRef, useState } from 'react';
import { defaultClinic } from '../../lib/clinic';

function validWorkingTime(value = '') {
  const text = String(value).trim();
  if (/^(?:nghỉ|đóng cửa|24\s*\/\s*7)$/iu.test(text)) return true;
  const ranges = text.split(/\s*[,;/]\s*/);
  if (!ranges.length || ranges.some(range => !range)) return false;
  const intervals = ranges.map(range => {
    const match = range.match(/^(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    const [, startHour, startMinute, endHour, endMinute] = match;
    const start = Number(startHour) * 60 + Number(startMinute);
    const end = Number(endHour) * 60 + Number(endMinute);
    const validClock = (hour, minute, allowEndOfDay = false) => minute < 60 && (hour < 24 || (allowEndOfDay && hour === 24 && minute === 0));
    return validClock(Number(startHour), Number(startMinute)) && validClock(Number(endHour), Number(endMinute), true) && end > start ? { start, end } : null;
  });
  if (intervals.some(interval => !interval)) return false;
  intervals.sort((a, b) => a.start - b.start);
  return intervals.every((interval, index) => index === 0 || interval.start >= intervals[index - 1].end);
}

function validClinicHours(hours) {
  if (!Array.isArray(hours) || hours.length > 14) return false;
  const labels = new Set();
  for (const item of hours) {
    if (!item || typeof item.label !== 'string' || typeof item.time !== 'string' || !item.label.trim() || item.label.trim().length > 100 || item.time.trim().length > 100 || !validWorkingTime(item.time)) return false;
    const label = item.label.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
    if (labels.has(label)) return false;
    labels.add(label);
  }
  return true;
}

export default function ClinicSettings({ profile, request, uploadImage, onSaved }) {
  const [form, setForm] = useState(() => ({ ...defaultClinic, ...profile,
    hours: Array.isArray(profile?.hours) ? profile.hours.map(hour => ({ label: String(hour?.label || ''), time: String(hour?.time || '') })) : [],
    socialLinks: Array.isArray(profile?.socialLinks) ? profile.socialLinks.map(link => ({ label: String(link?.label || ''), url: String(link?.url || '') })) : [],
  }));
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState(''), [logoFileName, setLogoFileName] = useState(''), [logoLoading, setLogoLoading] = useState(false);
  const logoReader = useRef(null);
  useEffect(() => () => logoReader.current?.abort(), []);
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  return <section className="admin-card clinic-settings-card"><div className="admin-section-heading"><div><h2>Thông tin phòng khám</h2><p>Thông tin này được dùng cho trang chủ, liên hệ và lịch khám mới. Để trống những nội dung chưa xác định.</p></div></div>
    <form className="clinic-form-grid clinic-settings-form" onSubmit={async event => {
      event.preventDefault(); if (busy || logoLoading) return; setMessage('');
      const phone = String(form.phone || '').trim();
      if (phone && (!/^\+?[\d\s().-]{9,20}$/.test(phone) || !/^\d{9,15}$/.test(phone.replace(/\D/g, '')))) {
        setMessage('Số điện thoại phòng khám chưa hợp lệ.'); return;
      }
      if (!validClinicHours(form.hours)) {
        setMessage('Mỗi ngày chỉ khai báo một lần; giờ mở cửa không được chồng lấn. Nhập giờ hợp lệ hoặc ghi “Nghỉ” / “24/7”.'); return;
      }
      if (form.socialLinks.some(link => !link.label?.trim() || !/^https:\/\//i.test(link.url || ''))) {
        setMessage('Mỗi liên kết mạng xã hội cần có tên và địa chỉ HTTPS hợp lệ.'); return;
      }
      setBusy(true);
      try {
        const uploadedImage = logoDataUrl ? await uploadImage({ kind: 'clinic-logo', dataUrl: logoDataUrl }) : null;
        if (logoDataUrl && !uploadedImage?.url) throw new Error('Kho ảnh không trả về đường dẫn logo hợp lệ.');
        const logo = uploadedImage?.url || form.logo;
        const payload = { ...form, logo };
        const result = await request(payload);
        setForm(current => ({ ...current, ...(result?.data || {}), logo }));
        setLogoDataUrl(''); setLogoFileName('');
        const logoInput = document.getElementById('clinic-logo-upload'); if (logoInput) logoInput.value = '';
        window.dispatchEvent(new CustomEvent('midhealth:clinic-updated', { detail: result?.data || payload }));
        try { sessionStorage.removeItem(catalogCacheKey); } catch {}
        setMessage('Đã lưu thông tin phòng khám.');
        try { await onSaved(); }
        catch (error) { setMessage(`Đã lưu thông tin nhưng chưa tải lại được dữ liệu: ${error.message}`); }
      } catch (error) { setMessage(error.message); } finally { setBusy(false); }
      }}>
      <fieldset disabled={busy || logoLoading} className="admin-form-fieldset">
      {[['name', 'Tên phòng khám'], ['address', 'Địa chỉ'], ['phone', 'Điện thoại'], ['email', 'Email']].map(([key, label]) => <label key={key}>{label}<input required={key === 'name'} maxLength={key === 'name' ? 160 : key === 'email' ? 254 : 500} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} inputMode={key === 'phone' ? 'tel' : undefined} value={form[key] || ''} onChange={event => change(key, event.target.value)} /></label>)}
      <div className="clinic-logo-field">
        <label htmlFor="clinic-logo-upload">Logo phòng khám</label>
        <div className="clinic-logo-picker">
          {logoDataUrl || (form.logo && form.logo !== defaultClinic.logo)
            ? <img src={logoDataUrl || form.logo} alt="Xem trước logo phòng khám" onError={event => { event.currentTarget.src = defaultClinic.logo; }} />
            : <span className="clinic-logo-default-preview"><span className="logo-word logo-word-blue">Mid</span><span className="logo-word logo-word-green">Health</span></span>}
          <div className="clinic-logo-picker-content">
            <strong>{logoFileName || (form.logo !== defaultClinic.logo ? 'Logo đang sử dụng' : 'Logo MidHealth mặc định')}</strong>
            <span>Ảnh sẽ xuất hiện tại phần nhận diện thương hiệu trên website.</span>
            <input id="clinic-logo-upload" className="clinic-logo-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || logoLoading} onChange={event => {
              const file = event.target.files?.[0];
              if (!file) return;
              logoReader.current?.abort();
              if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setMessage('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.'); event.target.value = ''; return; }
              if (file.size > 4 * 1024 * 1024) { setMessage('Ảnh logo phải nhỏ hơn 4 MB.'); event.target.value = ''; return; }
              setLogoDataUrl(''); setLogoFileName(''); setLogoLoading(true); setMessage('');
              const reader = new FileReader(); logoReader.current = reader;
              reader.onload = () => { if (logoReader.current !== reader) return; logoReader.current = null; setLogoDataUrl(String(reader.result || '')); setLogoFileName(file.name); setLogoLoading(false); };
              reader.onerror = () => { if (logoReader.current !== reader) return; logoReader.current = null; setLogoLoading(false); setMessage('Không thể đọc tệp logo.'); };
              reader.onabort = () => { if (logoReader.current === reader) { logoReader.current = null; setLogoLoading(false); } };
              reader.readAsDataURL(file);
            }} />
            <label className="clinic-logo-file-button" htmlFor="clinic-logo-upload">{logoLoading ? 'Đang đọc ảnh…' : 'Chọn ảnh logo'}</label>
          </div>
        </div>
        <small>JPG, PNG hoặc WebP · tối đa 4 MB. Ảnh sẽ được tải lên khi lưu biểu mẫu.</small>
        {logoDataUrl && <button className="clinic-logo-reset" type="button" disabled={busy || logoLoading} onClick={() => { setLogoDataUrl(''); setLogoFileName(''); const input = document.getElementById('clinic-logo-upload'); if (input) input.value = ''; }}>Bỏ ảnh vừa chọn</button>}
        {!logoDataUrl && form.logo !== defaultClinic.logo && <button className="clinic-logo-reset" type="button" disabled={busy || logoLoading} onClick={() => change('logo', defaultClinic.logo)}>Khôi phục logo MidHealth</button>}
      </div>
      <label>Giới thiệu<textarea maxLength={5000} rows="4" value={form.intro || ''} onChange={event => change('intro', event.target.value)} /></label>
      <label>Tỷ lệ tiền cọc (%)<input type="number" required min="1" max="100" step="1" value={form.depositPercent ?? 30} onChange={event => change('depositPercent', Number(event.target.value))} /><small className="clinic-settings-help">Tỷ lệ này dùng để tính tiền cọc hiển thị khi đặt lịch.</small></label>
      <fieldset className="clinic-form-wide">
        <legend>Giờ mở cửa phòng khám</legend>
        {form.hours.map((hour, index) => <div className="clinic-hours-row" key={index}><input required maxLength={100} aria-label="Ngày mở cửa" placeholder="Thứ 2 - Thứ 6" value={hour.label || ''} onChange={event => change('hours', form.hours.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} /><input required maxLength={100} aria-label="Khung giờ mở cửa" placeholder="07:30 - 12:00, 13:30 - 17:00" value={hour.time || ''} onChange={event => change('hours', form.hours.map((item, i) => i === index ? { ...item, time: event.target.value } : item))} /><button type="button" onClick={() => change('hours', form.hours.filter((_, i) => i !== index))}>Xóa</button></div>)}
        <button type="button" disabled={form.hours.length >= 14} onClick={() => change('hours', [...form.hours, { label: '', time: '' }])}>Thêm giờ mở cửa</button>
        <p className="clinic-settings-help">Đây là giờ mở cửa chung hiển thị trên website. Lịch hẹn và khung giờ của từng bác sĩ được quản lý riêng tại mục Lịch làm việc.</p>
      </fieldset>
      <fieldset className="clinic-form-wide">
        <legend>Liên kết mạng xã hội</legend>
        {form.socialLinks.map((link, index) => <div className="clinic-hours-row" key={index}><input required maxLength={100} aria-label="Tên kênh" placeholder="Tên kênh" value={link.label || ''} onChange={event => change('socialLinks', form.socialLinks.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} /><input required type="url" pattern="https://.+" maxLength={500} aria-label="Đường dẫn HTTPS" placeholder="https://example.com" value={link.url || ''} onChange={event => change('socialLinks', form.socialLinks.map((item, i) => i === index ? { ...item, url: event.target.value } : item))} /><button type="button" onClick={() => change('socialLinks', form.socialLinks.filter((_, i) => i !== index))}>Xóa</button></div>)}
        <button type="button" disabled={form.socialLinks.length >= 8} onClick={() => change('socialLinks', [...form.socialLinks, { label: '', url: '' }])}>Thêm liên kết</button>
        <p className="clinic-settings-help">Các kênh này được hiển thị ở chân trang website. Chỉ nhập đường dẫn HTTPS chính thức của phòng khám.</p>
      </fieldset>
      </fieldset>
      <button className="clinic-primary" disabled={busy || logoLoading}>{logoLoading ? 'Đang đọc logo...' : busy ? 'Đang lưu...' : 'Lưu thông tin'}</button>
    </form>{message && <p role="status">{message}</p>}
  </section>;
}
