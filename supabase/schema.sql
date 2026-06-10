create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql set search_path = public;

do $$
begin
  create type public.app_user_role as enum ('patient', 'doctor', 'staff', 'admin');
exception
  when duplicate_object then null;
end $$;

alter type public.app_user_role add value if not exists 'clinic';

do $$
begin
  create type public.app_user_status as enum ('active', 'disabled', 'pending');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  email text not null unique,
  full_name text,
  avatar_url text,
  role public.app_user_role not null default 'patient',
  status public.app_user_status not null default 'active',
  auth_provider text not null default 'password',
  email_verified boolean not null default false,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_profiles (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  app_user_id uuid references public.app_users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  phone text not null,
  date_of_birth date not null,
  gender text not null check (gender in ('male', 'female', 'other')),
  citizen_id text,
  health_insurance_number text,
  province text,
  district text,
  ward text,
  address text,
  ethnicity text default 'Kinh',
  occupation text,
  referral_code text,
  role public.app_user_role not null default 'patient',
  status public.app_user_status not null default 'active',
  email_verified boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_medical_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.patient_profiles(id) on delete cascade,
  relationship text not null default 'Tôi',
  full_name text not null,
  phone text not null,
  date_of_birth date not null,
  gender text not null check (gender in ('male', 'female', 'other')),
  citizen_id text,
  health_insurance_number text,
  email text,
  province text,
  district text,
  ward text,
  address text,
  ethnicity text default 'Kinh',
  occupation text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_guardians (
  id uuid primary key default gen_random_uuid(),
  patient_medical_profile_id uuid not null references public.patient_medical_profiles(id) on delete cascade,
  relationship text not null,
  full_name text not null,
  phone text not null,
  citizen_id text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.provider_workspaces (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
  app_user_id uuid references public.app_users(id) on delete cascade,
  email text not null,
  owner_name text not null,
  owner_phone text,
  mode text not null check (mode in ('doctor', 'clinic')),
  provider_role public.app_user_role not null default 'doctor',
  linked_doctor_id uuid,
  linked_facility_id uuid,
  status text not null default 'pending_review' check (status in ('draft', 'pending_review', 'approved', 'rejected')),
  clinic_name text,
  clinic_address text,
  tax_code text,
  doctor_title text,
  specialty text,
  image_url text,
  review_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_workspace_clinic_required check (
    mode <> 'clinic'
    or (nullif(trim(coalesce(clinic_name, '')), '') is not null and nullif(trim(coalesce(clinic_address, '')), '') is not null)
  ),
  constraint provider_workspace_doctor_required check (
    mode <> 'doctor'
    or nullif(trim(coalesce(specialty, '')), '') is not null
  )
);

create table if not exists public.provider_workspace_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.provider_workspaces(id) on delete set null,
  actor_firebase_uid text,
  actor_email text,
  actor_role text,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.provider_workspaces
add column if not exists provider_role public.app_user_role not null default 'doctor';

alter table public.provider_workspaces
add column if not exists linked_doctor_id uuid;

alter table public.provider_workspaces
add column if not exists linked_facility_id uuid;

create table if not exists public.clinic_specialties (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  image_url text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medical_facilities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  type text not null check (type in ('hospital', 'clinic')),
  name text not null,
  subtitle text,
  intro text,
  address text not null,
  province text,
  district text,
  ward text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  avatar_url text,
  background_url text,
  phone text,
  hotline text,
  is_active boolean not null default true,
  homepage_featured boolean not null default true,
  homepage_order integer not null default 100 check (homepage_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.facility_images (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.medical_facilities(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.facility_hours (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.medical_facilities(id) on delete cascade,
  label text not null,
  time_text text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.facility_notes (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.medical_facilities(id) on delete cascade,
  title text not null,
  lines text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.facility_specialties (
  facility_id uuid not null references public.medical_facilities(id) on delete cascade,
  specialty_id uuid not null references public.clinic_specialties(id) on delete cascade,
  description text,
  sort_order integer not null default 0,
  primary key (facility_id, specialty_id)
);

create table if not exists public.facility_services (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.medical_facilities(id) on delete cascade,
  specialty_id uuid references public.clinic_specialties(id) on delete set null,
  name text not null,
  description text,
  fee_text text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facility_id, name)
);

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  full_name text not null,
  initials text,
  title text,
  specialty_id uuid references public.clinic_specialties(id) on delete set null,
  facility_id uuid references public.medical_facilities(id) on delete set null,
  workplace_text text,
  avatar_url text,
  years_experience integer,
  consultation_fee numeric(12, 2),
  intro text,
  is_active boolean not null default true,
  homepage_featured boolean not null default true,
  homepage_order integer not null default 100 check (homepage_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'provider_workspaces_linked_doctor_id_fkey'
  ) then
    alter table public.provider_workspaces
    add constraint provider_workspaces_linked_doctor_id_fkey
    foreign key (linked_doctor_id) references public.doctors(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'provider_workspaces_linked_facility_id_fkey'
  ) then
    alter table public.provider_workspaces
    add constraint provider_workspaces_linked_facility_id_fkey
    foreign key (linked_facility_id) references public.medical_facilities(id) on delete set null;
  end if;
end $$;

create table if not exists public.appointment_slots (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid references public.medical_facilities(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete cascade,
  specialty_id uuid references public.clinic_specialties(id) on delete set null,
  service_id uuid references public.facility_services(id) on delete set null,
  slot_date date not null,
  start_time time not null,
  end_time time,
  capacity integer not null default 1 check (capacity > 0),
  booked_count integer not null default 0 check (booked_count >= 0 and booked_count <= capacity),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (facility_id is not null or doctor_id is not null)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references public.patient_profiles(id) on delete cascade,
  patient_medical_profile_id uuid references public.patient_medical_profiles(id) on delete set null,
  appointment_slot_id uuid references public.appointment_slots(id) on delete set null,
  appointment_type text not null default 'doctor' check (appointment_type in ('doctor', 'hospital', 'clinic')),
  facility_id uuid references public.medical_facilities(id) on delete set null,
  doctor_id uuid references public.doctors(id) on delete set null,
  specialty_id uuid references public.clinic_specialties(id) on delete set null,
  service_id uuid references public.facility_services(id) on delete set null,
  appointment_date date not null,
  appointment_time time,
  appointment_time_text text,
  patient_name text not null,
  patient_phone text,
  reason text,
  note text,
  insurance_used boolean not null default false,
  insurance_type text,
  insurance_rate numeric(5, 4) not null default 0,
  original_amount numeric(12, 2) not null default 0,
  insurance_discount numeric(12, 2) not null default 0,
  final_amount numeric(12, 2) not null default 0,
  payment_status text not null default 'unpaid',
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointment_attachments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  file_name text not null,
  file_url text,
  mime_type text,
  file_size integer,
  created_at timestamptz not null default now()
);

create table if not exists public.queue_tickets (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  owner_profile_id uuid references public.patient_profiles(id) on delete cascade,
  patient_medical_profile_id uuid references public.patient_medical_profiles(id) on delete set null,
  ticket_code text not null unique,
  appointment_code text unique,
  patient_code text,
  queue_number integer not null,
  current_number integer not null default 0,
  room text,
  status text not null default 'waiting'
    check (status in ('waiting', 'called', 'serving', 'done', 'cancelled')),
  estimated_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  owner_profile_id uuid references public.patient_profiles(id) on delete cascade,
  amount numeric(12, 2) not null default 0,
  currency text not null default 'VND',
  method text,
  provider text,
  status text not null default 'unpaid'
    check (status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  transaction_code text unique,
  paypal_order_id text,
  paypal_capture_id text,
  receipt_number text,
  raw_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reference_data (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

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
  full_name text,
  title text,
  specialty text,
  avatar text,
  avatar_url text,
  description text,
  bio text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.health_experts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  full_name text,
  title text,
  specialty text,
  avatar text,
  avatar_url text,
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
  thumbnail_url text,
  author_id uuid references public.health_authors(id) on delete set null,
  published_date timestamptz not null default now(),
  published_at timestamptz,
  updated_date timestamptz not null default now(),
  is_featured boolean not null default false,
  status text not null default 'published' check (status in ('draft', 'published', 'archived')),
  view_count integer not null default 0 check (view_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

alter table public.patient_profiles add column if not exists updated_at timestamptz not null default now();
alter table public.patient_profiles add column if not exists app_user_id uuid references public.app_users(id) on delete cascade;
alter table public.patient_profiles add column if not exists role public.app_user_role not null default 'patient';
alter table public.patient_profiles add column if not exists status public.app_user_status not null default 'active';
alter table public.patient_profiles add column if not exists last_login_at timestamptz;
alter table public.clinic_specialties add column if not exists slug text;
alter table public.clinic_specialties add column if not exists updated_at timestamptz not null default now();
alter table public.medical_facilities add column if not exists updated_at timestamptz not null default now();
alter table public.medical_facilities add column if not exists homepage_featured boolean not null default true;
alter table public.medical_facilities add column if not exists homepage_order integer not null default 100;
alter table public.facility_services add column if not exists updated_at timestamptz not null default now();
alter table public.doctors add column if not exists slug text;
alter table public.doctors add column if not exists initials text;
alter table public.doctors add column if not exists facility_id uuid references public.medical_facilities(id) on delete set null;
alter table public.doctors add column if not exists workplace_text text;
alter table public.doctors add column if not exists years_experience integer;
alter table public.doctors add column if not exists intro text;
alter table public.doctors add column if not exists notice text;
alter table public.doctors add column if not exists unavailable_note text;
alter table public.doctors add column if not exists updated_at timestamptz not null default now();
alter table public.doctors add column if not exists homepage_featured boolean not null default true;
alter table public.doctors add column if not exists homepage_order integer not null default 100;
alter table public.appointments add column if not exists owner_profile_id uuid references public.patient_profiles(id) on delete cascade;
alter table public.appointments add column if not exists patient_medical_profile_id uuid references public.patient_medical_profiles(id) on delete set null;
alter table public.appointments add column if not exists appointment_slot_id uuid references public.appointment_slots(id) on delete set null;
alter table public.appointments add column if not exists appointment_type text not null default 'doctor';
alter table public.appointments add column if not exists facility_id uuid references public.medical_facilities(id) on delete set null;
alter table public.appointments add column if not exists service_id uuid references public.facility_services(id) on delete set null;
alter table public.appointments add column if not exists appointment_start_time time;
alter table public.appointments add column if not exists appointment_end_time time;
alter table public.appointments add column if not exists appointment_time_text text;
alter table public.appointments add column if not exists doctor_name_text text;
alter table public.appointments add column if not exists specialty_text text;
alter table public.appointments add column if not exists workplace_text text;
alter table public.appointments add column if not exists patient_name text;
alter table public.appointments add column if not exists patient_phone text;
alter table public.appointments add column if not exists note text;
alter table public.appointments add column if not exists insurance_used boolean not null default false;
alter table public.appointments add column if not exists insurance_type text;
alter table public.appointments add column if not exists insurance_rate numeric(5, 4) not null default 0;
alter table public.appointments add column if not exists original_amount numeric(12, 2) not null default 0;
alter table public.appointments add column if not exists insurance_discount numeric(12, 2) not null default 0;
alter table public.appointments add column if not exists final_amount numeric(12, 2) not null default 0;
alter table public.appointments add column if not exists payment_status text not null default 'unpaid';
alter table public.queue_tickets add column if not exists owner_profile_id uuid references public.patient_profiles(id) on delete cascade;
alter table public.queue_tickets add column if not exists patient_medical_profile_id uuid references public.patient_medical_profiles(id) on delete set null;
alter table public.queue_tickets add column if not exists appointment_code text;
alter table public.queue_tickets add column if not exists patient_code text;

create unique index if not exists clinic_specialties_slug_unique_idx
on public.clinic_specialties(slug);

create unique index if not exists doctors_slug_unique_idx
on public.doctors(slug);

create unique index if not exists queue_tickets_appointment_code_unique_idx
on public.queue_tickets(appointment_code);

alter table public.payments add column if not exists provider text;
alter table public.payments add column if not exists paypal_order_id text;
alter table public.payments add column if not exists paypal_capture_id text;
alter table public.payments add column if not exists receipt_number text;
alter table public.payments add column if not exists raw_payload jsonb;
alter table public.health_authors add column if not exists full_name text;
alter table public.health_authors add column if not exists avatar_url text;
alter table public.health_authors add column if not exists bio text;
alter table public.health_experts add column if not exists full_name text;
alter table public.health_experts add column if not exists avatar_url text;
alter table public.health_articles add column if not exists thumbnail_url text;
alter table public.health_articles add column if not exists published_at timestamptz;
alter table public.health_articles add column if not exists is_featured boolean not null default false;

update public.health_authors
set full_name = coalesce(full_name, name),
    avatar_url = coalesce(avatar_url, avatar),
    bio = coalesce(bio, description);

update public.health_experts
set full_name = coalesce(full_name, name),
    avatar_url = coalesce(avatar_url, avatar);

update public.health_articles
set thumbnail_url = coalesce(thumbnail_url, thumbnail, ''),
    published_at = coalesce(published_at, published_date);

alter table public.health_articles alter column thumbnail_url set default '';
alter table public.health_articles alter column thumbnail_url set not null;
alter table public.health_articles alter column published_at set default now();
alter table public.health_articles alter column published_at set not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('health-articles', 'health-articles', true, 4194304, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create unique index if not exists payments_paypal_order_id_unique_idx
on public.payments(paypal_order_id)
where paypal_order_id is not null;

create unique index if not exists payments_receipt_number_unique_idx
on public.payments(receipt_number)
where receipt_number is not null;

create or replace view public.v_doctor_cards
with (security_invoker = true) as
select
  d.id,
  d.slug,
  d.initials,
  d.full_name as name,
  s.name as specialty,
  coalesce(f.name, d.workplace_text) as workplace,
  d.avatar_url as image,
  d.years_experience,
  d.is_active
from public.doctors d
left join public.clinic_specialties s on s.id = d.specialty_id
left join public.medical_facilities f on f.id = d.facility_id;

create or replace view public.v_facility_cards
with (security_invoker = true) as
select
  f.id,
  f.slug,
  f.type,
  f.name,
  f.subtitle,
  f.address,
  f.avatar_url,
  f.background_url,
  array_remove(array_agg(distinct s.name), null) as specialties,
  f.is_active
from public.medical_facilities f
left join public.facility_specialties fs on fs.facility_id = f.id
left join public.clinic_specialties s on s.id = fs.specialty_id
group by f.id;

create or replace view public.v_specialty_search_results
with (security_invoker = true) as
select
  f.id,
  f.type,
  f.name,
  f.address,
  f.avatar_url as image_url,
  array_remove(array_agg(distinct s.name), null) as tags,
  f.province,
  f.district,
  null::uuid as doctor_id,
  f.id as facility_id
from public.medical_facilities f
left join public.facility_specialties fs on fs.facility_id = f.id
left join public.clinic_specialties s on s.id = fs.specialty_id
where f.is_active = true
group by f.id
union all
select
  d.id,
  'doctor' as type,
  d.full_name as name,
  coalesce(f.address, d.workplace_text) as address,
  d.avatar_url as image_url,
  array_remove(array_agg(distinct s.name), null) as tags,
  f.province,
  f.district,
  d.id as doctor_id,
  f.id as facility_id
from public.doctors d
left join public.medical_facilities f on f.id = d.facility_id
left join public.clinic_specialties s on s.id = d.specialty_id
where d.is_active = true
group by d.id, f.id;

drop trigger if exists set_patient_profiles_updated_at on public.patient_profiles;
create trigger set_patient_profiles_updated_at
before update on public.patient_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_app_users_updated_at on public.app_users;
create trigger set_app_users_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

drop trigger if exists set_patient_medical_profiles_updated_at on public.patient_medical_profiles;
create trigger set_patient_medical_profiles_updated_at
before update on public.patient_medical_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_provider_workspaces_updated_at on public.provider_workspaces;
create trigger set_provider_workspaces_updated_at
before update on public.provider_workspaces
for each row execute function public.set_updated_at();

drop trigger if exists set_patient_guardians_updated_at on public.patient_guardians;
create trigger set_patient_guardians_updated_at
before update on public.patient_guardians
for each row execute function public.set_updated_at();

drop trigger if exists set_clinic_specialties_updated_at on public.clinic_specialties;
create trigger set_clinic_specialties_updated_at
before update on public.clinic_specialties
for each row execute function public.set_updated_at();

drop trigger if exists set_medical_facilities_updated_at on public.medical_facilities;
create trigger set_medical_facilities_updated_at
before update on public.medical_facilities
for each row execute function public.set_updated_at();

drop trigger if exists set_facility_services_updated_at on public.facility_services;
create trigger set_facility_services_updated_at
before update on public.facility_services
for each row execute function public.set_updated_at();

drop trigger if exists set_doctors_updated_at on public.doctors;
create trigger set_doctors_updated_at
before update on public.doctors
for each row execute function public.set_updated_at();

drop trigger if exists set_appointment_slots_updated_at on public.appointment_slots;
create trigger set_appointment_slots_updated_at
before update on public.appointment_slots
for each row execute function public.set_updated_at();

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

drop trigger if exists set_queue_tickets_updated_at on public.queue_tickets;
create trigger set_queue_tickets_updated_at
before update on public.queue_tickets
for each row execute function public.set_updated_at();

drop trigger if exists set_payments_updated_at on public.payments;
create trigger set_payments_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create or replace function public.claim_appointment_slot(slot_id uuid)
returns setof public.appointment_slots
language sql
security definer
set search_path = public
as $$
  update public.appointment_slots
  set booked_count = booked_count + 1
  where id = slot_id
    and is_active = true
    and booked_count < capacity
  returning *;
$$;

create or replace function public.release_appointment_slot(slot_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.appointment_slots
  set booked_count = greatest(booked_count - 1, 0)
  where id = slot_id;
$$;

alter table public.app_users enable row level security;
alter table public.patient_profiles enable row level security;
alter table public.provider_workspaces enable row level security;
alter table public.provider_workspace_events enable row level security;
alter table public.patient_medical_profiles enable row level security;
alter table public.patient_guardians enable row level security;
alter table public.clinic_specialties enable row level security;
alter table public.medical_facilities enable row level security;
alter table public.facility_images enable row level security;
alter table public.facility_hours enable row level security;
alter table public.facility_notes enable row level security;
alter table public.facility_specialties enable row level security;
alter table public.facility_services enable row level security;
alter table public.doctors enable row level security;
alter table public.appointment_slots enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_attachments enable row level security;
alter table public.queue_tickets enable row level security;
alter table public.payments enable row level security;
alter table public.reference_data enable row level security;
alter table public.health_categories enable row level security;
alter table public.health_authors enable row level security;
alter table public.health_experts enable row level security;
alter table public.health_articles enable row level security;
alter table public.symptom_specialty_rules enable row level security;
alter table public.chatbot_knowledge_base enable row level security;
alter table public.chatbot_interactions enable row level security;

create or replace function public.current_firebase_uid()
returns text
language sql
stable
set search_path = public
as $$
  with claims as (
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb as value
  )
  select coalesce(
    nullif(value ->> 'firebase_uid', ''),
    nullif(value ->> 'user_id', ''),
    nullif(value ->> 'sub', '')
  )
  from claims;
$$;

create or replace function public.current_app_role()
returns public.app_user_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.app_users
  where firebase_uid = public.current_firebase_uid()
    and status = 'active'
  limit 1;
$$;

drop policy if exists "service role can manage app users" on public.app_users;
create policy "service role can manage app users"
on public.app_users for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "users can read own app account" on public.app_users;
create policy "users can read own app account"
on public.app_users for select
using (
  auth.role() = 'service_role'
  or firebase_uid = public.current_firebase_uid()
  or public.current_app_role() in ('staff', 'admin')
);

drop policy if exists "admins can manage app accounts" on public.app_users;
create policy "admins can manage app accounts"
on public.app_users for all
using (auth.role() = 'service_role' or public.current_app_role() = 'admin')
with check (auth.role() = 'service_role' or public.current_app_role() = 'admin');

drop policy if exists "users can read own patient profile" on public.patient_profiles;
create policy "users can read own patient profile"
on public.patient_profiles for select
using (
  auth.role() = 'service_role'
  or firebase_uid = public.current_firebase_uid()
  or public.current_app_role() in ('staff', 'admin')
);

drop policy if exists "users can update own patient profile" on public.patient_profiles;
create policy "users can update own patient profile"
on public.patient_profiles for update
using (
  auth.role() = 'service_role'
  or firebase_uid = public.current_firebase_uid()
  or public.current_app_role() in ('staff', 'admin')
)
with check (
  auth.role() = 'service_role'
  or firebase_uid = public.current_firebase_uid()
  or public.current_app_role() in ('staff', 'admin')
);

drop policy if exists "service role can insert patient profiles" on public.patient_profiles;
create policy "service role can insert patient profiles"
on public.patient_profiles for insert
with check (auth.role() = 'service_role' or public.current_app_role() in ('staff', 'admin'));

drop policy if exists "service role can manage provider workspaces" on public.provider_workspaces;
create policy "service role can manage provider workspaces"
on public.provider_workspaces for all
using (auth.role() = 'service_role' or public.current_app_role() in ('staff', 'admin'))
with check (auth.role() = 'service_role' or public.current_app_role() in ('staff', 'admin'));

drop policy if exists "users can read own provider workspace" on public.provider_workspaces;
create policy "users can read own provider workspace"
on public.provider_workspaces for select
using (
  firebase_uid = public.current_firebase_uid()
  or public.current_app_role() in ('staff', 'admin')
);

drop policy if exists "users can update own provider workspace" on public.provider_workspaces;
create policy "users can update own provider workspace"
on public.provider_workspaces for update
using (
  firebase_uid = public.current_firebase_uid()
  and status in ('draft', 'pending_review', 'rejected')
)
with check (firebase_uid = public.current_firebase_uid());

drop policy if exists provider_workspace_events_service_manage on public.provider_workspace_events;
create policy provider_workspace_events_service_manage
on public.provider_workspace_events for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "users can read own medical profiles" on public.patient_medical_profiles;
create policy "users can read own medical profiles"
on public.patient_medical_profiles for select
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.patient_profiles owner
    where owner.id = patient_medical_profiles.owner_profile_id
      and owner.firebase_uid = public.current_firebase_uid()
  )
  or public.current_app_role() in ('staff', 'admin')
);

drop policy if exists "users can manage own medical profiles" on public.patient_medical_profiles;
create policy "users can manage own medical profiles"
on public.patient_medical_profiles for all
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.patient_profiles owner
    where owner.id = patient_medical_profiles.owner_profile_id
      and owner.firebase_uid = public.current_firebase_uid()
  )
  or public.current_app_role() in ('staff', 'admin')
)
with check (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.patient_profiles owner
    where owner.id = patient_medical_profiles.owner_profile_id
      and owner.firebase_uid = public.current_firebase_uid()
  )
  or public.current_app_role() in ('staff', 'admin')
);

drop policy if exists "users can manage own guardians" on public.patient_guardians;
create policy "users can manage own guardians"
on public.patient_guardians for all
using (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.patient_medical_profiles medical
    join public.patient_profiles owner on owner.id = medical.owner_profile_id
    where medical.id = patient_guardians.patient_medical_profile_id
      and owner.firebase_uid = public.current_firebase_uid()
  )
  or public.current_app_role() in ('staff', 'admin')
)
with check (
  auth.role() = 'service_role'
  or exists (
    select 1
    from public.patient_medical_profiles medical
    join public.patient_profiles owner on owner.id = medical.owner_profile_id
    where medical.id = patient_guardians.patient_medical_profile_id
      and owner.firebase_uid = public.current_firebase_uid()
  )
  or public.current_app_role() in ('staff', 'admin')
);

drop policy if exists "public can read active specialties" on public.clinic_specialties;
create policy "public can read active specialties"
on public.clinic_specialties for select
using (is_active = true);

drop policy if exists "public can read active facilities" on public.medical_facilities;
create policy "public can read active facilities"
on public.medical_facilities for select
using (is_active = true);

drop policy if exists "public can read facility images" on public.facility_images;
create policy "public can read facility images"
on public.facility_images for select
using (true);

drop policy if exists "public can read facility hours" on public.facility_hours;
create policy "public can read facility hours"
on public.facility_hours for select
using (true);

drop policy if exists "public can read facility notes" on public.facility_notes;
create policy "public can read facility notes"
on public.facility_notes for select
using (true);

drop policy if exists "public can read facility specialties" on public.facility_specialties;
create policy "public can read facility specialties"
on public.facility_specialties for select
using (true);

drop policy if exists "public can read active services" on public.facility_services;
create policy "public can read active services"
on public.facility_services for select
using (is_active = true);

drop policy if exists "public can read active doctors" on public.doctors;
create policy "public can read active doctors"
on public.doctors for select
using (is_active = true);


drop policy if exists "public can read active slots" on public.appointment_slots;
create policy "public can read active slots"
on public.appointment_slots for select
using (is_active = true and booked_count < capacity);

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

drop policy if exists chatbot_public_read_active_symptom_rules on public.symptom_specialty_rules;
create policy chatbot_public_read_active_symptom_rules
on public.symptom_specialty_rules for select
using (is_active = true);

drop policy if exists chatbot_service_manage_symptom_rules on public.symptom_specialty_rules;
create policy chatbot_service_manage_symptom_rules
on public.symptom_specialty_rules for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists chatbot_public_read_active_knowledge on public.chatbot_knowledge_base;
create policy chatbot_public_read_active_knowledge
on public.chatbot_knowledge_base for select
using (is_active = true);

drop policy if exists chatbot_service_manage_knowledge on public.chatbot_knowledge_base;
create policy chatbot_service_manage_knowledge
on public.chatbot_knowledge_base for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists chatbot_service_manage_interactions on public.chatbot_interactions;
create policy chatbot_service_manage_interactions
on public.chatbot_interactions for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

grant usage on schema public to anon, authenticated;
grant select on
  public.app_users,
  public.provider_workspaces,
  public.clinic_specialties,
  public.medical_facilities,
  public.facility_images,
  public.facility_hours,
  public.facility_notes,
  public.facility_specialties,
  public.facility_services,
  public.doctors,
  public.appointment_slots,
  public.v_doctor_cards,
  public.v_facility_cards,
  public.v_specialty_search_results,
  public.reference_data,
  public.health_categories,
  public.health_authors,
  public.health_experts,
  public.health_articles,
  public.symptom_specialty_rules,
  public.chatbot_knowledge_base
to anon, authenticated;

grant select on public.app_users to authenticated;
grant select, update on public.patient_profiles to authenticated;
grant select, insert, update on public.provider_workspaces to authenticated;
grant select, insert on public.provider_workspace_events to authenticated;
grant select, insert, update, delete on public.patient_medical_profiles to authenticated;
grant select, insert, update, delete on public.patient_guardians to authenticated;
grant execute on function public.current_firebase_uid() to anon, authenticated;
grant execute on function public.current_app_role() to anon, authenticated;

drop policy if exists "public can read reference data" on public.reference_data;
create policy "public can read reference data"
on public.reference_data for select
using (true);

drop trigger if exists set_reference_data_updated_at on public.reference_data;
create trigger set_reference_data_updated_at
before update on public.reference_data
for each row execute function public.set_updated_at();

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

drop trigger if exists set_symptom_specialty_rules_updated_at on public.symptom_specialty_rules;
create trigger set_symptom_specialty_rules_updated_at
before update on public.symptom_specialty_rules
for each row execute function public.set_updated_at();

drop trigger if exists set_chatbot_knowledge_base_updated_at on public.chatbot_knowledge_base;
create trigger set_chatbot_knowledge_base_updated_at
before update on public.chatbot_knowledge_base
for each row execute function public.set_updated_at();

revoke execute on function public.claim_appointment_slot(uuid) from public;
revoke execute on function public.release_appointment_slot(uuid) from public;
grant execute on function public.claim_appointment_slot(uuid) to service_role;
grant execute on function public.release_appointment_slot(uuid) to service_role;

drop index if exists public.patient_profiles_firebase_uid_idx;
drop index if exists public.patient_profiles_email_idx;
create unique index if not exists patient_profiles_email_lower_unique_idx
on public.patient_profiles(lower(email));
create unique index if not exists patient_profiles_app_user_id_idx on public.patient_profiles(app_user_id) where app_user_id is not null;
create index if not exists provider_workspaces_firebase_uid_idx on public.provider_workspaces(firebase_uid);
create index if not exists provider_workspaces_email_idx on public.provider_workspaces(email);
create index if not exists provider_workspaces_status_idx on public.provider_workspaces(status);
create index if not exists provider_workspaces_mode_idx on public.provider_workspaces(mode);
drop index if exists public.provider_workspaces_linked_doctor_idx;
drop index if exists public.provider_workspaces_linked_facility_idx;
create unique index if not exists provider_workspaces_linked_doctor_unique_idx
on public.provider_workspaces(linked_doctor_id) where linked_doctor_id is not null;
create unique index if not exists provider_workspaces_linked_facility_unique_idx
on public.provider_workspaces(linked_facility_id) where linked_facility_id is not null;
create index if not exists provider_workspace_events_workspace_idx
on public.provider_workspace_events(workspace_id, created_at desc);
create index if not exists provider_workspace_events_type_idx
on public.provider_workspace_events(event_type, created_at desc);
create index if not exists provider_workspace_events_actor_idx
on public.provider_workspace_events(actor_email, created_at desc);
drop index if exists public.app_users_firebase_uid_idx;
drop index if exists public.app_users_email_idx;
create unique index if not exists app_users_email_lower_unique_idx
on public.app_users(lower(email));
create index if not exists app_users_role_idx on public.app_users(role);
create index if not exists app_users_status_idx on public.app_users(status);
create index if not exists patient_medical_profiles_owner_idx on public.patient_medical_profiles(owner_profile_id);
create index if not exists patient_guardians_profile_idx on public.patient_guardians(patient_medical_profile_id);
create index if not exists medical_facilities_type_idx on public.medical_facilities(type);
create index if not exists medical_facilities_location_idx on public.medical_facilities(province, district);
create index if not exists facility_services_facility_idx on public.facility_services(facility_id);
create index if not exists doctors_specialty_idx on public.doctors(specialty_id);
create index if not exists doctors_facility_idx on public.doctors(facility_id);
create index if not exists doctors_homepage_featured_order_idx
on public.doctors(homepage_featured, homepage_order, full_name);
create index if not exists doctors_full_name_lower_idx
on public.doctors(lower(full_name));
create index if not exists medical_facilities_type_name_lower_idx
on public.medical_facilities(type, lower(name));
create index if not exists medical_facilities_homepage_featured_order_idx
on public.medical_facilities(type, homepage_featured, homepage_order, name);
create index if not exists appointment_slots_lookup_idx on public.appointment_slots(slot_date, facility_id, doctor_id, specialty_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointment_slots_booked_count_capacity_check'
  ) then
    alter table public.appointment_slots
    add constraint appointment_slots_booked_count_capacity_check
    check (booked_count >= 0 and booked_count <= capacity);
  end if;
end $$;

with duplicate_slots as (
  select
    id,
    row_number() over (
      partition by doctor_id, slot_date, start_time
      order by booked_count desc, created_at asc
    ) as row_number
  from public.appointment_slots
  where doctor_id is not null
    and booked_count = 0
)
delete from public.appointment_slots s
using duplicate_slots d
where s.id = d.id
  and d.row_number > 1;

create unique index if not exists appointment_slots_doctor_date_time_unique_idx
on public.appointment_slots(doctor_id, slot_date, start_time)
where doctor_id is not null;

with duplicate_facility_slots as (
  select
    id,
    row_number() over (
      partition by facility_id, slot_date, start_time, specialty_id, service_id
      order by booked_count desc, created_at asc
    ) as row_number
  from public.appointment_slots
  where doctor_id is null
    and facility_id is not null
    and booked_count = 0
)
delete from public.appointment_slots s
using duplicate_facility_slots d
where s.id = d.id
  and d.row_number > 1;

create unique index if not exists appointment_slots_facility_date_time_service_unique_idx
on public.appointment_slots(
  facility_id,
  slot_date,
  start_time,
  coalesce(specialty_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(service_id, '00000000-0000-0000-0000-000000000000'::uuid)
)
where doctor_id is null and facility_id is not null;
create index if not exists appointments_owner_profile_id_idx on public.appointments(owner_profile_id);
create index if not exists appointments_patient_medical_profile_id_idx on public.appointments(patient_medical_profile_id);
create index if not exists appointments_date_status_idx on public.appointments(appointment_date, status);
create index if not exists appointments_doctor_date_idx on public.appointments(doctor_id, appointment_date desc)
where doctor_id is not null;
create index if not exists appointments_facility_date_idx on public.appointments(facility_id, appointment_date desc)
where facility_id is not null;
create index if not exists appointment_attachments_appointment_idx on public.appointment_attachments(appointment_id);
create index if not exists queue_tickets_owner_profile_id_idx on public.queue_tickets(owner_profile_id);
create index if not exists queue_tickets_appointment_id_idx on public.queue_tickets(appointment_id);
create index if not exists payments_owner_profile_id_idx on public.payments(owner_profile_id);
create index if not exists payments_appointment_id_idx on public.payments(appointment_id);
create index if not exists health_categories_slug_idx on public.health_categories(slug);
create index if not exists health_articles_category_published_idx on public.health_articles(category_id, published_at desc);
create index if not exists health_articles_slug_idx on public.health_articles(slug);
create index if not exists health_articles_published_at_idx on public.health_articles(published_at desc);
create index if not exists health_articles_featured_idx
on public.health_articles(is_featured, published_at desc)
where status = 'published';
create index if not exists health_articles_search_idx on public.health_articles using gin (
  to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(content, ''))
);
create index if not exists symptom_specialty_rules_active_idx
on public.symptom_specialty_rules(is_active, priority);
create index if not exists chatbot_knowledge_base_active_idx
on public.chatbot_knowledge_base(is_active, priority);
create index if not exists chatbot_interactions_firebase_uid_idx
on public.chatbot_interactions(firebase_uid, created_at desc);
create index if not exists chatbot_interactions_created_at_idx
on public.chatbot_interactions(created_at desc);
