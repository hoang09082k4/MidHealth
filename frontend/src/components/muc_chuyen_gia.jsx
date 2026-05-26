function MucChuyenGia({ experts, editorialPolicies }) {
  return (
    <section className="expert-section">
      <h2>Đội ngũ chuyên gia</h2>
      <div className="expert-panel">
        <div className="expert-grid">
          {experts.map((expert) => (
            <article className="expert-item" key={expert.name}>
              <div className="expert-avatar">
                {expert.image ? <img src={`/image_doctor/${expert.image}`} alt="" /> : expert.initials}
              </div>
              <div>
                <h3>{expert.name}</h3>
                <p>{expert.specialty}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="expert-copy">
          <p>Hội đồng tham vấn y khoa cùng đội ngũ biên tập viên là các bác sĩ, dược sĩ đảm bảo nội dung MidHealth cung cấp chính xác về mặt y khoa và cập nhật những thông tin mới nhất.</p>
          <button className="pill-button" type="button">Đội ngũ chuyên gia <span>→</span></button>
        </div>
      </div>

      <div className="policy-band">
        <h2>Tạo nên một nguồn thông tin sức khỏe đáng tin cậy, dễ đọc, dễ hiểu cho mọi đối tượng độc giả</h2>
        {editorialPolicies.map((policy) => (
          <article key={`${policy.title}-${policy.text}`}>
            <div>{policy.icon}</div>
            <strong>{policy.title}</strong>
            <span>{policy.text}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

export default MucChuyenGia;
