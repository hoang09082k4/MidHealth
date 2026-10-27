# MidHealth

MidHealth là website đặt lịch cho **một phòng khám duy nhất**, gồm frontend React/Vite, API Node.js, Supabase, Firebase Authentication, OTP email, thanh toán. Hệ thống có năm vai trò tài khoản: `patient`, `staff`, `doctor`, `head` và `admin`. Admin cấp tài khoản nhân viên, bác sĩ và trưởng khoa; các vai trò đăng nhập tại trang chung.

## Cấu trúc

- `frontend`: giao diện người dùng và trang quản trị.
- `backend`: API xác thực, danh mục phòng khám, lịch khám, thanh toán, số khám.
- `supabase`: schema và seed của database.
- `docs/SINGLE_CLINIC_REFACTOR_AUDIT.md`: phạm vi chuyển đổi và hướng dẫn nâng cấp database.
- `docs/WORD_WORKFLOW_GAP.md`: đối chiếu quy trình với file Word.

`frontend/` chỉ chứa mã giao diện; `backend/` là Node API và cũng phục vụ bản build giao diện khi chạy production. `npm run build` tạo **một** thư mục `dist/` ở gốc. `dist/` được Git bỏ qua và không sửa trực tiếp.

Dự án dùng npm workspaces với một `package-lock.json` ở gốc. Cài dependencies và chạy lệnh từ thư mục gốc; không tạo lockfile riêng trong `frontend/` hoặc `backend/`.

## Chạy local

```bash
npm install
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
npm run dev --prefix backend
npm run dev --prefix frontend
```

Frontend mặc định tại `http://localhost:5173`, backend tại `http://localhost:4000`. Điền secret thật vào `backend/.env` và không commit file này.
Nếu muốn xem dữ liệu bác sĩ mô phỏng chỉ để demo local khi chưa có database, đặt `NODE_ENV=development` trong `backend/.env`. Khi chạy production, để `NODE_ENV=production` hoặc không đặt; bác sĩ mô phỏng không được công bố hay nhận đặt lịch.

## Chạy production độc lập

Từ thư mục gốc: `npm ci`, cấu hình `backend/.env` với `NODE_ENV=production`, tạo database mới bằng `supabase/schema.sql` rồi `supabase/seed.sql`, sau đó `npm run build` và `npm start`. Với database một phòng khám đang dùng, nâng cấp giữ dữ liệu theo `supabase/README.md`. Node phục vụ website và `/api` cùng một origin tại cổng `PORT` (mặc định 4000). Đặt reverse proxy HTTPS phía trước Node và cấu hình `FRONTEND_URL`, `ALLOWED_ORIGINS` theo tên miền thật. Chỉ đặt `TRUST_PROXY=true` khi proxy đã loại bỏ header `X-Forwarded-For` do client tự gửi và tạo lại header đáng tin. Cần giữ tiến trình Node hoạt động và theo dõi log, tải, lỗi và bản sao lưu dữ liệu.

## Database

Database mới: chạy `supabase/schema.sql`, rồi `supabase/seed.sql`. Để cấp tài khoản đăng nhập cho 10 bác sĩ ảo sau khi seed, chạy `npm run seed:virtual-doctors --prefix backend`; mật khẩu riêng của từng tài khoản được ghi vào `artifacts/virtual-doctor-credentials.json` ngoài Git. Database đang có dữ liệu không thể cập nhật cấu trúc bằng cách chạy lại schema/seed; các thay đổi cho database hiện hữu phải được rà soát và áp dụng trực tiếp lên đúng project mà không reset dữ liệu.

Các seed bổ sung, khi cần:

```bash
npm run seed:reference --prefix backend
npm run seed:admin --prefix backend
```

## Kiểm tra

```bash
npm run verify
```

Lệnh này chạy unit/API tests, kiểm tra schema và seed bằng PostgreSQL nhúng, sau đó build frontend production. Việc kết nối Supabase/Firebase và thanh toán thật vẫn phải được kiểm tra trên môi trường triển khai.

### Đối soát tiền cọc PayPal

Nếu PayPal đã duyệt đơn nhưng kết nối bị gián đoạn lúc capture, lịch giữ trạng thái `pending` thay vì bị hủy ngay. Tiến trình Node kiểm tra lại đơn PayPal sau 15 phút: chỉ xác nhận lịch khi thấy capture hoàn tất, chỉ giải phóng chỗ khi PayPal báo đơn `VOIDED`. Đơn vẫn `CREATED` hoặc `APPROVED` tiếp tục giữ chỗ để tránh hủy nhầm một khoản cọc đang xử lý. Nhân viên cần theo dõi các lịch `pending` trong admin và đối chiếu đơn trên PayPal; không hủy thủ công trước khi xác minh giao dịch. Cần kiểm thử tình huống mất kết nối, webhook trễ và capture lặp trên PayPal Sandbox trước khi thu tiền thật.

Đánh giá tải và phép thử cục bộ: [docs/LOAD_READINESS.md](docs/LOAD_READINESS.md). Lệnh `npm run check:load-local` không gửi yêu cầu đến production.

## Chức năng chính

- Đăng ký, đăng nhập, Google login và OTP email.
- Quản lý hồ sơ bệnh nhân; tìm bác sĩ/chuyên khoa của phòng khám.
- Chọn khung giờ, đặt/hủy lịch, cấp số khám và xem phiếu khám.
- Đặt lịch trực tuyến, thanh toán cọc PayPal trước khi xác nhận; nhân viên có thể thu cọc và tạo lịch tại quầy, xác minh danh tính rồi check-in.
- Bác sĩ khám chuyên khoa và chuyển khoa; trưởng khoa tổng hợp kết quả, kê đơn và hoàn tất hồ sơ; bệnh nhân xem kết quả, đơn thuốc.
- Báo cáo bệnh nhân, lịch khám, cọc đã thu, thuốc và vật tư theo thời gian, chuyên khoa, bác sĩ.
- Trưởng khoa điều phối khung giờ làm việc cho tất cả bác sĩ trong phòng khám; Admin cũng có thể quản lý lịch toàn phòng khám và xử lý ngày nghỉ, lịch hẹn, người dùng, nội dung và nhật ký.
- Nhận diện giấy tờ.
