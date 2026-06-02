create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.health_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text,
  specialty text,
  avatar text,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_experts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  title text,
  specialty text,
  avatar text,
  description text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_articles (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.health_categories(id) on delete restrict,
  title text not null,
  slug text not null unique,
  summary text,
  content text not null,
  thumbnail text,
  author_id uuid references public.health_authors(id) on delete set null,
  published_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  view_count integer not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.health_categories enable row level security;
alter table public.health_authors enable row level security;
alter table public.health_experts enable row level security;
alter table public.health_articles enable row level security;

drop policy if exists "public can read active health categories" on public.health_categories;
create policy "public can read active health categories"
on public.health_categories for select
using (status = 'active');

drop policy if exists "public can read active health authors" on public.health_authors;
create policy "public can read active health authors"
on public.health_authors for select
using (status = 'active');

drop policy if exists "public can read active health experts" on public.health_experts;
create policy "public can read active health experts"
on public.health_experts for select
using (status = 'active');

drop policy if exists "public can read published health articles" on public.health_articles;
create policy "public can read published health articles"
on public.health_articles for select
using (status = 'published');

grant select on
  public.health_categories,
  public.health_authors,
  public.health_experts,
  public.health_articles
to anon, authenticated;

create index if not exists health_categories_slug_idx on public.health_categories(slug);
create index if not exists health_articles_category_published_idx on public.health_articles(category_id, published_date desc);
create index if not exists health_articles_slug_idx on public.health_articles(slug);
create index if not exists health_articles_search_idx on public.health_articles using gin (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content, ''))
);

drop trigger if exists set_health_categories_updated_at on public.health_categories;
create trigger set_health_categories_updated_at
before update on public.health_categories
for each row execute function public.set_updated_at();

drop trigger if exists set_health_authors_updated_at on public.health_authors;
create trigger set_health_authors_updated_at
before update on public.health_authors
for each row execute function public.set_updated_at();

drop trigger if exists set_health_experts_updated_at on public.health_experts;
create trigger set_health_experts_updated_at
before update on public.health_experts
for each row execute function public.set_updated_at();

drop trigger if exists set_health_articles_updated_at on public.health_articles;
create trigger set_health_articles_updated_at
before update on public.health_articles
for each row execute function public.set_updated_at();

insert into public.health_categories (name, slug, description, status)
values
  ('Thuốc', 'thuoc', 'Thông tin sử dụng thuốc an toàn và hợp lý.', 'active'),
  ('Dược liệu', 'duoc-lieu', 'Dược liệu, tinh dầu và vị thuốc thường gặp.', 'active'),
  ('Bệnh', 'benh', 'Triệu chứng, phòng bệnh và chăm sóc sức khỏe.', 'active'),
  ('Cơ thể', 'co-the', 'Kiến thức về cơ quan, hormone và hoạt động của cơ thể.', 'active')
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    status = excluded.status;

insert into public.health_authors (name, title, specialty, avatar, description, status)
values
  ('Dược sĩ Nguyễn Lê Thu Trúc', 'Dược sĩ', 'Dược lâm sàng', '/image_doctor/6aec5f71595ed800814f.jpg', 'Biên tập nội dung thuốc và hướng dẫn sử dụng thuốc an toàn.', 'active'),
  ('Dược sĩ Phan Hữu Xuân Hạo', 'Dược sĩ', 'Thông tin thuốc', '/image_doctor/bfbae228e40765593c16.jpg', 'Phụ trách nội dung thuốc không kê đơn và tương tác thuốc.', 'active'),
  ('ThS.BS Nguyễn Thị Lệ Quyên', 'ThS.BS', 'Y học cổ truyền', '/image_doctor/6e11808d86a207fc5eb3.jpg', 'Cố vấn nội dung dược liệu và chăm sóc sức khỏe theo y học cổ truyền.', 'active'),
  ('Bác sĩ Phạm Lê Phương Mai', 'Bác sĩ', 'Sản phụ khoa', '/image_doctor/91270d870ba88af6d3b9.jpg', 'Biên tập nội dung bệnh học và sức khỏe phụ nữ.', 'active'),
  ('ThS.BS Nguyễn Đình Tuấn', 'ThS.BS', 'Nội tiết', '/image_doctor/790b4c984ab7cbe992a6.jpg', 'Cố vấn kiến thức cơ thể, hormone và chuyển hóa.', 'active')
