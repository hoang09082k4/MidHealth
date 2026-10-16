# Quy trình từ đặt lịch đến kết quả khám

Database mới được tạo từ `supabase/schema.sql` và `supabase/seed.sql`. Với database đã có dữ liệu, sao lưu trước rồi chỉ chạy các migration chưa áp dụng theo `supabase/README.md`; không chạy lại schema/seed để nâng cấp.

Áp dụng cho một phòng khám có nhiều bác sĩ, với năm vai trò: bệnh nhân, nhân viên, bác sĩ, Trưởng khoa và Admin. Admin cấp tài khoản nhân viên y tế. Trưởng khoa điều phối lịch làm việc cho tất cả bác sĩ của phòng khám; Admin cũng có quyền quản lý lịch toàn phòng khám. Nội dung điều trị do bác sĩ quyết định và giải thích trực tiếp; website không tự chẩn đoán.

## Luồng vận hành

1. **Đặt lịch trực tuyến:** Bệnh nhân đăng nhập, chọn hồ sơ, bác sĩ, ngày và khung giờ. PostgreSQL giữ chỗ tạm trong một giao dịch; lịch chỉ chuyển sang xác nhận sau khi PayPal ghi nhận tiền cọc. Nếu thanh toán lỗi hoặc hết hạn, hệ thống giải phóng chỗ theo quy trình đối soát. Sau xác nhận, bệnh nhân nhận mã hẹn và phiếu điện tử.
2. **Trước ngày khám:** Tiến trình Node kiểm tra hàng đợi mỗi phút và gửi email nhắc khoảng 24 giờ trước giờ hẹn qua địa chỉ email của tài khoản, nếu SMTP đã được cấu hình. Email ghi bác sĩ, ngày giờ, mã phiếu và hướng dẫn đến sớm khoảng 15 phút. Thông báo trong tài khoản cũng hiển thị khi bệnh nhân mở website.
3. **Tại quầy:** Người bệnh đọc hoặc đưa mã hẹn; nhân viên nhập mã vào trang Tiếp nhận, đối chiếu họ tên và ngày sinh với giấy tờ phù hợp rồi mới check-in. Check-in không dùng QR: mã hẹn giúp tìm lịch, còn họ tên và ngày sinh xác minh người đến khám. Database chỉ ghi nhận khi thông tin khớp, lịch đủ điều kiện và đúng ngày khám.
4. **Khám:** Bác sĩ đăng nhập trang làm việc và thấy lịch được gán cho mình; Trưởng khoa thấy lịch thuộc chuyên khoa của tài khoản. Sau khi nhân viên check-in, bác sĩ được gán cho lượt khám nhập triệu chứng, chẩn đoán tạm thời và chỉ định khoa tiếp theo nếu cần. Khi các lượt chỉ định hoàn tất, Trưởng khoa đủ quyền tổng hợp kết quả, kết luận, kê đơn và đóng hồ sơ. Bệnh nhân đăng nhập xem kết quả trên phiếu điện tử; email hoàn tất không chứa chi tiết y khoa.
5. **Không đến:** Admin chỉ có thể đánh dấu vắng sau giờ hẹn ít nhất 15 phút cộng thời gian bác sĩ trễ đã công bố, và chỉ khi bệnh nhân chưa check-in. Bệnh nhân thấy trạng thái trên website và nhận email nếu SMTP hoạt động. Nếu đã đến nhưng bị đánh dấu sai, bệnh nhân liên hệ quầy để kiểm tra; hệ thống hiện chưa có thao tác sửa trạng thái đã đóng.
6. **Bác sĩ trễ/vắng:** Admin nhập số phút trễ dự kiến hoặc đánh dấu vắng cho từng lịch. Khi admin đánh dấu ngày nghỉ của bác sĩ, các lịch còn hiệu lực trong khoảng đó cũng được đánh dấu vắng. Bệnh nhân thấy cảnh báo trên phiếu và được gửi email. Sau khi thống nhất với bệnh nhân, admin có thể chuyển lịch sang slot còn chỗ của bác sĩ cùng chuyên khoa bằng một giao dịch; mã phiếu và khoản thanh toán được giữ nguyên, slot cũ được trả lại. Nếu hủy lịch đã trả tiền thì **không tự hoàn tiền**; nhân viên phải xử lý thanh toán riêng.
7. **Điều phối lịch:** Trưởng khoa chọn bác sĩ trong danh sách toàn phòng khám để tạo, sửa, mở hoặc đóng khung giờ. API vẫn giới hạn đích đến là hồ sơ bác sĩ thuộc phòng khám. Admin giữ quyền quản lý lịch và ngày nghỉ.

