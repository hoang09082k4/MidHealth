function TieuDeMuc({ title, subtitle, action = 'Xem thêm', onAction }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <button className="pill-button" type="button" onClick={onAction}>
        {action}
        <i className="ui-chevron right" aria-hidden="true" />
      </button>
    </div>
  );
}

export default TieuDeMuc;
