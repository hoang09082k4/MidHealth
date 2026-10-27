import { useEffect, useRef, useState } from 'react';

const clinicDate = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const shiftDate = (value, offset) => new Date(Date.parse(`${value}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
const formatNumber = value => Number(value || 0).toLocaleString('vi-VN');
const formatMoney = value => `${formatNumber(value)} ₫`;
const formatDate = value => value ? new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T00:00:00+07:00`)) : '—';
const chartLabel = value => String(value || '').length > 27 ? `${String(value).slice(0, 26)}…` : value;
const appointmentStatusLabels = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', completed: 'Đã hoàn tất', cancelled: 'Đã hủy', no_show: 'Không đến' };

function completeDailySeries(report) {
  if (!report?.from || !report?.to) return [];
  const counts = new Map((report.byDate || []).map(row => [row.date, row]));
  const dayCount = (Date.parse(`${report.to}T00:00:00Z`) - Date.parse(`${report.from}T00:00:00Z`)) / 86400000 + 1;
  return Array.from({ length: dayCount }, (_, index) => {
    const date = shiftDate(report.from, index);
    const row = counts.get(date);
    return { date, appointments: Number(row?.appointments || 0), completed: Number(row?.completed || 0) };
  });
}

function ReportFigure({ number, title, note, source, children }) {
  return <figure className="clinic-report-figure">
    <div className="clinic-report-chart">{children}</div>
    <figcaption><strong>Hình {number}. {title}</strong>{note && <span>{note}</span>}<small>{source}</small></figcaption>
  </figure>;
}

function ReportTable({ number, title, description, source, headers, rows, emptyLabel = 'Chưa có dữ liệu trong khoảng thời gian này.' }) {
  return <section className="clinic-report-table-card">
    <div className="clinic-report-table-heading"><div><h3>Bảng {number}. {title}</h3>{description && <p>{description}</p>}</div><span>{formatNumber(rows.length)} dòng</span></div>
    {!rows.length ? <p className="clinic-report-empty-inline">{emptyLabel}</p> : <div className="admin-table-wrap clinic-report-table-wrap">
      <table className="admin-table clinic-report-table"><thead><tr>{headers.map(header => <th key={header.label} className={header.numeric ? 'is-numeric' : ''}>{header.label}</th>)}</tr></thead>
        <tbody>{rows.map((row, index) => <tr key={row.key || `${title}-${index}`}>{headers.map(header => <td key={header.key} className={header.numeric ? 'is-numeric' : ''}>{header.render ? header.render(row) : row[header.key]}</td>)}</tr>)}</tbody>
      </table>
    </div>}
    {source && <p className="clinic-report-source">{source}</p>}
  </section>;
}

function chartScale(maxValue) {
  const step = Math.max(1, Math.ceil(Number(maxValue || 0) / 4));
  return { max: step * 4, ticks: Array.from({ length: 5 }, (_, index) => index * step) };
}

function dateTick(value) {
  return value ? `${value.slice(8, 10)}/${value.slice(5, 7)}` : '';
}

