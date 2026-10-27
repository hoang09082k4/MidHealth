# MidHealth Frontend

> Mô hình hiện tại gồm tài khoản bệnh nhân, bác sĩ và admin. Database được tạo bằng `supabase/schema.sql` và `supabase/seed.sql`; xem `supabase/README.md`.

Frontend ReactJS + Vite cho website đặt lịch khám MidHealth.

Source giao diện nằm trong `src/`; Vite ghi bản build vào `../dist/`. API Node.js nằm ở `../backend/`; khi chạy production, backend phục vụ cả website và `/api` trên cùng origin.

## Chạy local

```bash
# Chạy từ thư mục gốc repository
npm install
npm run dev --prefix frontend
```

## Firebase Auth

Thông tin Firebase được cấu hình trong `src/lib/firebase.js`.

Tạo file `.env` trong thư mục `frontend` nếu cần đổi backend API:

```bash
VITE_API_BASE_URL=http://localhost:4000
```

Đăng nhập/đăng ký dùng Firebase Authentication. Nếu dùng OTP số điện thoại, hãy bật Phone provider trong Firebase Console.
