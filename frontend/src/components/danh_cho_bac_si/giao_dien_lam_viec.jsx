import { useMemo, useState } from 'react';
import BieuTuongLogo from '../dung_chung/bieu_tuong_logo';

const NAV_ITEMS_BY_MODE = {
  doctor: [
    { id: 'tong-quan', label: 'Tổng quan', icon: '01' },
    { id: 'lich-hen', label: 'Lịch hẹn', icon: '02' },
    { id: 'lich-lam-viec', label: 'Khung giờ', icon: '03' },
    { id: 'ho-so', label: 'Hồ sơ', icon: '04' },
    { id: 'tu-van', label: 'Tư vấn', icon: '05' },
    { id: 'bao-cao', label: 'Báo cáo', icon: '06' },
  ],
  clinic: [
    { id: 'tong-quan', label: 'Tổng quan', icon: '01' },
    { id: 'lich-hen', label: 'Lịch hẹn', icon: '02' },
    { id: 'lich-lam-viec', label: 'Khung giờ', icon: '03' },
    { id: 'dich-vu', label: 'Dịch vụ', icon: '04' },
    { id: 'ho-so', label: 'Hồ sơ', icon: '05' },
    { id: 'bao-cao', label: 'Báo cáo', icon: '06' },
  ],
};

const WORKSPACE_SECTIONS = new Set(
  Object.values(NAV_ITEMS_BY_MODE).flat().map((item) => item.id),
);

const STATUS_LABELS = {
  draft: 'Bản nháp',
  pending_review: 'Chờ kiểm duyệt',
  approved: 'Đã duyệt',
  rejected: 'Cần bổ sung',
};

const ROLE_LABELS = {
  clinic: 'Phòng khám',
  doctor: 'Bác sĩ độc lập',
};

const STATUS_BADGES = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  completed: 'Đã khám',
  cancelled: 'Đã hủy',
  no_show: 'Không đến',
};

const RISK_BADGES = {
  low: 'Rui ro thap',
  medium: 'Can theo doi',
  high: 'No-show',
};

function isWorkspaceSectionAllowed(mode, section) {
  return (NAV_ITEMS_BY_MODE[mode] || NAV_ITEMS_BY_MODE.doctor).some((item) => item.id === section);
}

function getRoleLabel(mode) {
  return ROLE_LABELS[mode] || ROLE_LABELS.doctor;
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.pending_review;
}

function WorkspaceBrand({ onHome }) {
  const content = (
    <>
      <BieuTuongLogo />
      <span>Workspace</span>
    </>
  );

  return onHome ? (
    <button className="dw-midhealth-brand" type="button" onClick={onHome} aria-label="Về trang chủ MidHealth">
      {content}
    </button>
  ) : (
    <div className="dw-midhealth-brand">{content}</div>
  );
}

function DashboardPreview() {
  return (
    <div className="dw-dashboard-preview" aria-hidden="true">
      <aside>
        <div className="dw-app-mark">M</div>
        <strong>MidHealth Workspace</strong>
        {['Tổng quan', 'Lịch hẹn', 'Khung giờ', 'Check-in', 'Báo cáo'].map((item, index) => (
          <span className={index === 0 ? 'active' : ''} key={item}>{item}</span>
        ))}
      </aside>
      <main>
        <div className="dw-preview-top">
          <h3>Vận hành đặt khám</h3>
          <span>Hôm nay</span>
        </div>
        <div className="dw-stat-row">
          <article><b>12</b><small>Lịch hẹn</small></article>
          <article><b>08</b><small>Xác nhận</small></article>
          <article><b>04</b><small>Cần xử lý</small></article>
        </div>
        <div className="dw-chart">
          {[36, 64, 48, 72, 42, 58, 30, 68].map((height, index) => (
            <i style={{ height: `${height}%` }} key={index} />
          ))}
        </div>
      </main>
    </div>
  );
}

function numberValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function todayValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getMetrics(operations, workspace) {
  const summary = operations?.summary || {};
  const locked = workspace?.status !== 'approved';
  return [
    { tone: 'blue', icon: '01', label: 'Lịch hôm nay', value: numberValue(summary.todayAppointments), note: locked ? 'Mở sau khi hồ sơ được duyệt' : 'Tổng số lượt khám trong ngày' },
    { tone: 'orange', icon: '!', label: 'Cần xác nhận', value: numberValue(summary.pendingAppointments), note: 'Ưu tiên xử lý các lịch mới' },
    { tone: 'green', icon: '03', label: 'Chỗ trống sắp tới', value: numberValue(summary.availableSlots), note: 'Tổng sức chứa còn lại trong 14 ngày' },
    { tone: 'violet', icon: '04', label: 'Đã check-in', value: numberValue(summary.checkedIn), note: 'Bệnh nhân đã vào quy trình khám' },
  ];
}

function EmptyState({ title, text, status }) {
  return (
    <section className="dw-workspace-empty">
      <div className={status === 'approved' ? 'ready' : 'locked'}>{status === 'approved' ? '0' : '!'}</div>
      <h2>{title}</h2>
      <p>{text}</p>
      <span>{getStatusLabel(status)}</span>
    </section>
  );
}

function ActivityFeed({ events = [] }) {
  if (!events.length) {
    return (
      <div className="dw-activity-empty">
        <strong>Chua co nhat ky</strong>
        <p>Cac thao tac duyet ho so, doi trang thai lich va cap nhat slot se hien thi tai day.</p>
      </div>
    );
  }

  return (
    <div className="dw-activity-feed">
      {events.slice(0, 8).map((event) => (
        <article key={event.id}>
          <span>{event.eventType}</span>
          <strong>{event.message}</strong>
          <p>{event.actorEmail || 'system'} · {new Date(event.createdAt).toLocaleString('vi-VN')}</p>
        </article>
      ))}
    </div>
  );
}

function OperationsOverview({ workspace, operations, onNavigate, onAppointmentStatusChange }) {
  const isApproved = workspace?.status === 'approved';
  const metrics = getMetrics(operations, workspace);
  const appointments = operations?.appointments || [];
  const reason = operations?.reason;

  return (
    <>
      <div className="dw-dashboard-heading compact">
        <div>
          <span>Tổng quan vận hành</span>
          <h1>{isApproved ? 'Công việc cần nắm hôm nay' : 'Hoàn thiện hồ sơ để mở workspace'}</h1>
          <p>{reason || 'Theo dõi lịch hẹn, khung giờ trống, check-in và hiệu suất khám từ dữ liệu backend.'}</p>
        </div>
        <button type="button" className="dw-primary-command" onClick={() => onNavigate('lich-hen')}>Quản lý lịch hẹn</button>
      </div>

      <section className="dw-metric-grid refined">
        {metrics.map((metric) => (
          <article className={`dw-metric-${metric.tone}`} key={metric.label}>
            <small>{metric.label}</small>
            <strong>{metric.value}</strong>
            <p>{metric.note}</p>
            <span className={metric.tone}>{metric.icon}</span>
          </article>
        ))}
      </section>

      <section className="dw-operations-grid refined">
        <article className="dw-today-panel">
          <header>
            <div>
              <span>Lịch gần nhất</span>
              <strong>{appointments.length ? `${appointments.length} lịch trong 14 ngày` : 'Chưa có lịch hẹn'}</strong>
            </div>
            <button type="button" onClick={() => onNavigate('lich-hen')}>Xem tất cả</button>
          </header>
          <AppointmentList
            appointments={appointments.slice(0, 5)}
            workspace={workspace}
            onStatusChange={onAppointmentStatusChange}
          />
        </article>

        <article className="dw-intake-panel">
          <header>
            <span>Trạng thái liên kết</span>
            <strong>{operations?.linked ? 'Đã nối dữ liệu backend' : 'Chưa liên kết catalog'}</strong>
          </header>
          <div className="dw-link-card">
            <b>{operations?.linkedDoctor?.name || operations?.linkedFacility?.name || 'Chưa tìm thấy hồ sơ liên kết'}</b>
            <p>{operations?.linkedDoctor?.specialty || operations?.linkedFacility?.address || reason || 'Backend đã sẵn sàng, cần liên kết workspace với danh mục bác sĩ/phòng khám để có dữ liệu.'}</p>
          </div>
          {['Xác nhận lịch mới', 'Kiểm tra thông tin bệnh nhân', 'Theo dõi slot trống', 'Cập nhật trạng thái khám'].map((step, index) => (
            <div className="dw-intake-step" key={step}>
              <i>{String(index + 1).padStart(2, '0')}</i>
              <span>{step}</span>
            </div>
          ))}
        </article>

        <article className="dw-activity-panel">
          <header>
            <span>Nhat ky van hanh</span>
            <strong>{operations?.activity?.length ? `${operations.activity.length} su kien gan day` : 'Chua co su kien'}</strong>
          </header>
          <ActivityFeed events={operations?.activity || []} />
        </article>
      </section>
    </>
  );
}