function DailyAppointmentsFigure({ rows, source }) {
  const width = 780, height = 320, left = 62, right = 22, top = 24, bottom = 64;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const scale = chartScale(Math.max(0, ...rows.map(row => Number(row.appointments || 0))));
  const points = rows.map((row, index) => ({
    x: left + (rows.length <= 1 ? plotWidth / 2 : index / (rows.length - 1) * plotWidth),
    y: top + plotHeight - Number(row.appointments || 0) / scale.max * plotHeight,
    row,
  }));
  const linePath = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const areaPath = points.length ? `${linePath} L ${points.at(-1).x} ${top + plotHeight} L ${points[0].x} ${top + plotHeight} Z` : '';
  const xTickIndexes = [...new Set([0, Math.round((rows.length - 1) / 4), Math.round((rows.length - 1) / 2), Math.round((rows.length - 1) * 3 / 4), rows.length - 1])];
  return <ReportFigure number="1" title="Số lịch khám theo ngày" note="Trục tung: số lịch (lịch); trục hoành: ngày khám (dd/mm)." source={source}>
    {!rows.length ? <p className="clinic-report-chart-empty">Không có quan sát theo ngày trong kỳ.</p> : <div className="clinic-report-svg-scroll">
      <svg className="clinic-report-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ đường số lịch khám theo ngày">
        {scale.ticks.map(tick => {
          const y = top + plotHeight - tick / scale.max * plotHeight;
          return <g key={tick}><line x1={left} x2={width - right} y1={y} y2={y} className="clinic-chart-gridline" /><text x={left - 10} y={y + 4} textAnchor="end" className="clinic-chart-axis-text">{formatNumber(tick)}</text></g>;
        })}
        <line x1={left} x2={left} y1={top} y2={top + plotHeight} className="clinic-chart-axis" />
        <line x1={left} x2={width - right} y1={top + plotHeight} y2={top + plotHeight} className="clinic-chart-axis" />
        {areaPath && <path d={areaPath} className="clinic-chart-area" />}
        {linePath && <path d={linePath} className="clinic-chart-line" />}
        {points.length <= 31 && points.map(point => <circle key={point.row.date} cx={point.x} cy={point.y} r="3.2" className="clinic-chart-point"><title>{formatDate(point.row.date)}: {formatNumber(point.row.appointments)} lịch khám</title></circle>)}
        {xTickIndexes.map(index => rows[index] && <text key={rows[index].date} x={points[index].x} y={top + plotHeight + 23} textAnchor="middle" className="clinic-chart-axis-text">{dateTick(rows[index].date)}</text>)}
        <text x={left + plotWidth / 2} y={height - 12} textAnchor="middle" className="clinic-chart-axis-title">Ngày khám</text>
        <text transform={`translate(17 ${top + plotHeight / 2}) rotate(-90)`} textAnchor="middle" className="clinic-chart-axis-title">Số lịch (lịch)</text>
      </svg>
    </div>}
  </ReportFigure>;
}

function StatusDistributionFigure({ rows, source }) {
  const width = 780, left = 140, right = 110, top = 18, rowHeight = 44, bottom = 42;
  const height = top + rows.length * rowHeight + bottom;
  const maxCount = Math.max(0, ...rows.map(row => Number(row.count || 0)));
  const scale = chartScale(maxCount);
  const plotWidth = width - left - right;
  return <ReportFigure number="2" title="Phân bố lịch khám theo trạng thái" note="Thanh biểu diễn số lịch; nhãn đi kèm là tỷ lệ trên tổng lịch trong kỳ." source={source}>
    <div className="clinic-report-svg-scroll"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ thanh ngang phân bố lịch khám theo trạng thái">
      {scale.ticks.map(tick => {
        const x = left + tick / scale.max * plotWidth;
        return <g key={tick}><line x1={x} x2={x} y1={top - 4} y2={height - bottom} className="clinic-chart-gridline" /><text x={x} y={height - 17} textAnchor="middle" className="clinic-chart-axis-text">{formatNumber(tick)}</text></g>;
      })}
      {rows.map((row, index) => {
        const y = top + index * rowHeight;
        const barWidth = Number(row.count || 0) / scale.max * plotWidth;
        return <g key={row.key}><text x={left - 12} y={y + 20} textAnchor="end" className="clinic-chart-category">{row.name}</text><rect x={left} y={y + 5} width={plotWidth} height="20" rx="4" className="clinic-chart-track" /><rect x={left} y={y + 5} width={barWidth} height="20" rx="4" className="clinic-chart-bar"><title>{row.name}: {formatNumber(row.count)} lịch, {row.share}%</title></rect><text x={Math.min(left + barWidth + 8, width - right + 8)} y={y + 20} className="clinic-chart-value">{formatNumber(row.count)} · {row.share}%</text></g>;
      })}
      <text x={left + plotWidth / 2} y={height - 1} textAnchor="middle" className="clinic-chart-axis-title">Số lịch (lịch)</text>
    </svg></div>
  </ReportFigure>;
}

