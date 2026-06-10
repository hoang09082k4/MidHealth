insert into public.clinic_specialties (slug, name, image_url)
values
  ('y-hoc-co-truyen', 'Y học cổ truyền', '/images_chuyen_khoa/Yhoccotruyen.webp'),
  ('lao-benh-phoi', 'Lao - bệnh phổi', '/images_chuyen_khoa/laobenhphoi.webp'),
  ('y-hoc-the-thao', 'Y học thể thao', '/images_chuyen_khoa/yhocthethao.webp'),
  ('co-xuong-khop', 'Cơ xương khớp', '/images_chuyen_khoa/Coxuongkhop.webp'),
  ('san-phu-khoa', 'Sản phụ khoa', '/images_chuyen_khoa/sanphukhoa.webp'),
  ('nhan-khoa', 'Nhãn khoa', '/images_chuyen_khoa/Nhankhoa.webp'),
  ('nam-khoa', 'Nam khoa', '/images_chuyen_khoa/Namkhoa.webp'),
  ('vo-sinh-hiem-muon', 'Vô sinh hiếm muộn', '/images_chuyen_khoa/vosinhhiemmuon.webp'),
  ('ngoai-tiet-nieu', 'Ngoại tiết niệu', '/images_chuyen_khoa/Ngoaitietnieu.webp'),
  ('ngoai-than-kinh', 'Ngoại thần kinh', '/images_chuyen_khoa/Ngoaithankinh.webp'),
  ('noi-tong-quat', 'Nội tổng quát', '/images_chuyen_khoa/Noitongquat.webp'),
  ('ngoai-nieu', 'Ngoại niệu', '/images_chuyen_khoa/ngoaitietnieu (1).webp'),
  ('dinh-duong', 'Dinh dưỡng', '/images_chuyen_khoa/Dinhduong.webp'),
  ('tieu-hoa', 'Tiêu hóa', '/images_chuyen_khoa/tieuhoa.webp'),
  ('nhi-khoa', 'Nhi khoa', '/images_chuyen_khoa/Nhikhoa.webp'),
  ('da-lieu', 'Da liễu', '/images_chuyen_khoa/Dalieu.webp'),
  ('ngoai-long-nguc-mach-mau', 'Ngoại lồng ngực - mạch máu', '/images_chuyen_khoa/ngoailongngucmachmau.webp'),
  ('chan-doan-hinh-anh', 'Chẩn đoán hình ảnh', '/images_chuyen_khoa/Chandoanhinhanh.png'),
  ('ngon-ngu-tri-lieu', 'Ngôn ngữ trị liệu', '/images_chuyen_khoa/ngonngutrilieu.webp'),
  ('rang-ham-mat', 'Răng - Hàm - Mặt', '/images_chuyen_khoa/Ranghammat.webp'),
  ('noi-than-kinh', 'Nội thần kinh', '/images_chuyen_khoa/Noithankinh.webp'),
  ('tai-mui-hong', 'Tai - Mũi - Họng', '/images_chuyen_khoa/taimuihong.webp'),
  ('ung-buou', 'Ung bướu', '/images_chuyen_khoa/ungbuou.webp'),
  ('tim-mach', 'Tim mạch', '/images_chuyen_khoa/timmach.webp'),
  ('lao-khoa', 'Lão khoa', '/images_chuyen_khoa/laokhoa.webp'),
  ('chan-thuong-chinh-hinh', 'Chấn thương chỉnh hình', '/images_chuyen_khoa/Chanthuongchinhhinh.webp'),
  ('hoi-suc-cap-cuu', 'Hồi sức - cấp cứu', '/images_chuyen_khoa/hoisuccapcuu.png'),
  ('ngoai-tong-quat', 'Ngoại tổng quát', '/images_chuyen_khoa/ngoaitongquat.webp'),
  ('gay-me-hoi-suc', 'Gây mê hồi sức', '/images_chuyen_khoa/Gaymehoisuc.webp'),
  ('y-hoc-du-phong', 'Y học dự phòng', '/images_chuyen_khoa/yhocduphong.webp'),
  ('truyen-nhiem', 'Truyền nhiễm', '/images_chuyen_khoa/truyennhiem.webp'),
  ('noi-than', 'Nội thận', '/images_chuyen_khoa/Noithan.webp'),
  ('noi-tiet', 'Nội tiết', '/images_chuyen_khoa/Noitiet.webp'),
  ('tam-than', 'Tâm thần', '/images_chuyen_khoa/tamthan.webp'),
  ('ho-hap', 'Hô hấp', '/images_chuyen_khoa/Hohap.webp'),
  ('xet-nghiem', 'Xét nghiệm', '/images_chuyen_khoa/xetnghiem.webp'),
  ('huyet-hoc', 'Huyết học', '/images_chuyen_khoa/huyet-hoc.webp'),
  ('tam-ly', 'Tâm lý', '/images_chuyen_khoa/tamly.webp'),
  ('phau-thuat-tao-hinh', 'Phẫu thuật tạo hình', '/images_chuyen_khoa/37_phauthuattaohinhthammy.webp'),
  ('da-khoa', 'Đa khoa', '/images_chuyen_khoa/Noitongquat (1).webp'),
  ('phuc-hoi-chuc-nang', 'Phục hồi chức năng', '/images_chuyen_khoa/vatlitrilieu.webp')
