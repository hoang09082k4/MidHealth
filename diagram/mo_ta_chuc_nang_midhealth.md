# Mô tả chức năng hệ thống MidHealth

## 1. Thông tin đề tài

- **Tên đề tài:** MidHealth - Website đặt khám trực tuyến và quản lý phòng khám.
- **Mục tiêu:** Xây dựng website giúp người dùng tra cứu bác sĩ, bệnh viện, phòng khám; đăng ký/đăng nhập; quản lý hồ sơ bệnh nhân; đặt lịch khám trực tuyến; nhận phiếu khám; theo dõi lịch hẹn và số khám điện tử.
- **Thành viên nhóm:** Cập nhật tên thành viên nhóm tại đây.

## 2. Actor trong hệ thống

| Actor | Vai trò |
|---|---|
| Khách truy cập | Xem trang chủ, tìm kiếm thông tin, xem danh sách bác sĩ, bệnh viện, phòng khám, xem chi tiết và thực hiện đăng ký/đăng nhập. |
| Bệnh nhân | Quản lý hồ sơ điện tử, đặt lịch khám, upload tập tin, xem/lưu phiếu khám, hủy lịch khám, xem lịch sử và theo dõi số khám điện tử. |
| Bác sĩ | Xem lịch khám được phân công, cập nhật trạng thái đang khám/hoàn tất và theo dõi bệnh nhân. |
| Nhân viên/Lễ tân | Xác nhận tiếp nhận bệnh nhân, hỗ trợ hủy lịch, xem phiếu khám và cập nhật trạng thái lịch khám. |
| Admin | Quản lý tài khoản, phân quyền, khóa/mở tài khoản, cập nhật dữ liệu bác sĩ/bệnh viện/phòng khám, thống kê và xuất báo cáo. |

## 3. Danh sách 7 use case đã tách chi tiết

1. Use case quản lý người dùng và xác thực.
2. Use case tra cứu và xem thông tin y tế.
3. Use case quản lý hồ sơ bệnh nhân.
4. Use case đặt lịch khám bác sĩ.
5. Use case đặt lịch khám bệnh viện.
6. Use case đặt lịch khám phòng khám.
7. Use case quản lý phiếu khám, lịch khám và số khám điện tử.

---

## 4.1. Use case tổng quan hệ thống MidHealth

**Hình 1: Use case tổng quan hệ thống MidHealth**

Sơ đồ tổng quan thể hiện các nhóm chức năng chính của hệ thống MidHealth gồm xác thực, tra cứu thông tin, quản lý hồ sơ, đặt lịch khám bác sĩ, đặt lịch khám bệnh viện, đặt lịch khám phòng khám, quản lý phiếu khám và số khám điện tử.

---

## 4.2. Use case quản lý người dùng và xác thực

**Hình 2: Use case quản lý người dùng và xác thực**

| Nội dung | Chi tiết |
|---|---|
| Tác nhân | Khách truy cập, Bệnh nhân, Bác sĩ, Nhân viên/Lễ tân, Admin |
| Mô tả | Hệ thống cho phép người dùng đăng ký tài khoản bằng email, nhận OTP, xác thực OTP, đặt mật khẩu, đăng nhập bằng email/mật khẩu hoặc Google, quên mật khẩu, đổi mật khẩu, cập nhật thông tin tài khoản và đăng xuất. Admin có thể phân quyền và khóa/mở tài khoản. |
| Tiền điều kiện | Người dùng truy cập website. Với chức năng cập nhật thông tin, đổi mật khẩu hoặc đăng xuất, người dùng cần đăng nhập vào hệ thống. |
| Luồng xử lí | 1. Người dùng truy cập website MidHealth. 2. Nếu chưa có tài khoản, người dùng nhập email để đăng ký. 3. Hệ thống gửi mã OTP đến email. 4. Người dùng nhập OTP để xác thực. 5. Nếu OTP hợp lệ, người dùng đặt mật khẩu và tạo hồ sơ điện tử. 6. Nếu đã có tài khoản, người dùng đăng nhập bằng email/mật khẩu hoặc Google. 7. Hệ thống kiểm tra thông tin đăng nhập. 8. Nếu hợp lệ, hệ thống cho phép truy cập theo vai trò. 9. Người dùng có thể cập nhật thông tin, đổi mật khẩu hoặc đăng xuất. |
| Luồng thay thế | Nếu OTP sai/hết hạn, hệ thống thông báo lỗi và cho phép gửi lại OTP. Nếu email hoặc mật khẩu sai, hệ thống thông báo đăng nhập thất bại. |
| Kết quả | Người dùng được xác thực và sử dụng chức năng phù hợp với vai trò. |

