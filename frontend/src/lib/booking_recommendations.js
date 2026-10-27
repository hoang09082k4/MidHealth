const normalize = value => String(value || '')
  .replace(/[đĐ]/g, 'd').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Common patient wording is mapped to clinic specialties for navigation only.
// The mappings intentionally favor first-contact assessment when a specialty
// is not offered; they are not a diagnostic or clinical-triage algorithm.
const symptomGroups = [
  {
    id: 'ent', area: 'Tai – Mũi – Họng', aliases: ['tai mui hong', 'ent', 'otorhinolaryngology'],
    terms: ['dau hong', 'rat hong', 'ngua hong', 'viem hong', 'viem amidan', 'sung amidan', 'nuot dau', 'dau khi nuot', 'kho nuot', 'vuong hong', 'co dom o hong', 'khan tieng', 'mat tieng', 'noi khan', 'dau tai', 'nhuc tai', 'chay tai', 'dich tai', 'nghe kem', 'giam thinh luc', 'u tai', 'reo tai', 'nghet tai', 'ngua tai', 'nghet mui', 'tac mui', 'so mui', 'chay mui', 'dich mui', 'hat hoi', 'ngua mui', 'dau xoang', 'dau vung xoang', 'dau tran', 'chay mau mui', 'mat mui', 'mat khuu giac', 'polyp mui', 'ngung tho khi ngu', 'ngu ngay', 'ho khan kem dau hong', 'khan tieng keo dai', "viem mui di ung", "dau am mui", "ngua hong", "ong tai", "nghe thay tieng ve", "dau mat ben trai", "dau mat ben phai", "viem tai giua", "viem tai ngoai", "dau tai khi nuot", "nghe kem dot ngot", "diec tai", "nghe khong ro", "viem xoang", "dau vung mui", "nghet mot ben mui", "chay nuoc mui", "ngua mui", "mat khuu giac", "mat mui", "dau hong keo dai"],
    detail: 'Phù hợp khi triệu chứng chính ở tai, mũi, xoang, họng hoặc giọng nói. Ho đơn thuần có thể cần đánh giá nội khoa trước.',
  },
  {
    id: 'eye', area: 'Mắt và thị lực', aliases: ['mat', 'nhan khoa', 'ophthalmology', 'eye clinic'], fallback: 'noi tong quat', missing: 'Mắt/Nhãn khoa',
    terms: ['dau mat', 'nhuc mat', 'mat do', 'do mat', 'mat cay', 'cay mat', 'kho mat', 'ran mat', 'nong mat', 'chay nuoc mat', 'nuoc mat song', 'ghen mat', 'dich mat', 'mat dinh ghe', 'dinh mat', 'ngua mat', 'di ung mat', 'sung mi mat', 'le mat', 'chao mat', 'nhin mo', 'nhin doi', 'chop sang', 'ruoi bay truoc mat', 'giam thi luc', 'mat thi luc', 'so anh sang', 'chan thuong mat', 'di vat vao mat', 'co di vat trong mat', 'mat song', 'moi mat', 'nhuc moi mat', 'loet giac mac', 'leo mat', "mat nhay", "mat nhay lien tuc", "mat nhuc", "nhay mat", "mi mat giat", "chop den truoc mat", "mo mat", "mat mo", "nhin thay mo", "nhin khong ro", "nhin khong ro net", "mat nhin khong ro", "thi luc mo", "mat nhin mo", "nhin thay chop sang", "nhin thay quang sang", "nhay mat lien tuc", "dau khi nhin", "kho nhin gan", "kho nhin xa", "nhay cam voi anh sang"],
    detail: 'Các triệu chứng mắt cần bác sĩ đánh giá riêng. Nội tổng quát chỉ là điểm tiếp nhận ban đầu nếu triệu chứng ổn định, không thay cho bác sĩ Mắt.',
  },
  {
    id: 'general', area: 'Nội khoa và triệu chứng toàn thân', aliases: ['noi tong quat', 'noi khoa', 'internal medicine', 'general medicine'],
    terms: ['sot', 'sot nhe', 'sot cao', 'sot ve chieu', 'ret run', 'lanh run', 'ho', 'ho khan', 'ho khang', 'ho co dom', 'ho ra dom', 'ho dai dang', 'ho keo dai', 'ho ve dem', 'ho sau khi an', 'kho khe', 'kho tho khi van dong', 'hen', 'dau dau', 'dau nua dau', 'dau dau sau gay', 'chong mat', 'choang vang', 'mat thang bang', 'te bi', 'te tay', 'te chan', 'te ran', 'hoi hop', 'tim dap nhanh', 'tim dap bat thuong', 'huyet ap cao', 'huyet ap thap', 'dau nguc nhe', 'dau bung', 'dau bung duoi', 'dau da day', 'nong rat thuong vi', 'trao nguoc', 'o nong', 'day bung', 'chuong bung', 'dau quan bung', 'buon non', 'non', 'non sau an', 'tieu chay', 'di ngoai long', 'tao bon', 'di ngoai kho', 'di cau ra mau', 'phan den', 'an khong tieu', 'an mau', 'dau hong lung', 'met moi', 'suy nhuoc', 'chan an', 'mat nuoc', 'kho mieng', 'kho nuot', 'tieu buot', 'dau khi tieu', 'phu chan', 'phu mat ca chan', 'dau lung', 'dau co', 'sut can', 'giam can', 'tang can', 'ra mo hoi dem', 'benh man tinh', 'tieu duong', 'duong huyet cao', 'tuyen giap', 'run tay', 'kho ngu', 'mat ngu', 'ngu ngon', 'dau co xuong khop', 'dau nhuc toan than', 'di ung thuc an', 'di ung thuoc', 'di ung', "dau nguc", "hut hoi", "dau bung lam ram", "co bung", "phong bung", "buon ia", "tieu ra mau", "phan co mau", "di ngoai ra mau", "di ngoai phan den", "kho tieu", "tieu dem", "kho tho", "tho kho", "dau co xuong", "dau bung tren", "choang", "choang khi dung len", "dau bung am i", "dau bung quan", "nong ran da day", "o chua", "day hoi", "di ngoai phan long", "phan long", "dau co bap", "sung mat", "lanh run"],
    detail: 'Lựa chọn phù hợp cho nhiều triệu chứng người lớn, ho/sốt hoặc khi chưa rõ chuyên khoa. Bác sĩ sẽ đánh giá và chuyển tuyến nếu cần.',
  },
  {
    id: 'dermatology', area: 'Da, tóc và móng', aliases: ['da lieu', 'dermatology'],
    terms: ['noi ban', 'phat ban', 'man do', 'man ngua', 'ngua da', 'ngua toan than', 'noi me day', 'noi may day', 'mun', 'mun trung ca', 'mun boc', 'mun dau den', 'eczema', 'cham da', 'viem da', 'da kho', 'da nut ne', 'da bong troc', 'bong da', 'noi mun nuoc', 'mun nuoc', 'vay nen', 'nam da', 'nam mong', 'nam da dau', 'mun coc', 'mun com', 'not ruoi thay doi', 'vet loet tren da', 'vet thuong lau lanh', 'da sung do', 'da bi kich ung', 'di ung da', 'rung toc', 'toc rung nhieu', 'toc mong', 'gay mong', 'mong doi mau', "ngua", "mun dau trang", "mun dau den", "mun boc", "rung long", "vet bam tim", "vet thuong tren da", "da noi bong nuoc", "ngua ngat", "ngua khap nguoi", "mong tay co soc", "mong chan bien mau"],
    detail: 'Phù hợp với ban da, ngứa, mụn, tổn thương da, tóc hoặc móng. Nếu sưng môi/lưỡi, khó thở hoặc dị ứng nặng, cần cấp cứu.',
  },
  {
    id: 'obgyn', area: 'Sản – Phụ khoa', aliases: ['san phu khoa', 'obstetrics', 'gynecology'],
    terms: ['mang thai', 'co thai', 'nghi co thai', 'tre kinh', 'cham kinh', 'mat kinh', 'kinh nguyet', 'kinh khong deu', 'rong kinh', 'ra kinh nhieu', 'dau bung kinh', 'dau khi hanh kinh', 'ra mau am dao', 'chay mau am dao', 'khi hu', 'khi hu bat thuong', 'ngua am dao', 'dau am dao', 'dau khi quan he', 'dau vung chau', 'dau bung duoi', 'kham thai', 'sieu am thai', 'thai may yeu', 'tu van tien san', 'tu van hau san', 'tranh thai', 'ke hoach hoa gia dinh', 'vo sinh', 'hiem muon', 'buong trung da nang', 'u xo tu cung', 'u vu', 'dau vu', 'tiet sua bat thuong', 'tien man kinh', 'man kinh', 'nong boc hoa', 'tram cam sau sinh', "ra mau khi mang thai", "dau bung khi mang thai", "thai may it", "dau nguc khi cho con bu", "ngua dau vu", "ra mau giua ky kinh", "dau bung sau sinh"],
    detail: 'Phù hợp với chăm sóc thai kỳ và triệu chứng phụ khoa. Ra máu nhiều, đau dữ dội hoặc choáng khi mang thai cần khám khẩn.',
  },
  {
    id: 'nutrition', area: 'Dinh dưỡng', aliases: ['dinh duong', 'nutrition'],
    terms: ['tu van dinh duong', 'tu van an uong', 'bieng an', 'kem an', 'an kem', 'kho an', 'an uong kem', 'cham tang can', 'cham tang truong', 'suy dinh duong', 'thieu can', 'thua can', 'beo phi', 'tang can co ke hoach', 'giam can co ke hoach', 'can nang', 'thuc don', 'che do an', 'dinh duong thai ky', 'dinh duong cho tre', 'an kieng'],
    detail: 'Phù hợp với tư vấn khẩu phần, mục tiêu cân nặng hoặc đánh giá tăng trưởng. Sụt cân không chủ ý hoặc mới xuất hiện nên được bác sĩ Nội tổng quát đánh giá nguyên nhân trước.',
  },
  {
    id: 'musculoskeletal', area: 'Cơ xương khớp / Chấn thương chỉnh hình', aliases: ['co xuong khop', 'chan thuong chinh hinh', 'orthopedics'], fallback: 'noi tong quat', missing: 'Cơ xương khớp/Chấn thương chỉnh hình',
    terms: ['dau xuong', 'dau khop', 'sung khop', 'cung khop', 'dau dau goi', 'dau goi', 'dau chan', 'dau got chan', 'dau co tay', 'dau ngon tay', 'dau vai', 'dau lung', 'dau cot song', 'dau that lung', 'dau co', 'dau gay', 'dau xuong suon', 'dau co xuong khop', 'han che van dong', 'te nga', 'va dap', 'bong gan', 'tran thuong', 'bong gan co chan', 'bong gan co tay', 'sung sau chan thuong', 'nghi gay xuong', 'gay xuong', 'gay chan', 'gay tay', 'lech khop', 'bien dang khop', "dau lung duoi", "dau lung tren", "dau xuong suon", "dau khop goi", "dau hong", "dau ngon chan", "dau ban chan", "dau co vai gay", "chan tay te bi", "dau vung hong", "dau khop hong"],
    detail: 'Website chưa có khoa Cơ xương khớp/Chấn thương chỉnh hình. Đau nhẹ, ổn định có thể hỏi Nội tổng quát để được đánh giá ban đầu; nghi gãy xương hoặc chấn thương nặng cần cơ sở cấp cứu.',
  },
  {
    id: 'dental', area: 'Răng – Hàm – Mặt', aliases: ['rang ham mat', 'dental', 'dentistry'], fallback: 'noi tong quat', missing: 'Răng – Hàm – Mặt',
    terms: ['dau rang', 'rang e buot', 'nhuc rang', 'sung loi', 'chay mau loi', 'loet mieng', 'nhiet mieng', 'dau ham', 'dau khop ham', 'sung mat do rang', 'sau rang', 'rang lung lay', 'ap xe rang', 'hoi mieng', 'chay mau sau nho rang', 'gay rang', 'rang khon dau', "dau nuou", "sung nuou", "loet luoi", "dau mieng", "dau khi nhai", "dau rang khi an nong lanh"],
    detail: 'Danh mục chưa có Răng – Hàm – Mặt. Nội tổng quát không thay thế nha sĩ; liên hệ phòng khám để hỏi nơi khám phù hợp. Sưng lan nhanh hoặc khó thở/nuốt cần cấp cứu.',
  },
  {
    id: 'urinary', area: 'Tiết niệu / Thận', aliases: ['tiet nieu', 'than tiet nieu', 'noi than', 'urology', 'nephrology'], fallback: 'noi tong quat', missing: 'Tiết niệu/Thận',
    terms: ['tieu ra mau', 'nuoc tieu co mau', 'nuoc tieu dui', 'tieu nhieu lan', 'di tieu nhieu', 'tieu dem', 'tieu gap', 'buon tieu lien tuc', 'dau hong lung', 'dau than', 'dau lung mot ben', 'dau khi tieu', 'tieu buot', 'tieu rat', 'tieu khong kiem soat', 'son tieu', 'dai dam', 'kho tieu', 'bi tieu', 'dau tinh hoan', 'sung tinh hoan', 'tiet dich duong tieu', "dau bung duoi khi tieu", "nuoc tieu hoi", "nuoc tieu duc", "tieu khong het", "tieu ra it", "dau khi di tieu", "tieu rat", "tieu gat", "dai dam ban dem"],
    detail: 'Website chưa có khoa Tiết niệu/Thận. Nội tổng quát có thể đánh giá ban đầu khi ổn định và hướng dẫn chuyển khám.',
  },
  {
    id: 'cardiology', area: 'Tim mạch', aliases: ['tim mach', 'cardiology'], fallback: 'noi tong quat', missing: 'Tim mạch',
    terms: ['hoi hop', 'tim dap nhanh', 'tim dap bat thuong', 'loan nhip tim', 'huyet ap cao', 'tang huyet ap', 'huyet ap bat thuong', 'phu chan', 'phu mat ca chan', 'kho tho khi nam', 'dau nguc khi gang suc', 'te chan khi di bo', 'chan lanh', "dau nguc", "tuc nguc", "nang nguc", "kho tho khi nam", "chan phu", "phu chan", "danh trong nguc", "mach nhanh", "mach dap nhanh"],
    detail: 'Danh mục hiện chưa có khoa Tim mạch; Nội tổng quát có thể đánh giá ban đầu. Đau ngực dữ dội, khó thở hoặc ngất là dấu hiệu cấp cứu.',
  },
  {
    id: 'neurology', area: 'Thần kinh', aliases: ['than kinh', 'noi than kinh', 'neurology'], fallback: 'noi tong quat', missing: 'Thần kinh',
    terms: ['dau dau', 'dau nua dau', 'dau dau du doi', 'dau dau keo dai', 'chong mat', 'quay cuong', 'mat thang bang', 'te bi', 'te nua nguoi', 'te tay chan', 'kien bo', 'run tay', 'run chan', 'yeu co', 'co cung', 'co giat', 'hay quen', 'suy giam tri nho', 'noi lap', 'noi kho', 'kho noi', 'mat ngu', "dau nua dau ben trai", "dau nua dau ben phai", "dau dau khi thay doi tu the", "te nua nguoi", "tay chan te bi", "chan tay te bi", "mat cam giac", "mat tri nho", "run", "yeu nua nguoi", "co giat"],
    detail: 'Danh mục hiện chưa có khoa Thần kinh; Nội tổng quát có thể đánh giá ban đầu. Yếu liệt hoặc méo miệng khởi phát đột ngột cần cấp cứu.',
  },
];

