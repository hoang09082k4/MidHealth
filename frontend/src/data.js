export const doctors = [
  {
    initials: 'LH',
    image: '1bf4426b4444c51a9c55.jpg',
    name: 'BS. CK2 Lê Thị Minh Hồng',
    specialty: 'Nhi khoa',
    workplace: 'Bệnh viện Nhi Đồng 2',
  },
  {
    initials: 'LT',
    image: '3f62dcffdad05b8e02c1.jpg',
    name: 'PGS. TS. BS Lâm Việt Trung',
    specialty: 'Tiêu hóa - Ngoại tiết niệu',
    workplace: 'Bệnh viện Chợ Rẫy',
  },
  {
    initials: 'TH',
    image: '448a5f1b5934d86a8125.jpg',
    name: 'BS. CK2 Nguyễn Thị Thu Hà',
    specialty: 'Nhi khoa',
    workplace: 'Bệnh viện Nhi Đồng Thành phố',
  },
  {
    initials: 'VH',
    image: '4ff24c634a4ccb12925d.jpg',
    name: 'BS. CK2 Võ Đức Hiếu',
    specialty: 'Ung bướu',
    workplace: 'Bệnh viện Ung Bướu TP.HCM',
  },
  {
    initials: 'TN',
    image: '6a5870c976e6f7b8aef7.jpg',
    name: 'PGS. TS. BS Trần Quốc Nhân',
    specialty: 'Nội tiết',
    workplace: 'Bệnh viện Đại học Y Dược',
  },
];

