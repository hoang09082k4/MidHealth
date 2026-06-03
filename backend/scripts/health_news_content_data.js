const imagePath = (file) => `/image_tin_y_te/${file}`;

const sourceNote = (items) => `
  <h2>Nguồn tham khảo</h2>
  <ul>
    ${items.map((item) => `<li><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.label}</a></li>`).join('')}
  </ul>
  <p><em>Nội dung chỉ dùng để tham khảo, không thay thế chẩn đoán hoặc điều trị trực tiếp từ nhân viên y tế.</em></p>
`;

const sources = {
  cdcBloodPressure: {
    label: 'CDC - About High Blood Pressure',
    url: 'https://www.cdc.gov/high-blood-pressure/about/index.html',
  },
  cdcPhysicalActivity: {
    label: 'CDC - Adult Activity: An Overview',
    url: 'https://www.cdc.gov/physical-activity-basics/guidelines/adults.html',
  },
  cdcDengue: {
    label: 'CDC - Symptoms of Dengue and Testing',
    url: 'https://www.cdc.gov/dengue/signs-symptoms/index.html',
  },
  medlineDiabetesType2: {
    label: 'MedlinePlus - Type 2 Diabetes',
    url: 'https://medlineplus.gov/diabetestype2.html',
  },
  medlineAcetaminophen: {
    label: 'MedlinePlus - Acetaminophen',
    url: 'https://medlineplus.gov/druginfo/meds/a681004.html',
  },
  medlineIbuprofen: {
    label: 'MedlinePlus - Ibuprofen',
    url: 'https://medlineplus.gov/druginfo/meds/a682159.html',
  },
  whoHealthyDiet: {
    label: 'WHO - Healthy diet',
    url: 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
  },
  cdcBmi: {
    label: 'CDC - BMI',
    url: 'https://www.cdc.gov/bmi/index.html',
  },
  acogPrenatalCare: {
    label: 'ACOG - Prenatal Care',
    url: 'https://www.acog.org/womens-health/faqs/prenatal-care',
  },
  cdcPostpartumDepression: {
    label: 'CDC - Symptoms of Depression Among Women',
    url: 'https://www.cdc.gov/reproductive-health/depression/index.html',
  },
  nimhDepression: {
    label: 'NIMH - Depression',
    url: 'https://www.nimh.nih.gov/health/publications/depression',
  },
  nimhGad: {
    label: 'NIMH - Generalized Anxiety Disorder',
    url: 'https://www.nimh.nih.gov/health/publications/generalized-anxiety-disorder-gad',
  },
  cdcAntibiotics: {
    label: 'CDC - Antibiotic Use and Antimicrobial Resistance Facts',
    url: 'https://www.cdc.gov/antibiotic-use/data-research/facts-stats/index.html',
  },
  cdcAdultVaccines: {
    label: 'CDC - Adult Immunization Schedule',
    url: 'https://www.cdc.gov/vaccines/hcp/imz-schedules/adult.html',
  },
  medlineScreening: {
    label: 'MedlinePlus - Health Screening',
    url: 'https://medlineplus.gov/healthscreening.html',
  },
  medlineEmergency: {
    label: 'MedlinePlus - Recognizing Medical Emergencies',
    url: 'https://medlineplus.gov/ency/article/001927.htm',
  },
  nccihGinger: {
    label: 'NCCIH - Ginger: Usefulness and Safety',
    url: 'https://www.nccih.nih.gov/health/ginger',
  },
  nccihTurmeric: {
    label: 'NCCIH - Turmeric: Usefulness and Safety',
    url: 'https://www.nccih.nih.gov/health/turmeric',
  },
  medlineInsomnia: {
    label: 'MedlinePlus - Insomnia',
    url: 'https://medlineplus.gov/insomnia.html',
  },
  cdcAsthma: {
    label: 'CDC - About Asthma',
    url: 'https://www.cdc.gov/asthma/about/index.html',
  },
  medlineImmune: {
    label: 'MedlinePlus - Immune System',
    url: 'https://medlineplus.gov/immunesystem.html',
  },
  nhlbiSleepHealth: {
    label: 'NHLBI - Sleep Deprivation and Deficiency: How Sleep Affects Your Health',
    url: 'https://www.nhlbi.nih.gov/health/sleep-deprivation/health-effects',
  },
};

export const categories = [
  ['Sức khỏe tổng quát', 'suc-khoe-tong-quat', 'Kiến thức nền tảng giúp người đọc chăm sóc sức khỏe hằng ngày.'],
  ['Bệnh thường gặp', 'benh-thuong-gap', 'Triệu chứng, dấu hiệu cảnh báo và cách theo dõi các bệnh thường gặp.'],
  ['Thuốc', 'thuoc', 'Thông tin thuốc, cách dùng an toàn và các lưu ý quan trọng.'],
  ['Dinh dưỡng', 'dinh-duong', 'Dinh dưỡng cân bằng, thực phẩm và thói quen ăn uống lành mạnh.'],
  ['Mẹ và bé', 'me-va-be', 'Chăm sóc sức khỏe phụ nữ, thai kỳ, sau sinh và trẻ nhỏ.'],
  ['Sức khỏe tinh thần', 'suc-khoe-tinh-than', 'Kiến thức về tâm lý, cảm xúc, căng thẳng và chất lượng sống.'],
  ['Tin y tế', 'tin-y-te', 'Cập nhật khuyến cáo sức khỏe cộng đồng và thông tin y tế đáng chú ý.'],
  ['Kinh nghiệm đi khám', 'kinh-nghiem-di-kham', 'Hướng dẫn chuẩn bị, chọn chuyên khoa và đi khám hiệu quả.'],
  ['Dược liệu', 'duoc-lieu', 'Dược liệu, thảo dược và lưu ý an toàn khi sử dụng.'],
  ['Bệnh', 'benh', 'Triệu chứng, phòng bệnh và chăm sóc sức khỏe theo từng nhóm bệnh.'],
  ['Cơ thể', 'co-the', 'Kiến thức về cơ quan, hệ miễn dịch, giấc ngủ và hoạt động của cơ thể.'],
].map(([name, slug, description]) => ({ name, slug, description, status: 'active' }));

export const authors = [
  {
    name: 'Ban biên tập MidHealth',
    full_name: 'Ban biên tập MidHealth',
    title: 'Biên tập viên',
    specialty: 'Thông tin sức khỏe',
    avatar: '',
    avatar_url: '',
    description: 'Biên tập và rà soát nội dung sức khỏe theo nguồn tham khảo y khoa đáng tin cậy.',
    bio: 'Biên tập và rà soát nội dung sức khỏe theo nguồn tham khảo y khoa đáng tin cậy.',
    status: 'active',
  },
  {
    name: 'Dược sĩ MidHealth',
    full_name: 'Dược sĩ MidHealth',
    title: 'Dược sĩ',
    specialty: 'Thông tin thuốc và dược liệu',
    avatar: '',
    avatar_url: '',
    description: 'Rà soát thông tin thuốc, dược liệu, cách dùng và lưu ý an toàn.',
    bio: 'Rà soát thông tin thuốc, dược liệu, cách dùng và lưu ý an toàn.',
    status: 'active',
  },
];

function article({
  categorySlug,
  title,
  slug,
  summary,
  thumbnail,
  body,
  publishedAt,
  updatedAt = '2026-06-04T00:00:00+07:00',
  authorName = 'Ban biên tập MidHealth',
  featured = false,
  viewCount = 0,
}) {
  return {
    categorySlug,
    title,
    slug,
    summary,
    content: body,
    thumbnail,
    thumbnail_url: thumbnail,
    published_date: publishedAt,
    published_at: publishedAt,
    updated_date: updatedAt,
    updated_at: updatedAt,
    status: 'published',
    is_featured: featured,
    view_count: viewCount,
    authorName,
  };
}