const urgentRules = [
  { id: 'breathing', level: 'emergency', terms: ['kho tho nang', 'kho tho dot ngot', 'khong tho duoc', 'tho rit', 'tim tai', 'moi tim', 'khong noi duoc vi kho tho', 'tho nhanh rut lom long nguc', 'tre rut lom long nguc khi tho'], message: 'Kh\u00f3 th\u1edf n\u1eb7ng, t\u00edm t\u00e1i ho\u1eb7c th\u1edf r\u00edt: g\u1ecdi 115/\u0111\u1ebfn c\u1ea5p c\u1ee9u ngay, kh\u00f4ng ch\u1edd \u0111\u1eb7t l\u1ecbch.' },
  { id: 'throat', level: 'emergency', terms: ['khong nuot duoc nuoc bot', 'nuot nuoc bot khong duoc', 'chay dai khong nuot', 'dau hong nang kem kho tho', 'co di vat chan duong tho'], message: 'Kh\u00f4ng nu\u1ed1t \u0111\u01b0\u1ee3c n\u01b0\u1edbc b\u1ecdt ho\u1eb7c nghi ngh\u1eb9n \u0111\u01b0\u1eddng th\u1edf: c\u1ea7n c\u1ea5p c\u1ee9u ngay.' },
  { id: 'vision', level: 'emergency', terms: ['mat thi luc dot ngot', 'giam thi luc dot ngot', 'mu mat dot ngot', 'dot ngot khong thay duoc', 'mat mat dot ngot', 'nhin doi dot ngot', 'man che truoc mat dot ngot'], message: 'M\u1ea5t ho\u1eb7c gi\u1ea3m th\u1ecb l\u1ef1c \u0111\u1ed9t ng\u1ed9t c\u1ea7n \u0111\u01b0\u1ee3c c\u1ea5p c\u1ee9u ngay.' },
  { id: 'eye-injury', level: 'emergency', terms: ['hoa chat vao mat', 'vat nhon dam vao mat', 'chan thuong mat nang', 'di vat ghim vao mat', 'vat dam vao mat', 'mat bi dam'], message: 'H\u00f3a ch\u1ea5t, v\u1eadt nh\u1ecdn ho\u1eb7c ch\u1ea5n th\u01b0\u01a1ng n\u1eb7ng \u1edf m\u1eaft c\u1ea7n c\u1ea5p c\u1ee9u ngay.' },
  { id: 'fracture', level: 'emergency', terms: ['gay xuong', 'gay chan', 'gay tay', 'xuong lo ra', 'chan bi bien dang', 'chan cong sau te nga', 'khong cam mau sau chan thuong'], message: 'Nghi g\u00e3y x\u01b0\u01a1ng, x\u01b0\u01a1ng l\u1ed9 ra ho\u1eb7c chi bi\u1ebfn d\u1ea1ng sau ch\u1ea5n th\u01b0\u01a1ng: \u0111\u1ebfn c\u01a1 s\u1edf c\u1ea5p c\u1ee9u ngay.' },
  { id: 'stroke', level: 'emergency', terms: ['meo mieng', 'meo mieng dot ngot', 'yeu liet nua nguoi', 'te nua nguoi dot ngot', 'noi kho dot ngot', 'khong noi duoc dot ngot', 'dot quy', 'mat thang bang dot ngot'], message: 'M\u00e9o mi\u1ec7ng, y\u1ebfu/t\u00ea li\u1ec7t m\u1ed9t b\u00ean ho\u1eb7c n\u00f3i kh\u00f3 kh\u1edfi ph\u00e1t \u0111\u1ed9t ng\u1ed9t c\u00f3 th\u1ec3 l\u00e0 \u0111\u1ed9t qu\u1ef5: g\u1ecdi 115 ngay.' },
  { id: 'chest', level: 'emergency', terms: ['dau nguc nang', 'dau nguc that chat', 'dau nguc de ep', 'dau nguc nhu bi de ep', 'dau nguc kem kho tho', 'dau nguc lan len ham', 'dau nguc lan ra tay', 'dau nguc kem mo hoi lanh', 'dau nguc kem buon non va choang'], message: '\u0110au ng\u1ef1c d\u1eef d\u1ed9i/\u0111\u00e8 \u00e9p, nh\u1ea5t l\u00e0 k\u00e8m kh\u00f3 th\u1edf, v\u00e3 m\u1ed3 h\u00f4i, bu\u1ed3n n\u00f4n ho\u1eb7c \u0111au lan: g\u1ecdi 115 ngay.' },
  { id: 'consciousness', level: 'emergency', terms: ['bat tinh', 'ngat', 'co giat lien tuc', 'kho goi day', 'co giat', 'lo mo khong danh thuc duoc'], message: 'B\u1ea5t t\u1ec9nh, co gi\u1eadt k\u00e9o d\u00e0i ho\u1eb7c kh\u00f3 \u0111\u00e1nh th\u1ee9c c\u1ea7n c\u1ea5p c\u1ee9u ngay.' },
  { id: 'allergy', level: 'emergency', terms: ['sung moi', 'sung luoi', 'sung hong', 'sung mat kem kho tho', 'di ung nang kho tho', 'soc phan ve', 'noi me day kem kho tho', 'kho tho sau an'], message: 'S\u01b0ng m\u00f4i/l\u01b0\u1ee1i/h\u1ecdng ho\u1eb7c n\u1ed5i m\u1ec1 \u0111ay k\u00e8m kh\u00f3 th\u1edf c\u00f3 th\u1ec3 l\u00e0 d\u1ecb \u1ee9ng n\u1eb7ng: g\u1ecdi 115 ngay.' },
  { id: 'bleeding', level: 'emergency', terms: ['non ra mau', 'di cau ra mau', 'phan den nhu hac in', 'chay mau khong cam duoc', 'chay mau am dao nhieu kem choang'], message: 'N\u00f4n ra m\u00e1u, \u0111i ngo\u00e0i ph\u00e2n \u0111en/ra m\u00e1u nhi\u1ec1u ho\u1eb7c ch\u1ea3y m\u00e1u kh\u00f4ng c\u1ea7m \u0111\u01b0\u1ee3c c\u1ea7n c\u1ea5p c\u1ee9u ngay.' },
  { id: 'eye-urgent', level: 'urgent', terms: ['dau mat nang', 'nhuc mat nang'], allTerms: [['dau mat', 'mat do'], ['dau mat', 'so anh sang'], ['dau mat', 'nhin mo'], ['nhuc mat', 'mat do']], message: '\u0110au m\u1eaft nhi\u1ec1u ho\u1eb7c \u0111au m\u1eaft k\u00e8m \u0111\u1ecf, s\u1ee3 \u00e1nh s\u00e1ng/nh\u00ecn m\u1edd c\u1ea7n \u0111\u01b0\u1ee3c nh\u00e2n vi\u00ean y t\u1ebf \u0111\u00e1nh gi\u00e1 kh\u1ea9n.' },
  { id: 'infection-urgent', level: 'urgent', terms: ['ho ra mau', 'sot cao keo dai', 'sot va li bi', 'sot cao kem li bi', 'sot cao khong ha', 'run ret va met lun'], message: 'Ho ra m\u00e1u, s\u1ed1t cao k\u00e9o d\u00e0i ho\u1eb7c l\u1edd \u0111\u1edd c\u1ea7n \u0111\u01b0\u1ee3c nh\u00e2n vi\u00ean y t\u1ebf \u0111\u00e1nh gi\u00e1 s\u1edbm trong ng\u00e0y.' },
  { id: 'pregnancy-urgent', level: 'urgent', terms: [], allTerms: [['mang thai', 'ra mau'], ['co thai', 'ra mau'], ['mang thai', 'dau bung du doi'], ['co thai', 'dau bung du doi'], ['mang thai', 'thai may yeu'], ['mang thai', 'khong thay thai may'], ['mang thai', 'sot'], ['mang thai', 'tieu buot']], message: 'Ra m\u00e1u, \u0111au b\u1ee5ng d\u1eef d\u1ed9i, s\u1ed1t ho\u1eb7c thai m\u00e1y gi\u1ea3m khi mang thai c\u1ea7n li\u00ean h\u1ec7 c\u01a1 s\u1edf s\u1ea3n khoa ngay.' },
  { id: 'breathing-urgent', level: 'urgent', terms: ['kho tho', 'hut hoi', 'tho kho'], message: "Khó thở hoặc hụt hơi mới xuất hiện cần được nhân viên y tế đánh giá sớm; nếu nặng, gọi 115." },
  { id: 'chest-urgent', level: 'urgent', terms: ['dau nguc'], message: "Đau ngực mới xuất hiện hoặc kéo dài cần được nhân viên y tế đánh giá sớm; nếu đau dữ dội/đè ép hoặc kèm khó thở, gọi 115." },
];