export const hospitals = [
  {
    avatar: 'avatar/avatar_benh_vien_nhi_dong_2.png',
    background: 'background/background_benh_vien_nhi_dong_2.png',
    name: 'Bệnh viện Nhi đồng 2',
    subtitle: 'Thân thiện như chính ngôi nhà của bạn',
    address: '14 Lý Tự Trọng, Phường Sài Gòn, TP. Hồ Chí Minh',
    intro: 'Bệnh viện Nhi Đồng 2 tọa lạc trên khu đất cao với diện tích 8,6 hecta, giáp 4 mặt tiền đường: Lý Tự Trọng, Chu Mạnh Trinh, Nguyễn Du và Hai Bà Trưng. Bệnh viện là đơn vị chuyên khoa Nhi hạng 1 trực thuộc Sở Y tế TP.HCM, tiếp nhận khám chữa bệnh cho trẻ em.',
    specialties: ['Nhi khoa', 'Sơ sinh', 'Dinh dưỡng', 'Nhiễm', 'Nội', 'Ung bướu - Huyết học', 'Tai Mũi Họng', 'Gan - Mật - Tụy', 'Hô hấp', 'Ngoại tổng hợp', 'Thận - Nội tiết', 'Tâm lý'],
    notes: [
      { title: 'Chọn khu khám:', lines: [
        '+ Khu Nguyễn Du (Số 33 Nguyễn Du, P. Sài Gòn, TP. HCM): Khám Tâm lý tại tầng 5',
        '+ Khu Lý Tự Trọng (Số 14 Lý Tự Trọng, P. Sài Gòn, TP. HCM): Khám theo yêu cầu các chuyên khoa: Sơ sinh, Dinh dưỡng, Nhiễm, Nội, Ung bướu – Huyết học, Tai Mũi Họng, Gan – Mật – Tụy, Hô hấp, Ngoại tổng hợp, Thận – Nội tiết.',
        'Các chuyên khoa khác hiện chưa áp dụng đặt lịch qua ứng dụng.',
      ] },
      { title: 'Lưu ý:', lines: [
        '+ Bệnh nhi đăng ký mua sổ khám trên app (nếu chưa có sổ) phí 5.000đ, nhận sổ tại khoa khám.',
        '+ Bệnh viện chỉ tiếp nhận bệnh nhân dưới 16 tuổi.',
        '+ Khi nhập số cân nặng và chiều cao, chỉ nhập số chẵn, không điền đơn vị.',
        '+ Bệnh nhi có nhu cầu khám tiêm ngừa, khám tầm soát nhi, vui lòng liên hệ 1900 1215 (không đặt khám online).',
      ] },
    ],
    hours: [
      { label: 'Thứ 2 đến Thứ 6, Buổi sáng', time: '7h00 - 11h00' },
      { label: 'Thứ 2 đến Thứ 6, Buổi chiều', time: '13h00 - 16h00' },
      { label: 'Thứ 7 và Chủ nhật (Khám ngoài giờ/dịch vụ)', time: '7h00 - 19h00' },
      { label: 'Cấp cứu', time: '24/7' },
    ],
  },
  {
    avatar: 'avatar/avatar_benh_vien_da_khoa.png',
    background: 'background/background_benh_vien_da_khoa.png',
    name: 'Bệnh viện Đa Khoa Thủ Đức',
    subtitle: 'Đa chuyên khoa - phục vụ tận tâm',
    address: '29 Phú Châu, Phường Tam Bình, TP. Hồ Chí Minh',
    intro: 'Bệnh viện Đa Khoa Thủ Đức cung cấp dịch vụ khám chữa bệnh đa chuyên khoa, hỗ trợ người bệnh đặt lịch chủ động và theo dõi lịch khám rõ ràng.',
    specialties: ['Nội tổng quát', 'Ngoại tổng quát', 'Tim mạch', 'Sản phụ khoa', 'Nhi khoa', 'Tai Mũi Họng', 'Da liễu', 'Xét nghiệm'],
    notes: [{ title: 'Lưu ý:', lines: ['Vui lòng điền chính xác thông tin người đi khám để bệnh viện tiếp nhận nhanh chóng.', 'Một số chuyên khoa có thể thay đổi khung giờ tiếp nhận theo lịch vận hành thực tế.'] }],
    hours: [
      { label: 'Thứ 2 đến Thứ 6', time: '7h00 - 16h30' },
      { label: 'Thứ 7', time: '7h00 - 11h30' },
      { label: 'Cấp cứu', time: '24/7' },
    ],
  },
  {
    avatar: 'avatar/avatar_benh_vien_quan_y.png',
    background: 'background/background_benh_vien_quan_y.png',
    name: 'Bệnh viện Quân Y 175',
    subtitle: 'Bệnh viện đa khoa tuyến cuối của Quân đội',
    address: '786 Nguyễn Kiệm, Phường Hạnh Thông, TP. Hồ Chí Minh',
    intro: 'Bệnh viện Quân y 175 tiếp nhận khám đa chuyên khoa, có khu khám theo yêu cầu và hỗ trợ đặt lịch trực tuyến cho các chuyên khoa phù hợp.',
    specialties: ['Nội tổng quát', 'Ngoại tổng quát', 'Chấn thương chỉnh hình', 'Tim mạch', 'Hô hấp', 'Tai Mũi Họng', 'Da liễu', 'Xét nghiệm'],
    notes: [{ title: 'THÔNG TIN', lines: [
      '+ Địa điểm khám bệnh ngoài giờ hành chính: Lầu 2, Khu khám bệnh theo yêu cầu, tòa nhà Viện Chấn thương Chỉnh hình, Bệnh viện Quân y 175.',
      '+ Hiện tại, Bệnh viện Quân y 175 chỉ hỗ trợ đặt lịch khám online đối với các chuyên khoa. Dịch vụ khám sức khỏe để làm giấy tờ chưa áp dụng hình thức đặt lịch trực tuyến.',
      '+ Để tầm soát lao phục vụ nhập cảnh Nhật Bản, khách hàng vui lòng đăng ký trực tiếp tại Phòng khám Sàng lọc Lao – Bệnh viện Quân y 175.',
      '📍 Địa điểm: Khu vực Xét nghiệm theo yêu cầu – tầng trệt nhà gửi xe máy, cổng Nguyễn Thái Sơn.',
      '📌 Lưu ý: Chưa hỗ trợ đặt lịch dịch vụ này qua ứng dụng.',
    ] }],
    hours: [
      { label: 'Thứ 2 đến Thứ 6', time: '7h00 - 16h30' },
      { label: 'Thứ 7', time: '7h00 - 16h00' },
      { label: 'Chủ Nhật', time: '7h00 - 11h30' },
    ],
  },
  {
    avatar: 'avatar/avatar_benh_vien_ung_buou.png',
    background: 'background/background_benh_vien_ung_buou.png',
    name: 'Bệnh viện Ung Bướu TPHCM',
    subtitle: 'Chuyên sâu ung bướu',
    address: '47 Nguyễn Huy Lượng, Phường Bình Thạnh, TP. Hồ Chí Minh',
    intro: 'Bệnh viện Ung Bướu TPHCM là cơ sở chuyên khoa ung bướu, hỗ trợ khám, tư vấn và điều trị cho người bệnh với nhiều chuyên khoa liên quan.',
    specialties: ['Ung bướu', 'Huyết học', 'Nội tổng quát', 'Chẩn đoán hình ảnh', 'Xét nghiệm'],
    notes: [{ title: 'Lưu ý:', lines: ['Vui lòng chuẩn bị hồ sơ bệnh án, kết quả xét nghiệm hoặc toa thuốc cũ nếu có.', 'Một số dịch vụ chuyên sâu có thể cần xác nhận lại từ bệnh viện.'] }],
    hours: [
      { label: 'Khám giờ hành chính', time: '7h30 - 16h30' },
      { label: 'Khám dịch vụ', time: '5h00 - 19h00' },
      { label: 'Cấp cứu', time: '24/7' },
    ],
  },
  {
    avatar: 'avatar/avatar_benh_vien_rang_ham_mat.png',
    background: 'background/background_benh_vien_rang_ham_mat.png',
    name: 'Bệnh viện Răng Hàm Mặt TP.HCM',
    subtitle: 'Chuyên khoa Răng Hàm Mặt',
    address: '263-265 Trần Hưng Đạo, Phường Cầu Ông Lãnh, TP. Hồ Chí Minh',
    intro: 'Bệnh viện Răng Hàm Mặt TP.HCM tiếp nhận khám và điều trị các vấn đề răng hàm mặt, hỗ trợ đặt lịch với loại hình khám phù hợp.',
    specialties: ['Răng - Hàm - Mặt', 'Nha khoa tổng quát', 'Phẫu thuật hàm mặt', 'Chỉnh nha'],
    notes: [{ title: 'LƯU Ý', lines: [
      'Hiện tại ứng dụng Bệnh viện Răng Hàm Mặt TPHCM tiếp nhận đặt lịch với loại hình khám VIP và KHÔNG áp dụng bảo hiểm y tế (các ngày trong tuần, trừ chiều thứ 7 và cả ngày Chủ nhật).',
      '+ Ở bước điền hồ sơ bệnh nhân, vui lòng điền chính xác thông tin của người đi khám để được tiếp nhận nhanh chóng.',
      '+ Với những bệnh nhân đã được bác sĩ hẹn lịch tái khám: vui lòng đến trực tiếp bệnh viện để đăng ký khám (không đăng ký online).',
      '+ Trẻ em từ 14 tuổi trở xuống không cần đặt lịch, chỉ cần đến trực tiếp bệnh viện đăng ký khám sẽ được hỗ trợ.',
      'Bệnh nhân vui lòng liên hệ tổng đài 1900 636 227 để được hỗ trợ trong quá trình đặt khám.',
    ] }],
    hours: [
      { label: 'Thứ 2 - Thứ 6', time: '7h - 18h30' },
      { label: 'Thứ 7', time: '7h30 - 18h30' },
      { label: 'Chủ nhật', time: '8h - 14h' },
    ],
  },
  {
    avatar: 'avatar/avatar_benh_vien_y_hoc_co_truyen.png',
    background: 'background/background_benh_vien_y_hoc_co_truyen.png',
    name: 'Bệnh viện Y Học Cổ Truyền TP.HCM',
    subtitle: 'Y học cổ truyền kết hợp hiện đại',
    address: '179 -187 Nam Kỳ Khởi Nghĩa, Phường Xuân Hòa, TP. Hồ Chí Minh',
    intro: 'Bệnh viện Y Học Cổ Truyền TP.HCM cung cấp dịch vụ khám và điều trị theo y học cổ truyền, kết hợp chăm sóc phục hồi sức khỏe.',
    specialties: ['Y học cổ truyền', 'Phục hồi chức năng', 'Cơ xương khớp', 'Nội tổng quát'],
    notes: [{ title: 'Lưu ý!', lines: [
      'Hiện tại, việc đặt khám online với Bệnh viện Y Học Cổ Truyền TP.HCM chỉ áp dụng cho bệnh nhân cũ (đã có mã bệnh nhân tại bệnh viện), bệnh nhân mới vui lòng đăng ký khám lần đầu trực tiếp tại Bệnh viện để được tạo mã bệnh nhân.',
      'Quý bệnh nhân vui lòng thông cảm.',
    ] }],
    hours: [
      { label: 'Thứ 2 - Thứ 7', time: '7h - 19h' },
      { label: 'Chủ nhật', time: '7h - 11h30' },
    ],
  },
];

