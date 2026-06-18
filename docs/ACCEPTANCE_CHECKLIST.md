# MidHealth Acceptance Checklist

Checklist này dùng để nghiệm thu trước khi nộp hoặc bảo vệ đồ án. Chỉ đánh dấu pass khi đã chạy thật trên môi trường demo.

## Build Và Test

- [ ] `npm run verify` ở root pass.
- [ ] `npm test --prefix backend` pass.
- [ ] `npm run build --prefix frontend` pass.
- [ ] Backend không in secret ra log.
- [ ] Frontend không chứa service role key hoặc secret backend.

## Cấu Hình

- [ ] `backend/.env` có `FIREBASE_API_KEY`.
- [ ] `backend/.env` có `FIREBASE_PROJECT_ID`.
- [ ] `backend/.env` có `SUPABASE_URL`.
- [ ] `backend/.env` có `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] `backend/.env` có `JWT_SECRET`.
- [ ] `backend/.env` có `GMAIL_USER` và `GMAIL_APP_PASSWORD`.
- [ ] `backend/.env` có PayPal sandbox credentials nếu demo PayPal.
- [ ] `backend/.env` có MoMo sandbox credentials nếu demo MoMo.
- [ ] `backend/.env` có `GEMINI_API_KEY` nếu demo AI.
- [ ] `frontend/.env` trỏ đúng `VITE_API_BASE_URL`.

## Database Và Seed

- [ ] `supabase/schema.sql` chạy thành công.
- [ ] `supabase/seed.sql` chạy thành công.
- [ ] `npm run seed:reference --prefix backend` chạy thành công.
- [ ] `npm run seed:catalog --prefix backend` chạy thành công.
- [ ] `npm run seed:health-news --prefix backend` chạy thành công.
- [ ] Có dữ liệu bác sĩ, bệnh viện, phòng khám, chuyên khoa.
- [ ] Có slot khám còn trống để demo.
- [ ] Có tài khoản admin demo.
- [ ] Có tài khoản đối tác demo hoặc script tạo được.

## Xác Thực Và Phân Quyền

- [ ] Bệnh nhân đăng ký bằng email/password được.
- [ ] OTP email gửi được.
- [ ] OTP xác minh được.
- [ ] Bệnh nhân đăng nhập được.
- [ ] Google login chạy được nếu bật trong Firebase.
- [ ] Admin không vào được cổng bệnh nhân.
- [ ] Bệnh nhân không vào được admin dashboard.
- [ ] Bệnh nhân không vào được workspace đối tác.
- [ ] Đối tác chưa duyệt không xem được dữ liệu vận hành nhạy cảm.

## Hồ Sơ Bệnh Nhân

- [ ] Tạo hồ sơ bệnh nhân được.
- [ ] Cập nhật hồ sơ bệnh nhân được.
- [ ] Danh sách hồ sơ chỉ hiện đúng người dùng đăng nhập.
- [ ] Dữ liệu địa chỉ/dân tộc/nghề nghiệp tải được từ reference data hoặc fallback.

## Đặt Lịch Và Số Khám

- [ ] Đặt lịch bác sĩ được.
- [ ] Đặt lịch bệnh viện được.
- [ ] Đặt lịch phòng khám được.
- [ ] Đặt lịch theo chuyên khoa được.
- [ ] Slot đã đặt tăng `booked_count`.
- [ ] Tạo bản ghi trong `appointments`.
- [ ] Tạo bản ghi trong `queue_tickets`.
- [ ] Phiếu khám điện tử hiển thị đúng mã lịch/số khám.
- [ ] Hủy lịch cập nhật trạng thái appointment.
- [ ] Hủy lịch cập nhật trạng thái queue ticket.
- [ ] Hủy lịch giải phóng slot nếu lịch chưa hoàn tất.

## Workspace Đối Tác Y Tế

- [ ] Đối tác đăng ký tài khoản được.
- [ ] Đối tác gửi hồ sơ workspace được.
- [ ] Admin duyệt workspace được.
- [ ] Đối tác xem dashboard làm việc được.
- [ ] Đối tác tạo slot khám được.
- [ ] Đối tác cập nhật slot khám được.
- [ ] Đối tác xóa slot khám được.
- [ ] Đối tác xem lịch hẹn của workspace được.
- [ ] Đối tác cập nhật trạng thái lịch hẹn được.
- [ ] Nhật ký workspace ghi nhận thao tác quan trọng.

## Admin

- [ ] Admin đăng nhập được.
- [ ] Dashboard admin tải được.
- [ ] Admin duyệt/từ chối workspace được.
- [ ] Admin cập nhật tài khoản người dùng được.
- [ ] Admin cập nhật catalog entity được.
- [ ] Admin đồng bộ catalog account được.
- [ ] Admin tạo/sửa/xóa bài tin y tế được.

## Tin Y Tế Và AI

- [ ] Danh mục tin y tế tải được.
- [ ] Bài viết nổi bật tải được.
- [ ] Tìm kiếm bài viết chạy được.
- [ ] Trang chi tiết bài viết chạy được.
- [ ] Chatbot trả lời được khi có `GEMINI_API_KEY`.
- [ ] Chatbot vẫn trả lỗi thân thiện khi thiếu cấu hình.
- [ ] Nhận diện thẻ chạy được khi có `GEMINI_API_KEY`.
- [ ] Nhận diện thẻ có rate limit và lỗi thân thiện.

## Thanh Toán

- [ ] Tạo PayPal order sandbox được.
- [ ] PayPal return success cập nhật payment/appointment.
- [ ] PayPal cancel hủy lịch hoặc đánh dấu thất bại đúng.
- [ ] PayPal webhook xác minh chữ ký.
- [ ] Tạo MoMo ATM payment sandbox được nếu có credentials.
- [ ] MoMo return cập nhật payment/appointment.
- [ ] MoMo IPN xác minh chữ ký.
- [ ] Lịch quá hạn thanh toán pending được xử lý.

## Deploy

- [ ] Frontend deploy được.
- [ ] Backend deploy được hoặc URL backend public hoạt động.
- [ ] `VITE_API_BASE_URL` trên frontend trỏ đúng backend production.
- [ ] CORS cho domain frontend production hoạt động.
- [ ] Route SPA reload trực tiếp không lỗi 404.
- [ ] `/api/health` trả đúng trạng thái connected/missing-config.

## Hiệu Năng Và Trải Nghiệm

- [ ] Trang chủ mở nhanh ở mạng bình thường.
- [ ] Catalog không gọi lại liên tục khi chuyển trang trong cùng session.
- [ ] Chatbot không chặn tải trang ban đầu.
- [ ] Không có lỗi console nghiêm trọng trên flow demo.
- [ ] Form có thông báo lỗi rõ ràng.
- [ ] Text tiếng Việt hiển thị đúng.
- [ ] Giao diện mobile không vỡ layout ở các trang chính.
