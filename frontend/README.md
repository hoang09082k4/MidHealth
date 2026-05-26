# MidHealth Frontend

Frontend ReactJS + Vite cho website đặt lịch khám MidHealth.

## Chạy local

```bash
npm install
npm run dev
```

## Firebase Auth

Thông tin Firebase được cấu hình trong `src/lib/firebase.js`.

Tạo file `.env` trong thư mục `frontend` nếu cần đổi backend API:

```bash
VITE_API_BASE_URL=http://localhost:4000
```

Đăng nhập/đăng ký dùng Firebase Authentication. Nếu dùng OTP số điện thoại, hãy bật Phone provider trong Firebase Console.