export const specialties = [
  { name: 'Y học cổ truyền', image: 'Yhoccotruyen.webp' },
  { name: 'Lao - bệnh phổi', image: 'laobenhphoi.webp' },
  { name: 'Y học thể thao', image: 'yhocthethao.webp' },
  { name: 'Cơ xương khớp', image: 'Coxuongkhop.webp' },
  { name: 'Sản phụ khoa', image: 'sanphukhoa.webp' },
  { name: 'Nhãn khoa', image: 'Nhankhoa.webp' },
  { name: 'Nam khoa', image: 'Namkhoa.webp' },
  { name: 'Vô sinh hiếm muộn', image: 'vosinhhiemmuon.webp' },
  { name: 'Ngoại tiết niệu', image: 'Ngoaitietnieu.webp' },
  { name: 'Ngoại thần kinh', image: 'Ngoaithankinh.webp' },
  { name: 'Nội tổng quát', image: 'Noitongquat.webp' },
  { name: 'Ngoại niệu', image: 'ngoaitietnieu (1).webp' },
  { name: 'Dinh dưỡng', image: 'Dinhduong.webp' },
  { name: 'Tiêu hóa', image: 'tieuhoa.webp' },
  { name: 'Nhi khoa', image: 'Nhikhoa.webp' },
  { name: 'Da liễu', image: 'Dalieu.webp' },
  { name: 'Ngoại lồng ngực - mạch máu', image: 'ngoailongngucmachmau.webp' },
  { name: 'Chẩn đoán hình ảnh', image: 'Chandoanhinhanh.png' },
  { name: 'Ngôn ngữ trị liệu', image: 'ngonngutrilieu.webp' },
  { name: 'Răng - Hàm - Mặt', image: 'Ranghammat.webp' },
  { name: 'Nội thần kinh', image: 'Noithankinh.webp' },
  { name: 'Tai - Mũi - Họng', image: 'taimuihong.webp' },
  { name: 'Ung bướu', image: 'ungbuou.webp' },
  { name: 'Tim mạch', image: 'timmach.webp' },
  { name: 'Lão khoa', image: 'laokhoa.webp' },
  { name: 'Chấn thương chỉnh hình', image: 'Chanthuongchinhhinh.webp' },
  { name: 'Hồi sức - cấp cứu', image: 'hoisuccapcuu.png' },
  { name: 'Ngoại tổng quát', image: 'ngoaitongquat.webp' },
  { name: 'Gây mê hồi sức', image: 'Gaymehoisuc.webp' },
  { name: 'Y học dự phòng', image: 'yhocduphong.webp' },
  { name: 'Truyền nhiễm', image: 'truyennhiem.webp' },
  { name: 'Nội thận', image: 'Noithan.webp' },
  { name: 'Nội tiết', image: 'Noitiet.webp' },
  { name: 'Tâm thần', image: 'tamthan.webp' },
  { name: 'Hô hấp', image: 'Hohap.webp' },
  { name: 'Xét nghiệm', image: 'xetnghiem.webp' },
  { name: 'Huyết học', image: 'huyet-hoc.webp' },
  { name: 'Tâm lý', image: 'tamly.webp' },
  { name: 'Phẫu thuật tạo hình', image: '37_phauthuattaohinhthammy.webp' },
  { name: 'Đa khoa', image: 'Noitongquat (1).webp' },
  { name: 'Phục hồi chức năng', image: 'vatlitrilieu.webp' },
];