on conflict (name) do update
set slug = excluded.slug,
    image_url = excluded.image_url,
    is_active = true;

insert into public.medical_facilities (slug, type, name, subtitle, intro, address, province, district, avatar_url, background_url)
values
  ('benh-vien-nhi-dong-2', 'hospital', 'Bệnh viện Nhi đồng 2', 'Thân thiện như chính ngôi nhà của bạn', 'Bệnh viện Nhi Đồng 2 là đơn vị chuyên khoa Nhi hạng 1 trực thuộc Sở Y tế TP.HCM.', '14 Lý Tự Trọng, Phường Sài Gòn, TP. Hồ Chí Minh', 'Hồ Chí Minh', 'Quận 1', '/image_benh_vien/avatar/avatar_benh_vien_nhi_dong_2.png', '/image_benh_vien/background/background_benh_vien_nhi_dong_2.png'),
  ('benh-vien-da-khoa-thu-duc', 'hospital', 'Bệnh viện Đa Khoa Thủ Đức', 'Đa chuyên khoa - phục vụ tận tâm', 'Bệnh viện Đa Khoa Thủ Đức cung cấp dịch vụ khám chữa bệnh đa chuyên khoa.', '29 Phú Châu, Phường Tam Bình, TP. Hồ Chí Minh', 'Hồ Chí Minh', 'Thủ Đức', '/image_benh_vien/avatar/avatar_benh_vien_da_khoa.png', '/image_benh_vien/background/background_benh_vien_da_khoa.png'),
  ('benh-vien-quan-y-175', 'hospital', 'Bệnh viện Quân Y 175', 'Bệnh viện đa khoa tuyến cuối của Quân đội', 'Bệnh viện Quân y 175 tiếp nhận khám đa chuyên khoa.', '786 Nguyễn Kiệm, Phường Hạnh Thông, TP. Hồ Chí Minh', 'Hồ Chí Minh', 'Gò Vấp', '/image_benh_vien/avatar/avatar_benh_vien_quan_y.png', '/image_benh_vien/background/background_benh_vien_quan_y.png'),
  ('benh-vien-ung-buou-tphcm', 'hospital', 'Bệnh viện Ung Bướu TPHCM', 'Chuyên sâu ung bướu', 'Bệnh viện Ung Bướu TPHCM là cơ sở chuyên khoa ung bướu.', '47 Nguyễn Huy Lượng, Phường Bình Thạnh, TP. Hồ Chí Minh', 'Hồ Chí Minh', 'Bình Thạnh', '/image_benh_vien/avatar/avatar_benh_vien_ung_buou.png', '/image_benh_vien/background/background_benh_vien_ung_buou.png'),
  ('benh-vien-rang-ham-mat-tphcm', 'hospital', 'Bệnh viện Răng Hàm Mặt TP.HCM', 'Chuyên khoa Răng Hàm Mặt', 'Bệnh viện Răng Hàm Mặt TP.HCM tiếp nhận khám và điều trị răng hàm mặt.', '263-265 Trần Hưng Đạo, Phường Cầu Ông Lãnh, TP. Hồ Chí Minh', 'Hồ Chí Minh', 'Quận 1', '/image_benh_vien/avatar/avatar_benh_vien_rang_ham_mat.png', '/image_benh_vien/background/background_benh_vien_rang_ham_mat.png'),
  ('benh-vien-y-hoc-co-truyen-tphcm', 'hospital', 'Bệnh viện Y Học Cổ Truyền TP.HCM', 'Y học cổ truyền kết hợp hiện đại', 'Bệnh viện Y Học Cổ Truyền TP.HCM cung cấp dịch vụ khám và điều trị theo y học cổ truyền.', '179 -187 Nam Kỳ Khởi Nghĩa, Phường Xuân Hòa, TP. Hồ Chí Minh', 'Hồ Chí Minh', 'Quận 3', '/image_benh_vien/avatar/avatar_benh_vien_y_hoc_co_truyen.png', '/image_benh_vien/background/background_benh_vien_y_hoc_co_truyen.png'),
  ('phong-kham-san-phu-khoa-13-cao-thang', 'clinic', 'Phòng khám Sản Phụ Khoa 13 Cao Thắng', 'Chăm sóc sức khỏe sản phụ khoa', 'Phòng khám tiếp nhận khám thai, siêu âm, tư vấn sức khỏe sinh sản.', '13 Cao Thắng, Phường Bàn Cờ, TP. Hồ Chí Minh', 'Hồ Chí Minh', 'Quận 3', '/image_phong_kham/phong_kham_san_phu.jpg', null),
  ('phong-kham-nhi-my-my', 'clinic', 'Phòng khám Nhi Mỹ Mỹ', 'Khám và tư vấn sức khỏe trẻ em', 'Phòng khám hỗ trợ khám bệnh nhi và tư vấn dinh dưỡng.', '105/10 Nguyễn Thị Tú, Phường Bình Tân, TP. Hồ Chí Minh', 'Hồ Chí Minh', 'Bình Tân', '/image_phong_kham/phong_kham_my_my.jpg', null),
  ('trung-tam-chac', 'clinic', 'Trung Tâm Chăm Sóc Sức Khỏe Cộng Đồng - CHAC', 'Đa chuyên khoa - hướng về cộng đồng', 'Trung tâm chăm sóc sức khỏe cộng đồng đa chuyên khoa.', '110A Ngô Quyền, P.8, Q.5, TP.HCM', 'Hồ Chí Minh', 'Quận 5', '/image_phong_kham/phong_kham_suc_khoe.jpg', null),
  ('phong-kham-da-lieu-shine-clinic', 'clinic', 'Phòng khám Da liễu Shine Clinic', 'Da liễu và chăm sóc thẩm mỹ da', 'Phòng khám cung cấp dịch vụ khám da liễu và chăm sóc thẩm mỹ da.', '06 Trương Quyền, P.6, Q.3, TP.HCM', 'Hồ Chí Minh', 'Quận 3', '/image_phong_kham/phong_kham_da_lieu.jpg', null)
