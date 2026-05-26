function MucTinYTe({ medicines }) {
  return (
    <section className="news-band" id="news">
      <div className="intro">
        <h2>Tin Y tế</h2>
        <p>Chính thống - Minh bạch - Trung lập</p>
      </div>
      <div className="medicine-search">
        <div className="tabs">
          <button type="button" className="active">Thuốc</button>
          <button type="button">Dược liệu</button>
          <button type="button">Bệnh</button>
          <button type="button">Cơ thể</button>
        </div>
        <label>
          <span>⌕</span>
          <input placeholder="Nhập tên thuốc..." />
        </label>
      </div>
      <div className="horizontal-list medicine-list">
        {medicines.map((medicine) => (
          <article className="medicine-card" key={medicine.name}>
            <div className="medicine-box">{medicine.tag}</div>
            <h3>{medicine.name}</h3>
            <p>{medicine.description}</p>
            <small>{medicine.author} · Cập nhật: {medicine.date}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

export default MucTinYTe;