on conflict do nothing;

insert into public.health_experts (name, title, specialty, avatar, description, status)
values
  ('ThS.BS Nguyễn Hồng Vân Khánh', 'ThS.BS', 'Gan mật tụy - Ghép gan, Nhi', '/image_doctor/6aec5f71595ed800814f.jpg', 'Tham vấn chuyên môn các chủ đề bệnh học và sức khỏe trẻ em.', 'active'),
  ('ThS.BS Đinh Thị Lan Phương', 'ThS.BS', 'Tai - Mũi - Họng', '/image_doctor/6e11808d86a207fc5eb3.jpg', 'Cố vấn nội dung tai mũi họng và hô hấp trên.', 'active'),
  ('ThS.BS Vũ Thành Đô', 'ThS.BS', 'Tim - Thận - Khớp - Nội tiết', '/image_doctor/790b4c984ab7cbe992a6.jpg', 'Tham vấn các bài viết về nội khoa và chuyển hóa.', 'active'),
  ('ThS.BS Phan Lê Nam', 'ThS.BS', 'Sản phụ khoa', '/image_doctor/91270d870ba88af6d3b9.jpg', 'Cố vấn nội dung sức khỏe phụ nữ và chăm sóc sinh sản.', 'active'),
  ('Dược sĩ Dương Anh Hoàng', 'Dược sĩ', 'Dược', '/image_doctor/bfbae228e40765593c16.jpg', 'Rà soát thông tin thuốc, dược liệu và an toàn sử dụng.', 'active')
on conflict do nothing;