on conflict (slug) do update
set name = excluded.name,
    subtitle = excluded.subtitle,
    intro = excluded.intro,
    address = excluded.address,
    province = excluded.province,
    district = excluded.district,
    avatar_url = excluded.avatar_url,
    background_url = excluded.background_url,
    is_active = true;

insert into public.facility_hours (facility_id, label, time_text, sort_order)
select f.id, h.label, h.time_text, h.sort_order
from public.medical_facilities f
join (values
  ('benh-vien-nhi-dong-2', 'Thứ 2 đến Thứ 6, Buổi sáng', '7h00 - 11h00', 1),
  ('benh-vien-nhi-dong-2', 'Thứ 2 đến Thứ 6, Buổi chiều', '13h00 - 16h00', 2),
  ('benh-vien-nhi-dong-2', 'Cấp cứu', '24/7', 3),
  ('benh-vien-da-khoa-thu-duc', 'Thứ 2 đến Thứ 6', '7h00 - 16h30', 1),
  ('benh-vien-quan-y-175', 'Thứ 2 đến Thứ 6', '7h00 - 16h30', 1),
  ('benh-vien-ung-buou-tphcm', 'Khám giờ hành chính', '7h30 - 16h30', 1),
  ('benh-vien-rang-ham-mat-tphcm', 'Thứ 2 - Thứ 6', '7h - 18h30', 1),
  ('benh-vien-y-hoc-co-truyen-tphcm', 'Thứ 2 - Thứ 7', '7h - 19h', 1),
  ('phong-kham-san-phu-khoa-13-cao-thang', 'Thứ 2 - Thứ 6', '17h00 - 20h00', 1),
  ('phong-kham-nhi-my-my', 'Thứ 2 - Thứ 6', '17h00 - 20h30', 1),
  ('trung-tam-chac', 'Thứ 2 - Thứ 6', '7h00 - 19h30', 1),
  ('phong-kham-da-lieu-shine-clinic', 'Thứ 2 - Thứ 6', '9h00 - 20h00', 1)
) as h(facility_slug, label, time_text, sort_order) on h.facility_slug = f.slug
where not exists (
  select 1 from public.facility_hours existing
  where existing.facility_id = f.id and existing.label = h.label
);

insert into public.facility_images (facility_id, image_url, alt_text, sort_order)
select f.id, x.image_url, f.name, x.sort_order
from public.medical_facilities f
join (values
  ('benh-vien-nhi-dong-2', '/image_benh_vien/background/background_benh_vien_nhi_dong_2.png', 1),
  ('benh-vien-da-khoa-thu-duc', '/image_benh_vien/background/background_benh_vien_da_khoa.png', 1),
  ('benh-vien-quan-y-175', '/image_benh_vien/background/background_benh_vien_quan_y.png', 1),
  ('benh-vien-ung-buou-tphcm', '/image_benh_vien/background/background_benh_vien_ung_buou.png', 1),
  ('benh-vien-rang-ham-mat-tphcm', '/image_benh_vien/background/background_benh_vien_rang_ham_mat.png', 1),
  ('benh-vien-y-hoc-co-truyen-tphcm', '/image_benh_vien/background/background_benh_vien_y_hoc_co_truyen.png', 1),
  ('benh-vien-nhi-dong-2', '/image_benh_vien/avatar/avatar_benh_vien_nhi_dong_2.png', 2),
  ('benh-vien-da-khoa-thu-duc', '/image_benh_vien/avatar/avatar_benh_vien_da_khoa.png', 2),
  ('benh-vien-quan-y-175', '/image_benh_vien/avatar/avatar_benh_vien_quan_y.png', 2),
  ('benh-vien-ung-buou-tphcm', '/image_benh_vien/avatar/avatar_benh_vien_ung_buou.png', 2),
  ('benh-vien-rang-ham-mat-tphcm', '/image_benh_vien/avatar/avatar_benh_vien_rang_ham_mat.png', 2),
  ('benh-vien-y-hoc-co-truyen-tphcm', '/image_benh_vien/avatar/avatar_benh_vien_y_hoc_co_truyen.png', 2),
  ('phong-kham-san-phu-khoa-13-cao-thang', '/image_phong_kham/phong_kham_san_phu.jpg', 1),
  ('phong-kham-nhi-my-my', '/image_phong_kham/phong_kham_my_my.jpg', 1),
  ('trung-tam-chac', '/image_phong_kham/phong_kham_suc_khoe.jpg', 1),
  ('phong-kham-da-lieu-shine-clinic', '/image_phong_kham/phong_kham_da_lieu.jpg', 1)
) as x(facility_slug, image_url, sort_order) on x.facility_slug = f.slug
where not exists (
  select 1 from public.facility_images existing
  where existing.facility_id = f.id and existing.image_url = x.image_url
);