---

## 4.3. Use case tra cứu và xem thông tin y tế

**Hình 3: Use case tra cứu và xem thông tin y tế**

| Nội dung | Chi tiết |
|---|---|
| Tác nhân | Khách truy cập, Bệnh nhân, Admin |
| Mô tả | Người dùng có thể xem trang chủ, tìm kiếm triệu chứng/bác sĩ/bệnh viện/phòng khám, xem danh sách bác sĩ, bệnh viện, phòng khám, chuyên khoa, tin y tế, thuốc/bệnh/cơ thể và xem chi tiết từng đối tượng. |
| Tiền điều kiện | Người dùng truy cập website MidHealth. Không bắt buộc đăng nhập đối với chức năng xem và tìm kiếm. |
| Luồng xử lí | 1. Người dùng mở trang chủ. 2. Người dùng nhập từ khóa hoặc chọn danh mục. 3. Hệ thống hiển thị danh sách phù hợp. 4. Người dùng chọn bác sĩ/bệnh viện/phòng khám để xem chi tiết. 5. Hệ thống hiển thị giới thiệu, hình ảnh, địa chỉ, giờ làm việc, chuyên khoa/dịch vụ. 6. Người dùng có thể bấm xem thêm giới thiệu hoặc xem ảnh cơ sở y tế. |
| Luồng thay thế | Nếu không có kết quả phù hợp, hệ thống hiển thị thông báo không tìm thấy dữ liệu. |
| Kết quả | Người dùng nắm được thông tin cần thiết trước khi đặt lịch khám. |

---

## 4.4. Use case quản lý hồ sơ bệnh nhân

**Hình 4: Use case quản lý hồ sơ bệnh nhân**

| Nội dung | Chi tiết |
|---|---|
| Tác nhân | Bệnh nhân, Nhân viên/Lễ tân, Admin |
| Mô tả | Bệnh nhân có thể xem danh sách hồ sơ, tìm nhanh hồ sơ, xem chi tiết, thêm hồ sơ mới, sửa thông tin hồ sơ, nhập thông tin cá nhân, địa chỉ, CCCD, BHYT, dân tộc, nghề nghiệp và thêm người giám hộ. |
| Tiền điều kiện | Bệnh nhân đã đăng nhập vào hệ thống. |
| Luồng xử lí | 1. Bệnh nhân mở mục hồ sơ. 2. Hệ thống hiển thị danh sách hồ sơ. 3. Bệnh nhân chọn xem chi tiết, thêm hồ sơ mới hoặc sửa hồ sơ. 4. Bệnh nhân nhập họ tên, số điện thoại, ngày sinh, giới tính, địa chỉ, CCCD, BHYT, dân tộc, nghề nghiệp. 5. Nếu bệnh nhân là trẻ em hoặc cơ sở yêu cầu, bệnh nhân thêm người giám hộ. 6. Hệ thống kiểm tra các trường bắt buộc. 7. Nếu hợp lệ, hệ thống lưu hồ sơ. |
| Luồng thay thế | Nếu thiếu thông tin bắt buộc, hệ thống hiển thị lỗi ngay tại trường cần nhập. Nếu hồ sơ phụ không còn dùng, bệnh nhân có thể xóa hồ sơ. |
| Kết quả | Hồ sơ bệnh nhân được lưu và có thể chọn khi đặt lịch khám. |

---

## 4.5. Use case đặt lịch khám bác sĩ

**Hình 5: Use case đặt lịch khám bác sĩ**

| Nội dung | Chi tiết |
|---|---|
| Tác nhân | Bệnh nhân, Bác sĩ, Nhân viên/Lễ tân |
| Mô tả | Bệnh nhân xem danh sách bác sĩ, xem chi tiết bác sĩ, chọn bác sĩ, xem chuyên khoa, chọn ngày giờ khám, chọn hồ sơ bệnh nhân, nhập ghi chú, upload tập tin và xác nhận đặt khám. |
| Tiền điều kiện | Bệnh nhân đã đăng nhập và có hồ sơ bệnh nhân hợp lệ. |
| Luồng xử lí | 1. Bệnh nhân xem danh sách bác sĩ. 2. Bệnh nhân chọn bác sĩ và xem thông tin chi tiết. 3. Hệ thống hiển thị chuyên khoa và lịch trống của bác sĩ. 4. Bệnh nhân chọn ngày khám và khung giờ. 5. Bệnh nhân chọn hồ sơ bệnh nhân. 6. Bệnh nhân nhập ghi chú triệu chứng và upload tập tin nếu có. 7. Bệnh nhân xác nhận đặt khám. 8. Hệ thống tạo số thứ tự và phiếu khám. |
| Luồng thay thế | Nếu khung giờ đã đầy, hệ thống yêu cầu chọn giờ khác. Nếu hồ sơ thiếu thông tin bắt buộc, hệ thống yêu cầu cập nhật hồ sơ. |
| Kết quả | Lịch khám bác sĩ được tạo thành công và bệnh nhân nhận phiếu khám. |

