# MidHealth Verification Report

Ngày kiểm chứng: 2026-06-19

## Kết Quả Đã Kiểm Chứng Bằng Lệnh

Các lệnh dùng để kiểm chứng:

```bash
npm run check:env
npm test --prefix backend
npm run build --prefix frontend
```

Kết quả kỳ vọng:

- Backend test pass.
- Frontend production build pass.
- Vite tạo SPA fallback cho các route chính.
- Env checker xác nhận biến bắt buộc đã có và cảnh báo dịch vụ demo còn thiếu.

## Phạm Vi Test Tự Động Hiện Có

Backend test hiện kiểm tra:

- Role policy cho admin, patient, doctor, clinic, hospital.
- Điều kiện identity relink của patient.
- CORS origin normalization và allow/block policy.
- Queue policy: chuẩn hóa mã số khám, trạng thái, code, mapping response.
- Security headers baseline.

Các test này không cần dịch vụ ngoài nên chạy nhanh và ổn định trong môi trường CI/local.

## Phạm Vi Cần Test Tích Hợp Thủ Công

Các chức năng sau phụ thuộc dịch vụ thật và phải được nghiệm thu bằng checklist:

- Firebase Email/Password, Google login.
- Gmail SMTP OTP.
- Supabase schema, seed và RLS.
- Đặt lịch và cập nhật slot thật.
- PayPal sandbox return/cancel/webhook.
- MoMo sandbox return/IPN nếu demo MoMo.
- Gemini chatbot và card scan.
- Admin dashboard với tài khoản admin thật.
- Provider workspace với tài khoản đối tác thật.

## Tiêu Chí Qua Môn/Đạt Demo

Project chỉ được xem là demo hoàn chỉnh khi:

1. `npm run verify` pass.
2. Tất cả biến môi trường cần dùng cho kịch bản demo đã có.
3. Database đã chạy schema + seed.
4. Từng mục trong `docs/ACCEPTANCE_CHECKLIST.md` của flow demo chính được đánh dấu pass.
5. Có tài khoản demo cho patient, provider và admin.
6. Có ít nhất một lịch khám được tạo thật, một queue ticket thật và một thao tác provider/admin thật.

## Ghi Chú Chất Lượng

MidHealth đã loại bỏ dữ liệu queue tĩnh khỏi backend. Số khám điện tử hiện đi qua bảng `queue_tickets`. CORS và security headers được tách module và có test. Frontend dùng lazy loading và cache catalog ngắn hạn để giảm tải ban đầu.
