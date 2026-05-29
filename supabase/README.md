# MidHealth Supabase

Chạy theo thứ tự trong Supabase SQL Editor:

1. `schema.sql`
2. `seed.sql`

`schema.sql` giữ nguyên bảng `patient_profiles` để backend đăng ký/đăng nhập hiện tại vẫn upsert hồ sơ bằng `firebase_uid`. Các bảng mới phục vụ luồng đặt lịch:

- `clinic_specialties`: chuyên khoa cho `the_chuyen_khoa` và lọc chuyên khoa.
- `medical_facilities`: bệnh viện/phòng khám cho `the_benh_vien`, `the_phong_kham`.
- `facility_services`, `facility_specialties`, `facility_hours`, `facility_notes`, `facility_images`: dữ liệu chi tiết cơ sở y tế.
- `doctors`, `doctor_specialties`: bác sĩ và chuyên khoa.
- `appointment_slots`: ngày giờ còn lịch.
- `patient_medical_profiles`, `patient_guardians`: hồ sơ bệnh nhân và người giám hộ.
- `appointments`, `appointment_attachments`, `queue_tickets`, `payments`: đặt lịch, file đính kèm, phiếu/số khám và thanh toán.

Các view dùng cho frontend khi chuyển khỏi dữ liệu hard-code:

- `v_doctor_cards`
- `v_facility_cards`
- `v_specialty_search_results`

Vì project đang dùng Firebase Auth, các thao tác ghi dữ liệu cá nhân nên đi qua backend Node.js bằng `SUPABASE_SERVICE_ROLE_KEY`. Frontend chỉ nên dùng quyền đọc public cho danh mục, bác sĩ, cơ sở y tế và slot trống.