function matchesTerm(query, term) {
  const normalizedTerm = normalize(term);
  if (!normalizedTerm) return false;
  const paddedQuery = ` ${query} `;
  const phrase = ` ${normalizedTerm} `;
  let startAt = 0;
  while (true) {
    const index = paddedQuery.indexOf(phrase, startAt);
    if (index < 0) return false;
    const previousWords = paddedQuery.slice(0, index).trim().split(/\s+/).slice(-2);
    if (!previousWords.some(word => ['khong', 'chua', 'het'].includes(word))) return true;
    startAt = index + phrase.length - 1;
  }
}

function findCatalogSpecialty(aliases, names) {
  return names.find(name => aliases.some(alias => {
    const normalizedName = normalize(name);
    const normalizedAlias = normalize(alias);
    return normalizedName === normalizedAlias || normalizedName.includes(normalizedAlias) || normalizedAlias.includes(normalizedName);
  })) || null;
}

export function analyzeSymptoms(text, specialties = []) {
  const query = normalize(text);
  if (query.length < 2) return { groups: [], urgent: [], multipleAreas: false, hasInput: Boolean(query) };
  const names = specialties.map(item => typeof item === 'string' ? item : item?.name).filter(Boolean);
  const matchedUrgent = urgentRules.filter(rule => rule.terms.some(term => matchesTerm(query, term)) || rule.allTerms?.some(terms => terms.every(term => matchesTerm(query, term))));
  const urgent = matchedUrgent.some(rule => rule.level === 'emergency')
    ? matchedUrgent.filter(rule => rule.level === 'emergency')
    : matchedUrgent;
  const childContext = ['tre em', 'tre nho', 'tre so sinh', 'be', 'em be', 'con toi', 'con minh', 'con nho', 'con trai', 'con gai', 'chau bi', 'nhi khoa'].some(term => matchesTerm(query, term));
  if (childContext) {
    const pediatric = findCatalogSpecialty(['nhi khoa', 'pediatrics'], names);
    return {
      groups: [{ id: 'pediatrics', area: 'Trẻ em · Nhi khoa', specialty: pediatric, unavailableSpecialty: pediatric ? null : 'Nhi khoa', detail: pediatric ? 'Bác sĩ Nhi có thể đánh giá các triệu chứng của trẻ.' : 'Hiện chưa có bác sĩ Nhi; vui lòng liên hệ phòng khám.' }],
      urgent, multipleAreas: false, hasInput: true,
    };
  }

  const rawQuery = String(text || '').normalize('NFC').toLocaleLowerCase('vi');
  const explicitlyHipPain = /đau\s+(?:vùng\s+|khớp\s+)?hông/u.test(rawQuery);
  const explicitlyThroatPain = /đau\s+họng/u.test(rawQuery);
  const matching = symptomGroups.filter(group => {
    const found = group.terms.some(term => matchesTerm(query, term));
    if (group.id === 'ent' && explicitlyHipPain && !explicitlyThroatPain) {
      return group.terms.some(term => term !== 'dau hong' && matchesTerm(query, term));
    }
    if (group.id === 'musculoskeletal' && explicitlyThroatPain && !explicitlyHipPain) {
      return group.terms.some(term => term !== 'dau hong' && matchesTerm(query, term));
    }
    if (group.id === 'musculoskeletal' && explicitlyHipPain) return true;
    if (group.id === 'musculoskeletal' && !explicitlyThroatPain) return found;
    return found;
  });
  const groups = matching.map(group => {
    const specialty = findCatalogSpecialty(group.aliases, names);
    const fallback = !specialty && group.fallback && !urgent.some(item => item.level === 'emergency') ? findCatalogSpecialty([group.fallback], names) : null;
    return {
      id: group.id,
      area: group.area,
      specialty: specialty || fallback,
      isFallback: Boolean(!specialty && fallback),
      unavailableSpecialty: !specialty ? group.missing || group.area : null,
      detail: group.detail,
    };
  });

  // For unfamiliar wording, offer the clinic's general medicine service as an
  // initial assessment only; never do this for symptoms already flagged urgent.
  const deduplicatedGroups = groups.reduce((result, group) => {
    const sameSpecialtyIndex = group.specialty ? result.findIndex(item => normalize(item.specialty) === normalize(group.specialty)) : -1;
    if (sameSpecialtyIndex < 0) result.push(group);
    else {
      const previous = result[sameSpecialtyIndex];
      const areas = [...new Set(`${previous.area} + ${group.area}`.split(' + '))];
      const unavailable = [...new Set([previous.unavailableSpecialty, group.unavailableSpecialty].filter(Boolean))];
      result[sameSpecialtyIndex] = { ...previous, area: areas.join(' + '), unavailableSpecialty: unavailable.length ? unavailable.join(', ') : null, isFallback: previous.isFallback && group.isFallback };
    }
    return result;
  }, []);

  if (!deduplicatedGroups.length && !urgent.some(item => item.level === 'emergency')) {
    const general = findCatalogSpecialty(['noi tong quat', 'noi khoa'], names);
    if (general) deduplicatedGroups.push({ id: 'general-fallback', area: 'Chưa xác định rõ chuyên khoa', specialty: general, isFallback: true, detail: 'Chưa nhận diện được chuyên khoa từ mô tả. Nội tổng quát có thể đánh giá ban đầu nếu tình trạng ổn định; phòng khám sẽ hướng dẫn chuyển khám khi cần.' });
  }
  return { groups: deduplicatedGroups, urgent, multipleAreas: deduplicatedGroups.length > 1, hasInput: true };
}

export function suggestSpecialties(text, specialties = []) {
  return [...new Set(analyzeSymptoms(text, specialties).groups.map(group => group.specialty).filter(Boolean))];
}

export function hasEmergencyHint(text) {
  return analyzeSymptoms(text).urgent.some(item => item.level === 'emergency');
}

export function rankAvailableSlots(slots = []) {
  return [...slots].filter(slot => slot.status !== 'full').sort((a, b) => {
    const aLoad = Number(a.capacity) > 0 ? Number(a.bookedCount || 0) / Number(a.capacity) : 1;
    const bLoad = Number(b.capacity) > 0 ? Number(b.bookedCount || 0) / Number(b.capacity) : 1;
    return aLoad - bLoad || `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`);
  });
}
