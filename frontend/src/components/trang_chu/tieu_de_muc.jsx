function TieuDeMuc({ title, subtitle, action = 'Xem thêm' }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <button className="pill-button" type="button">
        {action}
        <span>→</span>
      </button>
    </div>
  );
}

export default TieuDeMuc;
