function NotFoundPage({ onHome }) {
  return (
    <section className="not-found-page" aria-labelledby="not-found-title">
      <div className="not-found-content">
        <span className="not-found-kicker">MidHealth</span>
        <h1 id="not-found-title">404</h1>
        <p>Trang bạn tìm kiếm không tồn tại hoặc đã bị di chuyển.</p>
        <button type="button" onClick={onHome}>Quay về trang chủ</button>
      </div>
    </section>
  );
}

export default NotFoundPage;