export const medicines = [
  { tag: 'Rx', name: 'Thuốc Metronidazol là gì?', description: 'Tác dụng, cách dùng và những điều lưu ý khi sử dụng.', author: 'Dược sĩ Phan Hữu Xuân Hạo', date: '18/11/2025' },
  { tag: 'Gel', name: 'Viên ngậm kháng viêm Difflam', description: 'Công dụng, cách dùng và lưu ý khi chăm sóc họng miệng.', author: 'Dược sĩ Phan Hữu Xuân Hạo', date: '18/03/2026' },
  { tag: 'Tab', name: 'Thuốc Lomexin 1000 mg là gì?', description: 'Công dụng, chỉ định, chống chỉ định và cách bảo quản.', author: 'Dược sĩ Bùi Hoàng Ngọc Khánh', date: '25/12/2024' },
  { tag: 'OTC', name: 'Lomexin 200mg là thuốc gì?', description: 'Cách dùng, liều dùng và lưu ý khi sử dụng thuốc.', author: 'Dược sĩ Bùi Hoàng Ngọc Khánh', date: '24/12/2024' },
  { tag: 'Info', name: 'Thuốc bổ sung vitamin', description: 'Thông tin tham khảo trước khi dùng thực phẩm bổ sung.', author: 'Dược sĩ Trần Minh', date: '16/01/2026' },
];