export const articles = [
  article({
    categorySlug: 'suc-khoe-tong-quat',
    title: 'Tăng huyết áp: vì sao cần đo định kỳ ngay cả khi không có triệu chứng?',
    slug: 'tang-huyet-ap-vi-sao-can-do-dinh-ky',
    summary: 'Tăng huyết áp thường không gây triệu chứng rõ ràng nhưng có thể làm tăng nguy cơ biến chứng tim, não, thận và mắt.',
    thumbnail: imagePath('tang-huyet-ap-kiem-tra-dinh-ky.jpg'),
    publishedAt: '2026-06-04T00:00:00+07:00',
    featured: true,
    viewCount: 420,
    body: `
      <p>Tăng huyết áp là tình trạng áp lực máu tác động lên thành mạch cao kéo dài. Điểm nguy hiểm là nhiều người không có dấu hiệu đặc biệt, vẫn sinh hoạt bình thường nhưng mạch máu và các cơ quan đích đã chịu áp lực trong thời gian dài.</p>
      <h2>Vì sao cần đo huyết áp định kỳ?</h2>
      <p>Đo huyết áp là cách đơn giản để phát hiện sớm nguy cơ. Khi được phát hiện sớm, người bệnh có thể điều chỉnh ăn uống, vận động, giảm muối, kiểm soát cân nặng, hạn chế rượu bia, bỏ thuốc lá và dùng thuốc khi bác sĩ chỉ định.</p>
      <h2>Cách đo tại nhà đáng tin cậy hơn</h2>
      <p>Nên nghỉ ít nhất 5 phút trước khi đo, ngồi tựa lưng, đặt chân trên sàn, không nói chuyện khi đo và đặt vòng bít ngang mức tim. Nếu chỉ số cao bất thường, nên đo lại sau vài phút và ghi chép nhiều lần thay vì kết luận từ một lần đo đơn lẻ.</p>
      <h2>Khi nào cần đi khám?</h2>
      <p>Nếu huyết áp thường xuyên cao, có đau ngực, khó thở, yếu liệt, nói khó, đau đầu dữ dội hoặc nhìn mờ đột ngột, cần đi khám hoặc cấp cứu tùy mức độ triệu chứng.</p>
      ${sourceNote([sources.cdcBloodPressure])}
    `,
  }),
  article({
    categorySlug: 'suc-khoe-tong-quat',
    title: 'Người lớn nên vận động bao nhiêu mỗi tuần để bảo vệ sức khỏe?',
    slug: 'nguoi-lon-nen-van-dong-bao-nhieu-moi-tuan',
    summary: 'Vận động đều đặn giúp cải thiện tim mạch, cân nặng, đường huyết, giấc ngủ và sức khỏe tinh thần.',
    thumbnail: imagePath('van-dong-the-chat-nguoi-lon.jpg'),
    publishedAt: '2026-06-03T00:00:00+07:00',
    viewCount: 318,
    body: `
      <p>Vận động thể chất không chỉ là tập gym hoặc chơi thể thao cường độ cao. Đi bộ nhanh, đạp xe, bơi, làm vườn, leo cầu thang hoặc các hoạt động khiến nhịp tim tăng vừa phải đều có thể mang lại lợi ích.</p>
      <h2>Mốc khuyến nghị cơ bản</h2>
      <p>Người lớn nên hướng tới ít nhất 150 phút hoạt động aerobic cường độ vừa mỗi tuần, hoặc 75 phút hoạt động cường độ mạnh. Nên bổ sung hoạt động tăng cường cơ ít nhất 2 ngày mỗi tuần, phù hợp thể trạng và bệnh nền.</p>
      <h2>Bắt đầu thế nào nếu ít vận động?</h2>
      <p>Có thể chia nhỏ thành 10-15 phút mỗi lần, tăng dần theo tuần. Người có bệnh tim mạch, đau ngực, chóng mặt khi gắng sức, bệnh mạn tính chưa ổn định hoặc lớn tuổi nên hỏi ý kiến bác sĩ trước khi tập mạnh.</p>
      <h2>Dấu hiệu cần giảm cường độ</h2>
      <p>Đau ngực, khó thở bất thường, choáng, tim đập không đều, đau khớp dữ dội hoặc mệt kéo dài sau tập là các dấu hiệu cần dừng lại và được đánh giá y tế.</p>
      ${sourceNote([sources.cdcPhysicalActivity])}
    `,
  }),
  article({
    categorySlug: 'benh-thuong-gap',
    title: 'Sốt xuất huyết: dấu hiệu cảnh báo không nên bỏ qua',
    slug: 'sot-xuat-huyet-dau-hieu-canh-bao-khong-nen-bo-qua',
    summary: 'Sốt xuất huyết có thể chuyển nặng sau giai đoạn sốt, vì vậy cần theo dõi dấu hiệu cảnh báo và đi khám đúng lúc.',
    thumbnail: imagePath('sot-xuat-huyet-dau-hieu-canh-bao.jpg'),
    publishedAt: '2026-06-02T00:00:00+07:00',
    featured: true,
    viewCount: 395,
    body: `
      <p>Sốt xuất huyết là bệnh do virus dengue, lây truyền qua muỗi Aedes. Người bệnh thường sốt cao đột ngột, đau đầu, đau nhức cơ khớp, đau sau hốc mắt, buồn nôn, phát ban hoặc chảy máu nhẹ.</p>
      <h2>Vì sao giai đoạn hạ sốt vẫn cần theo dõi?</h2>
      <p>Một số trường hợp có thể nặng lên khi sốt bắt đầu giảm. Vì vậy, không nên chủ quan nếu người bệnh mệt nhiều, đau bụng, nôn ói, chảy máu hoặc lừ đừ.</p>
      <h2>Dấu hiệu cảnh báo</h2>
      <p>Cần đi khám ngay nếu có đau bụng nhiều, nôn liên tục, chảy máu mũi hoặc chân răng, nôn ra máu, đi tiêu phân đen, khó thở, vật vã, lừ đừ, tay chân lạnh hoặc tiểu ít.</p>
      <h2>Chăm sóc an toàn tại nhà</h2>
      <p>Uống đủ nước, nghỉ ngơi và dùng thuốc hạ sốt theo hướng dẫn. Không tự dùng aspirin hoặc ibuprofen khi nghi sốt xuất huyết vì có thể làm tăng nguy cơ chảy máu.</p>
      ${sourceNote([sources.cdcDengue])}
    `,
  }),
  article({
    categorySlug: 'benh-thuong-gap',
    title: 'Đái tháo đường type 2: triệu chứng sớm và cách theo dõi',
    slug: 'dai-thao-duong-type-2-trieu-chung-som-va-cach-theo-doi',
    summary: 'Đái tháo đường type 2 xảy ra khi đường huyết cao kéo dài, có thể âm thầm nhưng gây biến chứng nếu không kiểm soát.',
    thumbnail: imagePath('dai-thao-duong-type-2.jpg'),
    publishedAt: '2026-06-01T00:00:00+07:00',
    viewCount: 352,
    body: `
      <p>Đái tháo đường type 2 là bệnh mạn tính trong đó đường huyết tăng cao do cơ thể đề kháng insulin hoặc không tạo đủ insulin. Bệnh thường tiến triển âm thầm trong nhiều năm.</p>
      <h2>Dấu hiệu có thể gặp</h2>
      <p>Người bệnh có thể khát nhiều, tiểu nhiều, đói nhanh, mệt mỏi, nhìn mờ, vết thương lâu lành, nhiễm trùng tái phát hoặc tê bì bàn tay bàn chân. Tuy vậy, nhiều người chỉ phát hiện khi xét nghiệm.</p>
      <h2>Theo dõi và điều trị</h2>
      <p>Điều trị thường gồm dinh dưỡng hợp lý, vận động, giảm cân nếu thừa cân, theo dõi đường huyết và dùng thuốc khi cần. Mục tiêu điều trị nên cá thể hóa theo tuổi, bệnh nền và nguy cơ hạ đường huyết.</p>
      <h2>Khi nào cần đi khám sớm?</h2>
      <p>Đi khám nếu có triệu chứng nghi ngờ, có tiền sử gia đình, thừa cân, tăng huyết áp, rối loạn mỡ máu hoặc từng đái tháo đường thai kỳ.</p>
      ${sourceNote([sources.medlineDiabetesType2])}
    `,
  }),
  article({
    categorySlug: 'thuoc',
    title: 'Paracetamol dùng thế nào cho an toàn?',
    slug: 'paracetamol-dung-the-nao-cho-an-toan',
    summary: 'Paracetamol có trong nhiều thuốc giảm đau, hạ sốt và thuốc cảm; dùng trùng hoạt chất có thể gây quá liều nguy hiểm.',
    thumbnail: imagePath('paracetamol-cach-dung-an-toan.jpg'),
    publishedAt: '2026-05-31T00:00:00+07:00',
    authorName: 'Dược sĩ MidHealth',
    featured: true,
    viewCount: 388,
    body: `
      <p>Paracetamol, còn gọi là acetaminophen, thường dùng để giảm đau và hạ sốt. Thuốc có mặt trong nhiều sản phẩm không kê đơn và thuốc phối hợp điều trị cảm cúm.</p>
      <h2>Nguy cơ thường gặp</h2>
      <p>Người dùng dễ vô tình uống quá liều nếu dùng đồng thời nhiều thuốc cùng chứa paracetamol. Quá liều có thể gây tổn thương gan nghiêm trọng, kể cả khi ban đầu chưa có triệu chứng rõ ràng.</p>
      <h2>Dùng thuốc an toàn</h2>
      <p>Luôn đọc nhãn thuốc, kiểm tra hoạt chất, dùng đúng liều theo hướng dẫn và hỏi dược sĩ nếu đang dùng nhiều thuốc cùng lúc. Người có bệnh gan, uống rượu thường xuyên, phụ nữ mang thai hoặc đang dùng thuốc khác nên hỏi ý kiến chuyên môn.</p>
      <h2>Khi cần hỗ trợ y tế</h2>
      <p>Nếu nghi uống quá liều, cần liên hệ cơ sở y tế ngay, không chờ đến khi xuất hiện triệu chứng. Nếu sốt kéo dài hoặc đau không cải thiện, nên đi khám để tìm nguyên nhân.</p>
      ${sourceNote([sources.medlineAcetaminophen])}
    `,
  }),
  article({
    categorySlug: 'thuoc',
    title: 'Ibuprofen: khi nào cần thận trọng?',
    slug: 'ibuprofen-khi-nao-can-than-trong',
    summary: 'Ibuprofen là thuốc kháng viêm không steroid, có thể giúp giảm đau hạ sốt nhưng không phù hợp với mọi người.',
    thumbnail: imagePath('ibuprofen-luu-y-su-dung.jpg'),
    publishedAt: '2026-05-30T00:00:00+07:00',
    authorName: 'Dược sĩ MidHealth',
    viewCount: 301,
    body: `
      <p>Ibuprofen thuộc nhóm thuốc kháng viêm không steroid (NSAID), thường dùng giảm đau, hạ sốt và giảm viêm. Dù phổ biến, thuốc có thể gây tác dụng phụ nếu dùng sai cách hoặc dùng ở người có nguy cơ cao.</p>
      <h2>Ai cần hỏi ý kiến bác sĩ trước khi dùng?</h2>
      <p>Người có tiền sử loét dạ dày, xuất huyết tiêu hóa, bệnh thận, bệnh tim mạch, tăng huyết áp, đang dùng thuốc chống đông, phụ nữ mang thai hoặc người cao tuổi cần thận trọng.</p>
      <h2>Không dùng chồng nhiều NSAID</h2>
      <p>Không nên dùng ibuprofen cùng lúc với các NSAID khác nếu chưa được hướng dẫn. Dùng chung có thể tăng nguy cơ đau dạ dày, chảy máu, tổn thương thận hoặc biến cố tim mạch.</p>
      <h2>Khi nào cần ngừng thuốc và đi khám?</h2>
      <p>Đau bụng dữ dội, nôn ra máu, đi tiêu phân đen, khó thở, phù, phát ban nặng hoặc đau ngực là các dấu hiệu cần được đánh giá y tế.</p>
      ${sourceNote([sources.medlineIbuprofen])}
    `,
  }),
  article({
    categorySlug: 'dinh-duong',
    title: 'Chế độ ăn lành mạnh: bắt đầu từ những nguyên tắc nào?',
    slug: 'che-do-an-lanh-manh-bat-dau-tu-nguyen-tac-nao',
    summary: 'Ăn đa dạng, tăng rau quả, ngũ cốc nguyên hạt và giảm muối, đường, chất béo chuyển hóa là nền tảng của dinh dưỡng lành mạnh.',
    thumbnail: imagePath('che-do-an-lanh-manh.jpg'),
    publishedAt: '2026-05-29T00:00:00+07:00',
    featured: true,
    viewCount: 335,
    body: `
      <p>Chế độ ăn lành mạnh không phải là một thực đơn cứng nhắc. Mục tiêu là cung cấp đủ năng lượng, chất đạm, chất béo tốt, chất xơ, vitamin và khoáng chất, đồng thời hạn chế các yếu tố làm tăng nguy cơ bệnh mạn tính.</p>
      <h2>Nên ưu tiên gì?</h2>
      <p>Nên ăn đa dạng rau, trái cây, đậu, ngũ cốc nguyên hạt, nguồn đạm phù hợp và chất béo không bão hòa. Uống đủ nước và duy trì bữa ăn đều đặn giúp kiểm soát cảm giác đói tốt hơn.</p>
      <h2>Nên hạn chế gì?</h2>
      <p>Giảm muối, đường tự do, đồ uống có đường, thực phẩm siêu chế biến và chất béo chuyển hóa. Không cần loại bỏ hoàn toàn một nhóm thực phẩm nếu không có chỉ định y tế, nhưng cần kiểm soát tần suất và khẩu phần.</p>
      <h2>Cá nhân hóa theo bệnh nền</h2>
      <p>Người có đái tháo đường, bệnh thận, bệnh gan, gout, tăng huyết áp hoặc rối loạn mỡ máu nên được tư vấn dinh dưỡng cá thể hóa.</p>
      ${sourceNote([sources.whoHealthyDiet])}
    `,
  }),
  article({
    categorySlug: 'dinh-duong',
    title: 'Chỉ số BMI: hiểu đúng để theo dõi cân nặng',
    slug: 'chi-so-bmi-hieu-dung-de-theo-doi-can-nang',
    summary: 'BMI giúp sàng lọc tình trạng cân nặng ở người lớn, nhưng cần kết hợp vòng eo, bệnh nền và đánh giá lâm sàng.',
    thumbnail: imagePath('chi-so-bmi-can-nang.jpg'),
    publishedAt: '2026-05-28T00:00:00+07:00',
    viewCount: 276,
    body: `
      <p>BMI được tính bằng cân nặng chia cho bình phương chiều cao. Đây là công cụ sàng lọc đơn giản để ước tính tình trạng cân nặng ở người lớn.</p>
      <h2>BMI nói được điều gì?</h2>
      <p>BMI có thể gợi ý thiếu cân, cân nặng khỏe mạnh, thừa cân hoặc béo phì. Tuy nhiên, BMI không đo trực tiếp tỷ lệ mỡ, khối cơ, phân bố mỡ hoặc sức khỏe chuyển hóa.</p>
      <h2>Khi nào BMI dễ gây hiểu nhầm?</h2>
      <p>Người có nhiều cơ, vận động viên, người cao tuổi bị mất cơ, phụ nữ mang thai hoặc người phù giữ nước có thể có BMI không phản ánh chính xác tình trạng mỡ cơ thể.</p>
      <h2>Theo dõi cân nặng thực tế</h2>
      <p>Nên kết hợp BMI với vòng eo, huyết áp, đường huyết, mỡ máu, tiền sử gia đình và thói quen sinh hoạt. Mục tiêu cân nặng nên bền vững, không giảm cân cấp tốc.</p>
      ${sourceNote([sources.cdcBmi])}
    `,
  }),
  article({
    categorySlug: 'me-va-be',
    title: 'Khám thai lần đầu: cần chuẩn bị gì?',
    slug: 'kham-thai-lan-dau-can-chuan-bi-gi',
    summary: 'Khám thai sớm giúp xác nhận thai kỳ, đánh giá nguy cơ, lập kế hoạch xét nghiệm và theo dõi sức khỏe mẹ bé.',
    thumbnail: imagePath('kham-thai-lan-dau.jpg'),
    publishedAt: '2026-05-27T00:00:00+07:00',
    viewCount: 312,
    body: `
      <p>Khám thai là chăm sóc y tế trong thai kỳ. Lần khám đầu giúp bác sĩ xác nhận thai, tính tuổi thai, rà soát bệnh nền, thuốc đang dùng và các yếu tố nguy cơ.</p>
      <h2>Nên mang theo thông tin gì?</h2>
      <p>Nên chuẩn bị ngày đầu kỳ kinh cuối, kết quả thử thai hoặc siêu âm trước đó, bệnh sử, tiền sử thai sản, thuốc và thực phẩm bổ sung đang dùng, dị ứng thuốc và bệnh di truyền trong gia đình nếu có.</p>
      <h2>Buổi khám có thể gồm những gì?</h2>
      <p>Bác sĩ có thể đo huyết áp, cân nặng, hỏi triệu chứng, tư vấn dinh dưỡng, acid folic, tiêm chủng, xét nghiệm máu, nước tiểu và siêu âm tùy tuổi thai.</p>
      <h2>Dấu hiệu cần đi khám ngay</h2>
      <p>Ra máu âm đạo, đau bụng nhiều, chóng mặt ngất, sốt cao, nôn ói không uống được hoặc đau đầu nhìn mờ cần được đánh giá sớm.</p>
      ${sourceNote([sources.acogPrenatalCare])}
    `,
  }),
  article({
    categorySlug: 'me-va-be',
    title: 'Trầm cảm sau sinh: nhận biết sớm để được hỗ trợ',
    slug: 'tram-cam-sau-sinh-nhan-biet-som-de-duoc-ho-tro',
    summary: 'Trầm cảm sau sinh nghiêm trọng hơn “baby blues” và có thể ảnh hưởng đến mẹ, bé và gia đình nếu không được hỗ trợ.',
    thumbnail: imagePath('tram-cam-sau-sinh.jpg'),
    publishedAt: '2026-05-26T00:00:00+07:00',
    viewCount: 289,
    body: `
      <p>Sau sinh, nhiều phụ nữ có thay đổi cảm xúc do mệt mỏi, thiếu ngủ và biến động hormone. Tuy nhiên, nếu buồn bã, lo âu, mất hứng thú hoặc cảm giác vô vọng kéo dài, cần nghĩ đến trầm cảm sau sinh.</p>
      <h2>Dấu hiệu cần chú ý</h2>
      <p>Mẹ có thể khó ngủ dù bé ngủ, khó gắn kết với con, khó tập trung, tự trách bản thân, ăn uống thay đổi, khóc nhiều, cáu gắt hoặc mất niềm vui trong các hoạt động thường ngày.</p>
      <h2>Khi nào cần hỗ trợ khẩn cấp?</h2>
      <p>Nếu có ý nghĩ làm hại bản thân, làm hại em bé, nghe thấy hoặc nhìn thấy điều không có thật, gia đình cần đưa mẹ đến cơ sở y tế ngay.</p>
      <h2>Điều trị có hiệu quả</h2>
      <p>Trầm cảm sau sinh có thể điều trị bằng tư vấn tâm lý, hỗ trợ gia đình, điều chỉnh giấc ngủ và thuốc khi cần. Việc tìm kiếm hỗ trợ không phải là yếu đuối.</p>
      ${sourceNote([sources.cdcPostpartumDepression])}
    `,
  }),
  article({
    categorySlug: 'suc-khoe-tinh-than',
    title: 'Trầm cảm: dấu hiệu nào cho thấy bạn nên đi khám?',
    slug: 'tram-cam-dau-hieu-nao-cho-thay-nen-di-kham',
    summary: 'Trầm cảm không chỉ là buồn nhất thời; triệu chứng kéo dài có thể ảnh hưởng đến học tập, công việc, quan hệ và sức khỏe thể chất.',
    thumbnail: imagePath('tram-cam-dau-hieu.jpg'),
    publishedAt: '2026-05-25T00:00:00+07:00',
    viewCount: 341,
    body: `
      <p>Trầm cảm là rối loạn sức khỏe tâm thần có thể gặp ở nhiều độ tuổi. Người bệnh không chỉ buồn mà còn có thể mất hứng thú, mệt mỏi, rối loạn giấc ngủ, thay đổi ăn uống và khó tập trung.</p>
      <h2>Dấu hiệu thường gặp</h2>
      <p>Cảm giác buồn rỗng, vô vọng, dễ cáu, giảm năng lượng, cảm giác tội lỗi, đau nhức không rõ nguyên nhân hoặc suy nghĩ về cái chết là các dấu hiệu cần được quan tâm.</p>
      <h2>Khi nào nên đi khám?</h2>
      <p>Nên gặp chuyên gia nếu triệu chứng kéo dài, làm giảm khả năng sinh hoạt, học tập, làm việc hoặc ảnh hưởng quan hệ. Nếu có ý nghĩ tự hại, cần hỗ trợ khẩn cấp.</p>
      <h2>Điều trị không chỉ là thuốc</h2>
      <p>Tùy mức độ, điều trị có thể gồm trị liệu tâm lý, thuốc, điều chỉnh giấc ngủ, hoạt động thể chất, hỗ trợ xã hội và theo dõi định kỳ.</p>
      ${sourceNote([sources.nimhDepression])}
    `,
  }),
  article({
    categorySlug: 'suc-khoe-tinh-than',
    title: 'Rối loạn lo âu lan tỏa: khi lo lắng vượt khỏi kiểm soát',
    slug: 'roi-loan-lo-au-lan-toa-khi-lo-lang-vuot-khoi-kiem-soat',
    summary: 'Lo âu kéo dài, khó kiểm soát và đi kèm triệu chứng cơ thể có thể là dấu hiệu cần được đánh giá chuyên môn.',
    thumbnail: imagePath('roi-loan-lo-au.jpg'),
    publishedAt: '2026-05-24T00:00:00+07:00',
    viewCount: 267,
    body: `
      <p>Lo lắng là phản ứng bình thường trước áp lực. Tuy nhiên, nếu lo âu xảy ra hầu như mỗi ngày, kéo dài, khó kiểm soát và ảnh hưởng sinh hoạt, người bệnh nên được đánh giá.</p>
      <h2>Triệu chứng có thể gặp</h2>
      <p>Người bị rối loạn lo âu lan tỏa có thể bồn chồn, căng cơ, mệt mỏi, khó tập trung, cáu gắt, khó ngủ, tim đập nhanh hoặc đau bụng khi căng thẳng.</p>
      <h2>Không nên tự chịu đựng kéo dài</h2>
      <p>Lo âu có thể đi kèm trầm cảm, đau mạn tính hoặc vấn đề tim mạch. Việc thăm khám giúp phân biệt lo âu với bệnh cơ thể và lập kế hoạch hỗ trợ phù hợp.</p>
      <h2>Hướng hỗ trợ</h2>
      <p>Trị liệu tâm lý, kỹ năng quản lý căng thẳng, vận động, ngủ đủ và thuốc khi cần đều có thể giúp cải thiện triệu chứng.</p>
      ${sourceNote([sources.nimhGad])}
    `,
  }),
  article({
    categorySlug: 'tin-y-te',
    title: 'Không tự dùng kháng sinh: vì sao đây là khuyến cáo quan trọng?',
    slug: 'khong-tu-dung-khang-sinh-vi-sao-la-khuyen-cao-quan-trong',
    summary: 'Dùng kháng sinh khi không cần thiết làm tăng nguy cơ tác dụng phụ và góp phần tạo ra vi khuẩn kháng thuốc.',
    thumbnail: imagePath('khong-tu-dung-khang-sinh.jpg'),
    publishedAt: '2026-05-23T00:00:00+07:00',
    authorName: 'Dược sĩ MidHealth',
    featured: true,
    viewCount: 410,
    body: `
      <p>Kháng sinh chỉ có tác dụng với nhiễm khuẩn, không điều trị được cảm lạnh, cúm hoặc nhiều bệnh do virus. Tự mua kháng sinh khi ho, sốt, đau họng có thể không giúp khỏi nhanh hơn và còn gây hại.</p>
      <h2>Kháng kháng sinh là gì?</h2>
      <p>Khi vi khuẩn thay đổi để chống lại thuốc, nhiễm trùng có thể khó điều trị hơn. Kháng thuốc làm giảm hiệu quả của nhiều thủ thuật và điều trị hiện đại như phẫu thuật, ghép tạng, hóa trị hoặc chăm sóc bệnh mạn tính.</p>
      <h2>Người bệnh nên làm gì?</h2>
      <p>Chỉ dùng kháng sinh khi được kê, dùng đúng liều và đủ thời gian theo hướng dẫn. Không chia sẻ thuốc, không dùng lại đơn cũ và không yêu cầu kháng sinh nếu bác sĩ đánh giá không cần.</p>
      <h2>Khi cần đi khám</h2>
      <p>Sốt cao kéo dài, khó thở, đau ngực, lừ đừ, mất nước, triệu chứng nặng dần hoặc người bệnh có nguy cơ cao nên được khám để xác định nguyên nhân.</p>
      ${sourceNote([sources.cdcAntibiotics])}
    `,
  }),
  article({
    categorySlug: 'tin-y-te',
    title: 'Tiêm chủng người lớn: không chỉ dành cho trẻ em',
    slug: 'tiem-chung-nguoi-lon-khong-chi-danh-cho-tre-em',
    summary: 'Lịch tiêm chủng người lớn phụ thuộc tuổi, bệnh nền, nghề nghiệp, thai kỳ, tiền sử tiêm và nguy cơ phơi nhiễm.',
    thumbnail: imagePath('tiem-chung-phong-benh.jpg'),
    publishedAt: '2026-05-22T00:00:00+07:00',
    viewCount: 284,
    body: `
      <p>Nhiều người nghĩ tiêm chủng chỉ quan trọng ở trẻ em. Thực tế, miễn dịch có thể giảm theo thời gian và người lớn vẫn cần một số vaccine tùy tuổi, bệnh nền, nghề nghiệp, thai kỳ hoặc kế hoạch du lịch.</p>
      <h2>Vì sao cần rà soát lịch tiêm?</h2>
      <p>Rà soát lịch tiêm giúp biết vaccine nào đã đủ, vaccine nào cần nhắc lại và vaccine nào nên tránh trong tình huống đặc biệt như suy giảm miễn dịch hoặc mang thai.</p>
      <h2>Chuẩn bị trước khi tiêm</h2>
      <p>Nên mang hồ sơ tiêm chủng, danh sách thuốc đang dùng, thông tin dị ứng, bệnh nền và tình trạng mang thai nếu có. Sau tiêm, cần theo dõi phản ứng theo hướng dẫn tại điểm tiêm.</p>
      <h2>Không tự chọn vaccine theo tin truyền miệng</h2>
      <p>Khuyến cáo vaccine thay đổi theo tuổi, mùa dịch và nguy cơ cá nhân. Người bệnh nên trao đổi với bác sĩ hoặc cơ sở tiêm chủng đủ điều kiện.</p>
      ${sourceNote([sources.cdcAdultVaccines])}
    `,
  }),
  article({
    categorySlug: 'kinh-nghiem-di-kham',
    title: 'Đi khám sức khỏe tổng quát: chuẩn bị gì để kết quả chính xác hơn?',
    slug: 'di-kham-suc-khoe-tong-quat-chuan-bi-gi',
    summary: 'Chuẩn bị đúng giúp buổi khám thuận lợi, tránh thiếu thông tin và giúp bác sĩ diễn giải kết quả phù hợp hơn.',
    thumbnail: imagePath('kinh-nghiem-kham-tong-quat.jpg'),
    publishedAt: '2026-05-21T00:00:00+07:00',
    featured: true,
    viewCount: 432,
    body: `
      <p>Khám sức khỏe tổng quát thường gồm hỏi bệnh, khám lâm sàng và xét nghiệm hoặc chẩn đoán hình ảnh tùy tuổi, giới, bệnh nền và yếu tố nguy cơ.</p>
      <h2>Nên chuẩn bị trước</h2>
      <p>Hãy mang thuốc đang dùng, kết quả xét nghiệm cũ, hồ sơ bệnh, thông tin dị ứng, tiền sử gia đình và danh sách câu hỏi muốn trao đổi. Nếu có xét nghiệm đường huyết hoặc mỡ máu, hãy hỏi trước có cần nhịn ăn không.</p>
      <h2>Không phải ai cũng cần cùng một gói xét nghiệm</h2>
      <p>Khám tầm soát nên dựa trên nguy cơ cá nhân. Một xét nghiệm có thể hữu ích với người này nhưng không cần thiết với người khác. Sau xét nghiệm, nên hỏi khi nào nhận kết quả và ai sẽ giải thích kết quả.</p>
      <h2>Sau buổi khám</h2>
      <p>Nên lưu kết quả, kế hoạch theo dõi, lịch tái khám và các thay đổi lối sống được khuyến nghị. Nếu có kết quả bất thường, không nên tự diễn giải rời rạc mà cần trao đổi với bác sĩ.</p>
      ${sourceNote([sources.medlineScreening])}
    `,
  }),
  article({
    categorySlug: 'kinh-nghiem-di-kham',
    title: 'Dấu hiệu nào cần đi cấp cứu thay vì chờ đặt lịch khám?',
    slug: 'dau-hieu-nao-can-di-cap-cuu-thay-vi-cho-dat-lich-kham',
    summary: 'Một số triệu chứng cần xử trí ngay vì trì hoãn có thể làm tăng nguy cơ biến chứng hoặc đe dọa tính mạng.',
    thumbnail: imagePath('dau-hieu-can-di-cap-cuu.jpg'),
    publishedAt: '2026-05-20T00:00:00+07:00',
    viewCount: 370,
    body: `
      <p>Không phải mọi vấn đề sức khỏe đều có thể chờ đến lịch khám thông thường. Nhận biết tình huống cấp cứu giúp người bệnh được điều trị kịp thời.</p>
      <h2>Dấu hiệu cần cấp cứu</h2>
      <p>Đau ngực, khó thở nặng, yếu liệt hoặc nói khó đột ngột, co giật, ngất, chảy máu không cầm, chấn thương nặng, bỏng nặng, phản vệ, lú lẫn đột ngột hoặc đau đầu dữ dội bất thường cần được xử trí ngay.</p>
      <h2>Không tự lái xe nếu nguy hiểm</h2>
      <p>Nếu người bệnh mất tỉnh táo, đau ngực, khó thở, đột quỵ nghi ngờ hoặc chấn thương nặng, nên gọi cấp cứu địa phương thay vì tự di chuyển không an toàn.</p>
      <h2>Thông tin nên chuẩn bị</h2>
      <p>Khi gọi cấp cứu, cần nói rõ vị trí, tuổi người bệnh, triệu chứng chính, thời điểm bắt đầu, bệnh nền, thuốc đang dùng và dị ứng nếu biết.</p>
      ${sourceNote([sources.medlineEmergency])}
    `,
  }),
  article({
    categorySlug: 'duoc-lieu',
    title: 'Gừng: công dụng thường gặp và lưu ý an toàn',
    slug: 'gung-cong-dung-thuong-gap-va-luu-y-an-toan',
    summary: 'Gừng thường được dùng trong thực phẩm và một số sản phẩm hỗ trợ tiêu hóa, nhưng vẫn cần thận trọng với thuốc và bệnh nền.',
    thumbnail: imagePath('gung-duoc-lieu.jpg'),
    publishedAt: '2026-05-19T00:00:00+07:00',
    authorName: 'Dược sĩ MidHealth',
    viewCount: 255,
    body: `
      <p>Gừng là dược liệu và gia vị phổ biến. Nhiều người dùng gừng để hỗ trợ cảm giác buồn nôn hoặc khó chịu tiêu hóa nhẹ, nhưng hiệu quả phụ thuộc tình huống và cách dùng.</p>
      <h2>Không xem gừng là thuốc thay thế điều trị</h2>
      <p>Gừng không thay thế thuốc điều trị bệnh tiêu hóa, nhiễm trùng, thai kỳ nguy cơ cao hoặc các bệnh mạn tính. Nếu triệu chứng kéo dài, nôn nhiều, đau bụng dữ dội hoặc sụt cân, cần đi khám.</p>
      <h2>Lưu ý tương tác</h2>
      <p>Người đang dùng thuốc chống đông, có rối loạn chảy máu, sắp phẫu thuật, phụ nữ mang thai hoặc có bệnh nền nên hỏi ý kiến chuyên môn trước khi dùng liều cao hoặc sản phẩm bổ sung từ gừng.</p>
      <h2>Dùng thực tế</h2>
      <p>Dùng gừng như gia vị trong khẩu phần thường an toàn với đa số người. Cần tránh lạm dụng các sản phẩm cô đặc hoặc quảng cáo chữa bệnh.</p>
      ${sourceNote([sources.nccihGinger])}
    `,
  }),
  article({
    categorySlug: 'duoc-lieu',
    title: 'Nghệ và curcumin: hiểu đúng trước khi dùng sản phẩm bổ sung',
    slug: 'nghe-va-curcumin-hieu-dung-truoc-khi-dung',
    summary: 'Nghệ là gia vị quen thuộc, curcumin là hoạt chất được nghiên cứu; sản phẩm bổ sung cần dùng thận trọng.',
    thumbnail: imagePath('nghe-curcumin-duoc-lieu.jpg'),
    publishedAt: '2026-05-18T00:00:00+07:00',
    authorName: 'Dược sĩ MidHealth',
    viewCount: 244,
    body: `
      <p>Nghệ chứa curcumin và nhiều hợp chất khác. Trong ẩm thực, nghệ thường được dùng như gia vị. Các sản phẩm bổ sung curcumin có hàm lượng cao hơn nhiều so với lượng ăn thông thường.</p>
      <h2>Bằng chứng cần được hiểu thận trọng</h2>
      <p>Một số nghiên cứu xem xét nghệ hoặc curcumin trong các tình huống khác nhau, nhưng không nên diễn giải thành khả năng chữa bệnh cho mọi người. Chất lượng sản phẩm và khả năng hấp thu cũng khác nhau.</p>
      <h2>Ai cần hỏi ý kiến trước khi dùng?</h2>
      <p>Người đang dùng thuốc chống đông, có bệnh gan mật, sỏi mật, chuẩn bị phẫu thuật, đang mang thai, cho con bú hoặc đang điều trị bệnh mạn tính nên hỏi bác sĩ hoặc dược sĩ.</p>
      <h2>Tránh quảng cáo quá mức</h2>
      <p>Không nên bỏ thuốc điều trị để dùng nghệ hoặc curcumin. Nếu dùng sản phẩm bổ sung, cần chọn nguồn rõ ràng và thông báo với bác sĩ khi đi khám.</p>
      ${sourceNote([sources.nccihTurmeric])}
    `,
  }),
  article({
    categorySlug: 'benh',
    title: 'Mất ngủ: nguyên nhân thường gặp và khi nào cần đi khám',
    slug: 'mat-ngu-nguyen-nhan-thuong-gap-va-khi-nao-can-di-kham',
    summary: 'Mất ngủ có thể do căng thẳng, thói quen ngủ, bệnh lý, thuốc hoặc rối loạn giấc ngủ; điều trị cần dựa vào nguyên nhân.',
    thumbnail: imagePath('mat-ngu-nguyen-nhan.jpg'),
    publishedAt: '2026-05-17T00:00:00+07:00',
    viewCount: 298,
    body: `
      <p>Mất ngủ là khó đi vào giấc ngủ, khó duy trì giấc ngủ hoặc thức dậy quá sớm và không ngủ lại được. Tình trạng này có thể ngắn hạn hoặc kéo dài.</p>
      <h2>Nguyên nhân thường gặp</h2>
      <p>Căng thẳng, dùng caffeine muộn, ngủ trưa quá lâu, sử dụng màn hình sát giờ ngủ, đau mạn tính, bệnh hô hấp, trầm cảm, lo âu hoặc một số thuốc có thể làm mất ngủ.</p>
      <h2>Nên thử điều chỉnh gì?</h2>
      <p>Giữ giờ ngủ thức ổn định, giảm ánh sáng mạnh buổi tối, tránh caffeine gần giờ ngủ, tạo môi trường ngủ yên tĩnh và chỉ lên giường khi buồn ngủ.</p>
      <h2>Khi nào cần đi khám?</h2>
      <p>Nên đi khám nếu mất ngủ kéo dài nhiều tuần, buồn ngủ ban ngày, ảnh hưởng công việc, ngáy to ngưng thở, đau ngực khó thở ban đêm hoặc có triệu chứng trầm cảm lo âu.</p>
      ${sourceNote([sources.medlineInsomnia])}
    `,
  }),
  article({
    categorySlug: 'benh',
    title: 'Hen suyễn kiểm soát kém: dấu hiệu và cách theo dõi',
    slug: 'hen-suyen-kiem-soat-kem-dau-hieu-va-cach-theo-doi',
    summary: 'Hen suyễn ảnh hưởng đường thở và có thể gây ho, khò khè, tức ngực, khó thở; kiểm soát tốt giúp giảm cơn cấp.',
    thumbnail: imagePath('hen-suyen-kiem-soat-kem.jpg'),
    publishedAt: '2026-05-16T00:00:00+07:00',
    viewCount: 287,
    body: `
      <p>Hen suyễn là bệnh ảnh hưởng phổi và đường thở. Triệu chứng có thể thay đổi theo thời tiết, dị nguyên, nhiễm siêu vi, gắng sức, khói thuốc hoặc môi trường ô nhiễm.</p>
      <h2>Dấu hiệu kiểm soát kém</h2>
      <p>Ho hoặc khò khè nhiều về đêm, cần thuốc cắt cơn thường xuyên, khó thở khi vận động nhẹ, phải nghỉ học nghỉ làm hoặc từng nhập viện vì cơn hen là các dấu hiệu cần đánh giá lại kế hoạch điều trị.</p>
      <h2>Theo dõi yếu tố khởi phát</h2>
      <p>Người bệnh nên ghi nhận yếu tố làm nặng như bụi, nấm mốc, lông thú, khói thuốc, mùi mạnh, lạnh, vận động hoặc nhiễm trùng hô hấp. Tránh yếu tố khởi phát giúp giảm cơn hen.</p>
      <h2>Khi nào cần cấp cứu?</h2>
      <p>Khó thở nặng, nói không thành câu, tím tái, lơ mơ hoặc dùng thuốc cắt cơn không cải thiện cần được cấp cứu ngay.</p>
      ${sourceNote([sources.cdcAsthma])}
    `,
  }),
  article({
    categorySlug: 'co-the',
    title: 'Hệ miễn dịch hoạt động như thế nào?',
    slug: 'he-mien-dich-hoat-dong-nhu-the-nao',
    summary: 'Hệ miễn dịch giúp nhận diện và đáp ứng với tác nhân có hại, nhưng cũng cần cân bằng để tránh phản ứng quá mức.',
    thumbnail: imagePath('he-mien-dich.jpg'),
    publishedAt: '2026-05-15T00:00:00+07:00',
    viewCount: 260,
    body: `
      <p>Hệ miễn dịch là mạng lưới tế bào, mô và cơ quan giúp cơ thể nhận diện, đáp ứng với vi sinh vật, độc tố hoặc chất lạ có thể gây hại.</p>
      <h2>Miễn dịch bẩm sinh và thích ứng</h2>
      <p>Miễn dịch bẩm sinh phản ứng nhanh, gồm hàng rào da niêm mạc và các tế bào phòng vệ. Miễn dịch thích ứng học cách nhận diện tác nhân cụ thể và tạo trí nhớ miễn dịch sau nhiễm trùng hoặc tiêm chủng.</p>
      <h2>Khi hệ miễn dịch mất cân bằng</h2>
      <p>Phản ứng quá yếu làm tăng nguy cơ nhiễm trùng. Phản ứng quá mức hoặc sai mục tiêu có thể liên quan dị ứng, viêm hoặc bệnh tự miễn.</p>
      <h2>Chăm sóc hệ miễn dịch</h2>
      <p>Ngủ đủ, ăn đa dạng, vận động, tiêm chủng đúng khuyến cáo, kiểm soát bệnh mạn tính và tránh thuốc lá là các nền tảng hỗ trợ sức khỏe miễn dịch.</p>
      ${sourceNote([sources.medlineImmune])}
    `,
  }),
  article({
    categorySlug: 'co-the',
    title: 'Giấc ngủ ảnh hưởng cơ thể ra sao?',
    slug: 'giac-ngu-anh-huong-co-the-ra-sao',
    summary: 'Ngủ đủ và đúng thời điểm hỗ trợ não bộ, chuyển hóa, miễn dịch, an toàn khi lái xe và chất lượng sống.',
    thumbnail: imagePath('giac-ngu-va-co-the.jpg'),
    publishedAt: '2026-05-14T00:00:00+07:00',
    viewCount: 274,
    body: `
      <p>Giấc ngủ là thời gian cơ thể phục hồi và điều hòa nhiều chức năng quan trọng. Thiếu ngủ không chỉ gây mệt mà còn ảnh hưởng tập trung, cảm xúc, chuyển hóa và an toàn khi làm việc hoặc lái xe.</p>
      <h2>Dấu hiệu thiếu ngủ</h2>
      <p>Buồn ngủ ban ngày, khó tập trung, dễ cáu, phản xạ chậm, ngủ gật khi đọc sách, xem tivi hoặc ngồi yên là dấu hiệu ngủ chưa đủ hoặc chất lượng ngủ kém.</p>
      <h2>Ngủ đủ giúp gì?</h2>
      <p>Giấc ngủ hỗ trợ chức năng não, sức khỏe thể chất, miễn dịch, điều hòa hormone và phục hồi năng lượng. Thiếu ngủ kéo dài có thể làm nặng thêm nhiều vấn đề sức khỏe.</p>
      <h2>Thói quen nên duy trì</h2>
      <p>Giữ giờ ngủ ổn định, hạn chế caffeine chiều tối, giảm màn hình trước ngủ, tạo phòng ngủ yên tĩnh và trao đổi với bác sĩ nếu ngáy to, ngưng thở hoặc mất ngủ kéo dài.</p>
      ${sourceNote([sources.nhlbiSleepHealth])}
    `,
  }),
];

