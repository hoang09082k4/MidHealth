import { useCallback, useEffect, useMemo, useState } from 'react';
import { firebaseAuth } from '../../lib/firebase';
import { fetchCatalog } from '../../lib/catalog';
import {
  WorkspaceBrand,
  WorkspaceDashboard,
  getRoleLabel,
  getStatusLabel,
} from './giao_dien_lam_viec';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
const WORKSPACE_DRAFT_STORAGE_KEY = 'midhealth_provider_workspace_drafts';
const DOCTOR_TITLE_OPTIONS = [
  { value: 'BS', label: 'BS - Bác sĩ' },
  { value: 'BS.CKI', label: 'BS.CKI - Bác sĩ Chuyên khoa I' },
  { value: 'BS.CKII', label: 'BS.CKII - Bác sĩ Chuyên khoa II' },
  { value: 'ThS.BS', label: 'ThS.BS - Thạc sĩ, Bác sĩ' },
  { value: 'TS.BS', label: 'TS.BS - Tiến sĩ, Bác sĩ' },
  { value: 'PGS.TS.BS', label: 'PGS.TS.BS - Phó Giáo sư, Tiến sĩ, Bác sĩ' },
  { value: 'GS.TS.BS', label: 'GS.TS.BS - Giáo sư, Tiến sĩ, Bác sĩ' },
];

function normalizeDoctorTitle(value = '') {
  const normalized = String(value).trim().replace(/\s+/g, '').toUpperCase();
  const aliases = {
    BS: 'BS',
    'BS.CK1': 'BS.CKI',
    'BS.CKI': 'BS.CKI',
    'BS.CK2': 'BS.CKII',
    'BS.CKII': 'BS.CKII',
    'THS.BS': 'ThS.BS',
    'TS.BS': 'TS.BS',
    'PGS.TS.BS': 'PGS.TS.BS',
    'GS.TS.BS': 'GS.TS.BS',
  };
  return aliases[normalized] || '';
}

function saveWorkspaceDraft(draft) {
  try {
    const drafts = JSON.parse(window.localStorage.getItem(WORKSPACE_DRAFT_STORAGE_KEY) || '[]');
    const nextDrafts = [draft, ...drafts.filter((item) => item.uid !== draft.uid)];
    window.localStorage.setItem(WORKSPACE_DRAFT_STORAGE_KEY, JSON.stringify(nextDrafts.slice(0, 10)));
  } catch {
    // Draft local chỉ là tiện ích, không bắt buộc để gửi hồ sơ.
  }
}