---

## 4.6. Use case đặt lịch khám bệnh viện

**Hình 6: Use case đặt lịch khám bệnh viện**

| Nội dung | Chi tiết |
|---|---|
| Tác nhân | Bệnh nhân, Nhân viên/Lễ tân, Admin |
| Mô tả | Bệnh nhân xem danh sách bệnh viện, xem chi tiết bệnh viện, xem ảnh, giới thiệu, giờ làm việc, chuyên khoa, đọc lưu ý đặt khám, chọn dịch vụ, chọn chuyên khoa, chọn ngày giờ, chọn hồ sơ, upload tập tin và xác nhận đặt khám. |
| Tiền điều kiện | Bệnh nhân đã đăng nhập. Bệnh viện phải có lịch khám và quy định đặt khám được cấu hình. |
| Luồng xử lí | 1. Bệnh nhân chọn bệnh viện. 2. Hệ thống hiển thị thông tin bệnh viện. 3. Bệnh nhân bấm đặt khám ngay. 4. Hệ thống hiển thị lưu ý đặt khám nếu bệnh viện có quy định riêng. 5. Bệnh nhân chọn dịch vụ khám. 6. Bệnh nhân chọn chuyên khoa. 7. Bệnh nhân chọn ngày khám và giờ khám. 8. Bệnh nhân chọn hồ sơ bệnh nhân. 9. Hệ thống kiểm tra thông tin bắt buộc như ngày sinh, số điện thoại, CCCD/BHYT/người giám hộ nếu cần. 10. Bệnh nhân xác nhận đặt khám. 11. Hệ thống tạo phiếu khám bệnh viện. |
| Luồng thay thế | Nếu bệnh viện chỉ nhận một nhóm bệnh nhân nhất định, hệ thống thông báo không đủ điều kiện. Nếu hồ sơ thiếu thông tin, hệ thống yêu cầu bổ sung trước khi xác nhận. |
| Kết quả | Lịch khám bệnh viện được tạo và hiển thị phiếu khám cho bệnh nhân. |

---

## 4.7. Use case đặt lịch khám phòng khám

**Hình 7: Use case đặt lịch khám phòng khám**

| Nội dung | Chi tiết |
|---|---|
| Tác nhân | Bệnh nhân, Nhân viên/Lễ tân, Admin |
| Mô tả | Bệnh nhân xem danh sách phòng khám, xem chi tiết phòng khám, xem ảnh, giới thiệu, dịch vụ, chọn chuyên khoa, chọn bác sĩ, chọn ngày giờ, chọn hồ sơ, nhập ghi chú, upload tập tin và xác nhận đặt khám. |
| Tiền điều kiện | Bệnh nhân đã đăng nhập và phòng khám có lịch khám khả dụng. |
| Luồng xử lí | 1. Bệnh nhân chọn phòng khám. 2. Hệ thống hiển thị thông tin, hình ảnh, giới thiệu và dịch vụ. 3. Bệnh nhân bấm đặt khám ngay. 4. Bệnh nhân chọn chuyên khoa. 5. Bệnh nhân chọn bác sĩ. 6. Bệnh nhân chọn ngày khám. 7. Bệnh nhân chọn giờ khám. 8. Bệnh nhân chọn hồ sơ bệnh nhân. 9. Bệnh nhân nhập ghi chú và upload tập tin nếu có. 10. Bệnh nhân xác nhận đặt khám. 11. Hệ thống tạo phiếu khám phòng khám. |
| Luồng thay thế | Nếu chưa chọn đủ chuyên khoa, bác sĩ, ngày giờ hoặc hồ sơ, hệ thống không cho xác nhận. Nếu lịch phòng khám không khả dụng, hệ thống yêu cầu chọn lại ngày giờ khác. |
| Kết quả | Lịch khám phòng khám được tạo và bệnh nhân nhận phiếu khám. |