## Người bệnh đến trực tiếp, chưa có lịch hẹn

1. Nhân viên tiếp đón hỏi nhu cầu và chuyển ngay cho nhân viên y tế nếu người bệnh có dấu hiệu cần cấp cứu; màn hình tiếp đón không tự phân loại hay chẩn đoán.
2. Tìm hồ sơ cũ trước. Đối chiếu ít nhất hai định danh, ưu tiên họ tên đầy đủ và ngày sinh; kiểm tra thêm số điện thoại hoặc giấy tờ do người bệnh cung cấp. Không tạo hồ sơ mới chỉ vì email hoặc số điện thoại có thể dùng chung trong gia đình.
3. Nếu đã có hồ sơ, chọn đúng hồ sơ sau khi xác minh; cập nhật thông tin hành chính khi người bệnh xác nhận. Nếu chưa có, tạo hồ sơ tại quầy. Email chỉ là thông tin liên hệ tùy chọn, không tự tạo tài khoản đăng nhập hay mật khẩu.
4. Chọn bác sĩ/chuyên khoa và khung giờ còn chỗ. Thông báo phí khám và khoản đặt cọc trước khi xác nhận; chỉ đánh dấu đã thu tiền khi quầy thực sự nhận khoản đó. Website hiện chỉ ghi nhận cọc tiền mặt tại quầy, chưa thay thế hệ thống thu ngân/hóa đơn hoặc nghiệp vụ BHYT.
5. Hệ thống cấp mã hẹn và phiếu xếp hàng. Nếu lịch là hôm nay, nhân viên kiểm tra lại thông tin trên giấy tờ, tra cứu mã và bấm check-in để đưa người bệnh vào danh sách chờ của bác sĩ. Nếu lịch ở ngày khác, người bệnh quay lại làm thủ tục tiếp nhận vào ngày hẹn.
6. Bác sĩ làm việc trên lượt đã check-in, ghi nhận khám, chỉ định/chuyển chuyên khoa nếu cần và hoàn tất kết luận theo quyền được cấp.

Quy trình số hóa hỗ trợ tiếp đón; cơ sở khám bệnh vẫn cần thực hiện quy trình chuyên môn, giấy tờ, quyền lợi bảo hiểm, thu phí và xử trí cấp cứu theo quy định áp dụng cho chính cơ sở.

## Chính sách hiển thị cho bệnh nhân

- **Đến sớm:** khoảng 15 phút để tiếp nhận. Đây là hướng dẫn của phòng khám, không phải quy định pháp luật.
- **Đến trễ:** liên hệ phòng khám ngay khi biết sẽ trễ. Mốc 15 phút là lúc nhân viên *có thể* đánh dấu không đến; không bảo đảm còn suất khám nếu người bệnh đến sau đó. Khi bác sĩ trễ, mốc này được cộng thêm số phút trễ đã thông báo.
- **Xác minh tại quầy:** cần ít nhất họ tên và ngày sinh, đối chiếu giấy tờ. Mã phiếu và số thứ tự giúp tìm lịch, không xác thực người cầm phiếu.
- **Sau khám:** kết quả trên website là bản do phòng khám nhập; lời giải thích trực tiếp của bác sĩ và tài liệu chuyên môn chính thức vẫn cần được cung cấp theo quy trình của phòng khám.

## Triển khai và giới hạn còn lại

- Theo dõi `appointment_email_outbox` trong vận hành: việc lỗi được thử lại tối đa sáu lần, cách nhau ít nhất năm phút. Nếu SMTP ngừng lâu, nhân viên phải kiểm tra các dòng chưa gửi và liên hệ bệnh nhân trực tiếp; hiện chưa có bảng giám sát email trong admin. Số lịch trên bảng admin hiện giới hạn 500 lịch gần nhất; cơ sở lớn cần bổ sung tìm kiếm phân trang trên máy chủ.
- Chưa có tích hợp hoàn tiền PayPal, xác nhận chữ ký số của bác sĩ, hay tự động gọi điện/SMS khi bác sĩ vắng. Các việc đó cần quy trình nhân sự và hệ thống thanh toán tương ứng trước khi quảng bá là đã tự động hóa.
- `npm run check:database` chạy trên PostgreSQL WASM một kết nối, không chứng minh việc gửi Gmail, hành vi nhiều kết nối, hay các thao tác trên Supabase thật. Cần kiểm thử trên staging với dữ liệu giả và SMTP thử nghiệm trước khi dùng cho bệnh nhân thật.
