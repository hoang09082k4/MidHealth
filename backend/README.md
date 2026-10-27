# MidHealth Backend

> Hệ thống một phòng khám có năm vai trò: `patient`, `staff`, `doctor`, `head` và `admin`. Database mới được tạo bằng `supabase/schema.sql` rồi `supabase/seed.sql`; xem `supabase/README.md` trước khi thao tác với database đã có dữ liệu.

Backend Node.js cho API xác thực Firebase, OTP email, hồ sơ bệnh nhân, đặt lịch khám, thanh toán, quản trị phòng khám và số khám điện tử.

Request đã đăng nhập dùng Firebase ID token; `JWT_SECRET` dùng ký token OTP và dữ liệu xác thực liên quan, không thay Firebase làm nơi quản lý tài khoản/mật khẩu.

## Cấu Hình Môi Trường

Tạo file `.env` trong thư mục `backend`:

```bash
PORT=4000
TRUST_PROXY=false
FIREBASE_API_KEY=...
FIREBASE_PROJECT_ID=midhealth-1c1b9
# Required for admin password reset. Store the service-account JSON outside the repository.
GOOGLE_APPLICATION_CREDENTIALS=C:/secure/midhealth-firebase-service-account.json
# Alternatively configure FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in the backend environment.
# Never commit the JSON file or private key.
# FIREBASE_CLIENT_EMAIL=...
# FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
JWT_SECRET=your_random_long_secret
OTP_EXPIRES_MINUTES=5
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Admin password reset uses the Firebase UID, email, role, provider and status already stored in `public.app_users`. The backend confirms the Firebase UID belongs to the same email, updates its password with Firebase Admin SDK, then revokes old refresh tokens. The password is sent only from the admin form to the backend over HTTPS and directly to Firebase; it is never returned by the API, written to Supabase, or logged. A successful response is sent only after Firebase confirms both operations. A locked account must be verified and unlocked separately.

Use a dedicated Firebase service account with the `Firebase Authentication Admin` role (`roles/firebaseauth.admin`, including `firebaseauth.users.update`). Set `GOOGLE_APPLICATION_CREDENTIALS` to the absolute path of its JSON file in `backend/.env`, keep the file outside Git, and restart the backend. The health endpoint reports `firebaseClient` and `firebaseAdmin` separately; `configured` means local configuration is present, not that a live API call has been tested.

Với database mới, chạy `supabase/schema.sql` rồi `supabase/seed.sql`. Seed chỉ thêm các chuyên khoa; quản trị viên nhập hồ sơ bác sĩ thật đã xác minh và lịch tiếp nhận qua trang quản trị. Không chạy `seed:virtual-doctors` trên hệ thống phòng khám thật. Database đang có dữ liệu không thể cập nhật cấu trúc bằng cách chạy lại schema/seed. Các API lịch khám và số khám điện tử dùng bảng thật trong Supabase.

## Chạy Server

```bash
# Chạy từ thư mục gốc repository
npm install
npm run dev --prefix backend
```

Server mặc định chạy tại `http://localhost:4000`.

Production: đặt `NODE_ENV=production`, từ thư mục gốc chạy `npm run build` rồi `npm start`. Backend phục vụ `dist/` và các route `/api`; đặt reverse proxy HTTPS phía trước và cập nhật `FRONTEND_URL`, `ALLOWED_ORIGINS` theo tên miền triển khai. Chỉ bật `TRUST_PROXY=true` nếu proxy kiểm soát và ghi lại `X-Forwarded-For`.

## Kiểm Thử

```bash
npm test --prefix backend
npm test --prefix frontend
```

Lệnh backend chạy toàn bộ `backend/tests`; lệnh frontend chạy toàn bộ `frontend/tests`. Các test hiện có bao gồm phân quyền, đặt lịch, thanh toán, quy trình khám, báo cáo, đặt lại mật khẩu và xử lý lỗi API. Build frontend production bằng `npm run build` tại thư mục gốc. Các test local không thay thế kiểm tra Firebase, Supabase, email hoặc PayPal thật.

## API Mẫu

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `POST /api/auth/otp/send`
- `POST /api/auth/otp/verify`
- `POST /api/auth/password-reset`
- `GET /api/auth/me`
- `GET /api/clinic`, `GET /api/doctors`, `GET /api/specialties`, `GET /api/services`
- `GET /api/catalog`
- `GET /api/reference-data`
- `GET /api/appointments`
- `POST /api/appointments`
- `POST /api/payments/paypal/create-order`, `POST /api/payments/paypal/webhook`
- `GET /api/staff/appointments`, `POST /api/staff/check-in`, `POST /api/staff/bookings`
- `GET /api/doctor/workspace`, `POST /api/doctor/appointments/:id/complete`
- `GET /api/reports/clinic` (admin; trưởng khoa chỉ xem phạm vi chuyên khoa của mình)
- `GET /api/admin/dashboard`, `POST /api/admin/users/:id/password-reset`
- `GET /api/queue`
- `GET /api/queue/:ticketCode`
- `PATCH /api/queue/:ticketCode` cần quyền admin

Các API riêng tư xác minh Firebase ID token và vai trò được lưu trong `app_users`. Tài khoản nhân viên, bác sĩ và trưởng khoa do admin cấp; người dùng công khai chỉ đăng ký vai trò bệnh nhân. Số khám được tạo cùng luồng đặt lịch, không tạo bằng `POST /api/queue`.

## OTP Email

Gửi OTP:

```bash
curl -X POST http://localhost:4000/api/auth/otp/send \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\"}"
```

Xác minh OTP:

```bash
curl -X POST http://localhost:4000/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"otp\":\"123456\"}"
```

Đăng ký sau khi có `otpToken`:

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"123456\",\"fullName\":\"Nguyễn Văn A\",\"otpToken\":\"YOUR_OTP_JWT\",\"profile\":{\"fullName\":\"Nguyễn Văn A\",\"phone\":\"0343413231\",\"dateOfBirth\":\"2000-01-01\",\"gender\":\"male\",\"email\":\"test@example.com\"}}"
```

## Số Khám Điện Tử

Số khám được lưu trong bảng `queue_tickets` và được tạo cùng lịch khám trong database. Người bệnh xem số khám của mình; admin có thể tra cứu và cập nhật trạng thái vận hành. Nhân viên check-in qua `POST /api/staff/check-in` bằng mã hẹn cùng thông tin xác minh, không dùng API tạo số khám riêng.
