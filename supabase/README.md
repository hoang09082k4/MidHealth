# MidHealth Supabase

## Database đồng bộ

Database Supabase đang hoạt động đã được đồng bộ trực tiếp với quy trình trưởng khoa ngày 16/10/2026. Không chạy lại schema.sql trên database đang có dữ liệu; schema.sql là cấu trúc chuẩn để khởi tạo database mới.

## Snapshot schema và dữ liệu mẫu

`schema.sql` là nguồn cấu trúc chuẩn cho database mới; `seed.sql` chỉ thêm dữ liệu mẫu. Các thay đổi vai trò, quy trình khám, đối soát thanh toán, check-in và phí khám chuyên khoa hiện đã được gộp vào snapshot `schema.sql`, không cần chạy các file migration để khởi tạo database mới. `schema.sql` có chốt an toàn và không phải script nâng cấp tại chỗ cho database đã có dữ liệu.

Database live đã có luồng chuyển khoa theo lịch nhận khám, ghi nhận vật tư theo người nhập, xác nhận rà soát dị ứng khi kê đơn và ghi chú bổ sung bất biến. Khi cập nhật database đang dùng, chỉ áp dụng các câu SQL đã rà soát trực tiếp lên đúng project; không xóa dữ liệu hoặc khởi tạo lại schema.

Quy tắc hủy lịch bệnh nhân và bảo vệ thanh toán đã nằm trong snapshot `schema.sql`. Snapshot này dành cho database mới; không chạy lại trên database đang có dữ liệu. Thay đổi trên database hiện tại cần được áp dụng bằng SQL nâng cấp riêng đã rà soát cho đúng project.

Tiền cọc mặc định là **30% phí khám**, làm tròn lên 1 đồng. Tài liệu Word không quy định mức cọc nên admin cần kiểm tra và chỉnh tỷ lệ tại **Thông tin phòng khám** trước khi thu tiền thật. Tỷ lệ được lưu trong database và áp dụng cho lịch mới; lịch đã tạo giữ nguyên số cọc tại thời điểm đặt. Các lịch đã thanh toán trước khi nâng cấp vẫn giữ trạng thái cũ; những lịch đã xác nhận nhưng chưa thanh toán sẽ không được check-in cho tới khi ghi nhận cọc.

## Cấp lại mật khẩu tài khoản bác sĩ và nhân viên

Mật khẩu được lưu và cập nhật trực tiếp trong Firebase Authentication bằng Firebase Admin SDK. Backend tìm hồ sơ trong `app_users` theo `id`, dùng `firebase_uid` để cập nhật tài khoản Firebase, đồng thời kiểm tra `email`, `role`, `auth_provider` và `status`. Reset không ghi mật khẩu vào Supabase, không thêm cột database và không cần migration. Phiên đăng nhập Firebase cũ được thu hồi sau khi cập nhật thành công; người dùng đăng nhập lại bằng mật khẩu mới. Xem cấu hình credential trong `backend/README.md`.

## Tạo lại database hiện tại

Nếu đã chọn xóa dữ liệu hiện có, chạy `node backend/scripts/prepare_database_reset.js` để tạo `artifacts/reset_midhealth_database.sql`. Mở tệp này bằng trình soạn thảo UTF-8, sao chép **toàn bộ nội dung** vào Supabase SQL Editor của đúng dự án rồi chạy một lần. Tệp xóa và tạo lại toàn bộ schema `public`, chạy `schema.sql` và `seed.sql`, sau đó khôi phục bản ghi admin bằng Firebase UID hiện có. Toàn bộ thao tác nằm trong một transaction: câu lệnh lỗi sẽ rollback. Dữ liệu cũ trong `public`, bao gồm lịch khám và tài khoản, sẽ mất. Firebase Authentication và Supabase Storage không bị xóa bởi SQL này.

Không chạy script provision bác sĩ ảo cho phòng khám thật. Tài khoản bác sĩ thật phải được liên kết với hồ sơ đã xác minh qua trang quản trị.

## Cơ sở dữ liệu mới

Chạy `schema.sql`, rồi `seed.sql` trong Supabase SQL Editor. `schema.sql` chứa toàn bộ cấu trúc tài khoản bác sĩ và quy trình khám; `seed.sql` chứa dữ liệu mẫu.

`seed.sql` chỉ thêm các chuyên khoa mặc định. Nó không tạo bác sĩ, tài khoản bác sĩ, lịch trống hoặc dữ liệu đặt lịch. Quản trị viên thêm hồ sơ bác sĩ thật đã xác minh và lịch tiếp nhận từ trang quản trị.

## Hồ sơ và tài khoản bác sĩ

Seed có thể chạy lại an toàn: chuyên khoa đã có theo `slug` được giữ nguyên; script không cập nhật hoặc xóa hồ sơ bác sĩ hay lịch khám. Mỗi bác sĩ có hồ sơ riêng trong `doctors` và tài khoản đăng nhập riêng trong `app_users`, liên kết bằng `app_users.doctor_id`. Admin có thể tạo tài khoản từ hồ sơ bác sĩ đang hoạt động.

Danh sách công khai gồm hồ sơ bác sĩ đang hoạt động của phòng khám. Nút đặt lịch chỉ mở khi bác sĩ có khung giờ tương lai còn chỗ trong `appointment_slots`; mỗi lượt đặt được kiểm tra lại trên server trước khi lưu.

SQL không tự tạo người dùng Firebase. Với bác sĩ thật, dùng trang quản trị để tạo tài khoản sau khi đã nhập hồ sơ xác minh và cấu hình Firebase Admin SDK.

## Cơ sở dữ liệu hiện có

`schema.sql` có chốt an toàn và không chạy trực tiếp trên cơ sở dữ liệu đã có `app_users`. Với database hiện tại đã được chọn xóa và tạo lại, dùng `artifacts/reset_midhealth_database.sql` theo hướng dẫn đầu trang; tệp này gộp schema, seed và bản ghi admin vào một transaction.
