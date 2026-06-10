import BieuTuongLogo from '../dung_chung/bieu_tuong_logo';

const INFO_LINKS = {
  about: { slug: 'gioi-thieu', label: 'Giới thiệu MidHealth' },
  guide: { slug: 'huong-dan-dat-kham', label: 'Hướng dẫn đặt khám' },
  faq: { slug: 'cau-hoi-thuong-gap', label: 'Câu hỏi thường gặp' },
  contact: { slug: 'lien-he', label: 'Liên hệ hỗ trợ' },
  terms: { slug: 'dieu-khoan-su-dung', label: 'Điều khoản sử dụng' },
  privacy: { slug: 'chinh-sach-bao-mat', label: 'Chính sách bảo mật' },
  cookies: { slug: 'chinh-sach-cookie', label: 'Chính sách cookie' },
  payment: { slug: 'thanh-toan-va-hoan-tien', label: 'Thanh toán và hoàn tiền' },
  complaints: { slug: 'giai-quyet-khieu-nai', label: 'Giải quyết khiếu nại' },
  medical: { slug: 'mien-tru-trach-nhiem-y-khoa', label: 'Miễn trừ trách nhiệm y khoa' },
};

const SOCIAL_CHANNELS = [
  { key: 'facebook', label: 'Facebook', href: import.meta.env.VITE_SOCIAL_FACEBOOK_URL },
  { key: 'youtube', label: 'YouTube', href: import.meta.env.VITE_SOCIAL_YOUTUBE_URL },
  { key: 'linkedin', label: 'LinkedIn', href: import.meta.env.VITE_SOCIAL_LINKEDIN_URL },
  { key: 'zalo', label: 'Zalo', href: import.meta.env.VITE_SOCIAL_ZALO_URL },
].filter((channel) => /^https?:\/\//i.test(channel.href || ''));

function SocialIcon({ type }) {
  if (type === 'facebook') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8.2V6.7c0-.7.5-.9 1-.9h2.8V2h-3.7C10.4 2 9.5 4.7 9.5 6.4v1.8H7v4.2h2.5V22H14v-9.6h3.3l.5-4.2H14Z" /></svg>;
  }
  if (type === 'youtube') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 6.2a3 3 0 0 0-2.1-2.1C17.6 3.6 12 3.6 12 3.6s-5.6 0-7.5.5a3 3 0 0 0-2.1 2.1A31 31 0 0 0 2 12a31 31 0 0 0 .4 5.8 3 3 0 0 0 2.1 2.1c1.9.5 7.5.5 7.5.5s5.6 0 7.5-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22 12a31 31 0 0 0-.4-5.8ZM10 15.7V8.3l6 3.7-6 3.7Z" /></svg>;
  }
  if (type === 'linkedin') {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 8.2H2.4V21h4.1V8.2ZM4.5 2A2.4 2.4 0 1 0 4.5 6.8 2.4 2.4 0 0 0 4.5 2ZM21.6 13.7c0-3.9-2.1-5.8-4.9-5.8-2.3 0-3.3 1.2-3.8 2.1V8.2H8.8V21h4.1v-6.3c0-1.7.3-3.3 2.4-3.3 2 0 2.1 1.9 2.1 3.4V21h4.1l.1-7.3Z" /></svg>;
  }
  if (type === 'zalo') {
    return <span className="footer-zalo-icon" aria-hidden="true">Zalo</span>;
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4V4Zm2.2 2 5.8 5 5.8-5H6.2Zm11.9 12V8.5L12 13.8 5.9 8.5V18h12.2Z" /></svg>;
}