export const experts = [
  { initials: 'VK', image: '6aec5f71595ed800814f.jpg', name: 'ThS.BS Nguyễn Hồng Vân Khánh', specialty: 'Gan mật tụy - Ghép gan, Nhi' },
  { initials: 'LP', image: '6e11808d86a207fc5eb3.jpg', name: 'ThS.BS Đinh Thị Lan Phương', specialty: 'Tai - Mũi - Họng' },
  { initials: 'ĐT', image: '790b4c984ab7cbe992a6.jpg', name: 'ThS.BS Vũ Thành Đô', specialty: 'Tim - Thận - Khớp - Nội tiết' },
  { initials: 'PN', image: '91270d870ba88af6d3b9.jpg', name: 'ThS.BS Phan Lê Nam', specialty: 'Sản phụ khoa' },
  { initials: 'AH', image: 'bfbae228e40765593c16.jpg', name: 'Dược sĩ Dương Anh Hoàng', specialty: 'Dược' },
  { initials: 'NN', image: 'e51eb8bfbe903fce6681.jpg', name: 'ThS.BS Nguyễn Trung Nghĩa', specialty: 'Tâm thần' },
];

export const editorialPolicies = [
  { icon: '✎', title: 'Biên soạn bởi', text: 'Bác sĩ và Dược sĩ' },
  { icon: '✓', title: 'Chính sách biên tập', text: 'Nội dung minh bạch' },
  { icon: '◎', title: 'Chính sách', text: 'Quảng cáo rõ ràng' },
  { icon: '⌂', title: 'Chính sách', text: 'Bảo mật dữ liệu' },
];

export const trustItems = [
  { source: 'Thanh Niên', title: 'MidHealth hỗ trợ đặt lịch khám bệnh trực tuyến nhanh chóng' },
  { source: 'Sức khỏe & Đời sống', title: 'Chuyển đổi số y tế - xu hướng không thể đi ngược trong thời đại 4.0' },
  { source: 'Bệnh viện 175', title: 'Bệnh viện Quân y 175 triển khai kênh đặt khám trực tuyến' },
  { source: 'Y học cổ truyền', title: 'Bệnh viện Y học Cổ Truyền kết nối dịch vụ đặt khám MidHealth' },
];

export const securityItems = [
  { icon: '☆', title: 'Hạ tầng đạt tiêu chuẩn ISO 27001:2013' },
  { icon: '▣', title: 'Thông tin sức khỏe được bảo mật theo quy chuẩn HIPAA' },
  { icon: '◉', title: 'Thành viên VNISA' },
  { icon: '⌕', title: 'Pentest định kì hằng năm' },
];


export const articles = [
  { category: 'Phòng bệnh', title: 'Chuẩn bị gì trước khi đi khám chuyên khoa?', description: 'Danh sách giấy tờ, triệu chứng và thông tin thuốc đang dùng nên ghi lại trước khi gặp bác sĩ.' },
  { category: 'Sức khỏe gia đình', title: 'Khi nào cần đưa trẻ đi khám Nhi?', description: 'Những dấu hiệu cần theo dõi và các mốc nên đặt lịch khám sớm cho trẻ.' },
  { category: 'Dinh dưỡng', title: 'Ăn uống trước xét nghiệm máu', description: 'Một số xét nghiệm cần nhịn ăn, một số khác vẫn có thể sinh hoạt bình thường.' },
];