function AppointmentList({ appointments, workspace, onStatusChange }) {
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');

  if (!appointments.length) {
    return (
      <EmptyState
        status={workspace?.status}
        title={workspace?.status === 'approved' ? 'Chưa có lịch hẹn' : 'Chức năng đang khóa'}
        text={workspace?.status === 'approved' ? 'API đã hoạt động nhưng chưa có lịch hẹn liên kết với workspace này.' : 'Hồ sơ cần được duyệt trước khi mở dữ liệu bệnh nhân.'}
      />
    );
  }

  const changeStatus = async (appointmentId, status) => {
    if (!onStatusChange) return;
    setBusyId(`${appointmentId}:${status}`);
    setMessage('');
    try {
      await onStatusChange(appointmentId, status);
    } catch (error) {
      setMessage(error.message || 'Không thể cập nhật lịch hẹn.');
    } finally {
      setBusyId('');
    }
  };

  const canOperate = workspace?.status === 'approved' && onStatusChange;

  return (
    <div className="dw-appointment-list">
      {message ? <p className="dw-form-alert">{message}</p> : null}
      {appointments.map((item) => (
        <article key={item.id}>
          <time>
            <b>{item.time || '--:--'}</b>
            <small>{item.date}</small>
          </time>
          <div>
            <strong>{item.patientName}</strong>
            <p>{item.reason}</p>
            <small>{item.ticketCode || item.appointmentCode || item.patientPhone}</small>
          </div>
          <div className="dw-appointment-actions">
            <span className={`dw-risk ${item.riskLevel || 'low'}`} title={item.riskReason || ''}>{RISK_BADGES[item.riskLevel] || RISK_BADGES.low}</span>
            <span className={`dw-status ${item.status}`}>{STATUS_BADGES[item.status] || item.status}</span>
            {canOperate && item.status === 'pending' ? (
              <>
                <button type="button" disabled={Boolean(busyId)} onClick={() => changeStatus(item.id, 'confirmed')}>
                  {busyId === `${item.id}:confirmed` ? 'Đang lưu...' : 'Xác nhận'}
                </button>
                <button type="button" disabled={Boolean(busyId)} onClick={() => changeStatus(item.id, 'cancelled')}>Hủy</button>
              </>
            ) : null}
            {canOperate && item.status === 'confirmed' ? (
              <>
                <button type="button" disabled={Boolean(busyId)} onClick={() => changeStatus(item.id, 'completed')}>Hoàn tất</button>
                <button type="button" disabled={Boolean(busyId)} onClick={() => changeStatus(item.id, 'no_show')}>Không đến</button>
              </>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function ProfilePanel({ workspace, onEdit }) {
  const isClinic = workspace?.mode === 'clinic';
  const fields = isClinic
    ? [
      ['Tên phòng khám', workspace?.clinicName],
      ['Địa chỉ hoạt động', workspace?.clinicAddress],
      ['Mã số thuế / mã KCB', workspace?.taxCode],
      ['Email quản trị', workspace?.email],
    ]
    : [
      ['Họ tên hiển thị', workspace?.ownerName],
      ['Học hàm / chức danh', workspace?.doctorTitle],
      ['Chuyên khoa chính', workspace?.specialty],
      ['Email chuyên môn', workspace?.email],
    ];

  return (
    <section className="dw-provider-profile">
      <div className="dw-dashboard-heading compact">
        <div>
          <span>Thông tin công khai</span>
          <h1>{isClinic ? 'Hồ sơ phòng khám' : 'Hồ sơ bác sĩ'}</h1>
          <p>Thông tin dùng để kiểm duyệt và hiển thị với bệnh nhân.</p>
        </div>
        <button type="button" className="dw-primary-command" onClick={onEdit}>Chỉnh sửa</button>
      </div>
      <div className="dw-profile-fields">
        {fields.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value || 'Chưa cập nhật'}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function SchedulePanel({ workspace, operations, onSaveSlot, onToggleSlot }) {
  const slots = operations?.slots || [];
  const [slotForm, setSlotForm] = useState({
    date: todayValue(),
    startTime: '07:30',
    endTime: '08:00',
    capacity: '1',
  });
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState('');
  const groups = ['morning', 'afternoon', 'evening'].map((session) => {
    const sessionSlots = slots.filter((slot) => slot.session === session && slot.isActive);
    return {
      session,
      label: { morning: 'Sáng', afternoon: 'Chiều', evening: 'Tối' }[session],
      time: { morning: '07:30 - 11:30', afternoon: '13:30 - 17:00', evening: '17:30 - 19:00' }[session],
      slots: sessionSlots.length,
      available: sessionSlots.reduce((total, slot) => total + slot.availableCount, 0),
    };
  });
  const canManageSlots = workspace?.status === 'approved' && operations?.linked && onSaveSlot;

  const submitSlot = async (event) => {
    event.preventDefault();
    if (!canManageSlots) return;
    setBusyId('new-slot');
    setMessage('');
    try {
      await onSaveSlot({
        date: slotForm.date,
        startTime: slotForm.startTime,
        endTime: slotForm.endTime,
        capacity: Number(slotForm.capacity) || 1,
      });
      setMessage('Đã lưu khung giờ.');
    } catch (error) {
      setMessage(error.message || 'Không thể lưu khung giờ.');
    } finally {
      setBusyId('');
    }
  };

  const toggleSlot = async (slot) => {
    if (!onToggleSlot) return;
    setBusyId(slot.id);
    setMessage('');
    try {
      await onToggleSlot(slot.id, { isActive: !slot.isActive });
    } catch (error) {
      setMessage(error.message || 'Không thể cập nhật slot.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      <div className="dw-dashboard-heading compact">
        <div>
          <span>Lịch làm việc</span>
          <h1>Khung giờ nhận đặt khám</h1>
          <p>Dữ liệu slot được lấy từ API backend theo bác sĩ/phòng khám đã liên kết.</p>
        </div>
      </div>
      <section className="dw-schedule-board">
        {groups.map((block) => (
          <article key={block.session}>
            <span>{block.label}</span>
            <strong>{block.time}</strong>
            <p>{block.slots ? `${block.slots} slot đang mở` : 'Chưa có slot'}</p>
            <small>{block.available} lượt còn trống</small>
            <button type="button" disabled>{workspace?.status === 'approved' ? 'API sẵn sàng' : 'Chưa mở'}</button>
          </article>
        ))}
      </section>
      <section className="dw-slot-manager">
        <form onSubmit={submitSlot}>
          <div>
            <span>Thiết lập nhanh</span>
            <strong>Tạo hoặc cập nhật khung giờ</strong>
            <p>Slot trùng ngày và giờ bắt đầu sẽ được cập nhật sức chứa thay vì tạo trùng.</p>
          </div>
          <label>
            Ngày khám
            <input type="date" min={todayValue()} value={slotForm.date} onChange={(event) => setSlotForm({ ...slotForm, date: event.target.value })} disabled={!canManageSlots} required />
          </label>
          <label>
            Bắt đầu
            <input type="time" value={slotForm.startTime} onChange={(event) => setSlotForm({ ...slotForm, startTime: event.target.value })} disabled={!canManageSlots} required />
          </label>
          <label>
            Kết thúc
            <input type="time" value={slotForm.endTime} onChange={(event) => setSlotForm({ ...slotForm, endTime: event.target.value })} disabled={!canManageSlots} required />
          </label>
          <label>
            Sức chứa
            <input type="number" min="1" max="100" value={slotForm.capacity} onChange={(event) => setSlotForm({ ...slotForm, capacity: event.target.value })} disabled={!canManageSlots} required />
          </label>
          <button type="submit" disabled={!canManageSlots || busyId === 'new-slot'}>{busyId === 'new-slot' ? 'Đang lưu...' : 'Lưu slot'}</button>
        </form>
        {message ? <p className={message.includes('Đã') ? 'dw-form-alert neutral' : 'dw-form-alert'}>{message}</p> : null}
        <div className="dw-slot-list">
          {slots.slice(0, 12).map((slot) => (
            <article key={slot.id}>
              <div>
                <strong>{slot.date} · {slot.startTime}-{slot.endTime}</strong>
                <span>{slot.isActive ? 'Đang mở' : 'Đã khóa'} · {slot.bookedCount}/{slot.capacity} đã đặt, còn {slot.availableCount}</span>
              </div>
              <button type="button" disabled={!canManageSlots || busyId === slot.id} onClick={() => toggleSlot(slot)}>
                {slot.isActive ? 'Khóa slot' : 'Mở lại'}
              </button>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

function AppointmentsPanel({ workspace, operations, onAppointmentStatusChange }) {
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState('all');
  const [risk, setRisk] = useState('all');
  const appointments = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return (operations?.appointments || [])
      .filter((item) => status === 'all' || item.status === status)
      .filter((item) => risk === 'all' || item.riskLevel === risk)
      .filter((item) => !normalizedKeyword || [
        item.patientName,
        item.patientPhone,
        item.ticketCode,
        item.appointmentCode,
        item.reason,
      ].some((value) => String(value || '').toLowerCase().includes(normalizedKeyword)));
  }, [keyword, operations?.appointments, risk, status]);

  return (
    <>
      <div className="dw-dashboard-heading compact">
        <div>
          <span>Đặt khám</span>
          <h1>Quản lý lịch hẹn</h1>
          <p>Lọc, xem trạng thái và chuẩn bị dữ liệu khám từ API workspace.</p>
        </div>
      </div>
      <section className="dw-data-panel clean">
        <div className="dw-data-toolbar">
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Tìm bệnh nhân, mã phiếu hoặc số điện thoại" />
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="completed">Đã khám</option>
            <option value="cancelled">Đã hủy</option>
            <option value="no_show">Không đến</option>
          </select>
          <select value={risk} onChange={(event) => setRisk(event.target.value)}>
            <option value="all">Tat ca rui ro</option>
            <option value="medium">Can theo doi</option>
            <option value="high">No-show</option>
            <option value="low">Rui ro thap</option>
          </select>
        </div>
        <AppointmentList appointments={appointments} workspace={workspace} onStatusChange={onAppointmentStatusChange} />
      </section>
    </>
  );
}

function ServicePanel({ workspace, operations }) {
  return (
    <>
      <div className="dw-dashboard-heading compact">
        <div>
          <span>Dịch vụ</span>
          <h1>Dịch vụ và lý do khám</h1>
          <p>API đã dành chỗ cho danh mục dịch vụ phòng khám; hiện trả theo dữ liệu liên kết.</p>
        </div>
      </div>
      <EmptyState
        status={workspace?.status}
        title={operations?.services?.length ? 'Dịch vụ đã liên kết' : 'Chưa có dịch vụ'}
        text={operations?.services?.length ? 'Danh mục dịch vụ đã sẵn sàng.' : 'Chưa có dịch vụ gắn với workspace này trong backend.'}
      />
    </>
  );
}

function OnlineConsultPanel({ workspace }) {
  return (
    <>
      <div className="dw-dashboard-heading compact">
        <div>
          <span>Tư vấn trực tuyến</span>
          <h1>Yêu cầu tư vấn</h1>
          <p>Kênh tư vấn được tách riêng để sau này nối API video/chat.</p>
        </div>
      </div>
      <EmptyState status={workspace?.status} title="Chưa có yêu cầu tư vấn" text="Khi có yêu cầu gửi đến bác sĩ, dữ liệu sẽ hiển thị tại đây." />
    </>
  );
}

function ReportPanel({ workspace, operations }) {
  const report = operations?.report || [];

  return (
    <>
      <div className="dw-dashboard-heading compact">
        <div>
          <span>Báo cáo</span>
          <h1>Hiệu suất đặt khám</h1>
          <p>Tổng hợp lịch xác nhận, hoàn tất và hủy từ API backend.</p>
        </div>
      </div>
      <section className="dw-operation-chart clean">
        <header>
          <div>
            <span>14 ngày gần nhất</span>
            <strong>{report.length ? `${report.length} ngày có dữ liệu` : 'Chưa có dữ liệu báo cáo'}</strong>
          </div>
        </header>
        <div className="dw-report-bars">
          {(report.length ? report : Array.from({ length: 7 }, (_, index) => ({ date: `D${index + 1}`, total: 0, completed: 0 }))).map((item) => (
            <div key={item.date}>
              <i style={{ height: `${Math.max(item.total * 12, 8)}px` }} />
              <small>{String(item.date).slice(5) || item.date}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function WorkspaceDashboard({
  activeSection = 'tong-quan',
  displayName,
  roleLabel,
  statusLabel,
  accountEmail,
  isOperationsLoading,
  operationsMessage,
  workspace,
  operations,
  onNavigate,
  onEdit,
  onLogout,
  onHome,
  onRefresh,
  onAppointmentStatusChange,
  onSaveSlot,
  onToggleSlot,
}) {
  const navItems = NAV_ITEMS_BY_MODE[workspace?.mode] || NAV_ITEMS_BY_MODE.doctor;
  const allowedSection = navItems.some((item) => item.id === activeSection) ? activeSection : 'tong-quan';

  return (
    <div className="dw-live-dashboard refined">
      <aside className="dw-live-sidebar">
        <div className="dw-live-brand">
          <button className="dw-sidebar-home" type="button" onClick={onHome} aria-label="Về trang chủ MidHealth">
            <div className="dw-app-mark">M</div>
          </button>
          <div>
            <strong>{displayName}</strong>
            <span>{roleLabel}</span>
          </div>
        </div>
        <nav aria-label="Chức năng workspace">
          <b>QUẢN LÝ</b>
          {navItems.map((item) => (
            <button
              type="button"
              className={allowedSection === item.id ? 'active' : ''}
              onClick={() => onNavigate(item.id)}
              key={item.id}
            >
              <i>{item.icon}</i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="dw-sidebar-account">
          <span className={`dw-provider-status ${workspace?.status || 'pending_review'}`}>{statusLabel}</span>
          <strong>{accountEmail}</strong>
          <button type="button" onClick={onEdit}>Chỉnh sửa hồ sơ</button>
          <button type="button" onClick={onLogout}>Đăng xuất</button>
        </div>
      </aside>
      <main className="dw-live-content">
        <header className="dw-workspace-topbar">
          <div>
            <span>{new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date())}</span>
            <strong>{displayName}</strong>
          </div>
          <div className={`dw-connection-state ${operations?.linked ? 'connected' : ''}`}>
            <i aria-hidden="true" />
            <span>{isOperationsLoading ? 'Đang đồng bộ dữ liệu' : operations?.linked ? 'Dữ liệu đã liên kết' : 'Chưa liên kết dữ liệu'}</span>
          </div>
        </header>
        {operationsMessage ? <div className="dw-operations-notice">{operationsMessage}</div> : null}
        {allowedSection === 'tong-quan' ? (
          <OperationsOverview
            workspace={workspace}
            operations={operations}
            onNavigate={onNavigate}
            onAppointmentStatusChange={onAppointmentStatusChange}
          />
      ) : allowedSection === 'ho-so' ? (
          <ProfilePanel workspace={workspace} onEdit={onEdit} />
      ) : allowedSection === 'lich-lam-viec' ? (
          <SchedulePanel workspace={workspace} operations={operations} onSaveSlot={onSaveSlot} onToggleSlot={onToggleSlot} />
      ) : allowedSection === 'lich-hen' ? (
          <AppointmentsPanel workspace={workspace} operations={operations} onAppointmentStatusChange={onAppointmentStatusChange} onRefresh={onRefresh} />
        ) : allowedSection === 'dich-vu' ? (
          <ServicePanel workspace={workspace} operations={operations} />
        ) : allowedSection === 'tu-van' ? (
          <OnlineConsultPanel workspace={workspace} />
        ) : (
          <ReportPanel workspace={workspace} operations={operations} />
        )}
      </main>
    </div>
  );
}

export {
  DashboardPreview,
  WORKSPACE_SECTIONS,
  WorkspaceBrand,
  WorkspaceDashboard,
  getRoleLabel,
  getStatusLabel,
  isWorkspaceSectionAllowed,
};
