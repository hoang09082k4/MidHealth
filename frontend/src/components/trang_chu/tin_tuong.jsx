function MucTinTuong({ trustItems }) {
  return (
    <section className="trust-section">
      <article className="video-card">
        <div className="video-thumb">
          <span>▶</span>
        </div>
        <h2>Hướng dẫn đặt lịch và theo dõi số khám MidHealth</h2>
      </article>
      <div className="trust-news">
        <h2>Tin tưởng ở MidHealth</h2>
        <div className="trust-grid">
          {trustItems.map((item) => (
            <article key={item.title}>
              <strong>{item.source}</strong>
              <p>{item.title}</p>
              <div className="trust-image">MH</div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default MucTinTuong;