const editorialDepthByCategory = {
  'suc-khoe-tong-quat': `
      <h2>Người đọc nên tự theo dõi những gì?</h2>
      <p>Ngoài triệu chứng chính, người đọc nên ghi lại huyết áp, cân nặng, vòng eo, mức vận động, chất lượng giấc ngủ và các thay đổi bất thường như đau ngực, khó thở, chóng mặt, phù chân, mệt kéo dài hoặc sụt cân không rõ nguyên nhân. Những dữ liệu nhỏ này giúp bác sĩ nhìn được xu hướng thay vì chỉ dựa vào cảm giác tại một thời điểm.</p>
      <h2>Những sai lầm thường gặp</h2>
      <p>Sai lầm phổ biến là chỉ đi khám khi đã có triệu chứng nặng, tự mua thuốc theo lời mách, bỏ qua kết quả xét nghiệm hơi bất thường hoặc thay đổi quá nhiều thói quen cùng lúc rồi không duy trì được. Với chăm sóc sức khỏe tổng quát, điều quan trọng là đều đặn, vừa sức và có theo dõi.</p>
      <h2>Khi nào cần gặp bác sĩ sớm hơn lịch định kỳ?</h2>
      <p>Nên đi khám sớm nếu có triệu chứng mới xuất hiện, triệu chứng tăng nhanh, bệnh nền đang kiểm soát kém, tác dụng phụ khi dùng thuốc hoặc chỉ số tại nhà lặp lại nhiều lần ở mức bất thường. Người có tiền sử gia đình mắc bệnh tim mạch, đái tháo đường, đột quỵ hoặc ung thư cũng nên trao đổi về kế hoạch tầm soát cá nhân hóa.</p>
      <h2>Câu hỏi nên hỏi trong buổi khám</h2>
      <p>Người bệnh nên hỏi mục tiêu theo dõi là gì, chỉ số nào cần ưu tiên, bao lâu nên kiểm tra lại, dấu hiệu nào cần đi khám ngay và thay đổi lối sống nào phù hợp nhất với lịch làm việc, tuổi, bệnh nền và khả năng tài chính của mình.</p>
  `,
  'benh-thuong-gap': `
      <h2>Cách phân biệt dấu hiệu nhẹ và dấu hiệu đáng lo</h2>
      <p>Nhiều bệnh thường gặp bắt đầu bằng triệu chứng giống nhau như sốt, mệt, đau đầu, đau cơ, ho hoặc rối loạn tiêu hóa. Điều cần chú ý không chỉ là có triệu chứng gì, mà là triệu chứng kéo dài bao lâu, có nặng dần không, có kèm mất nước, khó thở, lừ đừ, đau dữ dội, chảy máu hoặc thay đổi ý thức không.</p>
      <h2>Theo dõi tại nhà sao cho hữu ích?</h2>
      <p>Nên ghi lại thời điểm bắt đầu bệnh, nhiệt độ, thuốc đã dùng, lượng nước uống, số lần nôn hoặc tiêu chảy, mức độ đau, phát ban, tình trạng ăn uống và nước tiểu. Khi đi khám, thông tin này giúp bác sĩ đánh giá diễn tiến và quyết định có cần xét nghiệm hay theo dõi sát hơn hay không.</p>
      <h2>Không tự điều trị kéo dài</h2>
      <p>Tự dùng thuốc nhiều ngày mà không rõ chẩn đoán có thể che lấp triệu chứng hoặc làm chậm điều trị đúng. Kháng sinh, thuốc kháng viêm, corticoid, thuốc chống nôn, thuốc cầm tiêu chảy và thuốc giảm đau mạnh đều cần dùng đúng hoàn cảnh.</p>
      <h2>Nhóm cần thận trọng hơn</h2>
      <p>Trẻ nhỏ, người cao tuổi, phụ nữ mang thai, người suy giảm miễn dịch và người có bệnh nền như tim mạch, thận, gan, đái tháo đường hoặc hen suyễn nên đi khám sớm hơn khi triệu chứng không rõ ràng hoặc diễn tiến nhanh.</p>
  `,
  thuoc: `
      <h2>Trước khi dùng thuốc cần kiểm tra gì?</h2>
      <p>Người dùng nên kiểm tra tên hoạt chất, hàm lượng, liều dùng, khoảng cách giữa các liều, thời điểm uống so với bữa ăn, chống chỉ định và hạn dùng. Với thuốc không kê đơn, vẫn cần đọc kỹ nhãn vì nhiều sản phẩm phối hợp có thể chứa cùng một hoạt chất.</p>
      <h2>Thông tin cần nói với bác sĩ hoặc dược sĩ</h2>
      <p>Hãy nói rõ bệnh nền, dị ứng thuốc, thuốc đang dùng, thực phẩm bổ sung, tình trạng mang thai hoặc cho con bú và các phản ứng bất thường từng gặp. Đây là phần quan trọng để tránh tương tác thuốc và giảm nguy cơ tác dụng phụ.</p>
      <h2>Khi nào không nên tự tăng liều?</h2>
      <p>Không tự tăng liều khi thuốc chưa có tác dụng nhanh như mong muốn. Một số thuốc cần thời gian để đạt hiệu quả, trong khi tăng liều có thể làm tăng độc tính. Nếu triệu chứng không cải thiện, nên hỏi lại nhân viên y tế thay vì tự phối hợp nhiều thuốc.</p>
      <h2>Bảo quản và theo dõi sau khi dùng</h2>
      <p>Thuốc nên được bảo quản theo hướng dẫn trên nhãn, tránh ẩm, nóng và ánh sáng trực tiếp nếu không phù hợp. Sau khi dùng, cần theo dõi phát ban, khó thở, đau bụng dữ dội, nôn nhiều, chóng mặt, chảy máu bất thường hoặc triệu chứng nặng lên.</p>
  `,
  'dinh-duong': `
      <h2>Đọc thông tin dinh dưỡng như thế nào?</h2>
      <p>Khi chọn thực phẩm đóng gói, nên xem khẩu phần, năng lượng, đường, muối, chất béo bão hòa, chất béo chuyển hóa và chất xơ. Một sản phẩm trông “lành mạnh” vẫn có thể nhiều đường hoặc muối nếu ăn quá khẩu phần.</p>
      <h2>Không có một thực đơn đúng cho tất cả</h2>
      <p>Nhu cầu dinh dưỡng thay đổi theo tuổi, giới, mức vận động, bệnh nền, thuốc đang dùng, thai kỳ và mục tiêu sức khỏe. Người bệnh thận, gan, đái tháo đường, tăng huyết áp, gout hoặc rối loạn mỡ máu nên có hướng dẫn cá thể hóa.</p>
      <h2>Cách thay đổi bền vững</h2>
      <p>Thay vì kiêng khem cực đoan, nên bắt đầu bằng việc tăng rau, trái cây phù hợp, đạm chất lượng, ngũ cốc nguyên hạt, uống đủ nước và giảm dần đồ uống có đường. Thay đổi nhỏ nhưng duy trì được thường có giá trị hơn kế hoạch quá nghiêm ngặt rồi bỏ cuộc.</p>
      <h2>Dấu hiệu cần tư vấn chuyên môn</h2>
      <p>Sụt cân không chủ ý, tăng cân nhanh, mệt mỏi kéo dài, rối loạn tiêu hóa dai dẳng, ăn uống kém, thiếu máu, bệnh mạn tính mới phát hiện hoặc cần chế độ ăn điều trị là những tình huống nên gặp bác sĩ hoặc chuyên gia dinh dưỡng.</p>
  `,
  'me-va-be': `
      <h2>Vì sao cần theo dõi liên tục?</h2>
      <p>Sức khỏe mẹ và bé thay đổi theo từng giai đoạn. Một dấu hiệu có thể bình thường ở thời điểm này nhưng cần đánh giá ở thời điểm khác. Vì vậy, việc khám định kỳ, ghi nhận triệu chứng và hỏi rõ khi có bất thường là rất quan trọng.</p>
      <h2>Thông tin nên chuẩn bị khi đi khám</h2>
      <p>Nên mang theo hồ sơ thai kỳ hoặc hồ sơ sinh, thuốc và vitamin đang dùng, tiền sử dị ứng, bệnh nền, kết quả xét nghiệm, cân nặng, huyết áp nếu có theo dõi tại nhà và các câu hỏi gia đình đang lo lắng.</p>
      <h2>Dấu hiệu không nên chờ đợi</h2>
      <p>Đau bụng nhiều, ra máu, sốt cao, khó thở, đau đầu nhìn mờ, phù nhiều, nôn ói không uống được, bé bỏ bú, tím tái, li bì, co giật hoặc mẹ có ý nghĩ tự hại cần được hỗ trợ y tế ngay.</p>
      <h2>Vai trò của gia đình</h2>
      <p>Gia đình nên hỗ trợ mẹ nghỉ ngơi, ăn uống, theo dõi cảm xúc, chia việc chăm bé và đưa mẹ đi khám khi có dấu hiệu bất thường. Sự hỗ trợ thực tế thường quan trọng không kém lời động viên.</p>
  `,
  'suc-khoe-tinh-than': `
      <h2>Triệu chứng tâm thần cũng là triệu chứng sức khỏe</h2>
      <p>Buồn bã, lo âu, mất ngủ, hoảng sợ, kiệt sức, khó tập trung hoặc mất hứng thú kéo dài không phải là “yếu đuối”. Đó có thể là dấu hiệu cơ thể và não bộ đang cần được hỗ trợ đúng cách.</p>
      <h2>Theo dõi mức độ ảnh hưởng</h2>
      <p>Nên quan sát triệu chứng ảnh hưởng thế nào đến học tập, công việc, chăm sóc gia đình, ăn uống, giấc ngủ và quan hệ xã hội. Nếu người bệnh bắt đầu né tránh hoạt động thường ngày hoặc thấy cuộc sống không còn ý nghĩa, cần tìm hỗ trợ sớm.</p>
      <h2>Những việc có thể làm ngay</h2>
      <p>Giữ lịch ngủ tương đối ổn định, giảm rượu bia, vận động nhẹ, chia sẻ với người tin cậy và hạn chế tự cô lập có thể giúp giảm phần nào gánh nặng. Tuy nhiên, các biện pháp này không thay thế đánh giá chuyên môn khi triệu chứng nặng hoặc kéo dài.</p>
      <h2>Khi cần hỗ trợ khẩn cấp</h2>
      <p>Nếu có ý nghĩ tự hại, làm hại người khác, nghe thấy tiếng nói không có thật, mất kiểm soát hành vi hoặc không thể tự chăm sóc bản thân, cần liên hệ cấp cứu hoặc cơ sở y tế gần nhất ngay.</p>
  `,
  'tin-y-te': `
      <h2>Đọc tin y tế cần chú ý điều gì?</h2>
      <p>Tin y tế nên được hiểu trong bối cảnh nguồn phát hành, nhóm đối tượng áp dụng, thời điểm cập nhật và mức độ bằng chứng. Không nên lấy một khuyến cáo chung để tự áp dụng cho mọi bệnh nền hoặc mọi độ tuổi.</p>
      <h2>Tránh hiểu sai thông tin sức khỏe cộng đồng</h2>
      <p>Một thông tin về vaccine, kháng sinh, dịch bệnh hoặc thuốc có thể bị diễn giải sai khi tách khỏi hướng dẫn chính thức. Người đọc nên ưu tiên nguồn từ cơ quan y tế, bệnh viện, tổ chức chuyên môn và trao đổi với nhân viên y tế khi có tình huống cá nhân.</p>
      <h2>Việc nên làm sau khi đọc khuyến cáo</h2>
      <p>Nếu khuyến cáo liên quan đến thuốc, tiêm chủng, xét nghiệm hoặc phòng bệnh, hãy kiểm tra hồ sơ sức khỏe của mình, ghi lại câu hỏi và hỏi bác sĩ hoặc dược sĩ trước khi thay đổi điều trị.</p>
      <h2>Dấu hiệu của thông tin kém tin cậy</h2>
      <p>Cần cảnh giác với nội dung hứa hẹn chữa khỏi nhanh, phủ nhận hoàn toàn điều trị chuẩn, bán sản phẩm kèm lời cam kết quá mức hoặc không nêu nguồn tham khảo rõ ràng.</p>
  `,
  'kinh-nghiem-di-kham': `
      <h2>Chuẩn bị trước buổi khám giúp tiết kiệm thời gian</h2>
      <p>Người bệnh nên ghi lại triệu chứng chính, thời điểm bắt đầu, yếu tố làm nặng hoặc giảm, thuốc đã dùng, bệnh nền, dị ứng và câu hỏi muốn hỏi. Chuẩn bị tốt giúp bác sĩ khai thác thông tin nhanh và chính xác hơn.</p>
      <h2>Nên mang theo giấy tờ gì?</h2>
      <p>Nên mang căn cước, thẻ bảo hiểm nếu có, toa thuốc, kết quả xét nghiệm, phim chụp, giấy ra viện, hồ sơ bệnh cũ và danh sách thuốc hoặc thực phẩm bổ sung đang dùng. Với trẻ em hoặc người cao tuổi, người đi cùng nên nắm được diễn tiến bệnh.</p>
      <h2>Sau khi khám cần hỏi lại điều gì?</h2>
      <p>Hãy hỏi chẩn đoán hiện tại là gì, dấu hiệu nào cần quay lại sớm, thuốc dùng bao lâu, tác dụng phụ cần theo dõi, có cần xét nghiệm lại không và lịch tái khám cụ thể.</p>
      <h2>Không bỏ qua phần theo dõi sau khám</h2>
      <p>Nhiều bệnh cần đánh giá lại sau vài ngày hoặc vài tuần. Nếu triệu chứng không cải thiện, nặng hơn hoặc xuất hiện dấu hiệu mới, người bệnh nên liên hệ lại thay vì tự đổi thuốc.</p>
  `,
  'duoc-lieu': `
      <h2>Dược liệu không đồng nghĩa với an toàn tuyệt đối</h2>
      <p>Nhiều dược liệu được dùng lâu đời trong ẩm thực hoặc chăm sóc sức khỏe, nhưng sản phẩm cô đặc, liều cao hoặc dùng kéo dài vẫn có thể gây tác dụng phụ và tương tác thuốc.</p>
      <h2>Ai nên thận trọng hơn?</h2>
      <p>Phụ nữ mang thai, người cho con bú, trẻ nhỏ, người cao tuổi, người có bệnh gan thận, rối loạn đông máu, bệnh tim mạch hoặc đang dùng thuốc điều trị mạn tính nên hỏi ý kiến chuyên môn trước khi dùng sản phẩm dược liệu.</p>
      <h2>Cách chọn sản phẩm</h2>
      <p>Nên ưu tiên sản phẩm có nguồn gốc rõ ràng, nhãn đầy đủ thành phần, hàm lượng, hướng dẫn dùng và cảnh báo. Tránh sản phẩm quảng cáo chữa khỏi nhiều bệnh hoặc không minh bạch thành phần.</p>
      <h2>Khi nào cần ngừng dùng?</h2>
      <p>Nếu có phát ban, khó thở, đau bụng, vàng da, nước tiểu sẫm, chảy máu bất thường, chóng mặt hoặc triệu chứng bệnh nặng hơn, nên ngừng sản phẩm và đi khám.</p>
  `,
  benh: `
      <h2>Hiểu bệnh theo diễn tiến, không chỉ theo tên gọi</h2>
      <p>Cùng một bệnh có thể biểu hiện khác nhau ở từng người. Mức độ nặng phụ thuộc tuổi, bệnh nền, thuốc đang dùng, yếu tố môi trường và thời điểm phát hiện. Vì vậy, tự so sánh với người khác có thể dẫn đến chủ quan hoặc lo lắng quá mức.</p>
      <h2>Theo dõi triệu chứng có hệ thống</h2>
      <p>Nên ghi lại triệu chứng chính, tần suất, thời điểm xuất hiện, yếu tố khởi phát, thuốc đã dùng và mức độ ảnh hưởng đến sinh hoạt. Nếu bệnh tái phát nhiều lần, nhật ký triệu chứng rất hữu ích khi đi khám.</p>
      <h2>Mục tiêu điều trị thực tế</h2>
      <p>Với nhiều bệnh mạn tính, mục tiêu không chỉ là hết triệu chứng ngay mà là giảm cơn cấp, ngừa biến chứng, duy trì chức năng và cải thiện chất lượng sống. Điều trị cần theo dõi và điều chỉnh theo đáp ứng.</p>
      <h2>Dấu hiệu cần đánh giá lại</h2>
      <p>Triệu chứng nặng nhanh, sốt cao kéo dài, khó thở, đau ngực, sụt cân không rõ nguyên nhân, chảy máu, yếu liệt, lơ mơ hoặc không đáp ứng với điều trị ban đầu là lý do cần đi khám sớm.</p>
  `,
  'co-the': `
      <h2>Cơ thể hoạt động như một hệ thống liên kết</h2>
      <p>Một thay đổi ở giấc ngủ, dinh dưỡng, vận động, miễn dịch hoặc nội tiết có thể ảnh hưởng đến nhiều cơ quan khác. Vì vậy, chăm sóc sức khỏe không nên chỉ tập trung vào một triệu chứng đơn lẻ mà cần nhìn vào toàn bộ lối sống và bệnh nền.</p>
      <h2>Tín hiệu cơ thể cần được lắng nghe</h2>
      <p>Mệt kéo dài, đau lặp lại, thay đổi cân nặng, rối loạn giấc ngủ, khó thở, hồi hộp, phù, thay đổi tiêu tiểu hoặc suy giảm khả năng làm việc là những tín hiệu nên được theo dõi và trao đổi với bác sĩ nếu kéo dài.</p>
      <h2>Những yếu tố nền tảng</h2>
      <p>Ngủ đủ, ăn đa dạng, vận động đều, tiêm chủng phù hợp, kiểm soát căng thẳng và khám định kỳ là các yếu tố nền tảng giúp nhiều hệ cơ quan hoạt động ổn định hơn.</p>
      <h2>Không nên tự chẩn đoán từ một dấu hiệu</h2>
      <p>Một triệu chứng có thể có nhiều nguyên nhân. Tự chẩn đoán qua mạng dễ dẫn đến dùng sai thuốc hoặc bỏ sót bệnh quan trọng. Khi triệu chứng kéo dài hoặc ảnh hưởng sinh hoạt, nên đi khám để được đánh giá toàn diện.</p>
  `,
};

articles.forEach((item) => {
  const extra = editorialDepthByCategory[item.categorySlug];
  if (!extra || item.content.includes('Câu hỏi nên hỏi trong buổi khám')) return;
  item.content = item.content.replace(/\s*<h2>Nguồn tham khảo<\/h2>/, `${extra}\n  <h2>Nguồn tham khảo</h2>`);
});
