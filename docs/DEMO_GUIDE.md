# MidHealth Demo Guide

Tài liệu này là kịch bản demo chính thức cho đồ án MidHealth. Mục tiêu là chứng minh hệ thống có frontend, backend, database, xác thực, phân quyền, đặt lịch, số khám, thanh toán, admin, đối tác y tế và AI.

## 1. Chuẩn Bị Môi Trường

Yêu cầu:

- Node.js 18 trở lên.
- Supabase project đã chạy `supabase/schema.sql` và `supabase/seed.sql`.
- Firebase project bật Email/Password và Google sign-in.
- Gmail App Password cho OTP.
- PayPal sandbox credentials.
- MoMo sandbox credentials nếu demo MoMo.
- Gemini API key nếu demo chatbot và nhận diện thẻ.

Tạo cấu hình:

```bash
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```

Điền đầy đủ các biến trong `backend/.env`. Không commit file `.env`.

## 2. Khởi Tạo Database Và Dữ Liệu Demo

Chạy theo thứ tự:

```bash
# Chạy trong Supabase SQL Editor hoặc Supabase CLI
supabase db reset
```

Sau đó seed dữ liệu bổ sung:

```bash
cd backend
npm run seed:reference
npm run seed:catalog
npm run seed:health-news
npm run seed:admin
npm run seed:provider-test
npm run sync:catalog-accounts
```

Nếu không dùng Supabase CLI, chạy `supabase/schema.sql` trước, sau đó `supabase/seed.sql`, rồi chạy các script seed backend ở trên.

## 3. Kiểm Chứng Kỹ Thuật Trước Khi Demo

Từ thư mục root:

```bash
npm run check:env
npm run verify
```

Kết quả đạt yêu cầu:

- Các biến môi trường bắt buộc có trạng thái OK.
- Backend test pass.
- Frontend production build pass.
- Không có lỗi cú pháp ở backend service chính.

## 4. Chạy Ứng Dụng

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
cd frontend
npm run dev
```

Mở `http://localhost:5173`.

## 5. Kịch Bản Demo Chính

### Luồng Bệnh Nhân

1. Vào trang chủ, xem bác sĩ, bệnh viện, phòng khám và chuyên khoa.
2. Đăng ký bệnh nhân bằng email.
3. Nhận OTP email và xác minh OTP.
4. Hoàn tất hồ sơ bệnh nhân.
5. Chọn bác sĩ/bệnh viện/phòng khám.
6. Chọn ngày giờ khám.
7. Tạo lịch khám.
8. Kiểm tra phiếu khám điện tử.
9. Kiểm tra số khám được tạo từ bảng `queue_tickets`.
10. Hủy lịch và xác nhận slot được mở lại nếu cần.

### Luồng Thanh Toán

1. Tạo lịch có phí.
2. Thanh toán PayPal sandbox.
3. Quay về frontend, kiểm tra trạng thái thanh toán thành công.
4. Tạo lịch khác và hủy PayPal, kiểm tra lịch bị hủy hoặc trạng thái thất bại.
5. Nếu có MoMo sandbox, chạy tương tự với MoMo ATM.

### Luồng Đối Tác Y Tế

1. Đăng ký tài khoản bác sĩ/phòng khám/bệnh viện.
2. Xác minh email/OTP.
3. Gửi hồ sơ workspace.
4. Admin duyệt workspace.
5. Đối tác đăng nhập lại, mở khu vực làm việc.
6. Tạo slot khám.
7. Xem lịch hẹn của bệnh nhân.
8. Cập nhật trạng thái: confirmed, completed, cancelled.

### Luồng Admin

1. Đăng nhập tài khoản admin demo.
2. Xem dashboard.
3. Duyệt workspace đối tác.
4. Cập nhật entity catalog nếu cần.
5. Quản lý bài viết tin y tế.

### Luồng AI Và Tin Y Tế

1. Mở trang Tin y tế.
2. Xem danh mục, bài nổi bật, tìm kiếm bài viết.
3. Mở chatbot và hỏi câu hỏi sức khỏe cơ bản.
4. Demo nhận diện thẻ nếu `GEMINI_API_KEY` đã cấu hình.

## 6. Điểm Cần Nói Khi Bảo Vệ

- Frontend React/Vite dùng lazy loading, cache catalog ngắn hạn và route fallback cho SPA.
- Backend Node.js tự quản lý API, CORS, security headers, rate limit cơ bản.
- Supabase chứa schema thật, index, trigger, RLS policy và dữ liệu seed.
- Firebase chịu trách nhiệm xác thực người dùng.
- Role-based access control tách bệnh nhân, đối tác y tế và admin.
- Queue/số khám dùng bảng `queue_tickets`, không dùng dữ liệu tĩnh.
- Thanh toán PayPal/MoMo tách service riêng, có callback/webhook.
- Test tự động kiểm tra phân quyền, CORS, security headers và queue policy.

## 7. Điều Kiện Đạt Demo Hoàn Chỉnh

Demo chỉ được xem là hoàn chỉnh khi tất cả mục trong `docs/ACCEPTANCE_CHECKLIST.md` được đánh dấu pass.
