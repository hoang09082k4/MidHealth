function OfflineIllustration() {
  return (
    <svg className="offline-illustration" viewBox="0 0 160 130" role="img" aria-label="Mat ket noi Internet">
      <circle cx="80" cy="70" r="54" fill="#eef6ff" />
      <path
        d="M45 72c20-20 50-20 70 0"
        fill="none"
        stroke="#176bdd"
        strokeLinecap="round"
        strokeWidth="9"
      />
      <path
        d="M60 89c11-11 29-11 40 0"
        fill="none"
        stroke="#16b978"
        strokeLinecap="round"
        strokeWidth="9"
      />
      <circle cx="80" cy="106" r="7" fill="#176bdd" />
      <path
        d="M54 35l52 72"
        fill="none"
        stroke="#e34848"
        strokeLinecap="round"
        strokeWidth="8"
      />
    </svg>
  );
}

function OfflinePage() {
  const handleRetry = () => {
    if (navigator.onLine) {
      window.location.reload();
    }
  };

  return (
    <section className="offline-page" aria-labelledby="offline-title">
      <div className="offline-content">
        <OfflineIllustration />
        <h1 id="offline-title">Kết nối Internet</h1>
        <p>Không có kết nối Internet. Vui lòng kiểm tra mạng.</p>
        <button type="button" onClick={handleRetry}>Thử lại</button>
      </div>
      <div className="offline-toast" role="status">Không có kết nối Internet</div>
    </section>
  );
}

export default OfflinePage;