insert into public.facility_notes (facility_id, title, lines, sort_order)
select f.id, x.title, x.lines, x.sort_order
from public.medical_facilities f
join (values
  ('benh-vien-nhi-dong-2', 'Chọn khu khám:', array['Khu Nguyễn Du: Khám Tâm lý tại tầng 5', 'Khu Lý Tự Trọng: Khám theo yêu cầu các chuyên khoa Nhi được hỗ trợ đặt online'], 1),
  ('benh-vien-nhi-dong-2', 'Lưu ý:', array['Bệnh viện chỉ tiếp nhận bệnh nhân dưới 16 tuổi.', 'Các chuyên khoa khác hiện chưa áp dụng đặt lịch qua ứng dụng.'], 2),
  ('benh-vien-da-khoa-thu-duc', 'Lưu ý:', array['Vui lòng điền chính xác thông tin người đi khám.', 'Một số chuyên khoa có thể thay đổi khung giờ tiếp nhận theo lịch vận hành thực tế.'], 1),
  ('benh-vien-quan-y-175', 'THÔNG TIN', array['Địa điểm khám bệnh ngoài giờ hành chính: Lầu 2, Khu khám bệnh theo yêu cầu.', 'Dịch vụ tầm soát lao nhập cảnh chưa áp dụng đặt lịch trực tuyến.'], 1),
  ('benh-vien-ung-buou-tphcm', 'Lưu ý:', array['Vui lòng chuẩn bị hồ sơ bệnh án, kết quả xét nghiệm hoặc toa thuốc cũ nếu có.'], 1),
  ('benh-vien-rang-ham-mat-tphcm', 'LƯU Ý', array['Khám VIP không áp dụng bảo hiểm y tế.', 'Tái khám theo hẹn vui lòng đăng ký trực tiếp tại bệnh viện.'], 1),
  ('benh-vien-y-hoc-co-truyen-tphcm', 'Lưu ý!', array['Đặt khám online chỉ áp dụng cho bệnh nhân cũ đã có mã bệnh nhân tại bệnh viện.'], 1)
) as x(facility_slug, title, lines, sort_order) on x.facility_slug = f.slug
where not exists (
  select 1 from public.facility_notes existing
  where existing.facility_id = f.id and existing.title = x.title
);

insert into public.facility_specialties (facility_id, specialty_id, sort_order)
select f.id, s.id, row_number() over (partition by f.id order by s.name)
from public.medical_facilities f
join (values
  ('benh-vien-nhi-dong-2', 'nhi-khoa'), ('benh-vien-nhi-dong-2', 'dinh-duong'), ('benh-vien-nhi-dong-2', 'ung-buou'), ('benh-vien-nhi-dong-2', 'tai-mui-hong'), ('benh-vien-nhi-dong-2', 'ho-hap'), ('benh-vien-nhi-dong-2', 'tam-ly'),
  ('benh-vien-da-khoa-thu-duc', 'noi-tong-quat'), ('benh-vien-da-khoa-thu-duc', 'ngoai-tong-quat'), ('benh-vien-da-khoa-thu-duc', 'tim-mach'), ('benh-vien-da-khoa-thu-duc', 'san-phu-khoa'), ('benh-vien-da-khoa-thu-duc', 'nhi-khoa'), ('benh-vien-da-khoa-thu-duc', 'da-lieu'),
  ('benh-vien-quan-y-175', 'noi-tong-quat'), ('benh-vien-quan-y-175', 'ngoai-tong-quat'), ('benh-vien-quan-y-175', 'chan-thuong-chinh-hinh'), ('benh-vien-quan-y-175', 'tim-mach'), ('benh-vien-quan-y-175', 'ho-hap'),
  ('benh-vien-ung-buou-tphcm', 'ung-buou'), ('benh-vien-ung-buou-tphcm', 'huyet-hoc'), ('benh-vien-ung-buou-tphcm', 'noi-tong-quat'), ('benh-vien-ung-buou-tphcm', 'chan-doan-hinh-anh'),
  ('benh-vien-rang-ham-mat-tphcm', 'rang-ham-mat'),
  ('benh-vien-y-hoc-co-truyen-tphcm', 'y-hoc-co-truyen'), ('benh-vien-y-hoc-co-truyen-tphcm', 'phuc-hoi-chuc-nang'), ('benh-vien-y-hoc-co-truyen-tphcm', 'co-xuong-khop'), ('benh-vien-y-hoc-co-truyen-tphcm', 'noi-tong-quat'),
  ('phong-kham-san-phu-khoa-13-cao-thang', 'san-phu-khoa'),
  ('phong-kham-nhi-my-my', 'nhi-khoa'), ('phong-kham-nhi-my-my', 'dinh-duong'), ('phong-kham-nhi-my-my', 'ho-hap'), ('phong-kham-nhi-my-my', 'tieu-hoa'),
  ('trung-tam-chac', 'noi-tong-quat'), ('trung-tam-chac', 'ho-hap'), ('trung-tam-chac', 'dinh-duong'),
  ('phong-kham-da-lieu-shine-clinic', 'da-lieu')
) as fs(facility_slug, specialty_slug) on fs.facility_slug = f.slug
join public.clinic_specialties s on s.slug = fs.specialty_slug
on conflict (facility_id, specialty_id) do nothing;