---

## 4.8. Use case quản lý phiếu khám, lịch khám và số khám điện tử

**Hình 8: Use case quản lý phiếu khám, lịch khám và số khám điện tử**

| Nội dung | Chi tiết |
|---|---|
| Tác nhân | Bệnh nhân, Bác sĩ, Nhân viên/Lễ tân, Admin |
| Mô tả | Bệnh nhân xem lịch khám, tìm kiếm lịch, xem phiếu khám, lưu/tải phiếu, hủy lịch, xem trạng thái đặt lịch, theo dõi số khám điện tử và xem lịch sử thanh toán. Nhân viên/Lễ tân và bác sĩ cập nhật trạng thái khám. Admin thống kê và xuất báo cáo. |
| Tiền điều kiện | Bệnh nhân đã đặt lịch thành công hoặc có mã phiếu khám hợp lệ. |
| Luồng xử lí | 1. Bệnh nhân mở mục lịch khám. 2. Hệ thống hiển thị danh sách lịch đã đặt. 3. Bệnh nhân chọn lịch để xem phiếu khám. 4. Bệnh nhân có thể lưu phiếu hoặc hủy lịch. 5. Bệnh nhân nhập mã phiếu để theo dõi số khám điện tử. 6. Hệ thống hiển thị số đang gọi, số của bệnh nhân, phòng khám và bác sĩ phụ trách. 7. Nhân viên/Lễ tân cập nhật trạng thái tiếp nhận. 8. Bác sĩ cập nhật trạng thái đang khám hoặc hoàn tất. 9. Admin xem thống kê và xuất báo cáo. |
| Luồng thay thế | Nếu mã phiếu không hợp lệ, hệ thống thông báo không tìm thấy lịch khám. Nếu lịch đã hoàn tất hoặc quá hạn, hệ thống không cho hủy. |
| Kết quả | Lịch khám, phiếu khám và trạng thái số khám điện tử được quản lý rõ ràng. |

---

## 5. Activity Diagram quy trình chính

**Hình 9: Activity Diagram quy trình đặt lịch khám trực tuyến MidHealth**

| Nội dung | Chi tiết |
|---|---|
| Điểm bắt đầu | Người dùng truy cập website MidHealth. |
| Các bước xử lý | Tìm kiếm/chọn bác sĩ, bệnh viện hoặc phòng khám; xem chi tiết; đăng nhập/đăng ký; chọn dịch vụ/chuyên khoa; chọn bác sĩ/cơ sở; chọn ngày giờ; chọn hồ sơ; nhập ghi chú; upload tập tin; xác nhận đặt khám. |
| Điều kiện rẽ nhánh | Kiểm tra đăng nhập, kiểm tra OTP, kiểm tra thông tin hồ sơ bắt buộc, kiểm tra lịch trống và kiểm tra dữ liệu đặt khám. |
| Kết quả đầu ra | Hệ thống tạo lịch hẹn, mã phiếu khám và số thứ tự khám. |
| Điểm kết thúc | Bệnh nhân xem hoặc lưu phiếu khám thành công. |

## 6. Danh sách file PlantUML

| STT | File | Nội dung |
|---|---|---|
| 1 | `tai_lieu/plantuml/01_uc_quan_ly_nguoi_dung_va_xac_thuc.txt` | Use case quản lý người dùng và xác thực |
| 2 | `tai_lieu/plantuml/02_uc_tra_cuu_va_xem_thong_tin_y_te.txt` | Use case tra cứu và xem thông tin y tế |
| 3 | `tai_lieu/plantuml/03_uc_quan_ly_ho_so_benh_nhan.txt` | Use case quản lý hồ sơ bệnh nhân |
| 4 | `tai_lieu/plantuml/04_uc_dat_lich_kham_bac_si.txt` | Use case đặt lịch khám bác sĩ |
| 5 | `tai_lieu/plantuml/05_uc_dat_lich_kham_benh_vien.txt` | Use case đặt lịch khám bệnh viện |
| 6 | `tai_lieu/plantuml/06_uc_dat_lich_kham_phong_kham.txt` | Use case đặt lịch khám phòng khám |
| 7 | `tai_lieu/plantuml/07_uc_quan_ly_phieu_kham_lich_kham_so_kham_dien_tu.txt` | Use case quản lý phiếu khám, lịch khám và số khám điện tử |
| 8 | `tai_lieu/plantuml/08_activity_quy_trinh_dat_lich_kham.txt` | Activity Diagram quy trình đặt lịch khám trực tuyến |