function SpecialtyComparisonFigure({ rows, source }) {
  const ranked = [...rows].sort((a, b) => Number(b.appointments || 0) - Number(a.appointments || 0)).slice(0, 8);
  const width = 820, left = 205, right = 150, top = 32, rowHeight = 48, bottom = 48;
  const height = top + ranked.length * rowHeight + bottom;
  const maxCount = Math.max(0, ...ranked.map(row => Number(row.appointments || 0)));
  const scale = chartScale(maxCount);
  const plotWidth = width - left - right;
  return <ReportFigure number="3" title="Lịch khám và lượt hoàn tất theo chuyên khoa" note="Hiển thị tối đa 8 chuyên khoa, xếp theo tổng lịch khám; trục ngang dùng đơn vị lịch." source={source}>
    {!ranked.length ? <p className="clinic-report-chart-empty">Chưa có dữ liệu chuyên khoa trong kỳ.</p> : <div className="clinic-report-svg-scroll"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ so sánh lịch khám và lượt hoàn tất theo chuyên khoa">
      <g className="clinic-chart-legend"><rect x={left} y="8" width="10" height="10" rx="2" className="clinic-chart-bar" /><text x={left + 15} y="17" className="clinic-chart-axis-text">Tổng lịch khám</text><rect x={left + 130} y="8" width="10" height="10" rx="2" className="clinic-chart-completed" /><text x={left + 145} y="17" className="clinic-chart-axis-text">Đã hoàn tất</text></g>
      {scale.ticks.map(tick => {
        const x = left + tick / scale.max * plotWidth;
        return <g key={tick}><line x1={x} x2={x} y1={top - 5} y2={height - bottom} className="clinic-chart-gridline" /><text x={x} y={height - 22} textAnchor="middle" className="clinic-chart-axis-text">{formatNumber(tick)}</text></g>;
      })}
      {ranked.map((row, index) => {
        const y = top + index * rowHeight;
        const appointmentsWidth = Number(row.appointments || 0) / scale.max * plotWidth;
        const completedWidth = Number(row.completed || 0) / scale.max * plotWidth;
        return <g key={row.specialtyId || row.name}><text x={left - 12} y={y + 18} textAnchor="end" className="clinic-chart-category"><title>{row.name}</title>{chartLabel(row.name)}</text><rect x={left} y={y + 1} width={appointmentsWidth} height="13" rx="3" className="clinic-chart-bar"><title>{row.name}: {formatNumber(row.appointments)} lịch khám</title></rect><rect x={left} y={y + 19} width={completedWidth} height="13" rx="3" className="clinic-chart-completed"><title>{row.name}: {formatNumber(row.completed)} lịch hoàn tất</title></rect><text x={Math.min(left + appointmentsWidth + 7, width - right + 70)} y={y + 12} className="clinic-chart-value">{formatNumber(row.appointments)}</text><text x={Math.min(left + completedWidth + 7, width - right + 70)} y={y + 30} className="clinic-chart-value">{formatNumber(row.completed)}</text></g>;
      })}
      <text x={left + plotWidth / 2} y={height - 3} textAnchor="middle" className="clinic-chart-axis-title">Số lịch (lịch)</text>
    </svg></div>}
  </ReportFigure>;
}

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function exportReportCsv(report, filters) {
  const rows = [
    ['Báo cáo hoạt động phòng khám', `${filters.from} đến ${filters.to}`],
    ['Bộ lọc chuyên khoa', filters.specialtyName || 'Tất cả'],
    ['Bộ lọc bác sĩ', filters.doctorName || 'Tất cả'],
    ['Nguồn', 'Hệ thống MidHealth; tổng hợp theo ngày khám.'],
    ['Phương pháp', 'Số đếm mô tả; tỷ lệ = số lịch của nhóm / tổng lịch trong kỳ × 100%.'],
    [],
    ['Chỉ số tổng quan', 'Giá trị'],
    ['Hồ sơ bệnh nhân có lịch khám', report.patients],
    ['Tổng lịch khám', report.appointments],
    ['Lịch đã hoàn tất', report.completed],
    ['Tỷ lệ hoàn tất (%)', report.appointments ? (report.completed / report.appointments * 100).toFixed(1) : '0'],
    ...Object.entries(appointmentStatusLabels).map(([status, label]) => [`Lịch ${label.toLowerCase()}`, report.appointmentStatuses?.[status] || 0]),
    ['Giao dịch đang ở trạng thái đã thanh toán', report.revenue],
    ['Dòng thuốc kê', report.prescriptionItems],
    ['Số lượng thuốc ghi nhận (chưa chuẩn hóa đơn vị)', report.medicineQuantity],
    ['Dòng vật tư sử dụng', report.materialItems],
    ['Số lượng vật tư ghi nhận (chưa chuẩn hóa đơn vị)', report.materialQuantity],
    [],
  ];
  const append = (title, items, columns) => {
    rows.push([title], columns.map(column => column.label));
    for (const item of items || []) rows.push(columns.map(column => item[column.key] ?? ''));
    rows.push([]);
  };
  append('Theo ngày khám', report.byDate, [{ key: 'date', label: 'Ngày' }, { key: 'appointments', label: 'Lịch khám' }, { key: 'completed', label: 'Hoàn tất' }]);
  append('Theo chuyên khoa', report.bySpecialty, [{ key: 'name', label: 'Chuyên khoa' }, { key: 'appointments', label: 'Lịch khám' }, { key: 'completed', label: 'Hoàn tất' }]);
  append('Theo bác sĩ phụ trách lịch khám', report.byDoctor, [{ key: 'name', label: 'Bác sĩ' }, { key: 'appointments', label: 'Lịch khám' }, { key: 'completed', label: 'Hoàn tất' }]);
  append('Thuốc theo chuyên khoa', report.medicineBySpecialty, [{ key: 'name', label: 'Chuyên khoa' }, { key: 'items', label: 'Dòng kê' }, { key: 'quantity', label: 'Số lượng nhập' }]);
  append('Thuốc theo bác sĩ phụ trách', report.medicineByDoctor, [{ key: 'name', label: 'Bác sĩ' }, { key: 'items', label: 'Dòng kê' }, { key: 'quantity', label: 'Số lượng nhập' }]);
  append('Vật tư theo chuyên khoa', report.materialBySpecialty, [{ key: 'name', label: 'Chuyên khoa' }, { key: 'items', label: 'Dòng sử dụng' }, { key: 'quantity', label: 'Số lượng nhập' }]);
  append('Vật tư theo bác sĩ phụ trách', report.materialByDoctor, [{ key: 'name', label: 'Bác sĩ' }, { key: 'items', label: 'Dòng sử dụng' }, { key: 'quantity', label: 'Số lượng nhập' }]);
  const content = `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `midhealth-bao-cao-${filters.from}-${filters.to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ClinicReport({ request }) {
  const [to, setTo] = useState(clinicDate);
  const [from, setFrom] = useState(() => shiftDate(clinicDate(), -29));
  const [specialtyId, setSpecialtyId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [catalog, setCatalog] = useState({ doctors: [], specialties: [] });
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestVersion = useRef(0);
  const selectedDoctor = catalog.doctors.find(doctor => doctor.id === doctorId);
  const filteredDoctors = catalog.doctors.filter(doctor => !specialtyId || doctor.specialty_id === specialtyId);
  const completionRate = report?.appointments ? Math.round(report.completed / report.appointments * 100) : 0;
  const dailyRows = completeDailySeries(report);
  const currentRangeInvalid = !from || !to || from > to || (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000 > 365;
  const reportSource = report ? `Nguồn: Hệ thống MidHealth; ngày khám từ ${formatDate(report.from)} đến ${formatDate(report.to)}.` : '';
  const statusRows = report ? Object.entries(appointmentStatusLabels).map(([status, name]) => ({
    key: status, name, count: Number(report.appointmentStatuses?.[status] || 0),
    share: report.appointments ? (Number(report.appointmentStatuses?.[status] || 0) / report.appointments * 100).toFixed(1) : '0.0',
  })) : [];
  const busiestDay = report?.byDate?.reduce((best, row) => !best || Number(row.appointments) > Number(best.appointments) ? row : best, null);
  const busiestSpecialty = report?.bySpecialty?.reduce((best, row) => !best || Number(row.appointments) > Number(best.appointments) ? row : best, null);
  const mostCommonStatus = statusRows.reduce((best, row) => !best || row.count > best.count ? row : best, null);

  useEffect(() => {
    let active = true;
    request('/api/admin/clinic/catalog').then(data => {
      if (active) setCatalog({ doctors: data.doctors || [], specialties: data.specialties || [] });
    }).catch(() => { if (active) setCatalog({ doctors: [], specialties: [] }); });
    return () => { active = false; };
  }, []);

  function invalidateReport() {
    requestVersion.current++;
    setBusy(false);
    setReport(null);
    setError('');
  }

  async function load(event) {
    event?.preventDefault();
    const version = ++requestVersion.current;
    if (currentRangeInvalid) {
      setReport(null);
      setError('Chọn khoảng ngày hợp lệ, tối đa 366 ngày.');
      setBusy(false);
      return;
    }
    setBusy(true); setError(''); setReport(null);
    try {
      const query = new URLSearchParams({ from, to });
      if (specialtyId) query.set('specialtyId', specialtyId);
      if (doctorId) query.set('doctorId', doctorId);
      const result = await request(`/api/reports/clinic?${query}`);
      if (version === requestVersion.current) setReport(result);
    } catch (cause) {
      if (version === requestVersion.current) setError(cause.message || 'Không thể tải báo cáo.');
    } finally {
      if (version === requestVersion.current) setBusy(false);
    }
  }

  useEffect(() => {
    load();
    return () => { requestVersion.current++; };
  }, []);

  function setPreset(days) {
    const end = clinicDate();
    invalidateReport();
    setFrom(shiftDate(end, -(days - 1)));
    setTo(end);
  }

  return <section className="clinic-report-page" aria-labelledby="clinic-report-title">
    <header className="clinic-report-header">
      <div><span className="clinic-report-eyebrow">TRUNG TÂM QUẢN TRỊ</span><h2 id="clinic-report-title">Báo cáo hoạt động</h2>
        <p>Theo dõi lịch khám, mức độ hoàn tất, thanh toán và hoạt động chuyên môn theo thời gian.</p></div>
      {report && <button className="clinic-report-export" type="button" onClick={() => exportReportCsv({ ...report, byDate: dailyRows }, { from, to, specialtyName: catalog.specialties.find(item => item.id === specialtyId)?.name, doctorName: selectedDoctor?.full_name })}>Xuất CSV</button>}
    </header>

    <form className="clinic-report-filter-card" onSubmit={load}>
      <div className="clinic-report-filter-title"><div><h3>Bộ lọc báo cáo</h3><p>Ngày được tính theo múi giờ Việt Nam.</p></div><div className="clinic-report-presets" aria-label="Khoảng thời gian nhanh">
        {[['7 ngày', 7], ['30 ngày', 30], ['90 ngày', 90]].map(([label, days]) => <button key={days} type="button" onClick={() => setPreset(days)}>{label}</button>)}
      </div></div>
      <div className="clinic-report-filter-grid">
        <label>Từ ngày<input type="date" max={to || undefined} value={from} onChange={event => { invalidateReport(); setFrom(event.target.value); }} required /></label>
        <label>Đến ngày<input type="date" min={from || undefined} max={clinicDate()} value={to} onChange={event => { invalidateReport(); setTo(event.target.value); }} required /></label>
        <label>Chuyên khoa<select value={specialtyId} onChange={event => { invalidateReport(); setSpecialtyId(event.target.value); setDoctorId(''); }}><option value="">Tất cả chuyên khoa</option>{catalog.specialties.map(item => <option key={item.id} value={item.id}>{item.name}{item.is_active ? '' : ' (đã ngừng)'}</option>)}</select></label>
        <label>Bác sĩ<select value={doctorId} onChange={event => { invalidateReport(); setDoctorId(event.target.value); }}><option value="">Tất cả bác sĩ</option>{filteredDoctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.full_name}{doctor.is_active ? '' : ' (đã ngừng)'}</option>)}</select></label>
        <button className="clinic-report-submit" type="submit" disabled={busy || currentRangeInvalid}>{busy ? 'Đang tải báo cáo…' : 'Xem báo cáo'}</button>
      </div>
      {currentRangeInvalid && <p className="clinic-report-validation" role="status">Khoảng báo cáo tối đa 366 ngày; ngày bắt đầu không được sau ngày kết thúc.</p>}
    </form>

    {error && <div className="clinic-report-error" role="alert"><strong>Không tải được báo cáo</strong><span>{error}</span><button type="button" onClick={load} disabled={busy}>Thử lại</button></div>}
    {busy && <div className="clinic-report-loading" role="status" aria-live="polite"><span className="clinic-report-spinner" />Đang tổng hợp dữ liệu phòng khám…</div>}
    {!report && !busy && !error && <div className="clinic-report-empty"><strong>Chưa có báo cáo để hiển thị</strong><span>Chọn khoảng thời gian và nhấn “Xem báo cáo”.</span></div>}
    {report && !error && <>
      <div className="clinic-report-summary-heading"><div><h3>Kết quả báo cáo</h3><p>{formatDate(report.from)} – {formatDate(report.to)}{specialtyId ? ` · ${catalog.specialties.find(item => item.id === specialtyId)?.name || 'Chuyên khoa'}` : ''}{doctorId ? ` · ${selectedDoctor?.full_name || 'Bác sĩ'}` : ''}</p></div><span className="clinic-report-updated">Dữ liệu tổng hợp</span></div>
      <div className="clinic-report-kpis">
        <article className="clinic-report-kpi"><span>Hồ sơ bệnh nhân</span><strong>{formatNumber(report.patients)}</strong><small>Có lịch khám trong kỳ</small></article>
        <article className="clinic-report-kpi"><span>Lịch khám</span><strong>{formatNumber(report.appointments)}</strong><small>Tính theo ngày khám</small></article>
        <article className="clinic-report-kpi"><span>Đã hoàn tất</span><strong>{formatNumber(report.completed)}</strong><small>{completionRate}% tổng lịch trong kỳ</small><div className="clinic-report-progress" role="progressbar" aria-label="Tỷ lệ lịch khám hoàn tất" aria-valuemin="0" aria-valuemax="100" aria-valuenow={completionRate}><span style={{ width: `${completionRate}%` }} /></div></article>
        <article className="clinic-report-kpi"><span>Giao dịch đã thanh toán</span><strong>{formatMoney(report.revenue)}</strong><small>Tổng khoản đang ở trạng thái đã thu, theo lịch trong kỳ</small></article>
        <article className="clinic-report-kpi"><span>Dòng thuốc kê</span><strong>{formatNumber(report.prescriptionItems)}</strong><small>{formatNumber(report.medicineQuantity)} lượng ghi nhận · chưa chuẩn hóa đơn vị</small></article>
        <article className="clinic-report-kpi"><span>Dòng vật tư sử dụng</span><strong>{formatNumber(report.materialItems)}</strong><small>{formatNumber(report.materialQuantity)} lượng ghi nhận · chưa chuẩn hóa đơn vị</small></article>
      </div>
      {!report.appointments && <div className="clinic-report-no-data">Không có lịch khám trong khoảng thời gian và bộ lọc đã chọn.</div>}
      <section className="clinic-report-results" aria-label="Biểu đồ và bảng số liệu báo cáo">
        <h3 className="clinic-report-subsection-title">Biểu đồ</h3>
        <div className="clinic-report-figures">
          <DailyAppointmentsFigure rows={dailyRows} source={reportSource} />
          <StatusDistributionFigure rows={statusRows} source={reportSource} />
          <SpecialtyComparisonFigure rows={report.bySpecialty || []} source={reportSource} />
        </div>
        <section className="clinic-report-interpretation"><h3>Nhận xét mô tả</h3>
          <p>{report.appointments && busiestDay ? `Hình 1 cho thấy ngày có số lịch khám cao nhất là ${formatDate(busiestDay.date)} với ${formatNumber(busiestDay.appointments)} lịch.` : 'Trong kỳ chưa ghi nhận lịch khám.'} {mostCommonStatus && report.appointments ? `Hình 2 và Bảng 1 ghi nhận trạng thái phổ biến nhất là “${mostCommonStatus.name}” (${mostCommonStatus.share}%).` : ''} {busiestSpecialty && report.appointments ? `Theo Hình 3, chuyên khoa có nhiều lịch khám nhất là ${busiestSpecialty.name} (${formatNumber(busiestSpecialty.appointments)} lịch).` : ''} Tỷ lệ hoàn tất được tính bằng số lịch hoàn tất chia tổng lịch trong kỳ ({completionRate}%). Đây là mô tả số liệu, không xác định nguyên nhân của xu hướng.</p>
        </section>
        <h3 className="clinic-report-subsection-title">Bảng số liệu</h3>
        <div className="clinic-report-tables">
          <ReportTable number="1" title="Phân bố lịch khám theo trạng thái" description="Tỷ trọng = số lịch của trạng thái / tổng số lịch trong kỳ × 100%." source={reportSource} headers={[{ key: 'name', label: 'Trạng thái' }, { key: 'count', label: 'Số lịch (lịch)', numeric: true }, { key: 'share', label: 'Tỷ trọng (%)', numeric: true, render: row => row.share }]} rows={statusRows} />
          <ReportTable number="2" title="Số lịch khám và lượt hoàn tất theo ngày" description="Ngày được hiểu là ngày khám; kỳ báo cáo bao gồm cả ngày không ghi nhận lịch (giá trị 0)." source={reportSource} headers={[{ key: 'date', label: 'Ngày khám' , render: row => formatDate(row.date) }, { key: 'appointments', label: 'Lịch khám (lịch)', numeric: true }, { key: 'completed', label: 'Hoàn tất (lịch)', numeric: true }]} rows={dailyRows} />
          <ReportTable number="3" title="Kết quả theo chuyên khoa" source={reportSource} headers={[{ key: 'name', label: 'Chuyên khoa' }, { key: 'appointments', label: 'Lịch khám (lịch)', numeric: true }, { key: 'completed', label: 'Hoàn tất (lịch)', numeric: true }]} rows={report.bySpecialty || []} />
          <ReportTable number="4" title="Kết quả theo bác sĩ phụ trách" description="Bác sĩ được xác định theo bác sĩ gán cho lịch khám." source={reportSource} headers={[{ key: 'name', label: 'Bác sĩ' }, { key: 'appointments', label: 'Lịch khám (lịch)', numeric: true }, { key: 'completed', label: 'Hoàn tất (lịch)', numeric: true }]} rows={report.byDoctor || []} />
          <ReportTable number="5" title="Thuốc kê theo chuyên khoa" description="Số lượng ghi nhận chưa có trường đơn vị chuẩn hóa; không cộng gộp để so sánh vật lý giữa các thuốc." source={reportSource} headers={[{ key: 'name', label: 'Chuyên khoa' }, { key: 'items', label: 'Dòng kê (dòng)', numeric: true }, { key: 'quantity', label: 'Số lượng ghi nhận', numeric: true }]} rows={report.medicineBySpecialty || []} />
          <ReportTable number="6" title="Thuốc kê theo bác sĩ phụ trách" description="Bác sĩ được xác định theo lịch khám; số lượng thuốc chưa có đơn vị chuẩn hóa." source={reportSource} headers={[{ key: 'name', label: 'Bác sĩ' }, { key: 'items', label: 'Dòng kê (dòng)', numeric: true }, { key: 'quantity', label: 'Số lượng ghi nhận', numeric: true }]} rows={report.medicineByDoctor || []} />
          <ReportTable number="7" title="Vật tư sử dụng theo chuyên khoa" description="Số lượng vật tư chưa có trường đơn vị chuẩn hóa." source={reportSource} headers={[{ key: 'name', label: 'Chuyên khoa' }, { key: 'items', label: 'Dòng sử dụng (dòng)', numeric: true }, { key: 'quantity', label: 'Số lượng ghi nhận', numeric: true }]} rows={report.materialBySpecialty || []} />
          <ReportTable number="8" title="Vật tư sử dụng theo bác sĩ phụ trách" description="Bác sĩ được xác định theo lịch khám; số lượng vật tư chưa có đơn vị chuẩn hóa." source={reportSource} headers={[{ key: 'name', label: 'Bác sĩ' }, { key: 'items', label: 'Dòng sử dụng (dòng)', numeric: true }, { key: 'quantity', label: 'Số lượng ghi nhận', numeric: true }]} rows={report.materialByDoctor || []} />
        </div>
        <details className="clinic-report-method"><summary>Phương pháp tính và giới hạn số liệu</summary><ul>
          <li>Kỳ báo cáo tính từ ngày bắt đầu đến ngày kết thúc, bao gồm cả hai ngày; nhóm theo ngày khám.</li>
          <li>Hồ sơ bệnh nhân là số hồ sơ bệnh án khác nhau có lịch trong kỳ; không phải số người duy nhất nếu một người có nhiều hồ sơ.</li>
          <li>Tỷ lệ hoàn tất = lịch có trạng thái “Đã hoàn tất” / tổng lịch trong kỳ × 100%.</li>
          <li>Tiền là tổng khoản thanh toán đang mang trạng thái “Đã thanh toán”, gắn với lịch trong kỳ; không đồng nghĩa doanh thu kế toán ròng.</li>
          <li>Thuốc và vật tư chỉ hiển thị số dòng và lượng đã nhập; hệ thống hiện chưa chuẩn hóa đơn vị, nên không dùng lượng cộng gộp để so sánh tiêu hao giữa các loại.</li>
        </ul></details>
      </section>
      <p className="clinic-report-footnote">Báo cáo này phục vụ quản trị nội bộ, không thay thế biểu mẫu báo cáo thống kê y tế định kỳ theo quy định.</p>
    </>}
  </section>;
}