insert into public.facility_services (facility_id, specialty_id, name, description, fee_text, sort_order)
select f.id, s.id, x.name, x.description, x.fee_text, x.sort_order
from public.medical_facilities f
join (values
  ('benh-vien-nhi-dong-2', 'nhi-khoa', 'Khám theo yêu cầu - Khu Lý Tự Trọng', 'Áp dụng các chuyên khoa Nhi được bệnh viện hỗ trợ đặt online', '5.000', 1),
  ('benh-vien-nhi-dong-2', 'tam-ly', 'Khám Tâm lý - Khu Nguyễn Du', 'Khám Tâm lý tại tầng 5, khu Nguyễn Du', '5.000', 2),
  ('benh-vien-rang-ham-mat-tphcm', 'rang-ham-mat', 'Khám VIP Răng Hàm Mặt', 'Không áp dụng bảo hiểm y tế, không áp dụng tái khám theo hẹn', 'Thanh toán tại viện', 1),
  ('benh-vien-y-hoc-co-truyen-tphcm', 'y-hoc-co-truyen', 'Khám bệnh nhân cũ', 'Chỉ áp dụng bệnh nhân đã có mã bệnh nhân tại bệnh viện', 'Thanh toán tại viện', 1),
  ('benh-vien-quan-y-175', 'noi-tong-quat', 'Khám chuyên khoa giờ hành chính', 'Áp dụng các chuyên khoa hỗ trợ đặt lịch trực tuyến', 'Thanh toán tại viện', 1),
  ('benh-vien-quan-y-175', 'noi-tong-quat', 'Khám chuyên khoa ngoài giờ', 'Khám tại khu khám bệnh theo yêu cầu theo lịch bệnh viện', 'Thanh toán tại viện', 2),
  ('benh-vien-ung-buou-tphcm', 'ung-buou', 'Khám chuyên khoa Ung bướu', 'Chuẩn bị hồ sơ bệnh án, kết quả xét nghiệm hoặc toa thuốc cũ nếu có', 'Thanh toán tại viện', 1),
  ('phong-kham-san-phu-khoa-13-cao-thang', 'san-phu-khoa', 'Sản phụ khoa', 'Khám thai, siêu âm và tư vấn sức khỏe sinh sản', 'Thanh toán tại phòng khám', 1),
  ('phong-kham-nhi-my-my', 'nhi-khoa', 'Nhi khoa', 'Khám và tư vấn sức khỏe trẻ em', 'Thanh toán tại phòng khám', 1),
  ('trung-tam-chac', 'noi-tong-quat', 'Nội tổng quát', 'Khám nội tổng quát tại CHAC', 'Thanh toán tại phòng khám', 1),
  ('phong-kham-da-lieu-shine-clinic', 'da-lieu', 'Da liễu', 'Khám da liễu và tư vấn chăm sóc da', 'Thanh toán tại phòng khám', 1)
) as x(facility_slug, specialty_slug, name, description, fee_text, sort_order) on x.facility_slug = f.slug
left join public.clinic_specialties s on s.slug = x.specialty_slug
on conflict (facility_id, name) do update
set specialty_id = excluded.specialty_id,
    description = excluded.description,
    fee_text = excluded.fee_text,
    is_active = true;

