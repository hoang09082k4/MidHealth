# MidHealth Backend

Backend Node.js cho API xác thực Firebase, OTP email, hồ sơ bệnh nhân, đặt lịch khám, thanh toán, workspace đối tác y tế, tin y tế và số khám điện tử.

## Cấu Hình Môi Trường

Tạo file `.env` trong thư mục `backend`:

```bash
PORT=4000
FIREBASE_API_KEY=...
FIREBASE_PROJECT_ID=midhealth-1c1b9
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
JWT_SECRET=your_random_long_secret
OTP_EXPIRES_MINUTES=5
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://midhealth.vercel.app
MOMO_ENDPOINT=https://test-payment.momo.vn
MOMO_PARTNER_CODE=...
MOMO_ACCESS_KEY=...
MOMO_SECRET_KEY=...
MOMO_RETURN_URL=http://localhost:4000/api/payments/momo/return
MOMO_IPN_URL=http://localhost:4000/api/payments/momo/ipn
```

Chạy SQL trong `supabase/schema.sql` tại Supabase SQL Editor trước khi dùng các chức năng lưu dữ liệu. Các API lịch khám và số khám điện tử dùng bảng thật trong Supabase, không dùng dữ liệu tĩnh.

## Chạy Server

```bash
cd backend
npm install
npm run dev
```

Server mặc định chạy tại `http://localhost:4000`.

## Kiểm Thử

```bash
cd backend
npm test
```

Script test chỉ chạy các test chính trong `backend/tests`.

## API Mẫu

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `POST /api/auth/otp/send`
- `POST /api/auth/otp/verify`
- `GET /api/auth/me`
- `GET /api/catalog`
- `GET /api/reference-data`
- `GET /api/appointments`
- `POST /api/appointments`
- `GET /api/queue`
- `GET /api/queue/MH-1025`
- `POST /api/queue` cần token bệnh nhân
- `PATCH /api/queue/MH-1025` cần token đối tác y tế

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

Số khám được lưu trong bảng `queue_tickets`. Khi đặt lịch qua `POST /api/appointments`, backend tự tạo số khám và liên kết với lịch hẹn. API `/api/queue` dùng cho tra cứu và cập nhật trạng thái vận hành.
