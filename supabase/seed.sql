-- Seed only the clinic specialties, virtual doctor profiles, and symptom rules
-- used by the current single-clinic application. Administrators manage the live catalog.
-- Firebase passwords are managed by Firebase Authentication, never seeded into Supabase.
begin;
-- Ten ho so bac si ao de xay dung giao dien va cong viec bac si.
-- Tai khoan dang nhap Firebase duoc tao rieng boi backend/scripts/provision_virtual_doctors.js.
-- Khong doi cac ho so nay thanh bac si that neu chua xac minh thong tin hanh nghe.
insert into public.clinic_specialties (slug, name, image_url, consultation_fee, clinic_owned, is_active)
values
  ('noi-tong-quat', 'Ná»™i tá»•ng quÃ¡t', '/images_chuyen_khoa/Noitongquat.webp', 180000, true, true),
  ('nhi-khoa', 'Nhi khoa', '/images_chuyen_khoa/Nhikhoa.webp', 180000, true, true),
  ('san-phu-khoa', 'Sáº£n phá»¥ khoa', '/images_chuyen_khoa/sanphukhoa.webp', 220000, true, true),
  ('da-lieu', 'Da liá»…u', '/images_chuyen_khoa/Dalieu.webp', 180000, true, true),
  ('tai-mui-hong', 'Tai - MÅ©i - Há»ng', '/images_chuyen_khoa/taimuihong.webp', 180000, true, true),
  ('dinh-duong', 'Dinh dÆ°á»¡ng', '/images_chuyen_khoa/Dinhduong.webp', 180000, true, true),
  ('kham-tong-quat', 'KhÃ¡m tá»•ng quÃ¡t', '/images_chuyen_khoa/Noitongquat.webp', 180000, true, true)
on conflict (slug) do nothing;

insert into public.doctors
  (slug, full_name, initials, title, specialty_id, avatar_url, years_experience, intro,
   workplace_text, clinic_owned, is_demo, is_active, homepage_featured, homepage_order, notice)
select v.slug, v.full_name, v.initials, 'BÃ¡c sÄ©', s.id, v.avatar_url, null,
  'Há»“ sÆ¡ bÃ¡c sÄ© mÃ´ phá»ng phá»¥c vá»¥ xÃ¢y dá»±ng website MidHealth. ThÃ´ng tin nÃ y khÃ´ng Ä‘áº¡i diá»‡n cho ngÆ°á»i hÃ nh nghá» thá»±c táº¿.',
  'MidHealth', true, true, true, true, v.display_order,
  'Dá»¯ liá»‡u mÃ´ phá»ng: khÃ´ng dÃ¹ng Ä‘á»ƒ Ä‘áº·t lá»‹ch khÃ¡m tháº­t.'
from (values
  ('midhealth-virtual-nguyen-van-minh', 'BS. Nguyá»…n VÄƒn Minh', 'VM', 'noi-tong-quat', '/image_doctor/e51eb8bfbe903fce6681.jpg', 1),
  ('midhealth-virtual-tran-quoc-huy', 'BS. Tráº§n Quá»‘c Huy', 'QH', 'nhi-khoa', '/image_doctor/f7698cf68ad90b8752c8.jpg', 2),
  ('midhealth-virtual-le-hoang-nam', 'BS. LÃª HoÃ ng Nam', 'HN', 'da-lieu', '/image_doctor/6a5870c976e6f7b8aef7.jpg', 3),
  ('midhealth-virtual-pham-duc-long', 'BS. Pháº¡m Äá»©c Long', 'DL', 'tai-mui-hong', '/image_doctor/3f62dcffdad05b8e02c1.jpg', 4),
  ('midhealth-virtual-dang-quang-khai', 'BS. Äáº·ng Quang Kháº£i', 'QK', 'kham-tong-quat', '/image_doctor/e51eb8bfbe903fce6681.jpg', 5),
  ('midhealth-virtual-nguyen-thi-lan', 'BS. Nguyá»…n Thá»‹ Lan', 'TL', 'san-phu-khoa', '/image_doctor/91270d870ba88af6d3b9.jpg', 6),
  ('midhealth-virtual-tran-thu-ha', 'BS. Tráº§n Thu HÃ ', 'TH', 'dinh-duong', '/image_doctor/790b4c984ab7cbe992a6.jpg', 7),
  ('midhealth-virtual-le-ngoc-mai', 'BS. LÃª Ngá»c Mai', 'NM', 'nhi-khoa', '/image_doctor/6e11808d86a207fc5eb3.jpg', 8),
  ('midhealth-virtual-pham-thao-vy', 'BS. Pháº¡m Tháº£o Vy', 'TV', 'da-lieu', '/image_doctor/4ff24c634a4ccb12925d.jpg', 9),
  ('midhealth-virtual-vo-minh-chau', 'BS. VÃµ Minh ChÃ¢u', 'MC', 'noi-tong-quat', '/image_doctor/448a5f1b5934d86a8125.jpg', 10)
) as v(slug, full_name, initials, specialty_slug, avatar_url, display_order)
join public.clinic_specialties s on s.slug = v.specialty_slug
on conflict (slug) do nothing;
commit;
