create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.patient_profiles (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,
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
  email_verified boolean not null default true,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doctor_specialties (
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  specialty_id uuid not null references public.clinic_specialties(id) on delete cascade,
  primary key (doctor_id, specialty_id)
);

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
  booked_count integer not null default 0 check (booked_count >= 0),
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
  status text not null default 'unpaid'
    check (status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  transaction_code text unique,
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

alter table public.patient_profiles add column if not exists updated_at timestamptz not null default now();
alter table public.clinic_specialties add column if not exists slug text;
alter table public.clinic_specialties add column if not exists updated_at timestamptz not null default now();
alter table public.medical_facilities add column if not exists updated_at timestamptz not null default now();
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

create or replace view public.v_doctor_cards as
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

create or replace view public.v_facility_cards as
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

create or replace view public.v_specialty_search_results as
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
left join public.doctor_specialties ds on ds.doctor_id = d.id
left join public.clinic_specialties s on s.id = coalesce(ds.specialty_id, d.specialty_id)
where d.is_active = true
group by d.id, f.id;

drop trigger if exists set_patient_profiles_updated_at on public.patient_profiles;
create trigger set_patient_profiles_updated_at
before update on public.patient_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_patient_medical_profiles_updated_at on public.patient_medical_profiles;
create trigger set_patient_medical_profiles_updated_at
before update on public.patient_medical_profiles
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

alter table public.patient_profiles enable row level security;
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
alter table public.doctor_specialties enable row level security;
alter table public.appointment_slots enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_attachments enable row level security;
alter table public.queue_tickets enable row level security;
alter table public.payments enable row level security;
alter table public.reference_data enable row level security;

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

drop policy if exists "public can read doctor specialties" on public.doctor_specialties;
create policy "public can read doctor specialties"
on public.doctor_specialties for select
using (true);

drop policy if exists "public can read active slots" on public.appointment_slots;
create policy "public can read active slots"
on public.appointment_slots for select
using (is_active = true and booked_count < capacity);

grant usage on schema public to anon, authenticated;
grant select on
  public.clinic_specialties,
  public.medical_facilities,
  public.facility_images,
  public.facility_hours,
  public.facility_notes,
  public.facility_specialties,
  public.facility_services,
  public.doctors,
  public.doctor_specialties,
  public.appointment_slots,
  public.v_doctor_cards,
  public.v_facility_cards,
  public.v_specialty_search_results,
  public.reference_data
to anon, authenticated;

drop policy if exists "public can read reference data" on public.reference_data;
create policy "public can read reference data"
on public.reference_data for select
using (true);

drop trigger if exists set_reference_data_updated_at on public.reference_data;
create trigger set_reference_data_updated_at
before update on public.reference_data
for each row execute function public.set_updated_at();

grant execute on function public.claim_appointment_slot(uuid) to anon, authenticated;
grant execute on function public.release_appointment_slot(uuid) to anon, authenticated;

create index if not exists patient_profiles_firebase_uid_idx on public.patient_profiles(firebase_uid);
create index if not exists patient_profiles_email_idx on public.patient_profiles(email);
create index if not exists patient_medical_profiles_owner_idx on public.patient_medical_profiles(owner_profile_id);
create index if not exists patient_guardians_profile_idx on public.patient_guardians(patient_medical_profile_id);
create index if not exists medical_facilities_type_idx on public.medical_facilities(type);
create index if not exists medical_facilities_location_idx on public.medical_facilities(province, district);
create index if not exists facility_services_facility_idx on public.facility_services(facility_id);
create index if not exists doctors_specialty_idx on public.doctors(specialty_id);
create index if not exists doctors_facility_idx on public.doctors(facility_id);
create index if not exists appointment_slots_lookup_idx on public.appointment_slots(slot_date, facility_id, doctor_id, specialty_id);
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
create index if not exists appointments_owner_profile_id_idx on public.appointments(owner_profile_id);
create index if not exists appointments_patient_medical_profile_id_idx on public.appointments(patient_medical_profile_id);
create index if not exists appointments_date_status_idx on public.appointments(appointment_date, status);
create index if not exists appointment_attachments_appointment_idx on public.appointment_attachments(appointment_id);
create index if not exists queue_tickets_owner_profile_id_idx on public.queue_tickets(owner_profile_id);
create index if not exists queue_tickets_appointment_id_idx on public.queue_tickets(appointment_id);
create index if not exists payments_owner_profile_id_idx on public.payments(owner_profile_id);
