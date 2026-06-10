import { INFO_LINKS } from './bao_mat_footer';

const UPDATED_DATE = '10/06/2026';

const PAGE_ORDER = [
  INFO_LINKS.about,
  INFO_LINKS.guide,
  INFO_LINKS.faq,
  INFO_LINKS.contact,
  INFO_LINKS.terms,
  INFO_LINKS.privacy,
  INFO_LINKS.cookies,
  INFO_LINKS.payment,
  INFO_LINKS.complaints,
  INFO_LINKS.medical,
];

const PAGE_CONTENT = {
  'gioi-thieu': {
    title: 'Giới thiệu MidHealth',
    lead: 'MidHealth là đồ án website hỗ trợ người bệnh tìm kiếm và đặt lịch khám trực tuyến.',
    sections: [
      {
        title: 'Phạm vi nền tảng',
        paragraphs: [
          'MidHealth cung cấp công cụ tra cứu bác sĩ, chuyên khoa, bệnh viện, phòng khám; lựa chọn khung giờ; tạo phiếu khám điện tử và quản lý lịch hẹn.',
          'MidHealth đóng vai trò nền tảng công nghệ hỗ trợ kết nối. Việc khám, chẩn đoán, kê đơn và điều trị thuộc trách nhiệm chuyên môn của bác sĩ và cơ sở y tế.',
        ],
      },
      {
        title: 'Nguyên tắc thông tin',
        bullets: [
          'Hiển thị rõ nguồn và thời điểm cập nhật đối với nội dung sức khỏe.',
          'Không tự gắn học hàm, học vị hoặc chức danh nghề nghiệp khi chưa được xác minh.',
          'Không công bố dấu chứng nhận, giấy phép hoặc đối tác khi chưa có tài liệu hợp lệ.',
          'Tách biệt quyền truy cập của người bệnh, bác sĩ và quản trị viên.',
        ],
      },
      {
        title: 'Trạng thái đồ án',
        tone: 'warning',
        paragraphs: [
          'Phiên bản hiện tại dùng cho học tập và trình diễn. Trước khi vận hành thực tế, chủ sở hữu phải bổ sung pháp nhân, địa chỉ, mã số doanh nghiệp, giấy phép liên quan, đầu mối bảo vệ dữ liệu và thủ tục thương mại điện tử theo mô hình hoạt động thực tế.',
        ],
      },
    ],
  },
  'huong-dan-dat-kham': {
    title: 'Hướng dẫn đặt khám',
    lead: 'Các bước cơ bản để tạo và theo dõi một lịch hẹn trên MidHealth.',
    sections: [
      {
        title: '1. Tìm nơi khám phù hợp',
        paragraphs: ['Tìm theo bác sĩ, chuyên khoa, bệnh viện hoặc phòng khám. Đọc kỹ địa chỉ, lịch làm việc, giá dự kiến và điều kiện tiếp nhận.'],
      },
      {
        title: '2. Chọn lịch và khai báo thông tin',
        paragraphs: ['Chọn ngày, giờ còn trống và nhập đúng thông tin người đi khám. Chỉ cung cấp dữ liệu sức khỏe cần thiết cho mục đích đặt khám.'],
      },
      {
        title: '3. Kiểm tra và xác nhận',
        paragraphs: ['Kiểm tra cơ sở y tế, bác sĩ, dịch vụ, thời gian, chi phí và chính sách hủy trước khi xác nhận hoặc thanh toán.'],
      },
      {
        title: '4. Nhận phiếu khám điện tử',
        paragraphs: ['Lưu mã lịch hẹn và có mặt theo hướng dẫn của cơ sở y tế. Lịch có thể thay đổi do tình huống chuyên môn hoặc cấp cứu; người bệnh sẽ được thông báo khi hệ thống nhận được cập nhật.'],
      },
      {
        title: '5. Hủy hoặc đổi lịch',
        paragraphs: ['Mở phiếu khám để xem tùy chọn đổi/hủy. Điều kiện hoàn tiền phụ thuộc thời điểm hủy, loại dịch vụ và chính sách đã hiển thị lúc đặt khám.'],
      },
    ],
  },
  'cau-hoi-thuong-gap': {
    title: 'Câu hỏi thường gặp',
    lead: 'Thông tin nhanh dành cho người bệnh trước và sau khi đặt lịch.',
    sections: [
      {
        title: 'Đặt lịch có thay thế việc đăng ký tại cơ sở y tế không?',
        paragraphs: ['Tùy quy trình của từng cơ sở. Phiếu điện tử xác nhận yêu cầu đặt lịch; người bệnh vẫn có thể phải xuất trình giấy tờ, làm thủ tục tiếp nhận hoặc chờ phân luồng tại nơi khám.'],
      },
      {
        title: 'Giờ khám có được bảo đảm tuyệt đối không?',
        paragraphs: ['Không. Thời gian là dự kiến vì hoạt động khám chữa bệnh có thể phát sinh ca cấp cứu hoặc kéo dài hơn kế hoạch.'],
      },
      {
        title: 'Ai chịu trách nhiệm về chẩn đoán và điều trị?',
        paragraphs: ['Bác sĩ và cơ sở y tế trực tiếp cung cấp dịch vụ chịu trách nhiệm chuyên môn. MidHealth không tự chẩn đoán, kê đơn hoặc thay đổi chỉ định điều trị.'],
      },
      {
        title: 'Tôi có thể yêu cầu xóa dữ liệu không?',
        paragraphs: ['Bạn có thể gửi yêu cầu qua kênh hỗ trợ. Một số dữ liệu có thể cần được lưu theo nghĩa vụ pháp lý, phòng chống gian lận hoặc giải quyết tranh chấp; MidHealth sẽ thông báo phạm vi xử lý.'],
      },
      {
        title: 'Khi nào cần gọi cấp cứu?',
        paragraphs: ['Nếu có khó thở, đau ngực, bất tỉnh, chảy máu nhiều, co giật, dấu hiệu đột quỵ hoặc nguy cơ tự gây hại, hãy gọi 115 hoặc đến cơ sở y tế gần nhất thay vì chờ lịch trực tuyến.'],
      },
    ],
  },
  'lien-he': {
    title: 'Liên hệ hỗ trợ',
    lead: 'Gửi đúng thông tin để yêu cầu được tiếp nhận và đối chiếu nhanh hơn.',
    sections: [
      {
        title: 'Kênh tiếp nhận',
        bullets: [
          'Email hỗ trợ đồ án: cskh@midhealth.vn',
          'Vấn đề dữ liệu cá nhân: ghi tiêu đề “Yêu cầu dữ liệu cá nhân”.',
          'Khiếu nại giao dịch: ghi mã lịch hẹn, thời điểm thanh toán và nội dung cần xử lý.',
        ],
      },
      {
        title: 'Không gửi dữ liệu không cần thiết',
        tone: 'warning',
        paragraphs: ['Không gửi mật khẩu, mã OTP, số thẻ đầy đủ hoặc hồ sơ bệnh án qua email thông thường. Nhân viên hỗ trợ không được yêu cầu bạn cung cấp mật khẩu.'],
      },
      {
        title: 'Thông tin đơn vị vận hành',
        paragraphs: ['MidHealth hiện là sản phẩm đồ án. Tên pháp nhân, địa chỉ đăng ký, mã số doanh nghiệp và người đại diện phải được cập nhật bằng hồ sơ có thể xác minh trước khi triển khai thương mại.'],
      },
    ],
  },
  'dieu-khoan-su-dung': {
    title: 'Điều khoản sử dụng',
    lead: 'Quy định cơ bản khi truy cập và sử dụng nền tảng đặt khám MidHealth.',
    sections: [
      {
        title: '1. Chấp thuận điều khoản',
        paragraphs: ['Khi tạo tài khoản hoặc sử dụng chức năng đặt khám, bạn xác nhận đã đọc các điều khoản và chính sách được liên kết tại trang này.'],
      },
      {
        title: '2. Vai trò của MidHealth',
        paragraphs: ['MidHealth cung cấp hạ tầng tra cứu, đặt lịch, thanh toán và trao đổi thông tin. Hợp đồng khám chữa bệnh, chất lượng chuyên môn, giá cuối cùng và quyết định điều trị thuộc bác sĩ hoặc cơ sở y tế cung cấp dịch vụ.'],
      },
      {
        title: '3. Tài khoản và tính chính xác',
        bullets: [
          'Cung cấp thông tin đúng của người đi khám và cập nhật khi có thay đổi.',
          'Giữ bí mật mật khẩu, mã OTP và thiết bị đăng nhập.',
          'Không sử dụng tài khoản của người khác hoặc giả mạo bác sĩ, cơ sở y tế.',
          'Thông báo ngay khi nghi ngờ tài khoản bị truy cập trái phép.',
        ],
      },
      {
        title: '4. Đặt lịch, giá và thanh toán',
        paragraphs: ['Thông tin lịch, giá và phạm vi dịch vụ được hiển thị trước bước xác nhận. Chi phí có thể thay đổi nếu bác sĩ chỉ định thêm dịch vụ sau khi thăm khám; khoản phát sinh phải được cơ sở y tế thông báo.'],
      },
      {
        title: '5. Hành vi bị cấm',
        bullets: [
          'Can thiệp hệ thống, dò quét trái phép, phát tán mã độc hoặc vượt quyền truy cập.',
          'Thu thập dữ liệu người dùng khác, đăng nội dung sai lệch hoặc xâm phạm quyền riêng tư.',
          'Dùng nền tảng cho cấp cứu, hành vi trái pháp luật hoặc gây cản trở hoạt động y tế.',
        ],
      },
      {
        title: '6. Tạm ngừng và thay đổi',
        paragraphs: ['MidHealth có thể giới hạn tài khoản khi phát hiện rủi ro bảo mật, gian lận hoặc vi phạm điều khoản. Thay đổi quan trọng sẽ được thông báo trên nền tảng trước khi áp dụng khi phù hợp.'],
      },
      {
        title: '7. Luật áp dụng và tranh chấp',
        paragraphs: ['Điều khoản được giải thích theo pháp luật Việt Nam. Các bên ưu tiên thương lượng; người tiêu dùng vẫn giữ nguyên quyền khiếu nại, yêu cầu cơ quan có thẩm quyền hoặc giải quyết theo pháp luật.'],
      },
    ],
  },
  'chinh-sach-bao-mat': {
    title: 'Chính sách bảo mật và dữ liệu cá nhân',
    lead: 'Giải thích dữ liệu nào được xử lý, vì sao cần xử lý và cách người dùng thực hiện quyền của mình.',
    sections: [
      {
        title: '1. Dữ liệu có thể được thu thập',
        bullets: [
          'Thông tin tài khoản và liên hệ: họ tên, email, số điện thoại, ngày sinh.',
          'Thông tin đặt khám: cơ sở y tế, bác sĩ, chuyên khoa, thời gian và trạng thái lịch.',
          'Dữ liệu sức khỏe do người dùng chủ động cung cấp; đây có thể là dữ liệu cá nhân nhạy cảm.',
          'Dữ liệu kỹ thuật và an toàn: địa chỉ IP, thiết bị, thời điểm đăng nhập, nhật ký thao tác và sự kiện bảo mật.',
          'Thông tin giao dịch cần thiết; MidHealth không nên lưu số thẻ đầy đủ hoặc mã bảo mật thẻ.',
        ],
      },
      {
        title: '2. Mục đích xử lý',
        bullets: [
          'Tạo tài khoản, xác thực danh tính và phân quyền truy cập.',
          'Thực hiện yêu cầu đặt khám, gửi thông báo và hỗ trợ người dùng.',
          'Xử lý thanh toán, đối soát, hoàn tiền và giải quyết tranh chấp.',
          'Phòng chống gian lận, bảo vệ hệ thống và đáp ứng nghĩa vụ pháp lý.',
          'Cải thiện dịch vụ bằng dữ liệu tổng hợp hoặc đã giảm khả năng nhận diện khi phù hợp.',
        ],
      },
      {
        title: '3. Cơ sở và sự đồng ý',
        paragraphs: ['MidHealth chỉ xử lý trong phạm vi cần thiết cho mục đích đã thông báo, sự đồng ý hợp lệ, yêu cầu thực hiện giao dịch hoặc căn cứ pháp luật áp dụng. Sự đồng ý cho mục đích không thiết yếu phải có thể lựa chọn riêng và rút lại.'],
      },
      {
        title: '4. Chia sẻ dữ liệu',
        paragraphs: ['Dữ liệu có thể được chuyển cho bác sĩ/cơ sở y tế được chọn, nhà cung cấp xác thực, lưu trữ, gửi thông báo, thanh toán hoặc cơ quan có thẩm quyền khi có căn cứ. Đối tác chỉ nhận phạm vi cần thiết và phải có nghĩa vụ bảo mật phù hợp.'],
      },
      {
        title: '5. Thời hạn lưu trữ và bảo vệ',
        paragraphs: ['Dữ liệu được lưu trong thời gian cần cho lịch hẹn, tài khoản, nghĩa vụ kế toán, an ninh và tranh chấp; sau đó được xóa hoặc ẩn danh theo lịch lưu trữ. Biện pháp bảo vệ gồm kiểm soát truy cập theo vai trò, mã hóa khi truyền, nhật ký bảo mật, sao lưu và rà soát quyền định kỳ. Không hệ thống nào an toàn tuyệt đối.'],
      },
      {
        title: '6. Quyền của chủ thể dữ liệu',
        bullets: [
          'Được biết, đồng ý hoặc rút lại sự đồng ý theo phạm vi pháp luật cho phép.',
          'Yêu cầu truy cập, chỉnh sửa, cung cấp, xóa hoặc hạn chế xử lý dữ liệu.',
          'Phản đối xử lý, khiếu nại, tố cáo hoặc yêu cầu bồi thường theo quy định.',
          'Không bị buộc đồng ý cho mục đích không cần thiết để nhận dịch vụ cốt lõi.',
        ],
      },
      {
        title: '7. Trẻ em và người được giám hộ',
        paragraphs: ['Tài khoản hoặc lịch hẹn cho trẻ em phải do cha mẹ/người giám hộ hợp pháp thực hiện phù hợp độ tuổi và quy định áp dụng. Chỉ cung cấp dữ liệu cần cho việc chăm sóc sức khỏe.'],
      },
      {
        title: '8. Liên hệ và sự cố',
        paragraphs: ['Gửi yêu cầu đến cskh@midhealth.vn với tiêu đề “Yêu cầu dữ liệu cá nhân”. Khi phát hiện sự cố có nguy cơ ảnh hưởng quyền lợi, MidHealth sẽ đánh giá, hạn chế tác động và thực hiện thông báo theo quy định áp dụng.'],
      },
    ],
  },
  'chinh-sach-cookie': {
    title: 'Chính sách cookie',
    lead: 'Cookie và bộ nhớ trình duyệt giúp duy trì phiên đăng nhập và vận hành chức năng cần thiết.',
    sections: [
      {
        title: 'Cookie thiết yếu',
        paragraphs: ['Dùng cho đăng nhập, bảo mật phiên, cân bằng tải và ghi nhớ thao tác cần thiết. Việc chặn nhóm này có thể làm chức năng tài khoản hoặc đặt khám không hoạt động.'],
      },
      {
        title: 'Đo lường và cá nhân hóa',
        paragraphs: ['Chỉ được bật khi hệ thống thực sự tích hợp công cụ tương ứng và đã cung cấp lựa chọn đồng ý phù hợp. MidHealth không được tuyên bố sử dụng công cụ theo dõi khi mã nguồn chưa triển khai chúng.'],
      },
      {
        title: 'Quản lý lựa chọn',
        paragraphs: ['Bạn có thể xóa hoặc chặn cookie trong cài đặt trình duyệt. Khi bổ sung cookie không thiết yếu, nền tảng phải có bảng lựa chọn cho phép chấp nhận, từ chối và thay đổi quyết định.'],
      },
    ],
  },
  'thanh-toan-va-hoan-tien': {
    title: 'Chính sách thanh toán và hoàn tiền',
    lead: 'Thông tin cần đọc trước khi xác nhận một dịch vụ có thu phí.',
    sections: [
      {
        title: 'Thông tin trước thanh toán',
        bullets: [
          'Tên dịch vụ, đơn vị cung cấp, thời gian dự kiến và số tiền phải trả.',
          'Khoản đã bao gồm/chưa bao gồm và khả năng phát sinh sau thăm khám.',
          'Điều kiện đổi lịch, hủy lịch, hoàn tiền và thời gian xử lý dự kiến.',
        ],
      },
      {
        title: 'Phương thức thanh toán',
        paragraphs: ['Phương thức khả dụng được hiển thị tại bước thanh toán. Giao dịch trực tuyến có thể do cổng thanh toán độc lập xử lý; điều khoản của cổng thanh toán cũng được áp dụng. Không cung cấp mật khẩu, OTP hoặc mã bảo mật thẻ cho nhân viên hỗ trợ.'],
      },
      {
        title: 'Trường hợp xem xét hoàn tiền',
        bullets: [
          'Cơ sở y tế hủy lịch và không có lịch thay thế được người bệnh chấp thuận.',
          'Giao dịch bị ghi nhận trùng hoặc đã trừ tiền nhưng hệ thống xác nhận thất bại.',
          'Người bệnh hủy trong thời hạn được hoàn theo điều kiện hiển thị lúc đặt.',
        ],
      },
      {
        title: 'Thời gian nhận tiền',
        paragraphs: ['Sau khi yêu cầu được chấp thuận, thời gian tiền về phụ thuộc phương thức thanh toán, ngân hàng và cổng trung gian. Trạng thái và mã đối soát cần được thông báo cho người dùng; không cam kết một thời hạn không thể kiểm soát.'],
      },
      {
        title: 'Hồ sơ yêu cầu',
        paragraphs: ['Cung cấp mã lịch hẹn, tài khoản đặt, thời điểm, số tiền, bằng chứng giao dịch và lý do. Che số thẻ, OTP và dữ liệu không cần thiết trước khi gửi.'],
      },
    ],
  },
  'giai-quyet-khieu-nai': {
    title: 'Quy trình giải quyết khiếu nại',
    lead: 'Quy trình minh bạch để tiếp nhận vấn đề về tài khoản, lịch khám, dữ liệu và giao dịch.',
    sections: [
      {
        title: 'Bước 1. Gửi yêu cầu',
        paragraphs: ['Gửi email đến cskh@midhealth.vn, nêu họ tên, thông tin liên hệ, mã lịch hẹn/giao dịch, diễn biến và yêu cầu xử lý. Không gửi mật khẩu hoặc OTP.'],
      },
      {
        title: 'Bước 2. Xác nhận và phân loại',
        paragraphs: ['Bộ phận hỗ trợ xác nhận đã tiếp nhận, kiểm tra danh tính ở mức cần thiết và chuyển yêu cầu đến nhóm tài khoản, thanh toán, dữ liệu hoặc cơ sở y tế liên quan.'],
      },
      {
        title: 'Bước 3. Đối chiếu và phản hồi',
        paragraphs: ['MidHealth đối chiếu nhật ký hệ thống và làm việc với bên cung cấp dịch vụ. Nếu cần thêm thời gian hoặc chứng từ, người dùng phải được thông báo lý do và tiến độ.'],
      },
      {
        title: 'Bước 4. Kết quả và lưu vết',
        paragraphs: ['Kết quả nêu rõ căn cứ, phương án khắc phục, hoàn tiền nếu có và kênh phản hồi tiếp theo. Hồ sơ khiếu nại được giới hạn người truy cập và lưu theo thời hạn cần thiết.'],
      },
      {
        title: 'Quyền lựa chọn khác',
        paragraphs: ['Quy trình nội bộ không hạn chế quyền yêu cầu cơ quan quản lý nhà nước, cơ quan bảo vệ người tiêu dùng, hòa giải, trọng tài hoặc tòa án giải quyết theo pháp luật.'],
      },
    ],
  },
  'mien-tru-trach-nhiem-y-khoa': {
    title: 'Miễn trừ trách nhiệm y khoa',
    lead: 'MidHealth hỗ trợ đặt lịch và cung cấp nội dung tham khảo, không thay thế cơ sở khám chữa bệnh.',
    sections: [
      {
        title: 'Không phải chẩn đoán hoặc đơn thuốc',
        paragraphs: ['Bài viết, kết quả tìm kiếm và phản hồi tự động không tạo quan hệ bác sĩ - người bệnh, không phải chẩn đoán, đơn thuốc hoặc chỉ định điều trị. Không tự ý dùng hoặc ngừng thuốc dựa trên nội dung nền tảng.'],
      },
      {
        title: 'Thông tin bác sĩ và lịch khám',
        paragraphs: ['Thông tin chuyên môn phải được đối chiếu từ hồ sơ do bác sĩ/cơ sở y tế cung cấp. Lịch và giá có thể thay đổi; thông tin xác nhận cuối cùng thuộc cơ sở cung cấp dịch vụ.'],
      },
      {
        title: 'Tình trạng khẩn cấp',
        tone: 'danger',
        paragraphs: ['Không dùng MidHealth để chờ tư vấn trong tình trạng cấp cứu. Khi có dấu hiệu nguy hiểm, hãy gọi 115 hoặc đến cơ sở y tế gần nhất ngay lập tức.'],
      },
      {
        title: 'Trách nhiệm của người dùng',
        paragraphs: ['Cung cấp trung thực tiền sử, triệu chứng, thuốc đang dùng và dị ứng cho nhân viên y tế; tuân thủ hướng dẫn chuyên môn và tái khám khi được yêu cầu.'],
      },
    ],
  },
};