insert into public.doctors (slug, initials, full_name, title, specialty_id, facility_id, workplace_text, avatar_url, years_experience)
select d.slug, d.initials, d.full_name, d.title, s.id, f.id, d.workplace_text, d.avatar_url, d.years_experience
from (values
  ('bs-ck2-le-thi-minh-hong', 'LH', 'BS. CK2 Lê Thị Minh Hồng', 'BS. CK2', 'nhi-khoa', 'benh-vien-nhi-dong-2', 'Bệnh viện Nhi Đồng 2', '/image_doctor/1bf4426b4444c51a9c55.jpg', 26),
  ('pgs-ts-bs-lam-viet-trung', 'LT', 'PGS. TS. BS Lâm Việt Trung', 'PGS. TS. BS', 'tieu-hoa', null, 'Bệnh viện Chợ Rẫy', '/image_doctor/3f62dcffdad05b8e02c1.jpg', 26),
  ('bs-ck2-nguyen-thi-thu-ha', 'TH', 'BS. CK2 Nguyễn Thị Thu Hà', 'BS. CK2', 'nhi-khoa', null, 'Bệnh viện Nhi Đồng Thành phố', '/image_doctor/448a5f1b5934d86a8125.jpg', 26),
  ('bs-ck2-vo-duc-hieu', 'VH', 'BS. CK2 Võ Đức Hiếu', 'BS. CK2', 'ung-buou', 'benh-vien-ung-buou-tphcm', 'Bệnh viện Ung Bướu TP.HCM', '/image_doctor/4ff24c634a4ccb12925d.jpg', 26),
  ('pgs-ts-bs-tran-quoc-nhan', 'TN', 'PGS. TS. BS Trần Quốc Nhân', 'PGS. TS. BS', 'noi-tiet', null, 'Bệnh viện Đại học Y Dược', '/image_doctor/6a5870c976e6f7b8aef7.jpg', 26),
  ('bs-nguyen-thi-thu-lan', 'TL', 'BS.CKII Nguyễn Thị Thu Lan', 'BS.CKII', 'san-phu-khoa', 'phong-kham-san-phu-khoa-13-cao-thang', 'Phòng khám Sản Phụ Khoa 13 Cao Thắng', null, 12),
  ('bs-tran-thi-ngoc-mai', 'NM', 'BS Trần Thị Ngọc Mai', 'BS', 'san-phu-khoa', 'phong-kham-san-phu-khoa-13-cao-thang', 'Phòng khám Sản Phụ Khoa 13 Cao Thắng', null, 8),
  ('ths-bs-pham-minh-anh', 'MA', 'ThS.BS Phạm Minh Anh', 'ThS.BS', 'san-phu-khoa', 'phong-kham-san-phu-khoa-13-cao-thang', 'Phòng khám Sản Phụ Khoa 13 Cao Thắng', null, 10),
  ('bs-nguyen-minh-my', 'MM', 'BS Nguyễn Minh Mỹ', 'BS', 'nhi-khoa', 'phong-kham-nhi-my-my', 'Phòng khám Nhi Mỹ Mỹ', null, 14),
  ('bs-le-hoang-phuc', 'HP', 'BS Lê Hoàng Phúc', 'BS', 'nhi-khoa', 'phong-kham-nhi-my-my', 'Phòng khám Nhi Mỹ Mỹ', null, 9),
  ('ths-bs-tran-hai-yen', 'HY', 'ThS.BS Trần Hải Yến', 'ThS.BS', 'nhi-khoa', 'phong-kham-nhi-my-my', 'Phòng khám Nhi Mỹ Mỹ', null, 11),
  ('bs-tran-quoc-tai', 'QT', 'BS Trần Quốc Tài', 'BS', 'noi-tong-quat', 'trung-tam-chac', 'Trung Tâm Chăm Sóc Sức Khỏe Cộng Đồng - CHAC', null, 15),
  ('ths-bs-hoang-dinh-huu-hanh', 'HH', 'ThS.BS Hoàng Đình Hữu Hạnh', 'ThS.BS', 'ho-hap', 'trung-tam-chac', 'Trung Tâm Chăm Sóc Sức Khỏe Cộng Đồng - CHAC', null, 15),
  ('ths-bs-tran-thi-kim-thu', 'KT', 'ThS.BS Trần Thị Kim Thu', 'ThS.BS', 'noi-tong-quat', 'trung-tam-chac', 'Trung Tâm Chăm Sóc Sức Khỏe Cộng Đồng - CHAC', null, 12),
  ('pgs-ts-le-thi-tuyet-lan', 'TL', 'PGS.TS Lê Thị Tuyết Lan', 'PGS.TS', 'ho-hap', 'trung-tam-chac', 'Trung Tâm Chăm Sóc Sức Khỏe Cộng Đồng - CHAC', null, 25),
  ('bs-nguyen-phuong-shine', 'PS', 'BS Nguyễn Phương Shine', 'BS', 'da-lieu', 'phong-kham-da-lieu-shine-clinic', 'Phòng khám Da liễu Shine Clinic', null, 10),
  ('ths-bs-le-thanh-thao', 'TT', 'ThS.BS Lê Thanh Thảo', 'ThS.BS', 'da-lieu', 'phong-kham-da-lieu-shine-clinic', 'Phòng khám Da liễu Shine Clinic', null, 9),
  ('bs-tran-minh-duc', 'MD', 'BS Trần Minh Đức', 'BS', 'da-lieu', 'phong-kham-da-lieu-shine-clinic', 'Phòng khám Da liễu Shine Clinic', null, 8)
) as d(slug, initials, full_name, title, specialty_slug, facility_slug, workplace_text, avatar_url, years_experience)
join public.clinic_specialties s on s.slug = d.specialty_slug
left join public.medical_facilities f on f.slug = d.facility_slug
on conflict (slug) do update
set full_name = excluded.full_name,
    specialty_id = excluded.specialty_id,
    facility_id = excluded.facility_id,
    workplace_text = excluded.workplace_text,
    avatar_url = excluded.avatar_url,
    is_active = true;

update public.doctors
set unavailable_note = 'Bác sĩ Lâm Việt Trung nghỉ ngày 20/10 đến 26/10, 27/10 làm lại bình thường. Nếu bệnh nhân bận việc không đến khám được vui lòng hủy lịch khám đã đặt và đặt lại ngày khác.'
where slug = 'pgs-ts-bs-lam-viet-trung';

insert into public.appointment_slots (facility_id, doctor_id, specialty_id, service_id, slot_date, start_time, end_time, capacity)
select
  coalesce(d.facility_id, f.id),
  d.id,
  d.specialty_id,
  null,
  slot_day::date,
  slot_time::time,
  (slot_time::time + interval '15 minutes')::time,
  1
from public.doctors d
cross join lateral generate_series(current_date, current_date + interval '14 days', interval '1 day') as slot_day
cross join (
  select to_char(time_value, 'HH24:MI') as slot_time
  from generate_series(timestamp '2000-01-01 07:30', timestamp '2000-01-01 11:15', interval '15 minutes') as time_value
  union all
  select to_char(time_value, 'HH24:MI') as slot_time
  from generate_series(timestamp '2000-01-01 13:30', timestamp '2000-01-01 16:45', interval '15 minutes') as time_value
) as t(slot_time)
left join public.medical_facilities f on f.slug = 'benh-vien-nhi-dong-2'
where d.is_active = true
  and not exists (
    select 1 from public.appointment_slots existing
    where existing.doctor_id = d.id
      and existing.slot_date = slot_day::date
      and existing.start_time = slot_time::time
  );

