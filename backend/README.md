# MidHealth Backend

Backend Node.js cho API đăng nhập/đăng ký Firebase, gửi OTP email bằng Gmail SMTP, JWT OTP, lưu hồ sơ bệnh nhân vào Supabase và số khám điện tử.

## Cấu hình môi trường

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
MOMO_ENDPOINT=https://test-payment.momo.vn
MOMO_PARTNER_CODE=MOMO
MOMO_ACCESS_KEY=...
MOMO_SECRET_KEY=...
MOMO_RETURN_URL=http://localhost:4000/api/payments/momo/return
MOMO_IPN_URL=http://localhost:4000/api/payments/momo/ipn
```

Chạy SQL trong `supabase/schema.sql` tại Supabase SQL Editor trước khi đăng ký tài khoản để backend lưu hồ sơ bệnh nhân.

## Chạy server

```bash
cd backend
npm run dev
```

Server mặc định chạy tại `http://localhost:4000`.

## API mẫu

- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `POST /api/auth/otp/send`
- `POST /api/auth/otp/verify`
- `GET /api/auth/otp/me`
- `GET /api/auth/me`
- `GET /api/queue`
- `GET /api/queue/MH-1025`
- `POST /api/queue`
- `PATCH /api/queue/MH-1025`

## Đăng ký Email/Password có OTP và hồ sơ

Gửi OTP:

```bash
curl -X POST http://localhost:4000/api/auth/otp/send \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\"}"
```

Xác minh OTP và nhận JWT dùng một lần:

```bash
curl -X POST http://localhost:4000/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"otp\":\"123456\"}"
```

Đăng ký sau khi có JWT OTP. `otpToken` chỉ dùng được một lần và hết hạn sau 10 phút:

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"test@example.com\",\"password\":\"123456\",\"fullName\":\"Nguyễn Văn A\",\"otpToken\":\"YOUR_OTP_JWT\",\"profile\":{\"fullName\":\"Nguyễn Văn A\",\"phone\":\"0343413231\",\"dateOfBirth\":\"2000-01-01\",\"gender\":\"male\",\"email\":\"test@example.com\"}}"
```

## Số khám điện tử

```bash
curl -X POST http://localhost:4000/api/queue \
  -H "Content-Type: application/json" \
  -d "{\"patient\":\"Nguyễn Văn A\",\"department\":\"Nhi khoa\"}"
```
