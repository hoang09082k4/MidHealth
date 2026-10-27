# Đánh giá khả năng chịu tải MidHealth

Quy trình tiếp nhận, nhắc lịch và kết quả khám hiện được mô tả trong [CLINIC_VISIT_WORKFLOW.md](CLINIC_VISIT_WORKFLOW.md). Email dùng hàng đợi PostgreSQL và tiến trình Node kiểm tra mỗi phút; cần đo thêm tốc độ SMTP và số việc tồn trước khi cam kết gửi đúng giờ ở tải lớn.

Cập nhật 01/10/2026. **Chưa có bằng chứng website chịu được 1 triệu người truy cập đồng thời.** Số người truy cập trong một ngày, số phiên đồng thời và số yêu cầu mỗi giây là ba đại lượng khác nhau. Ví dụ, nếu 1 triệu phiên cùng gọi một API mỗi phút thì API nhận khoảng 16.667 yêu cầu/giây; trang hiện còn có nhiều API khác và các luồng ghi.

## Đã đo trong workspace

`npm run check:load-local` chỉ gọi HTTP trên `127.0.0.1`, tắt Supabase, Firebase, PayPal và Gemini. Lượt đo sau khi chuyển sang Node server: 2.000 yêu cầu GET công khai, 50 kết nối song song, 2.000 HTTP 200; khoảng 2.745 yêu cầu/giây, p95 32 ms, p99 79 ms trên máy hiện tại. Kết quả này đo handler và dữ liệu fallback trong một tiến trình; **không đo** database, xác thực, thanh toán, đặt lịch, độ trễ Internet hoặc chi phí.

## Thay đổi đã làm để giảm tải

- API danh mục, thông tin phòng khám, dữ liệu tham chiếu và tin công khai trả header cache cho reverse proxy/CDN nếu được cấu hình (30–300 giây). Phản hồi lỗi, catalog không khả dụng và mọi phản hồi có token/cookie không được cache; API riêng tư mặc định `private, no-store`.
- Tệp JS/CSS trong `/assets/` có tên chứa hash được cache lâu trong trình duyệt. HTML và dữ liệu riêng tư không dùng chính sách này.
- Số lượt xem bài viết trong admin được ghi là lượt tải từ máy chủ ước tính: CDN có thể phục vụ người đọc mà không gọi API, nên đây không phải tổng số người đọc chính xác.

## Rủi ro cần giải quyết ở môi trường triển khai

1. **Nút thắt database.** Supabase compute có giới hạn kết nối và năng lực xử lý theo gói. Đặt lịch/đọc slot, hồ sơ, OTP và dashboard cần thử với dữ liệu và mức tải gần thực tế. Không giả định CDN giúp các thao tác ghi.
2. **Node và hạ tầng.** Một tiến trình Node không tự nhân rộng khi có hàng triệu phiên. Cần đo CPU, RAM, băng thông, giới hạn kết nối, reverse proxy/CDN và kế hoạch tăng số instance trước khi cam kết tải lớn.
3. **Chống lạm dụng.** Bộ giới hạn hiện tại trong `backend/src/rate_limit.js` chỉ giữ trạng thái trong từng tiến trình; nếu chạy nhiều instance, chúng không chia sẻ bộ đếm. Cần quy tắc rate limit tại reverse proxy/WAF cho `/api/auth/*`, `/api/card-scan`, OTP và các endpoint ghi, hoặc một bộ đếm phân tán. Thiết lập ngưỡng sau khi đo lưu lượng hợp lệ để tránh chặn bệnh nhân dùng chung mạng.
4. **Bài viết.** Mỗi cache miss của trang chi tiết bài viết hiện tăng `view_count` bằng thao tác đọc rồi ghi, nên số đếm không chính xác khi có cập nhật đồng thời. Không dùng số này làm số liệu kinh doanh; nếu cần lượt xem chính xác, thiết kế bộ đếm nguyên tử và gom lô riêng.
5. **Dịch vụ ngoài.** Firebase Authentication, Supabase, email OTP, PayPal và Gemini có quota, độ trễ và chi phí riêng; một bài test chỉ trên frontend không kiểm chứng được chúng.

## Cổng kiểm thử trước khi tuyên bố chịu tải lớn

### Hai người cùng đặt một khung giờ

API gọi `create_clinic_booking` trong PostgreSQL. Hàm tăng `booked_count` bằng một lệnh `UPDATE ... WHERE booked_count < capacity` và lưu lịch cùng phiếu khám trong cùng giao dịch. PostgreSQL khóa dòng slot khi cập nhật; yêu cầu đến sau chờ giao dịch trước rồi kiểm tra lại sức chứa. Với `capacity = 1`, nếu cả hai yêu cầu hợp lệ, một người nhận lịch và người kia nhận HTTP 409; với `capacity = 2`, hai hồ sơ bệnh nhân khác nhau đều có thể thành công. Cùng một hồ sơ không được đặt hai lần ở một slot. Nếu lưu lịch hoặc phiếu thất bại, giao dịch hoàn tác cả chỗ đã giữ. Giao diện tải lại danh sách slot sau HTTP 409 và yêu cầu chọn lại.

`npm run check:database` xác nhận sức chứa 1 và 2, chống đặt trùng hồ sơ và hoàn tác giao dịch trên PostgreSQL WASM. Bài kiểm này chạy tuần tự trên một kết nối; trước khi vận hành thực tế, cần thử hai kết nối đồng thời trên cơ sở dữ liệu staging và xác nhận đúng một thành công khi sức chứa còn một chỗ.

Tạo staging với cùng cấu hình tài nguyên dự kiến cho production và dữ liệu giả, không chứa bệnh nhân thật. Tăng tải theo bậc, ví dụ 100 → 1.000 → 10.000 phiên, tách riêng kịch bản chỉ xem trang, tìm bác sĩ, đăng nhập, xem slot, đặt lịch. Với đặt lịch, dùng slot/test account riêng và kiểm tra bất biến: không vượt sức chứa, không trùng số phiếu, không mất lịch. Theo dõi p95/p99, tỷ lệ 429/5xx, cache hit, CPU/RAM Node, kết nối/CPU database, quota và chi phí. Chỉ tăng tiếp khi mỗi bậc đạt ngưỡng do nhóm vận hành đặt trước; để thử 1 triệu phiên cần hạ tầng và ngân sách được xác nhận.

Nguồn giới hạn dịch vụ còn dùng: [Supabase compute limits](https://supabase.com/docs/guides/platform/compute-and-disk), [Firebase Auth limits](https://firebase.google.com/docs/auth/limits).
