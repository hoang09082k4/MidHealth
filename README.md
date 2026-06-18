# MidHealth

MidHealth là đồ án website đặt lịch khám gồm frontend React/Vite, backend Node.js, Supabase database, Firebase Auth, OTP email, phân quyền bệnh nhân/đối tác/admin, số khám điện tử, thanh toán, tin y tế và AI chatbot.

## Cấu Trúc

- `frontend`: giao diện React/Vite.
- `backend`: API Node.js, auth, appointment, payment, provider workspace, admin, queue, chatbot.
- `supabase`: schema, seed và cấu hình database.
- `docs`: tài liệu demo, checklist nghiệm thu và báo cáo kiểm chứng.
- `diagram`: tài liệu phân tích/use case/activity diagram.

## Cài Đặt Nhanh

```bash
npm install
npm install --prefix frontend
npm install --prefix backend
```

Tạo file môi trường:

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

Điền secret thật vào `backend/.env`. Không commit `.env`.

## Chạy Local

Terminal backend:

```bash
cd backend
npm run dev
```

Terminal frontend:

```bash
cd frontend
npm run dev
```

Frontend mặc định chạy tại `http://localhost:5173`, backend tại `http://localhost:4000`.

## Kiểm Chứng

Chạy toàn bộ kiểm chứng cơ bản từ root:

```bash
npm run verify
```

Lệnh này chạy backend test và frontend production build. Đây là bằng chứng kỹ thuật tối thiểu trước khi demo.

## Database Và Dữ Liệu Demo

Khởi tạo Supabase theo thứ tự:

1. Chạy `supabase/schema.sql`.
2. Chạy `supabase/seed.sql`.
3. Chạy seed bổ sung trong backend nếu cần:

```bash
npm run seed:reference --prefix backend
npm run seed:catalog --prefix backend
npm run seed:health-news --prefix backend
npm run seed:admin --prefix backend
npm run seed:provider-test --prefix backend
npm run sync:catalog-accounts --prefix backend
```

## Tài Liệu Bảo Vệ Đồ Án

- Kịch bản demo: `docs/DEMO_GUIDE.md`
- Checklist nghiệm thu: `docs/ACCEPTANCE_CHECKLIST.md`
- Báo cáo kiểm chứng: `docs/VERIFICATION_REPORT.md`
- Backend guide: `backend/README.md`
- Supabase guide: `supabase/README.md`

## Chức Năng Chính

- Đăng ký, đăng nhập, Google login, OTP email.
- Hồ sơ bệnh nhân và hồ sơ khám.
- Tìm kiếm/xem bác sĩ, bệnh viện, phòng khám, chuyên khoa.
- Đặt lịch khám, tạo số khám điện tử, phiếu khám điện tử.
- Thanh toán PayPal/MoMo sandbox.
- Workspace bác sĩ/phòng khám/bệnh viện.
- Admin dashboard, duyệt đối tác, quản lý user/catalog/tin y tế.
- Tin y tế, chatbot Gemini và nhận diện thẻ.

## Ghi Chú Chất Lượng

Project đã loại bỏ queue mock tĩnh. Số khám dùng bảng `queue_tickets` trong Supabase. Backend có CORS/security headers tách module và có test. Frontend dùng lazy loading và cache catalog ngắn hạn để giảm tải ban đầu.