function TrangThongTin({ slug, onNavigate, onBackHome }) {
  const page = PAGE_CONTENT[slug] || PAGE_CONTENT['gioi-thieu'];

  return (
    <div className="public-info-page">
      <div className="public-info-hero">
        <button type="button" onClick={onBackHome}>← Trang chủ</button>
        <p>TRUNG TÂM THÔNG TIN MIDHEALTH</p>
        <h1>{page.title}</h1>
        <span>{page.lead}</span>
        <small>Cập nhật lần cuối: {UPDATED_DATE}</small>
      </div>

      <div className="public-info-layout">
        <aside className="public-info-nav" aria-label="Danh mục thông tin">
          <strong>Nội dung dành cho khách hàng</strong>
          {PAGE_ORDER.map((item) => (
            <a
              className={item.slug === slug ? 'active' : ''}
              href={`/thong-tin/${item.slug}`}
              key={item.slug}
              onClick={(event) => {
                event.preventDefault();
                onNavigate?.(item.slug);
              }}
            >
              {item.label}
            </a>
          ))}
        </aside>

        <article className="public-info-content">
          {page.sections.map((section) => (
            <section className={section.tone ? `info-section info-section-${section.tone}` : 'info-section'} key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets ? (
                <ul>
                  {section.bullets.map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </section>
          ))}
          <div className="public-info-contact">
            <strong>Bạn cần làm rõ nội dung này?</strong>
            <p>Liên hệ <a href="mailto:cskh@midhealth.vn">cskh@midhealth.vn</a>. Không gửi mật khẩu, OTP hoặc số thẻ đầy đủ.</p>
          </div>
        </article>
      </div>
    </div>
  );
}

export default TrangThongTin;
