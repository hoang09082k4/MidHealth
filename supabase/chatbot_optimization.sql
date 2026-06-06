create table if not exists public.symptom_specialty_rules (
  id uuid primary key default gen_random_uuid(),
  symptom_keywords text[] not null,
  specialty_keywords text[] not null,
  severity text not null default 'normal' check (severity in ('normal', 'urgent')),
  advice_text text,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chatbot_interactions (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text,
  user_message text not null,
  assistant_reply text,
  intent text,
  model text,
  actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.chatbot_knowledge_base (
  id uuid primary key default gen_random_uuid(),
  keywords text[] not null,
  intent text not null default 'knowledge',
  reply text not null,
  actions jsonb not null default '[]'::jsonb,
  suggested_prompts text[] not null default array[]::text[],
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists symptom_specialty_rules_active_idx
on public.symptom_specialty_rules(is_active, priority);

create index if not exists chatbot_knowledge_base_active_idx
on public.chatbot_knowledge_base(is_active, priority);

create index if not exists chatbot_interactions_firebase_uid_idx
on public.chatbot_interactions(firebase_uid, created_at desc);

create index if not exists chatbot_interactions_created_at_idx
on public.chatbot_interactions(created_at desc);

alter table public.symptom_specialty_rules enable row level security;
alter table public.chatbot_interactions enable row level security;
alter table public.chatbot_knowledge_base enable row level security;

drop policy if exists "public can read active symptom rules" on public.symptom_specialty_rules;
create policy "public can read active symptom rules"
on public.symptom_specialty_rules for select
using (is_active = true);

drop policy if exists "service role can manage symptom rules" on public.symptom_specialty_rules;
create policy "service role can manage symptom rules"
on public.symptom_specialty_rules for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "service role can manage chatbot interactions" on public.chatbot_interactions;
create policy "service role can manage chatbot interactions"
on public.chatbot_interactions for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "public can read active chatbot knowledge" on public.chatbot_knowledge_base;
create policy "public can read active chatbot knowledge"
on public.chatbot_knowledge_base for select
using (is_active = true);

drop policy if exists "service role can manage chatbot knowledge" on public.chatbot_knowledge_base;
create policy "service role can manage chatbot knowledge"
on public.chatbot_knowledge_base for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

grant select on public.symptom_specialty_rules to anon, authenticated;
grant select on public.chatbot_knowledge_base to anon, authenticated;

drop trigger if exists set_symptom_specialty_rules_updated_at on public.symptom_specialty_rules;
create trigger set_symptom_specialty_rules_updated_at
before update on public.symptom_specialty_rules
for each row execute function public.set_updated_at();

drop trigger if exists set_chatbot_knowledge_base_updated_at on public.chatbot_knowledge_base;
create trigger set_chatbot_knowledge_base_updated_at
before update on public.chatbot_knowledge_base
for each row execute function public.set_updated_at();

insert into public.symptom_specialty_rules (symptom_keywords, specialty_keywords, severity, advice_text, priority)
values
  (array['dau bung', 'tieu chay', 'tao bon', 'day hoi', 'buon non', 'da day'], array['tieu hoa', 'noi tong quat'], 'normal', 'Neu dau bung du doi, sot cao, non lien tuc, di ngoai ra mau hoac ngat, ban nen di cap cuu ngay.', 10),
  (array['dau dau', 'mat ngu', 'chong mat'], array['noi than kinh', 'noi tong quat'], 'normal', 'Neu dau dau du doi dot ngot, yeu liet, noi kho hoac mat y thuc, ban nen di cap cuu ngay.', 20),
  (array['kho tho', 'dau nguc', 'ngat'], array['ho hap', 'tim mach', 'noi tong quat'], 'urgent', 'Day co the la dau hieu can cap cuu. Neu trieu chung dang xay ra, hay goi 115 hoac den co so y te gan nhat.', 5),
  (array['ho', 'viem hong', 'hen', 'kho tho'], array['ho hap', 'tai mui hong', 'noi tong quat'], 'normal', 'Neu kho tho, tim tai, dau nguc hoac sot cao keo dai, ban nen di kham som hoac cap cuu.', 30),
  (array['mun', 'ngua', 'phat ban', 'di ung', 'da lieu'], array['da lieu'], 'normal', 'Neu phat ban lan nhanh, kho tho hoac sung moi/mat, ban nen di cap cuu ngay.', 40),
  (array['huyet ap', 'tim mach', 'hoi hop'], array['tim mach', 'noi tong quat'], 'normal', 'Neu dau nguc, kho tho, vat mo hoi lanh hoac ngat, ban nen di cap cuu ngay.', 50),
  (array['tre em', 'em be', 'nhi khoa', 'be sot'], array['nhi khoa'], 'normal', 'Neu tre li bi, kho tho, co giat hoac sot cao khong ha, ban nen dua tre di cap cuu.', 60),
  (array['mang thai', 'thai', 'phu khoa', 'kinh nguyet'], array['san phu khoa'], 'normal', 'Neu dau bung du doi khi mang thai, ra mau am dao hoac choang, ban nen di cap cuu san khoa ngay.', 70)
on conflict do nothing;

insert into public.chatbot_knowledge_base (keywords, intent, reply, actions, suggested_prompts, priority)
values
  (array['midhealth la gi', 'website nay la gi', 'ban la ai', 'tro ly la gi'], 'knowledge_about_midhealth', 'MidHealth là website hỗ trợ đặt lịch khám trực tuyến. Bạn có thể tìm bác sĩ, chuyên khoa, bệnh viện hoặc phòng khám phù hợp, chọn khung giờ khám và theo dõi phiếu khám điện tử.', '[]'::jsonb, array['Hướng dẫn đặt lịch khám', 'Tôi nên đặt khám chuyên khoa nào?'], 10),
  (array['co can dang nhap', 'dang nhap de lam gi', 'tai khoan de lam gi'], 'knowledge_account', 'Bạn nên đăng nhập để lưu hồ sơ bệnh nhân, đặt lịch nhanh hơn, xem lịch đã đặt và theo dõi phiếu khám điện tử. Nếu chỉ xem thông tin cơ bản, bạn vẫn có thể tham khảo trước trên website.', '[{"label":"Đăng nhập","url":"/dang-nhap"},{"label":"Đăng ký tài khoản","url":"/dang-ky"}]'::jsonb, array['Hướng dẫn đặt lịch khám', 'Xem phiếu khám điện tử'], 20),
  (array['phieu kham dien tu la gi', 'phieu kham', 'lich kham cua toi', 'xem lich hen'], 'knowledge_ticket', 'Phiếu khám điện tử giúp bạn xem thông tin lịch hẹn, người đi khám, cơ sở khám, thời gian khám và trạng thái lịch đã đặt. Thông tin này cần đăng nhập để bảo vệ dữ liệu bệnh nhân.', '[{"label":"Xem phiếu khám điện tử","url":"/phieu-kham-dien-tu"}]'::jsonb, array['Tôi muốn đặt lịch khám mới', 'Tôi cần đăng nhập không?'], 30),
  (array['cach dat lich', 'huong dan dat lich', 'dat lich nhu the nao', 'dat kham nhu the nao'], 'knowledge_booking_guide', 'Để đặt lịch trên MidHealth, bạn chọn hướng đặt khám theo chuyên khoa, bác sĩ, bệnh viện hoặc phòng khám. Sau đó chọn khung giờ còn trống, nhập hồ sơ bệnh nhân, kiểm tra thông tin và xác nhận lịch hẹn.', '[{"label":"Về trang đặt khám","url":"/dat-kham/bac-si"}]'::jsonb, array['Tôi nên đặt khám chuyên khoa nào?', 'Gợi ý bác sĩ phù hợp'], 40),
  (array['huy lich', 'doi lich', 'sua lich', 'huy hen'], 'knowledge_appointment_change', 'Bạn có thể vào phiếu khám điện tử để xem trạng thái lịch hẹn. Nếu lịch còn cho phép thao tác, bạn có thể hủy lịch trực tiếp. Với nhu cầu đổi lịch, bạn nên hủy lịch cũ nếu phù hợp rồi đặt lại khung giờ mới.', '[{"label":"Xem phiếu khám điện tử","url":"/phieu-kham-dien-tu"}]'::jsonb, array['Hướng dẫn đặt lịch khám'], 50),
  (array['thanh toan', 'phi kham', 'gia kham', 'bao hiem', 'bhyt'], 'knowledge_payment', 'Chi phí khám có thể khác nhau theo bác sĩ, chuyên khoa, cơ sở khám và dịch vụ đi kèm. Nếu có thông tin bảo hiểm hoặc ưu đãi trong quy trình đặt khám, MidHealth sẽ hiển thị để bạn kiểm tra trước khi xác nhận.', '[{"label":"Về trang đặt khám","url":"/dat-kham/bac-si"}]'::jsonb, array['Gợi ý bác sĩ phù hợp', 'Hướng dẫn đặt lịch khám'], 60),
  (array['bao mat', 'thong tin ca nhan', 'du lieu benh nhan', 'ho so benh nhan'], 'knowledge_privacy', 'Thông tin hồ sơ bệnh nhân và phiếu khám điện tử cần đăng nhập để hạn chế người khác xem nhầm dữ liệu của bạn. Bạn nên kiểm tra kỹ thông tin người đi khám trước khi xác nhận lịch.', '[{"label":"Đăng nhập","url":"/dang-nhap"}]'::jsonb, array['Xem phiếu khám điện tử'], 70),
  (array['cam on', 'thanks', 'thank you'], 'small_talk_thanks', 'Không có gì. Nếu cần hỗ trợ thêm, bạn cứ nhắn nội dung mình đang thắc mắc.', '[]'::jsonb, array[]::text[], 80)
on conflict do nothing;