async function getAuthHeaders() {
  const user = firebaseAuth.currentUser;
  const token = user ? await user.getIdToken(true) : '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function saveProviderWorkspaceApi(payload) {
  const response = await fetch(`${apiBaseUrl}/api/provider/workspace`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Không thể lưu hồ sơ đối tác.');
  return data.data;
}

async function fetchProviderOperationsApi() {
  const response = await fetch(`${apiBaseUrl}/api/provider/workspace/operations`, {
    headers: await getAuthHeaders(),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Không thể tải dữ liệu vận hành.');
  return data.data;
}

async function patchProviderAppointmentStatusApi(appointmentId, status) {
  const response = await fetch(`${apiBaseUrl}/api/provider/workspace/appointments/${encodeURIComponent(appointmentId)}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Không thể cập nhật lịch hẹn.');
  return data.data;
}

async function saveProviderSlotApi(payload) {
  const response = await fetch(`${apiBaseUrl}/api/provider/workspace/slots`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Không thể lưu khung giờ.');
  return data.data;
}

async function patchProviderSlotApi(slotId, payload) {
  const response = await fetch(`${apiBaseUrl}/api/provider/workspace/slots/${encodeURIComponent(slotId)}`, {
    method: 'PATCH',
    headers: await getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Không thể cập nhật khung giờ.');
  return data.data;
}

function trimWorkspaceData(formData) {
  return {
    clinicName: formData.clinicName.trim(),
    clinicAddress: formData.clinicAddress.trim(),
    taxCode: formData.taxCode.trim(),
    doctorTitle: formData.doctorTitle.trim(),
    specialty: formData.specialty.trim(),
  };
}

function specialtyName(item) {
  return typeof item === 'string' ? item.trim() : String(item?.name || item?.title || '').trim();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Không thể đọc ảnh.'));
    reader.readAsDataURL(file);
  });
}

function buildPreviewTitle({ mode, formData, account }) {
  if (mode === 'clinic') return formData.clinicName || 'Tên phòng khám';
  if (mode === 'doctor') return `${formData.doctorTitle ? `${formData.doctorTitle} ` : ''}${account.name || 'Tên bác sĩ'}`;
  return 'Chọn hình thức hoạt động';
}

function buildPreviewSubtitle({ mode, formData }) {
  if (mode === 'clinic') return formData.clinicAddress || 'Địa chỉ phòng khám';
  if (mode === 'doctor') return formData.specialty || 'Chuyên khoa tư vấn';
  return 'Thông tin xem trước sẽ thay đổi theo lựa chọn của bạn.';
}

function TrangThietLap({ account, initialWorkspace, onComplete, onCancelEdit, onLogout, onHome }) {
  const [mode, setMode] = useState(initialWorkspace?.mode || '');
  const [logoPreview, setLogoPreview] = useState(initialWorkspace?.imageUrl || '');
  const [setupMessage, setSetupMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [specialtyOptions, setSpecialtyOptions] = useState([]);
  const [isLoadingSpecialties, setIsLoadingSpecialties] = useState(false);
  const [specialtySearch, setSpecialtySearch] = useState('');
  const [formData, setFormData] = useState({
    clinicName: initialWorkspace?.clinicName || '',
    clinicAddress: initialWorkspace?.clinicAddress || '',
    taxCode: initialWorkspace?.taxCode || '',
    doctorTitle: normalizeDoctorTitle(initialWorkspace?.doctorTitle) || 'BS',
    specialty: initialWorkspace?.specialty || '',
  });

  const isEditing = Boolean(initialWorkspace?.id || initialWorkspace?.firebaseUid);
  const isApprovedWorkspace = initialWorkspace?.status === 'approved';
  const previewTitle = buildPreviewTitle({ mode, formData, account });
  const previewSubtitle = buildPreviewSubtitle({ mode, formData });
  const roleLabel = getRoleLabel(mode);
  const filteredSpecialties = useMemo(() => {
    const keyword = specialtySearch.trim().toLocaleLowerCase('vi');
    if (!keyword) return specialtyOptions;
    return specialtyOptions.filter((specialty) => specialty.toLocaleLowerCase('vi').includes(keyword));
  }, [specialtyOptions, specialtySearch]);

  const canSubmit = useMemo(() => {
    const clean = trimWorkspaceData(formData);
    if (mode === 'clinic') return Boolean(clean.clinicName && clean.clinicAddress);
    if (mode === 'doctor') return Boolean(clean.doctorTitle && clean.specialty);
    return false;
  }, [formData, mode]);

  useEffect(() => {
    if (!account?.uid) return;
    saveWorkspaceDraft({
      uid: account.uid,
      email: account.email,
      ownerName: account.name,
      ownerPhone: account.phone,
      mode,
      providerRole: mode,
      ...trimWorkspaceData(formData),
      status: 'draft',
      updatedAt: new Date().toISOString(),
    });
  }, [account, formData, mode]);

  useEffect(() => async () => {
    if (logoPreview && logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setLogoPreview(dataUrl);
      setSetupMessage('Ảnh đã sẵn sàng để lưu vào hồ sơ. Khi bấm cập nhật, ảnh sẽ được ghi vào Supabase.');
    } catch (error) {
      setSetupMessage(error.message || 'Không thể đọc ảnh đã chọn.');
    }
    return;

    if (logoPreview && logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  useEffect(() => {
    let ignore = false;
    async function loadSpecialties() {
      setIsLoadingSpecialties(true);
      try {
        const catalog = await fetchCatalog();
        if (!ignore) {
          const names = (catalog.specialties || [])
            .map(specialtyName)
            .filter(Boolean);
          setSpecialtyOptions(Array.from(new Set(names)));
        }
      } catch {
        if (!ignore && formData.specialty) setSpecialtyOptions([formData.specialty]);
      } finally {
        if (!ignore) setIsLoadingSpecialties(false);
      }
    }

    loadSpecialties();
    return () => {
      ignore = true;
    };
  }, []);

  const updateLogo = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setSetupMessage('Chỉ hỗ trợ ảnh .png hoặc .jpeg.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setSetupMessage('Ảnh đại diện cần nhỏ hơn hoặc bằng 5MB.');
      return;
    }

    if (logoPreview && logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    const dataUrl = await fileToDataUrl(file);
    setLogoPreview(dataUrl);
    setSetupMessage('Ảnh đang ở chế độ xem trước. MidHealth sẽ bổ sung bước tải ảnh chính thức sau khi hồ sơ được duyệt.');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!mode) {
      setSetupMessage('Vui lòng chọn hình thức hoạt động trước khi gửi kiểm duyệt.');
      return;
    }

    if (!canSubmit) {
      setSetupMessage(mode === 'clinic' ? 'Vui lòng nhập tên và địa chỉ phòng khám.' : 'Vui lòng nhập chuyên khoa chính của bác sĩ.');
      return;
    }

    if (mode === 'doctor' && !DOCTOR_TITLE_OPTIONS.some((item) => item.value === formData.doctorTitle)) {
      setSetupMessage('Vui lòng chọn danh xưng chuyên môn trong danh sách chuẩn.');
      return;
    }

    setIsSaving(true);
    setSetupMessage('');

    try {
      const clean = trimWorkspaceData(formData);
      const workspace = await saveProviderWorkspaceApi({
        email: account.email,
        ownerName: account.name,
        ownerPhone: account.phone,
        mode,
        providerRole: mode,
        ...clean,
        imageUrl: logoPreview && !logoPreview.startsWith('blob:') ? logoPreview : initialWorkspace?.imageUrl || '',
        status: isApprovedWorkspace ? 'approved' : 'pending_review',
      });
      onComplete(workspace);
    } catch (error) {
      setSetupMessage(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="dw-provider-profile-page refined">
      <header className="dw-profile-topbar">
        <WorkspaceBrand onHome={onHome} />
        <div>
          {isEditing ? <button className="dw-ghost-button" type="button" onClick={onCancelEdit}>Hủy sửa</button> : null}
          <button className="dw-ghost-button" type="button" onClick={onLogout}>Đổi tài khoản</button>
        </div>
      </header>

      <section className="dw-profile-hero">
        <div>
          <span>Hồ sơ đối tác</span>
          <h1>{isEditing ? 'Cập nhật hồ sơ vận hành' : 'Thiết lập hồ sơ bác sĩ hoặc phòng khám'}</h1>
          <p>Đây là trang riêng để xác minh thông tin chuyên môn trước khi mở workspace. Dữ liệu tại đây sẽ được ghi vào Supabase và liên kết với catalog bác sĩ/phòng khám.</p>
        </div>
        <aside>
          <strong>{account.email}</strong>
          <small>Tài khoản đối tác đã xác thực</small>
        </aside>
      </section>

      <section className="dw-profile-layout">
        <aside className="dw-profile-steps">
          {[
            ['01', 'Chọn mô hình', 'Bác sĩ độc lập hoặc phòng khám.'],
            ['02', 'Nhập thông tin', 'Thông tin công khai để kiểm duyệt.'],
            ['03', 'Gửi kiểm duyệt', 'Backend tạo liên kết vận hành trong Supabase.'],
          ].map(([index, title, text]) => (
            <article key={index} className={mode ? 'active' : ''}>
              <span>{index}</span>
              <div>
                <strong>{title}</strong>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </aside>

        <form className="dw-profile-form" onSubmit={submit}>
          <div className="dw-form-title-row">
            <div>
              <h2>{account.name}</h2>
              <p>Hoàn thiện hồ sơ để MidHealth mở các chức năng lịch hẹn, khung giờ và báo cáo.</p>
            </div>
          </div>

          <fieldset>
            <legend>Hình thức hoạt động</legend>
            <div className="dw-choice-grid">
              <button type="button" className={mode === 'clinic' ? 'active' : ''} onClick={() => setMode('clinic')}>
                <b>Có phòng khám</b>
                <span>Quản lý dịch vụ, lịch hẹn, khung giờ và báo cáo vận hành phòng khám.</span>
              </button>
              <button type="button" className={mode === 'doctor' ? 'active' : ''} onClick={() => setMode('doctor')}>
                <b>Bác sĩ độc lập</b>
                <span>Quản lý hồ sơ chuyên môn, lịch hẹn cá nhân và tư vấn trực tuyến.</span>
              </button>
            </div>
          </fieldset>

          <div className="dw-upload-row">
            <div className="dw-upload-box" aria-hidden="true">
              {logoPreview ? <img src={logoPreview} alt="" /> : <span>Ảnh</span>}
            </div>
            <label className="dw-upload-button">
              Xem trước ảnh
              <input type="file" accept="image/png,image/jpeg" onChange={updateLogo} />
            </label>
            <span>.png, .jpeg, tối đa 5MB</span>
          </div>
          {setupMessage ? <p className={setupMessage.includes('xem trước') ? 'dw-form-alert neutral' : 'dw-form-alert'}>{setupMessage}</p> : null}

          {!mode ? (
            <div className="dw-setup-empty">Chọn một hình thức hoạt động để hiển thị form phù hợp.</div>
          ) : mode === 'clinic' ? (
            <>
              <label>
                Tên phòng khám <span>*</span>
                <input value={formData.clinicName} onChange={(event) => setFormData({ ...formData, clinicName: event.target.value })} placeholder="Nhập tên phòng khám" required />
              </label>
              <label>
                Địa chỉ phòng khám <span>*</span>
                <input value={formData.clinicAddress} onChange={(event) => setFormData({ ...formData, clinicAddress: event.target.value })} placeholder="Nhập địa chỉ hoạt động" required />
              </label>
              <label>
                Mã số thuế / mã KCB
                <input value={formData.taxCode} onChange={(event) => setFormData({ ...formData, taxCode: event.target.value })} placeholder="Nhập nếu có" />
              </label>
            </>
          ) : (
            <div className="dw-doctor-only">
              <label className="dw-doctor-title-field">
                Danh xưng chuyên môn <span>*</span>
                <select value={formData.doctorTitle} onChange={(event) => setFormData({ ...formData, doctorTitle: event.target.value })} required>
                  {DOCTOR_TITLE_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>{option.label}</option>
                  ))}
                </select>
                <small>Thứ tự hiển thị chuẩn: học hàm, học vị/chuyên khoa, sau cùng là bác sĩ.</small>
              </label>
              <div className="dw-selected-specialty">
                <span>Chuyên khoa chính *</span>
                <strong>{formData.specialty || 'Chưa chọn chuyên khoa'}</strong>
                <small>Chọn một mục trong danh sách bên dưới để tránh sai tên chuyên khoa.</small>
              </div>
            </div>
          )}

          {mode === 'doctor' ? (
            <div className="dw-specialty-section">
              <div className="dw-specialty-heading">
                <div>
                  <strong>Danh sách chuyên khoa</strong>
                  <p>Chọn một chuyên khoa chính từ danh mục đang hoạt động.</p>
                </div>
                <span>{specialtyOptions.length} chuyên khoa</span>
              </div>
              <input
                className="dw-specialty-search"
                type="search"
                value={specialtySearch}
                onChange={(event) => setSpecialtySearch(event.target.value)}
                placeholder="Tìm chuyên khoa, ví dụ: Tim mạch"
                aria-label="Tìm chuyên khoa"
              />
              <div className="dw-specialty-checklist" role="radiogroup" aria-label="Chọn chuyên khoa chính">
                {isLoadingSpecialties ? <span className="dw-specialty-loading">Đang tải chuyên khoa...</span> : null}
                {(filteredSpecialties.length ? filteredSpecialties : specialtyOptions.length ? [] : formData.specialty ? [formData.specialty] : []).map((specialty) => (
                  <label key={specialty} className={formData.specialty === specialty ? 'active' : ''}>
                    <input
                      type="radio"
                      name="provider-specialty-checklist"
                      value={specialty}
                      checked={formData.specialty === specialty}
                      onChange={() => setFormData({ ...formData, specialty })}
                    />
                    <span>{specialty}</span>
                  </label>
                ))}
                {!isLoadingSpecialties && specialtyOptions.length > 0 && filteredSpecialties.length === 0 ? (
                  <div className="dw-specialty-empty">Không tìm thấy chuyên khoa phù hợp.</div>
                ) : null}
              </div>
            </div>
          ) : null}

          <button type="submit" disabled={!canSubmit || isSaving}>
            {isSaving ? 'Đang lưu...' : isApprovedWorkspace ? 'Cập nhật hồ sơ' : 'Gửi kiểm duyệt'}
          </button>
        </form>
        <aside className="dw-profile-preview">
          <h2>Xem trước hồ sơ</h2>
          <p>Thông tin hiển thị sau khi được kiểm duyệt</p>
          <article>
            <div className="dw-upload-box small">
              {logoPreview ? <img src={logoPreview} alt="" /> : <span>Ảnh</span>}
            </div>
            <div>
              <span className="dw-role-badge">{roleLabel}</span>
              <h3>{previewTitle}</h3>
              <p>{previewSubtitle}</p>
              <p>Email: {account.email}</p>
            </div>
          </article>
          <div className="dw-profile-checklist">
            <strong>Điều kiện mở workspace</strong>
            <p>Hồ sơ hợp lệ, chuyên khoa rõ ràng, thông tin liên hệ có thể xác minh.</p>
            <p>Sau khi lưu, backend tạo/cập nhật bản ghi catalog trong Supabase.</p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function TrangLamViec({
  account,
  workspace,
  activeSection,
  operations,
  operationsMessage,
  isOperationsLoading,
  onNavigate,
  onEdit,
  onLogout,
  onHome,
  onRefresh,
  onAppointmentStatusChange,
  onSaveSlot,
  onToggleSlot,
}) {
  const displayName = workspace?.mode === 'doctor'
    ? `${workspace?.doctorTitle ? `${workspace.doctorTitle} ` : ''}${account.name}`
    : workspace?.clinicName || 'MidHealth Workspace';
  const statusLabel = getStatusLabel(workspace?.status);
  const roleLabel = getRoleLabel(workspace?.mode);

  return (
    <div className="dw-dashboard-page refined">
      <WorkspaceDashboard
        activeSection={activeSection}
        displayName={displayName}
        roleLabel={roleLabel}
        statusLabel={statusLabel}
        accountEmail={account.email}
        isOperationsLoading={isOperationsLoading}
        operationsMessage={operationsMessage}
        workspace={workspace}
        operations={operations}
        onNavigate={onNavigate}
        onEdit={onEdit}
        onLogout={onLogout}
        onHome={onHome}
        onRefresh={onRefresh}
        onAppointmentStatusChange={onAppointmentStatusChange}
        onSaveSlot={onSaveSlot}
        onToggleSlot={onToggleSlot}
      />
    </div>
  );
}

function KhuVucLamViec({
  account,
  workspace,
  initialWorkspace,
  hasWorkspace,
  activeSection,
  onNavigate,
  onComplete,
  onCancelEdit,
  onEdit,
  onLogout,
  onHome,
}) {
  const [operations, setOperations] = useState(null);
  const [operationsMessage, setOperationsMessage] = useState('');
  const [isOperationsLoading, setIsOperationsLoading] = useState(false);

  const loadOperations = useCallback(async () => {
    if (!hasWorkspace) {
      setOperations(null);
      setOperationsMessage('');
      return null;
    }

    setIsOperationsLoading(true);
    try {
      const data = await fetchProviderOperationsApi();
      setOperations(data);
      setOperationsMessage(data?.reason || '');
      return data;
    } catch (error) {
      setOperations(null);
      setOperationsMessage(error.message);
      return null;
    } finally {
      setIsOperationsLoading(false);
    }
  }, [hasWorkspace]);

  useEffect(() => {
    let isMounted = true;
    if (!hasWorkspace) {
      setOperations(null);
      setOperationsMessage('');
      return () => {
        isMounted = false;
      };
    }

    setIsOperationsLoading(true);
    fetchProviderOperationsApi()
      .then((data) => {
        if (!isMounted) return;
        setOperations(data);
        setOperationsMessage(data?.reason || '');
      })
      .catch((error) => {
        if (!isMounted) return;
        setOperations(null);
        setOperationsMessage(error.message);
      })
      .finally(() => {
        if (isMounted) setIsOperationsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [hasWorkspace, workspace?.id, workspace?.status]);

  const handleAppointmentStatusChange = async (appointmentId, status) => {
    setOperationsMessage('');
    await patchProviderAppointmentStatusApi(appointmentId, status);
    await loadOperations();
  };

  const handleSaveSlot = async (payload) => {
    setOperationsMessage('');
    await saveProviderSlotApi(payload);
    await loadOperations();
  };

  const handleToggleSlot = async (slotId, payload) => {
    setOperationsMessage('');
    await patchProviderSlotApi(slotId, payload);
    await loadOperations();
  };

  if (hasWorkspace) {
    return (
      <TrangLamViec
        account={account}
        workspace={workspace}
        operations={operations}
        operationsMessage={operationsMessage}
        isOperationsLoading={isOperationsLoading}
        activeSection={activeSection}
        onNavigate={onNavigate}
        onHome={onHome}
        onEdit={onEdit}
        onLogout={onLogout}
        onRefresh={loadOperations}
        onAppointmentStatusChange={handleAppointmentStatusChange}
        onSaveSlot={handleSaveSlot}
        onToggleSlot={handleToggleSlot}
      />
    );
  }

  return (
    <TrangThietLap
      account={account}
      onHome={onHome}
      initialWorkspace={initialWorkspace}
      onComplete={onComplete}
      onCancelEdit={onCancelEdit}
      onLogout={onLogout}
    />
  );
}

export default KhuVucLamViec;