insert into public.appointment_slots (facility_id, specialty_id, service_id, slot_date, start_time, end_time, capacity)
select
  fs.facility_id,
  fs.specialty_id,
  sv.id,
  slot_day::date,
  slot_time::time,
  (slot_time::time + interval '30 minutes')::time,
  8
from public.facility_services sv
join public.facility_specialties fs on fs.facility_id = sv.facility_id and (sv.specialty_id is null or sv.specialty_id = fs.specialty_id)
cross join lateral generate_series(current_date, current_date + interval '14 days', interval '1 day') as slot_day
cross join (values ('07:00'), ('07:30'), ('08:00'), ('08:30'), ('09:00'), ('09:30'), ('10:00'), ('10:30'), ('13:00'), ('13:30'), ('14:00'), ('17:00')) as t(slot_time)
where sv.is_active = true
  and not exists (
    select 1 from public.appointment_slots existing
    where existing.facility_id = fs.facility_id
      and existing.service_id = sv.id
      and existing.specialty_id = fs.specialty_id
      and existing.slot_date = slot_day::date
      and existing.start_time = slot_time::time
  );

update public.appointment_slots slot
set booked_count = slot.capacity
from public.medical_facilities facility
where slot.facility_id = facility.id
  and facility.slug = 'trung-tam-chac'
  and slot.slot_date = (current_date + interval '2 days')::date
  and slot.start_time = '09:00'::time
  and slot.booked_count = 0;

insert into public.symptom_specialty_rules (symptom_keywords, specialty_keywords, severity, advice_text, priority)
values
  (array['dau bung', 'tieu chay', 'tao bon', 'day hoi', 'buon non', 'da day'], array['tieu hoa', 'noi tong quat'], 'normal', 'Neu dau bung du doi, sot cao, non lien tuc, di ngoai ra mau hoac ngat, ban nen di cap cuu ngay.', 10),
  (array['dau dau', 'mat ngu', 'chong mat'], array['noi than kinh', 'noi tong quat'], 'normal', 'Neu dau dau du doi dot ngot, yeu liet, noi kho hoac mat y thuc, ban nen di cap cuu ngay.', 20),
  (array['kho tho', 'dau nguc', 'ngat'], array['ho hap', 'tim mach', 'noi tong quat'], 'urgent', 'Day co the la dau hieu can cap cuu. Neu trieu chung dang xay ra, hay goi 115 hoac den co so y te gan nhat.', 5),
  (array['ho', 'viem hong', 'hen', 'kho tho'], array['ho hap', 'tai mui hong', 'noi tong quat'], 'normal', 'Neu kho tho, tim tai, dau nguc hoac sot cao keo dai, ban nen di kham som hoac cap cuu.', 30),
  (array['mun', 'ngua', 'phat ban', 'di ung', 'da lieu'], array['da lieu'], 'normal', 'Neu phat ban lan nhanh, kho tho hoac sung moi/mat, ban nen di cap cuu ngay.', 40),
  (array['tre em', 'em be', 'nhi khoa', 'be sot'], array['nhi khoa'], 'normal', 'Neu tre li bi, kho tho, co giat hoac sot cao khong ha, ban nen dua tre di cap cuu.', 60),
  (array['mang thai', 'thai', 'phu khoa', 'kinh nguyet'], array['san phu khoa'], 'normal', 'Neu dau bung du doi khi mang thai, ra mau am dao hoac choang, ban nen di cap cuu san khoa ngay.', 70)
on conflict do nothing;

insert into public.chatbot_knowledge_base (keywords, intent, reply, actions, suggested_prompts, priority)
values
  (array['midhealth la gi', 'website nay la gi', 'ban la ai'], 'knowledge_about_midhealth', 'MidHealth la website ho tro dat lich kham truc tuyen. Ban co the tim bac si, chuyen khoa, benh vien hoac phong kham phu hop, chon khung gio kham va theo doi phieu kham dien tu.', '[]'::jsonb, array['Huong dan dat lich kham', 'Toi nen dat kham chuyen khoa nao?'], 10),
  (array['co can dang nhap', 'dang nhap de lam gi', 'tai khoan de lam gi'], 'knowledge_account', 'Ban nen dang nhap de luu ho so benh nhan, dat lich nhanh hon, xem lich da dat va theo doi phieu kham dien tu.', '[{"label":"Dang nhap","url":"/dang-nhap"},{"label":"Dang ky tai khoan","url":"/dang-ky"}]'::jsonb, array['Huong dan dat lich kham', 'Xem phieu kham dien tu'], 20),
  (array['phieu kham dien tu la gi', 'phieu kham', 'lich kham cua toi', 'xem lich hen'], 'knowledge_ticket', 'Phieu kham dien tu giup ban xem thong tin lich hen, nguoi di kham, co so kham, thoi gian kham va trang thai lich da dat.', '[{"label":"Xem phieu kham dien tu","url":"/phieu-kham-dien-tu"}]'::jsonb, array['Toi muon dat lich kham moi', 'Toi can dang nhap khong?'], 30),
  (array['cach dat lich', 'huong dan dat lich', 'dat lich nhu the nao', 'dat kham nhu the nao'], 'knowledge_booking_guide', 'De dat lich tren MidHealth, ban chon bac si, chuyen khoa, benh vien hoac phong kham, sau do chon khung gio con trong, nhap ho so benh nhan va xac nhan lich hen.', '[{"label":"Ve trang dat kham","url":"/dat-kham/bac-si"}]'::jsonb, array['Toi nen dat kham chuyen khoa nao?', 'Goi y bac si phu hop'], 40),
  (array['huy lich', 'doi lich', 'sua lich', 'huy hen'], 'knowledge_appointment_change', 'Ban co the vao phieu kham dien tu de xem trang thai lich hen. Neu lich con cho phep thao tac, ban co the huy lich truc tiep roi dat lai khung gio moi.', '[{"label":"Xem phieu kham dien tu","url":"/phieu-kham-dien-tu"}]'::jsonb, array['Huong dan dat lich kham'], 50),
  (array['thanh toan', 'phi kham', 'gia kham', 'bao hiem', 'bhyt'], 'knowledge_payment', 'Chi phi kham co the khac nhau theo bac si, chuyen khoa, co so kham va dich vu di kem. Neu co bao hiem hoac uu dai, MidHealth se hien thi de ban kiem tra truoc khi xac nhan.', '[{"label":"Ve trang dat kham","url":"/dat-kham/bac-si"}]'::jsonb, array['Goi y bac si phu hop', 'Huong dan dat lich kham'], 60)
