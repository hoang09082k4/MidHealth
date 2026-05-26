create extension if not exists "pgcrypto";

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

create table if not exists public.clinic_specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  image_url text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  specialty_id uuid references public.clinic_specialties(id) on delete set null,
  title text,
  hospital text,
  avatar_url text,
  consultation_fee numeric(12, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_profile_id uuid references public.patient_profiles(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete set null,
  specialty_id uuid references public.clinic_specialties(id) on delete set null,
  appointment_date date not null,
  appointment_time time,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.queue_tickets (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  patient_profile_id uuid references public.patient_profiles(id) on delete cascade,
  ticket_code text not null unique,
  queue_number integer not null,
  current_number integer not null default 0,
  room text,
  status text not null default 'waiting'
    check (status in ('waiting', 'called', 'serving', 'done', 'cancelled')),
  estimated_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_patient_profiles_updated_at on public.patient_profiles;
create trigger set_patient_profiles_updated_at
before update on public.patient_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_appointments_updated_at on public.appointments;
create trigger set_appointments_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

drop trigger if exists set_queue_tickets_updated_at on public.queue_tickets;
create trigger set_queue_tickets_updated_at
before update on public.queue_tickets
for each row execute function public.set_updated_at();

alter table public.patient_profiles enable row level security;
alter table public.clinic_specialties enable row level security;
alter table public.doctors enable row level security;
alter table public.appointments enable row level security;
alter table public.queue_tickets enable row level security;

create policy "public can read active specialties"
on public.clinic_specialties for select
using (is_active = true);

create policy "public can read active doctors"
on public.doctors for select
using (is_active = true);

create index if not exists patient_profiles_firebase_uid_idx on public.patient_profiles(firebase_uid);
create index if not exists patient_profiles_email_idx on public.patient_profiles(email);
create index if not exists appointments_patient_profile_id_idx on public.appointments(patient_profile_id);
create index if not exists queue_tickets_patient_profile_id_idx on public.queue_tickets(patient_profile_id);
