import { useEffect, useRef, useState } from 'react';
import { catalogCacheKey } from '../../lib/catalog';

const clinicToday = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const blank = kind => ({ homepageFeatured: true, homepageOrder: 100, kind, name: '', birthDate: '', title: '', specialtyId: '', contactEmail: '', contactPhone: '', image: '', intro: '', workplace: '', yearsExperience: '', consultationFee: '', education: '', expertise: '', licenseNumber: '', isActive: true, isDemo: false });
const formatFee = value => value == null || value === '' ? 'Ch\u01B0a c\u1EA5u h\u00ECnh' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(value));

export default function ClinicCatalog({ request, uploadImage, onSaved }) {
  const [data, setData] = useState({ doctors: [], specialties: [] });
  const [form, setForm] = useState(blank('doctor'));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState('');
  const [imageFileName, setImageFileName] = useState('');
  const [imageLoading, setImageLoading] = useState(false);
  const imageInputRef = useRef(null);
  const imageReaderRef = useRef(null);
  const clearImageSelection = () => {
    imageReaderRef.current?.abort();
    imageReaderRef.current = null;
    if (imageInputRef.current) imageInputRef.current.value = '';
    setImageDataUrl(''); setImageFileName(''); setImageLoading(false);
  };
  const resetForm = kind => { clearImageSelection(); setForm(blank(kind)); };
  const load = async () => { const result = await request(); setData(result); };
  useEffect(() => {
    let active = true;
    request().then(result => { if (active) setData(result); }).catch(error => { if (active) setMessage(error.message); });
    return () => {
      active = false;
      const reader = imageReaderRef.current;
      imageReaderRef.current = null;
      reader?.abort();
    };
  }, []);
  const change = (key, value) => setForm(current => ({ ...current, [key]: value }));
  const edit = (kind, item) => {
    clearImageSelection();
    setForm({ ...blank(kind), id: item.id, name: item.full_name || item.name, title: item.title || '',
      specialtyId: item.specialty_id || '', birthDate: item.birth_date || '', contactEmail: item.contact_email || '', contactPhone: item.contact_phone || '', image: item.avatar_url || item.image_url || '', intro: item.intro || '', workplace: item.workplace_text || '', yearsExperience: item.years_experience ?? '', education: item.education || '', expertise: item.expertise || '', licenseNumber: item.license_number || '',
      homepageFeatured: item.homepage_featured !== false, homepageOrder: item.homepage_order ?? 100, consultationFee: item.consultation_fee ?? '', isActive: item.is_active, isDemo: item.is_demo === true });
    document.getElementById('clinic-catalog-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return <section className="admin-card">
    <div className="admin-section-heading"><div><h2>Bác sĩ và chuyên khoa của phòng khám</h2><p>Quản lý dữ liệu MidHealth tại một nơi. Tạo chuyên khoa trước khi thêm bác sĩ.</p></div></div>
    <div className="clinic-staff-tabs"><button type="button" disabled={busy || imageLoading} aria-current={form.kind === 'doctor' ? 'page' : undefined} onClick={() => resetForm('doctor')}>Thêm bác sĩ</button><button type="button" disabled={busy || imageLoading} aria-current={form.kind === 'specialty' ? 'page' : undefined} onClick={() => resetForm('specialty')}>Thêm chuyên khoa</button></div>
    <form id="clinic-catalog-editor" className="clinic-form-grid" onSubmit={async event => {
      event.preventDefault(); if (busy || imageLoading) return; setBusy(true); setMessage('');
      try {
        const uploadedImage = imageDataUrl ? await uploadImage({ kind: form.kind, dataUrl: imageDataUrl }) : null;
        if (imageDataUrl && !uploadedImage?.url) throw new Error('Kho ảnh không trả về đường dẫn hợp lệ.');
        const image = uploadedImage?.url || form.image;
        await request({ ...form, image });
        resetForm(form.kind);
        try { sessionStorage.removeItem(catalogCacheKey); } catch {}
        window.dispatchEvent(new Event('midhealth:catalog-updated'));
        setMessage('Đã lưu danh mục phòng khám.');
        const refreshErrors = [];
        try { await onSaved(); } catch (refreshError) { refreshErrors.push(refreshError); }
        try { await load(); } catch (refreshError) { refreshErrors.push(refreshError); }
        if (refreshErrors.length) setMessage(`Đã lưu danh mục nhưng chưa tải mới được giao diện: ${refreshErrors[0].message}`);
      } catch (error) { setMessage(error.message); } finally { setBusy(false); }
    }}>
      <fieldset disabled={busy || imageLoading} className="admin-form-fieldset">
      <label>{form.kind === 'doctor' ? 'Họ tên bác sĩ' : 'Tên chuyên khoa'}<input required maxLength={160} value={form.name} onChange={e => change('name', e.target.value)} /></label>
      {form.kind === 'specialty' && <label>Phí khám mặc định (VNĐ)<input type="number" required min="0" max="100000000" step="1" value={form.consultationFee} onChange={e => change('consultationFee', e.target.value === '' ? '' : Number(e.target.value))} /><small>Áp dụng cho bác sĩ thuộc chuyên khoa nếu bác sĩ chưa có mức phí riêng.</small></label>}
      {form.kind === 'doctor' && <>
        <label>Ngày sinh<input required type="date" max={clinicToday()} value={form.birthDate} onChange={e => change('birthDate', e.target.value)} />{form.id && data.doctors.find(item => item.id === form.id)?.birth_date_estimated && <small>Ngày sinh tạm; cần kiểm tra và lưu lại ngày chính xác.</small>}</label>
        <label>Chuyên khoa<select required value={form.specialtyId} onChange={e => change('specialtyId', e.target.value)}><option value="">Chọn chuyên khoa</option>{data.specialties.filter(item => item.is_active || item.id === form.specialtyId).map(item => <option key={item.id} value={item.id} disabled={!item.is_active}>{item.name}{!item.is_active ? ' · Đã ẩn' : ''}</option>)}</select></label>
        <label>Chức danh<input maxLength={100} value={form.title} onChange={e => change('title', e.target.value)} placeholder="Nhập theo hồ sơ chuyên môn" /></label>
        <label>Nơi công tác<input maxLength={160} value={form.workplace} onChange={e => change('workplace', e.target.value)} placeholder="MidHealth" /></label>
        <label>Số năm kinh nghiệm<input type="number" min="0" max="80" value={form.yearsExperience} onChange={e => change('yearsExperience', e.target.value)} /></label>
        <label>Đào tạo, bằng cấp<input maxLength={500} value={form.education} onChange={e => change('education', e.target.value)} /></label>
        <label>Lĩnh vực chuyên sâu<input maxLength={500} value={form.expertise} onChange={e => change('expertise', e.target.value)} /></label>
        <label>Số giấy phép hành nghề<input maxLength={100} value={form.licenseNumber} onChange={e => change('licenseNumber', e.target.value)} /></label>
        <label>Phí khám riêng (VNĐ)<input type="number" min="0" max="100000000" step="1" value={form.consultationFee} onChange={e => change('consultationFee', e.target.value)} /><small>Để trống để dùng phí mặc định của chuyên khoa.</small></label>
        <label>Ưu tiên trang chủ<input required type="number" min="0" max="10000" step="1" value={form.homepageOrder} onChange={e => change('homepageOrder', e.target.value === '' ? '' : Number(e.target.value))} /></label>
        <label>Email liên hệ bác sĩ<input type="email" maxLength={254} value={form.contactEmail} onChange={e => change('contactEmail', e.target.value)} placeholder="tenbacsi@example.com" /></label>
        <label>Số điện thoại liên hệ<input type="tel" inputMode="tel" maxLength={20} value={form.contactPhone} onChange={e => change('contactPhone', e.target.value)} placeholder="Nhập số điện thoại bác sĩ" /></label>
        <label className="clinic-featured-toggle"><input type="checkbox" checked={form.homepageFeatured} onChange={e => change('homepageFeatured', e.target.checked)} /><span>Hiển thị trên trang chủ</span></label><label>Loại hồ sơ<select value={String(form.isDemo)} onChange={e => change('isDemo', e.target.value === 'true')}><option value="false">Bác sĩ thực tế của phòng khám</option><option value="true">Dữ liệu mô phỏng MidHealth</option></select></label>
        <label className="clinic-form-wide">Giới thiệu<textarea maxLength={5000} rows={3} value={form.intro} onChange={e => change('intro', e.target.value)} /></label>
      </>}
      <label className="clinic-image-field"><span>Ảnh {form.kind === 'doctor' ? 'bác sĩ' : 'chuyên khoa'}</span>
        <input ref={imageInputRef} className="clinic-image-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || imageLoading} onChange={event => {
          const file = event.target.files?.[0];
          if (!file) return;
          imageReaderRef.current?.abort(); imageReaderRef.current = null; setImageLoading(false);
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setMessage('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.'); event.target.value = ''; return; }
          if (file.size > 4 * 1024 * 1024) { setMessage('Ảnh phải nhỏ hơn 4 MB.'); event.target.value = ''; return; }
          setImageDataUrl(''); setImageFileName('');
          const reader = new FileReader();
          imageReaderRef.current?.abort(); imageReaderRef.current = reader; setImageLoading(true); setMessage('');
          reader.onload = () => { if (imageReaderRef.current !== reader) return; imageReaderRef.current = null; setImageLoading(false); setImageDataUrl(String(reader.result || '')); setImageFileName(file.name); };
          reader.onerror = () => { if (imageReaderRef.current !== reader) return; imageReaderRef.current = null; setImageLoading(false); setMessage('Không thể đọc tệp ảnh.'); };
          reader.onabort = () => { if (imageReaderRef.current === reader) { imageReaderRef.current = null; setImageLoading(false); } };
          reader.readAsDataURL(file);
        }} />
        <span className="clinic-image-picker">
          {(imageDataUrl || form.image) ? <img className="clinic-image-preview" src={imageDataUrl || form.image} alt="Xem trước ảnh" /> : <span className="clinic-image-placeholder" aria-hidden="true">+</span>}
          <span className="clinic-image-copy"><strong>{imageLoading ? 'Đang đọc ảnh...' : imageFileName || (form.image ? 'Ảnh hiện tại' : 'Chọn ảnh từ máy')}</strong><span>{imageDataUrl || form.image ? 'Nhấn để thay ảnh' : 'Thêm ảnh đại diện cho hồ sơ'}</span></span>
        </span>
        <small>JPG, PNG hoặc WebP · tối đa 4 MB</small>
      </label>
      <label className="clinic-status-field">Hiển thị<select value={String(form.isActive)} onChange={e => change('isActive', e.target.value === 'true')}><option value="true">Đang hoạt động</option><option value="false">Tạm ẩn</option></select></label>
      <div className="clinic-actions"><button className="clinic-primary" disabled={busy || imageLoading}>{imageLoading ? 'Đang đọc ảnh...' : busy ? 'Đang lưu…' : form.id ? 'Lưu thay đổi' : 'Thêm mới'}</button>{form.id && <button className="clinic-secondary" type="button" disabled={busy || imageLoading} onClick={() => resetForm(form.kind)}>Hủy chỉnh sửa</button>}</div>
      </fieldset>
    </form>
    {message && <p className="clinic-alert" role="status">{message}</p>}
    <div className="clinic-admin-catalog-list"><h3>Đội ngũ bác sĩ · {data.doctors.length}</h3>
      {data.doctors.map(item => {
        const specialty = data.specialties.find(s => s.id === item.specialty_id);
        return <article key={item.id}><div><strong>{item.full_name}</strong><p>{specialty?.name || 'Chưa chọn chuyên khoa'} · {item.is_demo ? 'Mô phỏng' : 'Hồ sơ phòng khám'} · {item.is_active ? 'Đang hiển thị' : 'Đã ẩn'}</p><p>Ngày sinh: {item.birth_date || 'Chưa có'}{item.birth_date_estimated ? ' (tạm, cần xác nhận)' : ''} · Kinh nghiệm: {item.years_experience ?? 'Chưa có'} năm</p><p>Phí khám: {formatFee(item.consultation_fee ?? specialty?.consultation_fee)}</p><p>Trang chủ: {item.homepage_featured ? `Ưu tiên ${item.homepage_order ?? 100}` : 'Không hiển thị'}</p>{(item.contact_email || item.contact_phone) && <p>{[item.contact_email, item.contact_phone].filter(Boolean).join(' · ')}</p>}</div><button className="clinic-secondary" disabled={busy || imageLoading} onClick={() => edit('doctor', item)}>Chỉnh sửa</button></article>;
      })}
      {!data.doctors.length && <p>Chưa có bác sĩ. Thêm hồ sơ bằng biểu mẫu phía trên.</p>}
      <h3>Chuyên khoa · {data.specialties.length}</h3>
      {data.specialties.map(item => <article key={item.id}><div><strong>{item.name}</strong><p>{item.is_active ? 'Đang hiển thị' : 'Đã ẩn'} · Phí mặc định: {formatFee(item.consultation_fee)}</p></div><button className="clinic-secondary" disabled={busy || imageLoading} onClick={() => edit('specialty', item)}>Chỉnh sửa</button></article>)}
    </div>
  </section>;
}