on conflict do nothing;

-- Catalog records are manageable in Admin even when they do not have a Firebase login.
with ranked_doctors as (
  select d.*,
    row_number() over (partition by lower(trim(d.full_name)) order by d.created_at, d.id) as name_rank
  from public.doctors d
)
insert into public.app_users (
  firebase_uid, email, full_name, avatar_url, role, status, auth_provider, email_verified
)
select
  'catalog:doctor:' || d.id,
  'doctor+' || regexp_replace(lower(coalesce(nullif(d.slug, ''), d.id::text)), '[^a-z0-9._-]+', '-', 'g') || '@catalog.midhealth.local',
  d.full_name,
  d.avatar_url,
  'doctor'::public.app_user_role,
  'pending'::public.app_user_status,
  'catalog',
  false
from ranked_doctors d
where d.name_rank = 1
on conflict (firebase_uid) do update set
  full_name = excluded.full_name,
  avatar_url = excluded.avatar_url,
  updated_at = now();

insert into public.app_users (
  firebase_uid, email, full_name, avatar_url, role, status, auth_provider, email_verified
)
select
  'catalog:clinic:' || f.id,
  'clinic+' || regexp_replace(lower(coalesce(nullif(f.slug, ''), f.id::text)), '[^a-z0-9._-]+', '-', 'g') || '@catalog.midhealth.local',
  f.name,
  f.avatar_url,
  'clinic'::public.app_user_role,
  'pending'::public.app_user_status,
  'catalog',
  false
from public.medical_facilities f
where f.type = 'clinic'
on conflict (firebase_uid) do update set
  full_name = excluded.full_name,
  avatar_url = excluded.avatar_url,
  updated_at = now();

with ranked_doctors as (
  select d.*,
    row_number() over (partition by lower(trim(d.full_name)) order by d.created_at, d.id) as name_rank
  from public.doctors d
)
insert into public.provider_workspaces (
  firebase_uid, app_user_id, email, owner_name, mode, provider_role,
  linked_doctor_id, status, clinic_name, clinic_address, doctor_title,
  specialty, image_url, review_note, submitted_at, reviewed_at
)
select
  u.firebase_uid,
  u.id,
  u.email,
  d.full_name,
  'doctor',
  'doctor'::public.app_user_role,
  d.id,
  'approved',
  coalesce(f.name, d.workplace_text),
  f.address,
  d.title,
  coalesce(s.name, 'Khám tổng quát'),
  d.avatar_url,
  'Hồ sơ catalog nội bộ được hệ thống đồng bộ.',
  now(),
  now()
from ranked_doctors d
join public.app_users u on u.firebase_uid = 'catalog:doctor:' || d.id
left join public.clinic_specialties s on s.id = d.specialty_id
left join public.medical_facilities f on f.id = d.facility_id
where d.name_rank = 1
on conflict (firebase_uid) do update set
  app_user_id = excluded.app_user_id,
  linked_doctor_id = excluded.linked_doctor_id,
  owner_name = excluded.owner_name,
  specialty = excluded.specialty,
  updated_at = now();

insert into public.provider_workspaces (
  firebase_uid, app_user_id, email, owner_name, owner_phone, mode, provider_role,
  linked_facility_id, status, clinic_name, clinic_address, image_url,
  review_note, submitted_at, reviewed_at
)
select
  u.firebase_uid,
  u.id,
  u.email,
  f.name,
  coalesce(f.phone, f.hotline),
  'clinic',
  'clinic'::public.app_user_role,
  f.id,
  'approved',
  f.name,
  coalesce(nullif(trim(f.address), ''), 'Chưa cập nhật địa chỉ'),
  f.avatar_url,
  'Hồ sơ catalog nội bộ được hệ thống đồng bộ.',
  now(),
  now()
from public.medical_facilities f
join public.app_users u on u.firebase_uid = 'catalog:clinic:' || f.id
where f.type = 'clinic'
on conflict (firebase_uid) do update set
  app_user_id = excluded.app_user_id,
  linked_facility_id = excluded.linked_facility_id,
  owner_name = excluded.owner_name,
  clinic_name = excluded.clinic_name,
  clinic_address = excluded.clinic_address,
  updated_at = now();