function ExternalSocialLink({ channel, compact = false }) {
  return (
    <a
      className={`footer-social-link footer-social-${channel.key}${compact ? ' compact' : ''}`}
      href={channel.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${channel.label} - mở trong tab mới`}
      title={`${channel.label} - mở trong tab mới`}
    >
      <SocialIcon type={channel.key} />
      {!compact ? <span>{channel.label}</span> : null}
    </a>
  );
}

function FooterInfoLink({ item, onNavigate }) {
  return (
    <a
      href={`/thong-tin/${item.slug}`}
      onClick={(event) => {
        if (!onNavigate) return;
        event.preventDefault();
        onNavigate(item.slug);
      }}
    >
      {item.label}
    </a>
  );
}

function MucBaoMatFooter({ onNavigate, onOpenBookingOverview, onOpenHealthNews }) {
  const year = new Date().getFullYear();
  const publicSiteUrl = import.meta.env.VITE_PUBLIC_SITE_URL
    || (typeof window !== 'undefined' ? window.location.origin : 'https://midhealth.vn');
  const encodedSiteUrl = encodeURIComponent(publicSiteUrl);
  const shareChannels = [
    {
      key: 'facebook',
      label: 'Chia sẻ qua Facebook',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedSiteUrl}`,
    },
    {
      key: 'linkedin',
      label: 'Chia sẻ qua LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedSiteUrl}`,
    },
    {
      key: 'email',
      label: 'Chia sẻ qua email',
      href: `mailto:?subject=${encodeURIComponent('Đặt khám trực tuyến cùng MidHealth')}&body=${encodedSiteUrl}`,
    },
  ];

  return (
    <footer className="site-footer" aria-label="Thông tin và chính sách MidHealth">
      <div className="footer-grid">
        <section className="footer-brand" aria-labelledby="footer-brand-title">
          <div id="footer-brand-title" className="footer-logo"><BieuTuongLogo /></div>
          <p className="footer-eyebrow">NỀN TẢNG ĐẶT KHÁM TRỰC TUYẾN</p>
          <p>
            Hỗ trợ người bệnh tìm cơ sở y tế, chọn lịch khám và quản lý phiếu khám trực tuyến
            trên một giao diện thống nhất.
          </p>
          <div className="footer-contact">
            <div>
              <span>Email hỗ trợ</span>
              <a href="mailto:cskh@midhealth.vn">cskh@midhealth.vn</a>
            </div>
            <div>
              <span>Cấp cứu y tế</span>
              <a href="tel:115">Gọi 115</a>
            </div>
          </div>
          {SOCIAL_CHANNELS.length > 0 ? (
            <div className="footer-social-section">
              <strong>Kết nối với MidHealth</strong>
              <div className="footer-social-row">
                {SOCIAL_CHANNELS.map((channel) => <ExternalSocialLink channel={channel} key={channel.key} />)}
              </div>
            </div>
          ) : null}
          <p className="footer-project-note">
            Đây là sản phẩm đồ án. Thông tin pháp nhân, giấy phép và kênh hỗ trợ chính thức
            phải được đơn vị vận hành xác minh trước khi cung cấp dịch vụ thương mại.
          </p>
        </section>

        <nav aria-labelledby="footer-service-title">
          <h3 id="footer-service-title">Đặt khám</h3>
          <a href="/dat-kham/bac-si" onClick={(event) => { event.preventDefault(); onOpenBookingOverview?.('doctor'); }}>
            Đặt khám bác sĩ
          </a>
          <a href="/dat-kham/benh-vien" onClick={(event) => { event.preventDefault(); onOpenBookingOverview?.('hospital'); }}>
            Đặt khám bệnh viện
          </a>
          <a href="/dat-kham/phong-kham" onClick={(event) => { event.preventDefault(); onOpenBookingOverview?.('clinic'); }}>
            Đặt khám phòng khám
          </a>
          <a href="/tin-tuc" onClick={(event) => { event.preventDefault(); onOpenHealthNews?.(); }}>
            Tin y tế
          </a>
        </nav>

        <nav aria-labelledby="footer-help-title">
          <h3 id="footer-help-title">Hỗ trợ người bệnh</h3>
          <FooterInfoLink item={INFO_LINKS.guide} onNavigate={onNavigate} />
          <FooterInfoLink item={INFO_LINKS.faq} onNavigate={onNavigate} />
          <FooterInfoLink item={INFO_LINKS.payment} onNavigate={onNavigate} />
          <FooterInfoLink item={INFO_LINKS.complaints} onNavigate={onNavigate} />
          <FooterInfoLink item={INFO_LINKS.contact} onNavigate={onNavigate} />
        </nav>

        <nav aria-labelledby="footer-legal-title">
          <h3 id="footer-legal-title">Thông tin pháp lý</h3>
          <FooterInfoLink item={INFO_LINKS.terms} onNavigate={onNavigate} />
          <FooterInfoLink item={INFO_LINKS.privacy} onNavigate={onNavigate} />
          <FooterInfoLink item={INFO_LINKS.cookies} onNavigate={onNavigate} />
          <FooterInfoLink item={INFO_LINKS.medical} onNavigate={onNavigate} />
          <FooterInfoLink item={INFO_LINKS.about} onNavigate={onNavigate} />
        </nav>
      </div>

      <div className="footer-safety-note">
        <strong>Trường hợp khẩn cấp:</strong>
        <span>
          MidHealth không phải dịch vụ cấp cứu. Hãy gọi <a href="tel:115">115</a> hoặc đến cơ sở
          y tế gần nhất khi có dấu hiệu nguy hiểm.
        </span>
      </div>

      <div className="footer-bottom">
        <div>
          <p>
            Nội dung sức khỏe chỉ có mục đích tham khảo, không thay thế chẩn đoán, chỉ định hoặc
            điều trị trực tiếp của người hành nghề khám bệnh, chữa bệnh.
          </p>
          <p>© {year} MidHealth. Sản phẩm phục vụ mục đích học tập và trình diễn.</p>
        </div>
        <div className="footer-share">
          <span>Chia sẻ website</span>
          {shareChannels.map((channel) => <ExternalSocialLink channel={channel} compact key={channel.key} />)}
        </div>
      </div>
    </footer>
  );
}

export { INFO_LINKS };
export default MucBaoMatFooter;