insert into public.health_articles (
  category_id,
  title,
  slug,
  summary,
  content,
  thumbnail,
  author_id,
  published_date,
  updated_date,
  status,
  view_count
)
select c.id, a.title, a.slug, a.summary, a.content, a.thumbnail, au.id, a.published_date::timestamptz, a.updated_date::timestamptz, 'published', a.view_count
from (values
  ('thuoc', 'Thuốc Ozempic: Thành phần, công dụng và lưu ý khi sử dụng', 'thuoc-ozempic-thanh-phan-cong-dung-luu-y', 'Ozempic là thuốc kê đơn cần dùng theo chỉ định và theo dõi của nhân viên y tế.', '<p><strong>Ozempic</strong> chứa semaglutide, thường được chỉ định trong quản lý đường huyết ở người trưởng thành mắc đái tháo đường típ 2.</p><h2>Ozempic là thuốc gì?</h2><p>Thuốc thuộc nhóm đồng vận thụ thể GLP-1. Người bệnh không tự ý tăng liều hoặc dùng chung với thuốc khác khi chưa được bác sĩ đánh giá.</p><h2>Lưu ý khi dùng</h2><p>Theo dõi dấu hiệu hạ đường huyết, rối loạn tiêu hóa và thông báo cho bác sĩ khi có triệu chứng bất thường.</p>', '/images_chuyen_khoa/Noitiet.webp', 'Dược sĩ Nguyễn Lê Thu Trúc', '2026-05-28', '2026-05-27', 125),
  ('thuoc', 'Thuốc Saxenda: Thành phần, công dụng và cách dùng an toàn', 'thuoc-saxenda-thanh-phan-cong-dung-cach-dung-an-toan', 'Saxenda là thuốc tiêm hỗ trợ quản lý cân nặng theo chỉ định chuyên môn.', '<p><strong>Saxenda</strong> là một trong những giải pháp hỗ trợ điều trị và quản lý cân nặng nhận được nhiều quan tâm hiện nay. Vì đây là thuốc kê đơn dạng tiêm, việc hiểu rõ thành phần, liều lượng và lưu ý an toàn là điều quan trọng trước khi sử dụng.</p><h2>Saxenda là thuốc gì?</h2><p>Saxenda chứa liraglutide, thuộc nhóm đồng vận thụ thể GLP-1. Thuốc cần được dùng theo phác đồ tăng liều và theo dõi đáp ứng của bác sĩ.</p><h2>Ai cần thận trọng?</h2><p>Người có bệnh lý tuyến giáp, viêm tụy, phụ nữ mang thai hoặc đang cho con bú cần hỏi ý kiến bác sĩ trước khi dùng.</p>', '/images_chuyen_khoa/Dinhduong.webp', 'Dược sĩ Nguyễn Lê Thu Trúc', '2026-05-28', '2026-05-27', 142),
  ('thuoc', 'Thuốc Metronidazol là gì? Tác dụng, cách dùng và những điều lưu ý', 'thuoc-metronidazol-la-gi-tac-dung-cach-dung-luu-y', 'Metronidazol là thuốc kháng khuẩn, kháng ký sinh trùng cần dùng đúng liều.', '<p>Metronidazol được sử dụng trong một số nhiễm khuẩn kỵ khí và nhiễm ký sinh trùng. Người bệnh cần dùng đủ liệu trình để hạn chế nguy cơ tái phát.</p><h2>Cách dùng</h2><p>Uống thuốc theo đơn, không tự ý ngưng thuốc khi triệu chứng vừa cải thiện. Tránh rượu bia trong thời gian dùng thuốc và ít nhất 48 giờ sau liều cuối.</p>', '/images_chuyen_khoa/truyennhiem.webp', 'Dược sĩ Phan Hữu Xuân Hạo', '2025-11-18', '2025-11-18', 98),
  ('thuoc', 'Viên ngậm kháng viêm Difflam: Công dụng, cách dùng và lưu ý khi dùng', 'vien-ngam-khang-viem-difflam-cong-dung-cach-dung-luu-y', 'Difflam hỗ trợ giảm đau họng tại chỗ, không thay thế điều trị nguyên nhân.', '<p>Viên ngậm Difflam thường được dùng để làm dịu đau rát họng. Cần đọc kỹ hướng dẫn sử dụng, đặc biệt về số viên tối đa trong ngày.</p><h2>Khi nào nên đi khám?</h2><p>Nếu đau họng kéo dài, sốt cao, khó thở hoặc nuốt đau nhiều, người bệnh nên đi khám để tìm nguyên nhân.</p>', '/images_chuyen_khoa/taimuihong.webp', 'Dược sĩ Phan Hữu Xuân Hạo', '2026-03-18', '2026-03-18', 76),
  ('thuoc', 'Thuốc Lomexin 1000 mg là gì? Công dụng và cách bảo quản', 'thuoc-lomexin-1000mg-la-gi-cong-dung-cach-bao-quan', 'Lomexin cần dùng đúng chỉ định, đúng đường dùng và đúng thời gian.', '<p>Lomexin là thuốc điều trị nhiễm nấm tại chỗ trong một số tình huống. Người bệnh cần dùng theo hướng dẫn của bác sĩ hoặc dược sĩ.</p><h2>Bảo quản</h2><p>Bảo quản nơi khô mát, tránh ánh sáng trực tiếp và để xa tầm tay trẻ em.</p>', '/images_chuyen_khoa/sanphukhoa.webp', 'Dược sĩ Phan Hữu Xuân Hạo', '2024-12-25', '2024-12-25', 61),
  ('duoc-lieu', 'Tinh dầu sả: công dụng, cách dùng và lưu ý', 'tinh-dau-sa-cong-dung-cach-dung-luu-y', 'Tinh dầu sả có mùi thơm đặc trưng, thường dùng để thư giãn và khử mùi.', '<p>Tinh dầu sả được chiết xuất từ cây sả, có thể dùng trong khuếch tán hương hoặc pha loãng để chăm sóc ngoài da.</p><h2>Lưu ý an toàn</h2><p>Không uống tinh dầu khi chưa có chỉ định. Luôn pha loãng trước khi dùng trên da và thử trên vùng nhỏ trước.</p>', '/images_chuyen_khoa/yhocduphong.webp', 'Dược sĩ Phan Hữu Xuân Hạo', '2025-11-12', '2025-11-12', 87),
  ('duoc-lieu', 'Biển súc: Vị thuốc quý và những công dụng đối với sức khỏe', 'bien-suc-vi-thuoc-quy-cong-dung-doi-voi-suc-khoe', 'Biển súc là dược liệu được dùng trong y học cổ truyền với nhiều bài thuốc khác nhau.', '<p>Biển súc thường được nhắc đến trong các bài thuốc thanh nhiệt, lợi tiểu. Việc dùng dược liệu nên được cá nhân hóa theo thể trạng.</p><h2>Không tự phối hợp</h2><p>Người đang dùng thuốc điều trị bệnh mạn tính nên hỏi ý kiến chuyên gia trước khi dùng thêm dược liệu.</p>', '/images_chuyen_khoa/Yhoccotruyen.webp', 'ThS.BS Nguyễn Thị Lệ Quyên', '2022-10-23', '2022-10-23', 53),
  ('duoc-lieu', 'Bàng phiến - Những tác dụng và những lưu ý khi dùng', 'bang-phien-nhung-tac-dung-va-luu-y-khi-dung', 'Bàng phiến cần được dùng đúng cách vì không phù hợp với mọi đối tượng.', '<p>Bàng phiến là vị thuốc có tính chất đặc thù, chỉ nên dùng khi có hướng dẫn từ người có chuyên môn.</p><h2>Lưu ý</h2><p>Không tự ý dùng cho trẻ nhỏ, phụ nữ mang thai hoặc người có bệnh nền khi chưa được tư vấn.</p>', '/images_chuyen_khoa/yhocduphong.webp', 'ThS.BS Nguyễn Thị Lệ Quyên', '2025-11-12', '2025-11-12', 44),
  ('duoc-lieu', 'Tinh dầu trầm hương: giá trị thực sự của loại tinh dầu đắt đỏ', 'tinh-dau-tram-huong-gia-tri-thuc-su', 'Tinh dầu trầm hương được dùng trong thư giãn, hương liệu và chăm sóc tinh thần.', '<p>Tinh dầu trầm hương có mùi thơm sâu, thường dùng trong không gian thư giãn. Giá trị sản phẩm phụ thuộc nguồn gốc, phương pháp chiết xuất và độ tinh khiết.</p><h2>Cách chọn</h2><p>Ưu tiên sản phẩm có nguồn gốc rõ ràng, nhãn thành phần minh bạch và hướng dẫn sử dụng cụ thể.</p>', '/images_chuyen_khoa/tamly.webp', 'Bác sĩ Phạm Lê Phương Mai', '2022-10-10', '2022-10-10', 66),
  ('duoc-lieu', 'Gừng: công dụng, cách dùng và trường hợp cần thận trọng', 'gung-cong-dung-cach-dung-than-trong', 'Gừng là dược liệu quen thuộc nhưng vẫn cần dùng đúng lượng.', '<p>Gừng có thể hỗ trợ làm ấm cơ thể, giảm cảm giác buồn nôn ở một số người. Tuy nhiên, không nên xem gừng là phương pháp điều trị thay thế.</p><h2>Thận trọng</h2><p>Người đang dùng thuốc chống đông hoặc có bệnh lý dạ dày nên hỏi ý kiến bác sĩ trước khi dùng nhiều gừng.</p>', '/images_chuyen_khoa/Yhoccotruyen.webp', 'ThS.BS Nguyễn Thị Lệ Quyên', '2025-08-09', '2025-08-09', 49),
  ('benh', 'Điểm danh 9 bác sĩ chữa hen suyễn giỏi TPHCM đúng người, đúng chuyên khoa', 'diem-danh-bac-si-chua-hen-suyen-gioi-tphcm', 'Hen suyễn cần được chẩn đoán và theo dõi bởi bác sĩ chuyên khoa phù hợp.', '<p>Hen suyễn là bệnh hô hấp mạn tính có thể kiểm soát tốt nếu người bệnh được đánh giá đúng mức độ và dùng thuốc dự phòng phù hợp.</p><h2>Khi nào cần khám?</h2><p>Khó thở, khò khè tái diễn, ho về đêm hoặc phải dùng thuốc cắt cơn thường xuyên là các dấu hiệu nên đi khám.</p>', '/images_chuyen_khoa/Hohap.webp', 'Bác sĩ Phạm Lê Phương Mai', '2026-05-22', '2026-05-22', 103),
  ('benh', '15 loại nước ép tốt cho sức khỏe được khuyên dùng', '15-loai-nuoc-ep-tot-cho-suc-khoe', 'Nước ép có thể bổ sung vitamin nhưng không thay thế bữa ăn cân bằng.', '<p>Nước ép trái cây và rau củ có thể giúp bổ sung vi chất. Tuy vậy, lượng đường tự nhiên vẫn cần được cân nhắc, nhất là ở người đái tháo đường.</p><h2>Gợi ý dùng hợp lý</h2><p>Ưu tiên nước ép không thêm đường, dùng lượng vừa phải và kết hợp ăn rau quả nguyên miếng.</p>', '/images_chuyen_khoa/Dinhduong.webp', 'Dược sĩ Phan Hữu Xuân Hạo', '2025-11-19', '2025-11-19', 92),
  ('benh', 'Khám phụ khoa là gì? Khám phụ khoa là khám những gì?', 'kham-phu-khoa-la-gi-kham-nhung-gi', 'Khám phụ khoa giúp phát hiện sớm viêm nhiễm và vấn đề sức khỏe sinh sản.', '<p>Khám phụ khoa gồm hỏi bệnh, thăm khám và có thể kèm xét nghiệm tùy tình trạng. Người đi khám nên chia sẻ trung thực triệu chứng và tiền sử dùng thuốc.</p><h2>Chuẩn bị trước khi khám</h2><p>Ghi lại ngày kinh gần nhất, triệu chứng đang gặp và các thuốc đã sử dụng.</p>', '/images_chuyen_khoa/sanphukhoa.webp', 'Bác sĩ Phạm Lê Phương Mai', '2025-11-14', '2025-11-14', 118),
  ('benh', 'Thời điểm khám phụ khoa tốt nhất cho nữ giới', 'thoi-diem-kham-phu-khoa-tot-nhat-cho-nu-gioi', 'Chọn thời điểm khám phù hợp giúp kết quả thăm khám thuận lợi hơn.', '<p>Thông thường, phụ nữ nên khám khi đã sạch kinh vài ngày. Nếu có đau bụng nhiều, ra huyết bất thường hoặc sốt, cần đi khám sớm thay vì chờ lịch định kỳ.</p><h2>Tần suất</h2><p>Khám định kỳ 6-12 tháng một lần hoặc theo hẹn của bác sĩ khi có bệnh lý cần theo dõi.</p>', '/images_chuyen_khoa/sanphukhoa.webp', 'Bác sĩ Phạm Lê Phương Mai', '2025-10-28', '2025-10-28', 84),
  ('benh', 'Sốt xuất huyết: triệu chứng cảnh báo và cách chăm sóc tại nhà', 'sot-xuat-huyet-trieu-chung-canh-bao-cham-soc', 'Sốt xuất huyết cần theo dõi dấu hiệu cảnh báo trong giai đoạn hạ sốt.', '<p>Sốt xuất huyết thường gây sốt cao, đau mỏi người và mệt nhiều. Người bệnh cần uống đủ nước và tái khám theo hẹn.</p><h2>Dấu hiệu nguy hiểm</h2><p>Đau bụng nhiều, nôn ói liên tục, lừ đừ, chảy máu bất thường hoặc tay chân lạnh cần đi cấp cứu.</p>', '/images_chuyen_khoa/truyennhiem.webp', 'Bác sĩ Phạm Lê Phương Mai', '2025-09-08', '2025-09-08', 97),
  ('co-the', 'Tìm hiểu về hệ nội tiết của cơ thể: Chức năng và các bệnh lý liên quan', 'tim-hieu-he-noi-tiet-cua-co-the', 'Hệ nội tiết điều hòa chuyển hóa, tăng trưởng, sinh sản và nhiều chức năng sống.', '<p>Hệ nội tiết gồm các tuyến tiết hormone vào máu. Hormone giúp điều hòa đường huyết, huyết áp, chuyển hóa năng lượng và khả năng sinh sản.</p><h2>Khi nào cần kiểm tra?</h2><p>Sụt cân hoặc tăng cân bất thường, mệt kéo dài, khát nhiều, rối loạn kinh nguyệt hoặc hồi hộp có thể cần đánh giá nội tiết.</p>', '/images_chuyen_khoa/Noitiet.webp', 'ThS.BS Nguyễn Đình Tuấn', '2022-08-30', '2022-08-30', 91),
  ('co-the', 'Androgen và những rối loạn liên quan hormone này', 'androgen-va-roi-loan-lien-quan-hormone', 'Androgen ảnh hưởng đến da, tóc, chuyển hóa và sức khỏe sinh sản.', '<p>Androgen là nhóm hormone có ở cả nam và nữ. Nồng độ androgen bất thường có thể liên quan mụn trứng cá, rậm lông, rụng tóc hoặc rối loạn kinh nguyệt.</p><h2>Chẩn đoán</h2><p>Bác sĩ có thể chỉ định xét nghiệm hormone, siêu âm và đánh giá triệu chứng lâm sàng.</p>', '/images_chuyen_khoa/Noitiet.webp', 'Bác sĩ Phạm Lê Phương Mai', '2022-08-29', '2022-08-29', 48),
  ('co-the', 'Hormone testosterone và những thông tin bạn cần biết', 'hormone-testosterone-va-thong-tin-can-biet', 'Testosterone liên quan đến cơ bắp, sinh lý, mật độ xương và tâm trạng.', '<p>Testosterone là hormone quan trọng với sức khỏe sinh sản và chuyển hóa. Nồng độ thấp hoặc cao bất thường đều cần được đánh giá trong bối cảnh triệu chứng cụ thể.</p><h2>Không tự bổ sung</h2><p>Việc dùng testosterone không đúng chỉ định có thể gây tác dụng phụ nghiêm trọng.</p>', '/images_chuyen_khoa/Namkhoa.webp', 'ThS.BS Nguyễn Đình Tuấn', '2022-08-19', '2022-08-19', 73),
  ('co-the', 'Hormone Estrogen và những thông tin bạn cần biết', 'hormone-estrogen-va-thong-tin-can-biet', 'Estrogen đóng vai trò quan trọng trong sức khỏe sinh sản và xương.', '<p>Estrogen ảnh hưởng đến chu kỳ kinh nguyệt, niêm mạc tử cung, da, xương và chuyển hóa. Thay đổi estrogen có thể xuất hiện ở tuổi dậy thì, sau sinh hoặc quanh mãn kinh.</p><h2>Khi nào nên khám?</h2><p>Rối loạn kinh nguyệt kéo dài, bốc hỏa nhiều hoặc đau khi quan hệ nên được tư vấn y khoa.</p>', '/images_chuyen_khoa/sanphukhoa.webp', 'ThS.BS Nguyễn Đình Tuấn', '2025-11-14', '2025-11-14', 88),
  ('co-the', 'Hệ miễn dịch hoạt động như thế nào?', 'he-mien-dich-hoat-dong-nhu-the-nao', 'Hệ miễn dịch bảo vệ cơ thể trước tác nhân gây bệnh và cần được duy trì cân bằng.', '<p>Hệ miễn dịch gồm nhiều tế bào và cơ chế phối hợp để nhận diện, đáp ứng với vi sinh vật gây bệnh. Một đáp ứng miễn dịch tốt cần ngủ đủ, dinh dưỡng hợp lý và tiêm chủng phù hợp.</p><h2>Dấu hiệu cần chú ý</h2><p>Nhiễm trùng tái diễn, sụt cân không rõ nguyên nhân hoặc sốt kéo dài cần được thăm khám.</p>', '/images_chuyen_khoa/Hohap.webp', 'ThS.BS Nguyễn Đình Tuấn', '2025-04-20', '2025-04-20', 57)
) as a(category_slug, title, slug, summary, content, thumbnail, author_name, published_date, updated_date, view_count)
join public.health_categories c on c.slug = a.category_slug
left join public.health_authors au on au.name = a.author_name
on conflict (slug) do update
set category_id = excluded.category_id,
    title = excluded.title,
    summary = excluded.summary,
    content = excluded.content,
    thumbnail = excluded.thumbnail,
    author_id = excluded.author_id,
    published_date = excluded.published_date,
    updated_date = excluded.updated_date,
    status = excluded.status,
    view_count = excluded.view_count;
