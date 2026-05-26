# Website phòng khám MidHealth

Dự án đã tách rõ hai phần để chuẩn bị phát triển đầy đủ:

- `frontend`: ReactJS + Vite, giao diện đặt lịch khám MidHealth.
- `backend`: Node.js, API đăng nhập/đăng ký Firebase và số khám điện tử.

## Chạy Frontend

```bash
cd frontend
npm install
npm run dev
```

## Chạy Backend

```bash
cd backend
npm run dev
```

Backend mặc định chạy tại `http://localhost:4000`.

## Cấu hình Firebase Auth

Frontend dùng Firebase SDK tại `frontend/src/lib/firebase.js` cho Email/Password và Google.
Backend dùng Firebase Identity Toolkit REST API với `FIREBASE_API_KEY` trong `backend/.env` cho Email/Password.
Backend cũng có API gửi OTP email qua Gmail SMTP và trả JWT OTP dùng một lần sau khi xác minh thành công.
Schema Supabase để lưu hồ sơ bệnh nhân nằm tại `supabase/schema.sql`.

## Tài nguyên ảnh

- Ảnh chuyên khoa: `frontend/public/images_chuyen_khoa`
- Ảnh bác sĩ, bệnh viện và bài viết có thể bổ sung sau trong `frontend/public`
