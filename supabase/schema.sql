begin;
-- Fresh database only. To replace an existing database, use the generated reset SQL bundle.
do $$ begin
  if to_regclass('public.app_users') is not null then
    raise exception 'Database already initialized; use the reset SQL bundle instead of schema.sql';
  end if;
end $$;
create extension if not exists pgcrypto;
create type public.app_user_role as enum ('patient', 'staff', 'doctor', 'head', 'admin');
create type public.app_user_status as enum ('active', 'disabled', 'pending');
create function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

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
  email text not null,
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
  relationship text not null default 'TÃ´i',
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
  medical_history text,
  blood_group text check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-') or blood_group is null),
  allergies text,
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
  updated_at timestamptz not null default now(),
  clinic_owned boolean not null default true,
  consultation_fee numeric(12, 2) not null default 180000 check (consultation_fee >= 0)
);

create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  full_name text not null,
  initials text,
  title text,
  specialty_id uuid references public.clinic_specialties(id) on delete set null,
  workplace_text text,
  avatar_url text,
  years_experience integer check (years_experience >= 0),
  consultation_fee numeric(12, 2) check (consultation_fee >= 0),
  intro text,
  is_active boolean not null default true,
  homepage_featured boolean not null default true,
  homepage_order integer not null default 100 check (homepage_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  clinic_owned boolean not null default true,
  is_demo boolean not null default false,
  notice text,
  unavailable_note text,
  unavailable_from date,
  unavailable_to date,
  check ((unavailable_from is null and unavailable_to is null) or (unavailable_from is not null and unavailable_to is not null and unavailable_from <= unavailable_to))
);

create table if not exists public.appointment_slots (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  specialty_id uuid references public.clinic_specialties(id) on delete set null,
  slot_date date not null,
  start_time time not null,
  end_time time,
  capacity integer not null default 1 check (capacity > 0),
  booked_count integer not null default 0 check (booked_count >= 0 and booked_count <= capacity),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time is null or end_time > start_time)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid references public.patient_profiles(id) on delete cascade,
  patient_medical_profile_id uuid references public.patient_medical_profiles(id) on delete set null,
  appointment_slot_id uuid references public.appointment_slots(id) on delete set null,
  appointment_type text not null default 'doctor' check (appointment_type = 'doctor'),
  doctor_id uuid references public.doctors(id) on delete set null,
  specialty_id uuid references public.clinic_specialties(id) on delete set null,
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
  deposit_amount numeric(12, 2) not null default 0 check (deposit_amount >= 0),
  payment_status text not null default 'unpaid',
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  appointment_start_time time,
  appointment_end_time time,
  doctor_name_text text,
  specialty_text text,
  workplace_text text,
  clinic_snapshot jsonb
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

create table if not exists public.clinic_profile (
  id boolean primary key default true check (id),
  profile jsonb not null default '{}'::jsonb check (jsonb_typeof(profile) = 'object'),
  updated_at timestamptz not null default now()
);

create table if not exists public.queue_number_counter (
  id boolean primary key default true check (id),
  last_number integer not null check (last_number >= 0)
);

create table if not exists public.admin_events (
  id uuid primary key default gen_random_uuid(),
  actor_firebase_uid text, actor_email text, actor_role text,
  event_type text not null, entity_type text, entity_id uuid,
  message text not null, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create trigger set_app_users_updated_at before update on public.app_users for each row execute function public.set_updated_at();
create trigger set_patient_profiles_updated_at before update on public.patient_profiles for each row execute function public.set_updated_at();
create trigger set_patient_medical_profiles_updated_at before update on public.patient_medical_profiles for each row execute function public.set_updated_at();
create trigger set_clinic_specialties_updated_at before update on public.clinic_specialties for each row execute function public.set_updated_at();
create trigger set_doctors_updated_at before update on public.doctors for each row execute function public.set_updated_at();
create trigger set_appointment_slots_updated_at before update on public.appointment_slots for each row execute function public.set_updated_at();
create trigger set_appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();
create trigger set_queue_tickets_updated_at before update on public.queue_tickets for each row execute function public.set_updated_at();
create trigger set_payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger set_reference_data_updated_at before update on public.reference_data for each row execute function public.set_updated_at();
create trigger set_patient_guardians_updated_at before update on public.patient_guardians for each row execute function public.set_updated_at();
create trigger set_clinic_profile_updated_at before update on public.clinic_profile for each row execute function public.set_updated_at();

create unique index app_users_email_lower_unique_idx on public.app_users(lower(email));
create unique index patient_profiles_email_lower_unique_idx on public.patient_profiles(lower(email));
create unique index patient_profiles_app_user_id_idx on public.patient_profiles(app_user_id) where app_user_id is not null;
create index patient_medical_profiles_owner_idx on public.patient_medical_profiles(owner_profile_id);
create index patient_guardians_profile_idx on public.patient_guardians(patient_medical_profile_id);
create index doctors_specialty_idx on public.doctors(specialty_id);
create index doctors_homepage_idx on public.doctors(homepage_featured, homepage_order, full_name) where clinic_owned and is_active;
create index clinic_specialties_active_idx on public.clinic_specialties(name) where clinic_owned and is_active;
create unique index appointment_slots_doctor_date_time_unique_idx on public.appointment_slots(doctor_id, slot_date, start_time);
create index appointments_owner_profile_id_idx on public.appointments(owner_profile_id);
create index appointments_patient_medical_profile_id_idx on public.appointments(patient_medical_profile_id);
create index appointments_slot_idx on public.appointments(appointment_slot_id);
create index appointments_date_status_idx on public.appointments(appointment_date, status);
create index appointments_doctor_date_idx on public.appointments(doctor_id, appointment_date);
create index appointment_attachments_appointment_idx on public.appointment_attachments(appointment_id);
create index queue_tickets_owner_idx on public.queue_tickets(owner_profile_id);
create index queue_tickets_appointment_idx on public.queue_tickets(appointment_id);
create index payments_owner_idx on public.payments(owner_profile_id);
create index payments_appointment_idx on public.payments(appointment_id);
create unique index payments_paypal_order_id_unique_idx on public.payments(paypal_order_id) where paypal_order_id is not null;
create unique index payments_receipt_number_unique_idx on public.payments(receipt_number) where receipt_number is not null;
create index admin_events_created_idx on public.admin_events(created_at desc);

insert into public.clinic_profile(id, profile) values (true, '{"name":"MidHealth","address":"","phone":"","email":"","hours":[],"socialLinks":[],"timezone":"Asia/Ho_Chi_Minh"}'::jsonb);
insert into public.queue_number_counter(id, last_number) values (true, 0);
create or replace function public.allocate_queue_number()
returns integer language sql security definer set search_path = public as $$
  update public.queue_number_counter set last_number = last_number + 1
  where id = true returning last_number;
$$;
-- Booking integrity and permissions. The consultation fee is declared on clinic_specialties above.

-- Firebase authorization runs in the backend. Browser clients never write tables directly.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'app_users', 'patient_profiles', 'patient_medical_profiles', 'patient_guardians',
    'clinic_profile', 'clinic_specialties', 'doctors', 'appointment_slots', 'appointments',
    'appointment_attachments', 'queue_tickets', 'queue_number_counter', 'payments',
    'reference_data',
    'admin_events'
  ] loop
    if to_regclass('public.' || table_name) is not null then
      execute format('alter table public.%I enable row level security', table_name);
      execute format('revoke all on public.%I from public, anon, authenticated', table_name);
      execute format('grant all on public.%I to service_role', table_name);
    end if;
  end loop;
end $$;

-- Deleting an account/profile cannot cascade away medical and financial history.
alter table public.patient_profiles drop constraint if exists patient_profiles_app_user_id_fkey;
alter table public.patient_profiles add constraint patient_profiles_app_user_id_fkey
  foreign key (app_user_id) references public.app_users(id) on delete restrict;
alter table public.appointments drop constraint if exists appointments_owner_profile_id_fkey;
alter table public.appointments add constraint appointments_owner_profile_id_fkey
  foreign key (owner_profile_id) references public.patient_profiles(id) on delete restrict;
alter table public.payments drop constraint if exists payments_owner_profile_id_fkey;
alter table public.payments add constraint payments_owner_profile_id_fkey
  foreign key (owner_profile_id) references public.patient_profiles(id) on delete restrict;
alter table public.queue_tickets drop constraint if exists queue_tickets_owner_profile_id_fkey;
alter table public.queue_tickets add constraint queue_tickets_owner_profile_id_fkey
  foreign key (owner_profile_id) references public.patient_profiles(id) on delete restrict;

create or replace function public.validate_clinic_staff_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.role = old.role then return new; end if;
  if new.role::text not in ('patient', 'staff', 'doctor', 'head', 'admin') then raise exception 'Unsupported account role'; end if;
  return new;
end $$;
drop trigger if exists validate_clinic_staff_role on public.app_users;
create trigger validate_clinic_staff_role before insert or update of role on public.app_users
for each row execute function public.validate_clinic_staff_role();

create or replace function public.validate_single_clinic_appointment()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.appointment_type <> 'doctor' or new.doctor_id is null then
    raise exception 'New appointments must use a doctor at the single clinic';
  end if;
  if new.owner_profile_id is null or new.patient_medical_profile_id is null or not exists (
    select 1 from public.patient_medical_profiles p where p.id = new.patient_medical_profile_id
      and p.owner_profile_id = new.owner_profile_id
  ) then raise exception 'Patient profile does not belong to appointment owner'; end if;
  if not exists (
    select 1 from public.appointment_slots s join public.doctors d on d.id = s.doctor_id
    join public.clinic_specialties c on c.id = d.specialty_id
    where s.id = new.appointment_slot_id and s.doctor_id = new.doctor_id
      and s.is_active and s.booked_count > 0
      and d.clinic_owned and d.is_active and c.clinic_owned and c.is_active
      and new.specialty_id = d.specialty_id
      and s.slot_date = new.appointment_date and s.start_time = new.appointment_time
      and (d.unavailable_from is null or d.unavailable_to is null or s.slot_date not between d.unavailable_from and d.unavailable_to)
  ) then raise exception 'Appointment requires a reserved, matching active clinic slot'; end if;
  if (new.appointment_date + new.appointment_time) <= (now() at time zone 'Asia/Ho_Chi_Minh') then
    raise exception 'Appointment time is in the past';
  end if;
  return new;
end $$;
drop trigger if exists validate_single_clinic_appointment on public.appointments;
create trigger validate_single_clinic_appointment before insert on public.appointments
for each row execute function public.validate_single_clinic_appointment();

create or replace function public.claim_appointment_slot(slot_id uuid)
returns setof public.appointment_slots language sql security definer set search_path = public as $$
  update public.appointment_slots s set booked_count = s.booked_count + 1
  where s.id = slot_id and s.is_active and s.booked_count < s.capacity
    and (s.slot_date + s.start_time) > (now() at time zone 'Asia/Ho_Chi_Minh')
    and exists (select 1 from public.doctors d join public.clinic_specialties c on c.id = d.specialty_id
      where d.id = s.doctor_id and d.clinic_owned and d.is_active and c.clinic_owned and c.is_active
      and (d.unavailable_from is null or d.unavailable_to is null or s.slot_date not between d.unavailable_from and d.unavailable_to))
  returning s.*;
$$;

create or replace function public.release_appointment_slot(slot_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.appointment_slots set booked_count = greatest(booked_count - 1, 0) where id = slot_id;
$$;

create or replace function public.transition_clinic_appointment(
  appointment_id_value uuid, doctor_id_value uuid, owner_id_value uuid, status_value text
) returns setof public.appointments language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  if status_value is null or status_value not in ('confirmed', 'cancelled', 'completed', 'no_show') then
    raise exception 'Invalid appointment status';
  end if;
  select * into a from public.appointments where id = appointment_id_value
    and (doctor_id_value is null or doctor_id = doctor_id_value)
    and (owner_id_value is null or owner_profile_id = owner_id_value) for update;
  if not found then return; end if;
  if a.status = status_value then return next a; return; end if;
  if a.status in ('cancelled', 'completed', 'no_show') then raise exception 'Appointment is already closed'; end if;
  if status_value in ('completed', 'no_show') and (a.appointment_date + coalesce(a.appointment_time, '00:00'::time)) > (now() at time zone 'Asia/Ho_Chi_Minh') then
    raise exception 'Appointment has not started';
  end if;
  update public.appointments set status = status_value where id = a.id returning * into a;
  if status_value in ('cancelled', 'completed', 'no_show') then
    update public.queue_tickets set status = case when status_value = 'completed' then 'done' else 'cancelled' end where appointment_id = a.id;
  end if;
  if status_value = 'cancelled' and a.appointment_slot_id is not null then
    perform public.release_appointment_slot(a.appointment_slot_id);
  end if;
  return next a;
end $$;

create or replace function public.cancel_clinic_unpaid_appointment(appointment_id_value uuid, payment_status_value text)
returns setof public.appointments language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  if payment_status_value is null or payment_status_value not in ('failed', 'unpaid') then raise exception 'Invalid payment status'; end if;
  select * into a from public.appointments where id = appointment_id_value for update;
  if not found or a.payment_status = 'paid' or a.status in ('completed', 'no_show') then return; end if;
  if a.status = 'cancelled' then return next a; return; end if;
  perform public.transition_clinic_appointment(a.id, null, null, 'cancelled');
  update public.appointments set payment_status = payment_status_value where id = a.id returning * into a;
  return next a;
end $$;

create or replace function public.guard_booked_clinic_slot()
returns trigger language plpgsql security definer set search_path = public as $$
declare referral_count integer := 0;
begin
  if tg_op = 'DELETE' then
    if old.booked_count > 0 or exists (select 1 from public.appointments where appointment_slot_id = old.id) then
      raise exception 'Cannot delete a slot with appointment history; deactivate it instead';
    end if;
    return old;
  end if;
  select count(*) into referral_count from public.clinical_encounters where referred_slot_id = old.id;
  if new.capacity < new.booked_count + referral_count then raise exception 'Capacity is below booked and referred count'; end if;
  if (old.booked_count > 0 or referral_count > 0 or exists (select 1 from public.appointments where appointment_slot_id = old.id))
    and (new.slot_date, new.start_time, new.end_time, new.doctor_id) is distinct from (old.slot_date, old.start_time, old.end_time, old.doctor_id) then
    raise exception 'Cannot move a slot with appointment history';
  end if;
  return new;
end $$;
drop trigger if exists guard_booked_clinic_slot on public.appointment_slots;
create trigger guard_booked_clinic_slot before update or delete on public.appointment_slots
for each row execute function public.guard_booked_clinic_slot();

revoke execute on function public.claim_appointment_slot(uuid), public.release_appointment_slot(uuid),
  public.transition_clinic_appointment(uuid, uuid, uuid, text), public.cancel_clinic_unpaid_appointment(uuid, text),
  public.allocate_queue_number() from public, anon, authenticated;
grant execute on function public.claim_appointment_slot(uuid), public.release_appointment_slot(uuid),
  public.transition_clinic_appointment(uuid, uuid, uuid, text), public.cancel_clinic_unpaid_appointment(uuid, text),
  public.allocate_queue_number() to service_role;
notify pgrst, 'reload schema';

-- Shared OTP state for serverless instances. Only the backend service key can use it.
create table if not exists public.email_otp_challenges (
  email text primary key check (email = lower(trim(email))),
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts between 0 and 5),
  last_sent_at timestamptz not null default now(),
  verification_id uuid,
  verification_expires_at timestamptz,
  consumed_at timestamptz
);
alter table public.email_otp_challenges enable row level security;
revoke all on public.email_otp_challenges from public, anon, authenticated;
grant all on public.email_otp_challenges to service_role;

create or replace function public.request_email_otp(p_email text, p_hash text, p_expires_at timestamptz)
returns text language plpgsql security definer set search_path = public as $$
begin
  if p_email is null or p_email <> lower(trim(p_email)) or p_hash is null or p_expires_at <= now() then
    raise exception 'Invalid OTP challenge';
  end if;
  insert into public.email_otp_challenges(email, otp_hash, expires_at)
  values (p_email, p_hash, p_expires_at)
  on conflict (email) do update set otp_hash = excluded.otp_hash,
    expires_at = excluded.expires_at, attempts = 0, last_sent_at = now(),
    verification_id = null, verification_expires_at = null, consumed_at = null
  where public.email_otp_challenges.last_sent_at <= now() - interval '60 seconds';
  if found then return 'created'; end if;
  return 'cooldown';
end $$;

create or replace function public.verify_email_otp(p_email text, p_hash text, p_verification_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare challenge public.email_otp_challenges;
begin
  select * into challenge from public.email_otp_challenges where email = p_email for update;
  if not found then return 'missing'; end if;
  if challenge.attempts >= 5 then return 'locked'; end if;
  if challenge.expires_at <= now() or challenge.verification_id is not null or challenge.consumed_at is not null then return 'expired'; end if;
  if p_hash is null or p_hash <> challenge.otp_hash then
    update public.email_otp_challenges set attempts = attempts + 1 where email = p_email;
    if challenge.attempts >= 4 then return 'locked'; end if;
    return 'invalid';
  end if;
  if p_verification_id is null then return 'invalid'; end if;
  update public.email_otp_challenges set verification_id = p_verification_id,
    verification_expires_at = now() + interval '10 minutes' where email = p_email;
  return 'verified';
end $$;

create or replace function public.validate_email_otp(p_email text, p_verification_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.email_otp_challenges where email = p_email
    and verification_id = p_verification_id and verification_expires_at > now() and consumed_at is null);
$$;

create or replace function public.consume_email_otp(p_email text, p_verification_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.email_otp_challenges set consumed_at = now() where email = p_email
    and verification_id = p_verification_id and verification_expires_at > now() and consumed_at is null;
  return found;
end $$;

create or replace function public.release_failed_email_otp(p_email text, p_hash text)
returns void language sql security definer set search_path = public as $$
  delete from public.email_otp_challenges where email = p_email and otp_hash = p_hash and verification_id is null;
$$;

revoke execute on function public.request_email_otp(text, text, timestamptz),
  public.verify_email_otp(text, text, uuid), public.validate_email_otp(text, uuid),
  public.consume_email_otp(text, uuid), public.release_failed_email_otp(text, text) from public, anon, authenticated;
grant execute on function public.request_email_otp(text, text, timestamptz),
  public.verify_email_otp(text, text, uuid), public.validate_email_otp(text, uuid),
  public.consume_email_otp(text, uuid), public.release_failed_email_otp(text, text) to service_role;
notify pgrst, 'reload schema';
-- Claim capacity, save the appointment and issue its ticket in one transaction.
create or replace function public.create_clinic_booking(booking jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  requested public.appointments;
  saved public.appointments;
  ticket public.queue_tickets;
  slot public.appointment_slots;
  patient public.patient_medical_profiles;
  fee numeric;
  deposit_percent numeric;
  number integer;
begin
  requested := jsonb_populate_record(null::public.appointments, booking);
  select * into patient from public.patient_medical_profiles
    where id = requested.patient_medical_profile_id and owner_profile_id = requested.owner_profile_id for share;
  if not found then raise exception 'Patient profile does not belong to appointment owner'; end if;
  select * into slot from public.claim_appointment_slot(requested.appointment_slot_id);
  if not found then raise exception 'Slot is unavailable' using errcode = 'P0001'; end if;
  -- The slot row remains locked until both appointment and ticket are committed.
  if exists (select 1 from public.appointments where appointment_slot_id = slot.id
    and patient_medical_profile_id = patient.id and status in ('pending', 'confirmed')) then
    raise exception 'Patient already booked this slot';
  end if;
  select coalesce(d.consultation_fee, c.consultation_fee) into fee from public.clinic_specialties c
    join public.doctors d on d.specialty_id = c.id
    where d.id = slot.doctor_id and d.is_active and d.clinic_owned and c.is_active and c.clinic_owned
      and requested.doctor_id = d.id and requested.specialty_id = c.id for share of c, d;
  if fee is null or fee < 0 or fee <> trunc(fee) then raise exception 'Consultation fee is not configured'; end if;
  if requested.final_amount is distinct from fee then raise exception 'Consultation fee changed'; end if;
  select case when profile->>'depositPercent' ~ '^[0-9]{1,3}$'
    then (profile->>'depositPercent')::numeric else 30 end into deposit_percent
    from public.clinic_profile where id=true;
  deposit_percent := coalesce(deposit_percent,30);
  if deposit_percent < 1 or deposit_percent > 100 then raise exception 'Deposit percentage is invalid'; end if;
  insert into public.appointments (
    owner_profile_id, patient_medical_profile_id, appointment_slot_id, appointment_type,
    doctor_id, specialty_id, appointment_date, appointment_time, appointment_start_time,
    appointment_end_time, appointment_time_text, patient_name, patient_phone, reason, note,
    status, insurance_used, insurance_type, insurance_rate, original_amount, insurance_discount,
    final_amount, deposit_amount, payment_status, workplace_text, clinic_snapshot, doctor_name_text, specialty_text
  ) values (
    patient.owner_profile_id, patient.id, slot.id, 'doctor', requested.doctor_id, requested.specialty_id,
    slot.slot_date, slot.start_time, slot.start_time, slot.end_time, requested.appointment_time_text,
    patient.full_name, patient.phone, requested.reason, requested.note, case when fee=0 then 'confirmed' else 'pending' end,
    coalesce(requested.insurance_used,false), requested.insurance_type, 0, fee, 0, fee, ceil(fee*deposit_percent/100),
    case when fee = 0 then 'paid' else 'unpaid' end, requested.workplace_text, requested.clinic_snapshot,
    (select full_name from public.doctors where id = slot.doctor_id),
    (select name from public.clinic_specialties where id = requested.specialty_id)
  ) returning * into saved;
  number := public.allocate_queue_number();
  if number is null then raise exception 'Queue counter is not initialized'; end if;
  insert into public.queue_tickets (
    appointment_id, owner_profile_id, patient_medical_profile_id, ticket_code,
    appointment_code, patient_code, queue_number, current_number, status
  ) values (
    saved.id, patient.owner_profile_id, patient.id, 'MHQ' || lpad(number::text, greatest(4,length(number::text)), '0'),
    'MHA' || to_char(now() at time zone 'Asia/Ho_Chi_Minh','YYMMDD') || '-' || number::text,
    'MHP-' || upper(substr(replace(patient.id::text,'-',''),1,12)), number, 0, 'waiting'
  ) returning * into ticket;
  return jsonb_build_object('appointment',to_jsonb(saved),'ticket',to_jsonb(ticket));
end $$;
revoke execute on function public.create_clinic_booking(jsonb) from public, anon, authenticated;
grant execute on function public.create_clinic_booking(jsonb) to service_role;
notify pgrst, 'reload schema';
-- Clinic visit workflow (mirrors 202610010001_clinic_visit_workflow.sql).
alter table public.appointments
  add column if not exists checked_in_at timestamptz,
  add column if not exists checked_in_by uuid references public.app_users(id),
  add column if not exists delay_minutes integer not null default 0 check (delay_minutes between 0 and 240),
  add column if not exists delay_note text,
  add column if not exists clinician_absent boolean not null default false,
  add column if not exists absence_source text check (absence_source in ('manual','schedule'));

create table if not exists public.appointment_clinical_notes (
  appointment_id uuid primary key references public.appointments(id) on delete cascade,
  clinician_name text not null check (char_length(trim(clinician_name)) between 2 and 120),
  summary text not null check (char_length(trim(summary)) between 10 and 4000),
  diagnosis text not null check (char_length(trim(diagnosis)) between 2 and 2000),
  care_plan text not null check (char_length(trim(care_plan)) between 10 and 4000),
  follow_up text,
  allergies_reviewed boolean not null default false,
  entered_by uuid not null references public.app_users(id),
  entered_at timestamptz not null default now()
);
alter table public.appointment_clinical_notes enable row level security;
revoke all on public.appointment_clinical_notes from public, anon, authenticated;
grant all on public.appointment_clinical_notes to service_role;

create table if not exists public.clinical_note_addenda (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  entered_by uuid not null references public.app_users(id),
  author_name text not null check (char_length(trim(author_name)) between 2 and 120),
  content text not null check (char_length(trim(content)) between 10 and 4000),
  created_at timestamptz not null default now()
);
create index clinical_note_addenda_appointment_created_idx on public.clinical_note_addenda(appointment_id,created_at);
alter table public.clinical_note_addenda enable row level security;
revoke all on public.clinical_note_addenda from public, anon, authenticated;
grant all on public.clinical_note_addenda to service_role;

create table public.clinical_encounters (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  stage integer not null check (stage between 1 and 6),
  specialty_id uuid not null references public.clinic_specialties(id),
  doctor_id uuid not null references public.doctors(id),
  referred_slot_id uuid references public.appointment_slots(id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting','completed')),
  symptoms text,
  provisional_diagnosis text,
  completed_by uuid references public.app_users(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (appointment_id, stage)
);
create index clinical_encounters_doctor_waiting_idx on public.clinical_encounters(doctor_id,status);
create index clinical_encounters_referral_slot_idx on public.clinical_encounters(referred_slot_id) where referred_slot_id is not null;
alter table public.clinical_encounters enable row level security;
revoke all on public.clinical_encounters from public, anon, authenticated;
grant all on public.clinical_encounters to service_role;

create table public.prescription_items (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  medicine_name text not null check (char_length(trim(medicine_name)) between 2 and 200),
  dosage text not null check (char_length(trim(dosage)) between 2 and 200),
  frequency text not null check (char_length(trim(frequency)) between 2 and 200),
  duration text not null check (char_length(trim(duration)) between 2 and 200),
  quantity integer not null check (quantity between 1 and 1000),
  entered_by uuid not null references public.app_users(id),
  created_at timestamptz not null default now()
);
alter table public.prescription_items enable row level security;
revoke all on public.prescription_items from public, anon, authenticated;
grant all on public.prescription_items to service_role;

create table public.clinical_material_usage (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  material_name text not null check (char_length(trim(material_name)) between 2 and 200),
  quantity integer not null check (quantity between 1 and 10000),
  entered_by uuid not null references public.app_users(id),
  created_at timestamptz not null default now()
);
alter table public.clinical_material_usage enable row level security;
revoke all on public.clinical_material_usage from public, anon, authenticated;
grant all on public.clinical_material_usage to service_role;

create table if not exists public.appointment_email_outbox (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  kind text not null check (kind in ('confirmed','reminder','cancelled','no_show','doctor_delay','doctor_absent','doctor_available','rescheduled','completed')),
  due_at timestamptz not null default now(),
  claimed_until timestamptz,
  sent_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  unique (appointment_id,kind)
);
create index if not exists appointment_email_outbox_due_idx on public.appointment_email_outbox(due_at) where sent_at is null;
alter table public.appointment_email_outbox enable row level security;
revoke all on public.appointment_email_outbox from public, anon, authenticated;
grant all on public.appointment_email_outbox to service_role;

create or replace function public.enqueue_appointment_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.appointment_email_outbox(appointment_id,kind) values (new.id,'confirmed') on conflict do nothing;
    insert into public.appointment_email_outbox(appointment_id,kind,due_at)
      values (new.id,'reminder',greatest(now(), (new.appointment_date + coalesce(new.appointment_time,'00:00'::time)) at time zone 'Asia/Ho_Chi_Minh' - interval '24 hours')) on conflict do nothing;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status in ('cancelled','no_show','completed') then
      update public.appointment_email_outbox set sent_at=now(),claimed_until=null,last_error='skipped: appointment closed'
        where appointment_id=new.id and kind='reminder' and sent_at is null;
      insert into public.appointment_email_outbox(appointment_id,kind) values (new.id,new.status) on conflict do nothing;
    end if;
  end if;
  if tg_op = 'UPDATE' and new.delay_minutes is distinct from old.delay_minutes and new.delay_minutes > 0 then
    insert into public.appointment_email_outbox(appointment_id,kind) values (new.id,'doctor_delay')
      on conflict (appointment_id,kind) do update set due_at=now(), sent_at=null, claimed_until=null;
  end if;
  if tg_op = 'UPDATE' and new.clinician_absent and not old.clinician_absent then
    insert into public.appointment_email_outbox(appointment_id,kind) values (new.id,'doctor_absent') on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists enqueue_appointment_email on public.appointments;
create trigger enqueue_appointment_email after insert or update of status,delay_minutes,clinician_absent on public.appointments
for each row execute function public.enqueue_appointment_email();

insert into public.appointment_email_outbox(appointment_id,kind,due_at)
select id,'reminder',greatest(now(), (appointment_date + coalesce(appointment_time,'00:00'::time)) at time zone 'Asia/Ho_Chi_Minh' - interval '24 hours')
from public.appointments where status in ('pending','confirmed') and appointment_date >= (now() at time zone 'Asia/Ho_Chi_Minh')::date
on conflict do nothing;

create or replace function public.claim_appointment_emails(batch_size integer default 10)
returns setof public.appointment_email_outbox language sql security definer set search_path = public as $$
  update public.appointment_email_outbox o set claimed_until=now()+interval '5 minutes', attempts=o.attempts+1
  where o.id in (
    select e.id from public.appointment_email_outbox e join public.appointments a on a.id=e.appointment_id
    where e.sent_at is null and e.due_at<=now() and (e.claimed_until is null or e.claimed_until<now())
      and e.attempts<6 and (e.kind<>'reminder' or (a.status='confirmed' and not a.clinician_absent
        and (a.appointment_date+coalesce(a.appointment_time,'00:00'::time)) at time zone 'Asia/Ho_Chi_Minh'>now()))
    order by e.due_at limit least(greatest(batch_size,1),20) for update of e skip locked
  ) returning o.*;
$$;
revoke execute on function public.claim_appointment_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_appointment_emails(integer) to service_role;

create or replace function public.check_in_clinic_appointment(appointment_id_value uuid, patient_name_value text, birth_date_value date, actor_id_value uuid)
returns setof public.appointments language plpgsql security definer set search_path = public as $$
declare a public.appointments; p public.patient_medical_profiles;
begin
  select * into a from public.appointments where id=appointment_id_value for update;
  if not found then return; end if;
  if a.status <> 'confirmed' or a.clinician_absent then raise exception 'Appointment is not open for check-in'; end if;
  if a.final_amount > 0 and a.payment_status <> 'paid' then raise exception 'Deposit must be paid before check-in'; end if;
  if a.appointment_date <> (now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Check-in is only available on appointment day'; end if;
  select * into p from public.patient_medical_profiles where id=a.patient_medical_profile_id;
  if not found or lower(trim(p.full_name))<>lower(trim(patient_name_value)) or p.date_of_birth is distinct from birth_date_value then
    raise exception 'Patient identity does not match';
  end if;
  if a.checked_in_at is not null then return next a; return; end if;
  update public.appointments set checked_in_at=now(),checked_in_by=actor_id_value where id=a.id returning * into a;
  insert into public.clinical_encounters(appointment_id,stage,specialty_id,doctor_id)
    values(a.id,1,a.specialty_id,a.doctor_id) on conflict (appointment_id,stage) do nothing;
  return next a;
end $$;
revoke execute on function public.check_in_clinic_appointment(uuid,text,date,uuid) from public, anon, authenticated;
grant execute on function public.check_in_clinic_appointment(uuid,text,date,uuid) to service_role;

notify pgrst, 'reload schema';

-- Clinic visit actions (mirrors 202610010002_visit_actions.sql).
create or replace function public.transition_clinic_appointment(
  appointment_id_value uuid, doctor_id_value uuid, owner_id_value uuid, status_value text
) returns setof public.appointments language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  if status_value is null or status_value not in ('confirmed','cancelled','completed','no_show') then raise exception 'Invalid appointment status'; end if;
  select * into a from public.appointments where id=appointment_id_value
    and (doctor_id_value is null or doctor_id=doctor_id_value)
    and (owner_id_value is null or owner_profile_id=owner_id_value) for update;
  if not found then return; end if;
  if a.status=status_value then return next a; return; end if;
  if a.status in ('cancelled','completed','no_show') then raise exception 'Appointment is already closed'; end if;
  if status_value='confirmed' and a.deposit_amount>0 and a.payment_status<>'paid' then
    raise exception 'Deposit must be paid before confirmation';
  end if;
  if status_value='completed' then
    if a.checked_in_at is null then raise exception 'Patient must check in first'; end if;
    if not exists(select 1 from public.appointment_clinical_notes where appointment_id=a.id) then raise exception 'Visit result is required'; end if;
    if ((a.appointment_date+coalesce(a.appointment_time,'00:00'::time)) at time zone 'Asia/Ho_Chi_Minh')>now() then
      raise exception 'Appointment has not started';
    end if;
  end if;
  if status_value='no_show' then
    if a.checked_in_at is not null then raise exception 'Checked-in patient cannot be marked absent'; end if;
    if a.clinician_absent then raise exception 'Doctor absence must be resolved first'; end if;
    if ((a.appointment_date+coalesce(a.appointment_time,'00:00'::time)) at time zone 'Asia/Ho_Chi_Minh') + make_interval(mins => 15 + a.delay_minutes) > now() then
      raise exception 'Wait 15 minutes after the scheduled time';
    end if;
  end if;
  update public.appointments set status=status_value where id=a.id returning * into a;
  update public.queue_tickets set status=case status_value when 'completed' then 'done' when 'cancelled' then 'cancelled' when 'no_show' then 'cancelled' else 'waiting' end where appointment_id=a.id;
  if status_value='cancelled' and a.appointment_slot_id is not null then perform public.release_appointment_slot(a.appointment_slot_id); end if;
  return next a;
end $$;
revoke execute on function public.transition_clinic_appointment(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.transition_clinic_appointment(uuid,uuid,uuid,text) to service_role;

-- Patient self-cancellation must not release a paid, in-flight, checked-in, or started visit.
create or replace function public.cancel_clinic_patient_appointment(appointment_id_value uuid, owner_id_value uuid)
returns setof public.appointments language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  select * into a from public.appointments
    where id = appointment_id_value and owner_profile_id = owner_id_value for update;
  if not found then return; end if;
  if a.status in ('cancelled','completed','no_show') then raise exception 'Appointment is already closed'; end if;
  if a.checked_in_at is not null then raise exception 'Checked-in appointment cannot be cancelled'; end if;
  if a.payment_status in ('paid','refunded') then raise exception 'Paid appointment requires clinic cancellation'; end if;
  if a.payment_status = 'pending' then raise exception 'Payment is being processed'; end if;
  if ((a.appointment_date + coalesce(a.appointment_time, '00:00'::time)) at time zone 'Asia/Ho_Chi_Minh') <= now() then
    raise exception 'Appointment has started';
  end if;
  return query select * from public.transition_clinic_appointment(a.id, null, a.owner_profile_id, 'cancelled');
end $$;
revoke execute on function public.cancel_clinic_patient_appointment(uuid,uuid) from public, anon, authenticated;
grant execute on function public.cancel_clinic_patient_appointment(uuid,uuid) to service_role;

create or replace function public.complete_clinic_visit(appointment_id_value uuid, clinician_name_value text,
  summary_value text, diagnosis_value text, care_plan_value text, follow_up_value text, actor_id_value uuid)
returns setof public.appointments language plpgsql security definer set search_path = public as $$
declare a public.appointments;
begin
  select * into a from public.appointments where id=appointment_id_value for update;
  if not found then return; end if;
  if a.status not in ('pending','confirmed') or a.checked_in_at is null or a.clinician_absent then
    raise exception 'Appointment is not ready for completion';
  end if;
  if a.appointment_date <> (now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Visit must be completed on appointment day'; end if;
  if not exists(select 1 from public.doctors d where d.id=a.doctor_id and lower(trim(d.full_name))=lower(trim(clinician_name_value))) then
    raise exception 'Clinician must match the assigned doctor';
  end if;
  insert into public.appointment_clinical_notes(appointment_id,clinician_name,summary,diagnosis,care_plan,follow_up,entered_by)
    values(a.id,clinician_name_value,summary_value,diagnosis_value,care_plan_value,follow_up_value,actor_id_value);
  return query select * from public.transition_clinic_appointment(a.id,null,null,'completed');
end $$;
revoke execute on function public.complete_clinic_visit(uuid,text,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.complete_clinic_visit(uuid,text,text,text,text,text,uuid) to service_role;

notify pgrst, 'reload schema';

-- Doctor absence handling (mirrors 202610010003_doctor_absence.sql).
alter table public.appointment_email_outbox drop constraint if exists appointment_email_outbox_kind_check;
alter table public.appointment_email_outbox add constraint appointment_email_outbox_kind_check
  check (kind in ('confirmed','reminder','cancelled','no_show','doctor_delay','doctor_absent','doctor_available','rescheduled','completed'));

create or replace function public.enqueue_appointment_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    insert into public.appointment_email_outbox(appointment_id,kind) values (new.id,'confirmed') on conflict do nothing;
    insert into public.appointment_email_outbox(appointment_id,kind,due_at)
      values (new.id,'reminder',greatest(now(), (new.appointment_date + coalesce(new.appointment_time,'00:00'::time)) at time zone 'Asia/Ho_Chi_Minh' - interval '24 hours')) on conflict do nothing;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status in ('cancelled','no_show','completed') then
      update public.appointment_email_outbox set sent_at=now(),claimed_until=null,last_error='skipped: appointment closed'
        where appointment_id=new.id and kind='reminder' and sent_at is null;
      insert into public.appointment_email_outbox(appointment_id,kind) values (new.id,new.status) on conflict do nothing;
    end if;
  end if;
  if tg_op = 'UPDATE' and new.delay_minutes is distinct from old.delay_minutes and new.delay_minutes > 0 then
    insert into public.appointment_email_outbox(appointment_id,kind) values (new.id,'doctor_delay')
      on conflict (appointment_id,kind) do update set due_at=now(), sent_at=null, claimed_until=null;
  end if;
  if tg_op = 'UPDATE' and new.clinician_absent is distinct from old.clinician_absent
    and new.appointment_slot_id is not distinct from old.appointment_slot_id then
    insert into public.appointment_email_outbox(appointment_id,kind)
      values (new.id,case when new.clinician_absent then 'doctor_absent' else 'doctor_available' end)
      on conflict (appointment_id,kind) do update set due_at=now(), sent_at=null, claimed_until=null;
  end if;
  return new;
end $$;

create or replace function public.set_clinic_doctor_absence(doctor_id_value uuid, enabled_value boolean,
  start_date_value date, end_date_value date, reason_value text)
returns setof public.doctors language plpgsql security definer set search_path = public as $$
declare d public.doctors;
begin
  select * into d from public.doctors where id=doctor_id_value and clinic_owned for update;
  if not found then return; end if;
  if enabled_value and (start_date_value is null or end_date_value is null or end_date_value<start_date_value) then
    raise exception 'Invalid absence dates';
  end if;
  if d.unavailable_from is not null then
    update public.appointments set clinician_absent=false,absence_source=null where doctor_id=d.id
      and appointment_date between d.unavailable_from and d.unavailable_to and status in ('pending','confirmed')
      and absence_source='schedule' and (not enabled_value or appointment_date not between start_date_value and end_date_value);
  end if;
  update public.doctors set unavailable_from=case when enabled_value then start_date_value else null end,
    unavailable_to=case when enabled_value then end_date_value else null end,
    unavailable_note=case when enabled_value then coalesce(reason_value,'') else '' end
    where id=d.id returning * into d;
  if enabled_value then
    update public.appointments set clinician_absent=true,absence_source='schedule',delay_minutes=0,
      delay_note='BÃ¡c sÄ© váº¯ng máº·t; phÃ²ng khÃ¡m sáº½ liÃªn há»‡ Ä‘á»ƒ Ä‘á»•i lá»‹ch hoáº·c há»§y.'
      where doctor_id=d.id and appointment_date between start_date_value and end_date_value
        and status in ('pending','confirmed') and not clinician_absent;
  end if;
  return next d;
end $$;
revoke execute on function public.set_clinic_doctor_absence(uuid,boolean,date,date,text) from public, anon, authenticated;
grant execute on function public.set_clinic_doctor_absence(uuid,boolean,date,date,text) to service_role;

notify pgrst, 'reload schema';

-- Booking/absence lock (mirrors 202610010004_absence_booking_lock.sql).
-- Serialize doctor absence changes with booking before claiming a slot.
create or replace function public.claim_appointment_slot(slot_id uuid)
returns setof public.appointment_slots language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.doctors d join public.appointment_slots s on s.doctor_id=d.id
    where s.id=slot_id and d.is_active and d.clinic_owned
      and (d.unavailable_from is null or s.slot_date not between d.unavailable_from and d.unavailable_to)
    for share of d;
  if not found then return; end if;
  return query update public.appointment_slots s set booked_count=s.booked_count+1
    where s.id=slot_id and s.is_active and s.booked_count<s.capacity
      and (s.slot_date+s.start_time)>(now() at time zone 'Asia/Ho_Chi_Minh')
    returning s.*;
end $$;
revoke execute on function public.claim_appointment_slot(uuid) from public, anon, authenticated;
grant execute on function public.claim_appointment_slot(uuid) to service_role;
notify pgrst, 'reload schema';

-- Appointment rescheduling (mirrors 202610010005_reschedule.sql).
alter table public.appointments add column if not exists rescheduled_at timestamptz;
alter table public.appointment_email_outbox drop constraint if exists appointment_email_outbox_kind_check;
alter table public.appointment_email_outbox add constraint appointment_email_outbox_kind_check
  check (kind in ('confirmed','reminder','cancelled','no_show','doctor_delay','doctor_absent','doctor_available','rescheduled','completed'));

create or replace function public.enqueue_appointment_reschedule_email()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.appointment_email_outbox(appointment_id,kind) values(new.id,'rescheduled')
    on conflict (appointment_id,kind) do update set due_at=now(),sent_at=null,claimed_until=null;
  update public.appointment_email_outbox set due_at=greatest(now(),
    (new.appointment_date+coalesce(new.appointment_time,'00:00'::time)) at time zone 'Asia/Ho_Chi_Minh' - interval '24 hours'),
    sent_at=null,claimed_until=null,last_error=null
    where appointment_id=new.id and kind='reminder';
  return new;
end $$;
drop trigger if exists enqueue_appointment_reschedule_email on public.appointments;
create trigger enqueue_appointment_reschedule_email after update of appointment_slot_id on public.appointments
for each row when (old.appointment_slot_id is distinct from new.appointment_slot_id)
execute function public.enqueue_appointment_reschedule_email();

create or replace function public.reschedule_clinic_appointment(appointment_id_value uuid, new_slot_id_value uuid)
returns setof public.appointments language plpgsql security definer set search_path = public as $$
declare a public.appointments; slot public.appointment_slots; d public.doctors; old_slot_id uuid;
begin
  select * into a from public.appointments where id=appointment_id_value;
  if not found then return; end if;
  if a.status not in ('pending','confirmed') or a.checked_in_at is not null then raise exception 'Appointment cannot be rescheduled'; end if;
  if a.appointment_slot_id=new_slot_id_value then return next a; return; end if;
  -- Claim first: the doctor row is locked before the appointment row, matching absence updates.
  select * into slot from public.claim_appointment_slot(new_slot_id_value);
  if not found then raise exception 'New slot is unavailable'; end if;
  select * into a from public.appointments where id=appointment_id_value for update;
  if a.status not in ('pending','confirmed') or a.checked_in_at is not null then raise exception 'Appointment cannot be rescheduled'; end if;
  select * into d from public.doctors where id=slot.doctor_id;
  if not found or d.specialty_id<>a.specialty_id or (slot.specialty_id is not null and slot.specialty_id<>a.specialty_id) then
    raise exception 'New doctor must have the same specialty';
  end if;
  old_slot_id := a.appointment_slot_id;
  update public.appointments set appointment_slot_id=slot.id,doctor_id=d.id,
    appointment_date=slot.slot_date,appointment_time=slot.start_time,
    appointment_start_time=slot.start_time,appointment_end_time=slot.end_time,
    appointment_time_text=left(slot.start_time::text,5)||'-'||left(slot.end_time::text,5),
    doctor_name_text=d.full_name,clinician_absent=false,absence_source=null,delay_minutes=0,delay_note=null,rescheduled_at=now()
    where id=a.id returning * into a;
  if old_slot_id is not null then perform public.release_appointment_slot(old_slot_id); end if;
  return next a;
end $$;
revoke execute on function public.reschedule_clinic_appointment(uuid,uuid) from public, anon, authenticated;
grant execute on function public.reschedule_clinic_appointment(uuid,uuid) to service_role;

notify pgrst, 'reload schema';

-- Doctor accounts are part of the canonical schema.
-- The seed adds doctor profiles only. Firebase UIDs and passwords are provisioned
-- separately by backend/scripts/provision_virtual_doctors.js after this schema and seed.
alter table public.app_users add column if not exists doctor_id uuid unique references public.doctors(id) on delete restrict;
alter table public.app_users drop constraint if exists app_users_doctor_role_check;
alter table public.app_users add constraint app_users_doctor_role_check
  check ((role in ('doctor','head')) = (doctor_id is not null));

create or replace function public.validate_clinic_staff_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.role = old.role then return new; end if;
  if new.role::text not in ('patient', 'staff', 'doctor', 'head', 'admin') then raise exception 'Unsupported account role'; end if;
  return new;
end $$;

create or replace function public.complete_clinic_visit(appointment_id_value uuid, clinician_name_value text,
  summary_value text, diagnosis_value text, care_plan_value text, follow_up_value text, actor_id_value uuid)
returns setof public.appointments language plpgsql security definer set search_path = public as $$
declare a public.appointments; actor public.app_users;
begin
  select * into a from public.appointments where id=appointment_id_value for update;
  if not found then return; end if;
  select * into actor from public.app_users where id=actor_id_value;
  if not found or actor.role not in ('doctor','head') or actor.status <> 'active' or actor.doctor_id is distinct from a.doctor_id then
    raise exception 'Only the assigned doctor can complete this visit';
  end if;
  if a.status not in ('pending','confirmed') or a.checked_in_at is null or a.clinician_absent then
    raise exception 'Appointment is not ready for completion';
  end if;
  if a.appointment_date <> (now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Visit must be completed on appointment day'; end if;
  if not exists(select 1 from public.doctors d where d.id=a.doctor_id and lower(trim(d.full_name))=lower(trim(clinician_name_value))) then
    raise exception 'Clinician must match the assigned doctor';
  end if;
  insert into public.appointment_clinical_notes(appointment_id,clinician_name,summary,diagnosis,care_plan,follow_up,entered_by)
    values(a.id,clinician_name_value,summary_value,diagnosis_value,care_plan_value,follow_up_value,actor_id_value);
  return query select * from public.transition_clinic_appointment(a.id,null,null,'completed');
end $$;
revoke execute on function public.complete_clinic_visit(uuid,text,text,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.complete_clinic_visit(uuid,text,text,text,text,text,uuid) to service_role;
create or replace function public.confirm_clinic_deposit(payment_id_value uuid)
returns setof public.appointments language plpgsql security definer set search_path = public as $$
declare p public.payments; a public.appointments;
begin
  select * into p from public.payments where id=payment_id_value for update;
  if not found or p.status <> 'paid' then raise exception 'Deposit payment is not verified'; end if;
  select * into a from public.appointments where id=p.appointment_id for update;
  if not found or a.status='cancelled' then raise exception 'Appointment is no longer payable'; end if;
  if a.status in ('completed','no_show') and a.payment_status='paid' then return next a; return; end if;
  if a.status in ('completed','no_show') then raise exception 'Appointment is no longer payable'; end if;
  if p.amount < a.deposit_amount or a.deposit_amount <= 0 then raise exception 'Deposit amount is insufficient'; end if;
  if a.status='pending' then
    update public.appointments set payment_status='paid',status='confirmed' where id=a.id returning * into a;
  elsif a.payment_status <> 'paid' then
    update public.appointments set payment_status='paid' where id=a.id returning * into a;
  end if;
  return next a;
end $$;
revoke execute on function public.confirm_clinic_deposit(uuid) from public, anon, authenticated;
grant execute on function public.confirm_clinic_deposit(uuid) to service_role;

create or replace function public.create_clinic_walkin_booking(patient_id_value uuid, slot_id_value uuid,
  actor_id_value uuid, cash_deposit_received boolean, reason_value text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare actor public.app_users; patient public.patient_medical_profiles; slot public.appointment_slots;
  fee numeric; saved jsonb; saved_id uuid; payment_id uuid;
begin
  select * into actor from public.app_users where id=actor_id_value;
  if not found or actor.role not in ('staff','admin') or actor.status <> 'active' then raise exception 'Only reception staff can create counter bookings'; end if;
  select * into patient from public.patient_medical_profiles where id=patient_id_value;
  if not found then raise exception 'Patient profile not found'; end if;
  select * into slot from public.appointment_slots where id=slot_id_value;
  if not found then raise exception 'Slot not found'; end if;
   select coalesce(d.consultation_fee, c.consultation_fee) into fee
     from public.clinic_specialties c join public.doctors d on d.specialty_id=c.id
     where c.id=slot.specialty_id and d.id=slot.doctor_id and c.is_active and c.clinic_owned and d.is_active and d.clinic_owned;
  if fee is null then raise exception 'Consultation fee is not available'; end if;
  if fee > 0 and cash_deposit_received is distinct from true then raise exception 'Counter deposit must be received'; end if;
  saved := public.create_clinic_booking(jsonb_build_object(
    'owner_profile_id',patient.owner_profile_id,'patient_medical_profile_id',patient.id,
    'appointment_slot_id',slot.id,'doctor_id',slot.doctor_id,'specialty_id',slot.specialty_id,
    'final_amount',fee,'reason',left(coalesce(reason_value,'ÄÄƒng kÃ½ táº¡i quáº§y'),2000)));
  saved_id := (saved->'appointment'->>'id')::uuid;
  if fee > 0 then
    insert into public.payments(appointment_id,owner_profile_id,amount,method,provider,status,paid_at,raw_payload)
      values(saved_id,patient.owner_profile_id,(saved->'appointment'->>'deposit_amount')::numeric,'cash','counter','paid',now(),
        jsonb_build_object('received_by',actor.id)) returning id into payment_id;
    perform public.confirm_clinic_deposit(payment_id);
  end if;
  return jsonb_build_object('appointment_id',saved_id,'appointment_code',saved->'ticket'->>'appointment_code');
end $$;
revoke execute on function public.create_clinic_walkin_booking(uuid,uuid,uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.create_clinic_walkin_booking(uuid,uuid,uuid,boolean,text) to service_role;

create or replace function public.create_counter_patient(actor_id_value uuid, firebase_uid_value text,
  email_value text, name_value text, phone_value text, birth_date_value date, gender_value text,
  history_value text default null, blood_group_value text default null, allergies_value text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare actor public.app_users; account_id uuid; owner_id uuid; medical_id uuid;
begin
  select * into actor from public.app_users where id=actor_id_value;
  if not found or actor.role not in ('staff','admin') or actor.status <> 'active' then raise exception 'Only reception staff can create patients'; end if;
  if char_length(trim(coalesce(firebase_uid_value,''))) < 5 or char_length(trim(coalesce(name_value,''))) < 2
    or char_length(trim(coalesce(email_value,''))) < 5 or char_length(trim(coalesce(phone_value,''))) < 9
    or birth_date_value is null or birth_date_value > current_date or gender_value not in ('male','female','other')
    then raise exception 'Patient data is incomplete'; end if;
  insert into public.app_users(firebase_uid,email,full_name,role,status,auth_provider)
    values(firebase_uid_value,lower(trim(email_value)),trim(name_value),'patient','active','password') returning id into account_id;
  insert into public.patient_profiles(firebase_uid,app_user_id,email,full_name,phone,date_of_birth,gender)
    values(firebase_uid_value,account_id,lower(trim(email_value)),trim(name_value),trim(phone_value),birth_date_value,gender_value) returning id into owner_id;
  insert into public.patient_medical_profiles(owner_profile_id,relationship,full_name,phone,date_of_birth,gender,email,is_primary,medical_history,blood_group,allergies)
    values(owner_id,'TÃ´i',trim(name_value),trim(phone_value),birth_date_value,gender_value,lower(trim(email_value)),true,
      nullif(trim(coalesce(history_value,'')),''),nullif(trim(coalesce(blood_group_value,'')),''),nullif(trim(coalesce(allergies_value,'')),''))
    returning id into medical_id;
  return jsonb_build_object('patientId',medical_id,'accountId',account_id);
end $$;
revoke execute on function public.create_counter_patient(uuid,text,text,text,text,date,text,text,text,text) from public, anon, authenticated;
grant execute on function public.create_counter_patient(uuid,text,text,text,text,date,text,text,text,text) to service_role;

create or replace function public.record_specialty_exam(encounter_id_value uuid, actor_id_value uuid,
  symptoms_value text, diagnosis_value text, next_specialty_id_value uuid default null,
  next_slot_id_value uuid default null, materials_value jsonb default '[]'::jsonb)
returns setof public.clinical_encounters language plpgsql security definer set search_path = public as $$
declare e public.clinical_encounters; a public.appointments; actor public.app_users; material jsonb;
  target_slot public.appointment_slots; referral_count integer;
begin
  select * into e from public.clinical_encounters where id=encounter_id_value for update;
  if not found then return; end if;
  select * into a from public.appointments where id=e.appointment_id for update;
  select * into actor from public.app_users where id=actor_id_value;
  if not found or actor.role not in ('doctor','head') or actor.status <> 'active' or actor.doctor_id is distinct from e.doctor_id then
    raise exception 'Only the assigned specialist can record this exam';
  end if;
  if e.status <> 'waiting' or a.status <> 'confirmed' or a.checked_in_at is null then raise exception 'Exam is not ready'; end if;
  if a.appointment_date <> (now() at time zone 'Asia/Ho_Chi_Minh')::date then raise exception 'Exam must occur on appointment day'; end if;
  if char_length(trim(coalesce(symptoms_value,''))) < 5 or char_length(trim(coalesce(diagnosis_value,''))) < 2
    or char_length(symptoms_value) > 4000 or char_length(diagnosis_value) > 2000 then raise exception 'Exam details are incomplete'; end if;
  if jsonb_typeof(coalesce(materials_value,'[]'::jsonb)) <> 'array' then raise exception 'Material usage is invalid'; end if;
  if jsonb_array_length(coalesce(materials_value,'[]'::jsonb)) > 30 then raise exception 'Material usage is invalid'; end if;
  for material in select value from jsonb_array_elements(coalesce(materials_value,'[]'::jsonb)) loop
    if char_length(trim(coalesce(material->>'name',''))) not between 2 and 200 then raise exception 'Material usage is invalid'; end if;
    if coalesce(material->>'quantity','') !~ '^[0-9]+$' then raise exception 'Material usage is invalid'; end if;
    if (material->>'quantity')::numeric not between 1 and 10000 then raise exception 'Material usage is invalid'; end if;
  end loop;
  if next_specialty_id_value is not null then
    if e.stage >= 6 or next_specialty_id_value=e.specialty_id or next_slot_id_value is null then
      raise exception 'Referral limit, destination, and available time are required';
    end if;
    if exists(select 1 from public.clinical_encounters where appointment_id=a.id and specialty_id=next_specialty_id_value) then
      raise exception 'Patient already has an encounter in the destination department';
    end if;
    select s.* into target_slot from public.appointment_slots s
      join public.doctors d on d.id=s.doctor_id
      where s.id=next_slot_id_value and s.specialty_id=next_specialty_id_value
        and d.specialty_id=next_specialty_id_value and d.is_active and d.clinic_owned and not d.is_demo
        and s.slot_date=a.appointment_date and s.is_active
      for update of s;
    if target_slot.id is null then raise exception 'The selected referral time is no longer available'; end if;
    if (target_slot.slot_date + target_slot.start_time) at time zone 'Asia/Ho_Chi_Minh' < now() then
      raise exception 'The selected referral time has already started';
    end if;
    select count(*) into referral_count from public.clinical_encounters where referred_slot_id=target_slot.id;
    if target_slot.booked_count + referral_count >= target_slot.capacity then
      raise exception 'The selected referral time is full';
    end if;
  elsif next_slot_id_value is not null then
    raise exception 'Referral time requires a destination department';
  end if;
  update public.clinical_encounters set symptoms=trim(symptoms_value),provisional_diagnosis=trim(diagnosis_value),
    status='completed',completed_by=actor_id_value,completed_at=now() where id=e.id returning * into e;
  for material in select value from jsonb_array_elements(coalesce(materials_value,'[]'::jsonb)) loop
    insert into public.clinical_material_usage(appointment_id,material_name,quantity,entered_by)
      values(a.id,trim(material->>'name'),(material->>'quantity')::integer,actor_id_value);
  end loop;
  if next_specialty_id_value is not null then
    insert into public.clinical_encounters(appointment_id,stage,specialty_id,doctor_id,referred_slot_id)
      values(a.id,e.stage+1,next_specialty_id_value,target_slot.doctor_id,target_slot.id);
  end if;
  return next e;
end $$;
revoke execute on function public.record_specialty_exam(uuid,uuid,text,text,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.record_specialty_exam(uuid,uuid,text,text,uuid,uuid,jsonb) to service_role;

create or replace function public.finalize_clinic_visit(appointment_id_value uuid, actor_id_value uuid,
  summary_value text, diagnosis_value text, care_plan_value text, follow_up_value text,
  allergies_reviewed_value boolean, medicines_value jsonb, materials_value jsonb)
returns setof public.appointments language plpgsql security definer set search_path = public as $$
declare a public.appointments; actor public.app_users; medicine jsonb; material jsonb;
begin
  select * into a from public.appointments where id=appointment_id_value for update;
  if not found then return; end if;
  select * into actor from public.app_users where id=actor_id_value;
  if not found or actor.role <> 'head' or actor.status <> 'active' or actor.doctor_id is null
    or not exists(select 1 from public.doctors d where d.id=actor.doctor_id and d.specialty_id=a.specialty_id)
    then raise exception 'Only the department head may finalize this visit'; end if;
  if a.status <> 'confirmed' or a.checked_in_at is null then raise exception 'Visit is not ready'; end if;
  if not exists(select 1 from public.clinical_encounters where appointment_id=a.id and status='completed')
    or exists(select 1 from public.clinical_encounters where appointment_id=a.id and status='waiting')
    then raise exception 'All specialist results are required'; end if;
  if char_length(trim(coalesce(summary_value,''))) < 10 or char_length(trim(coalesce(diagnosis_value,''))) < 2
    or char_length(trim(coalesce(care_plan_value,''))) < 10 then raise exception 'Final diagnosis is incomplete'; end if;
  if jsonb_typeof(coalesce(medicines_value,'[]'::jsonb)) <> 'array' then raise exception 'Prescription is invalid'; end if;
  if jsonb_array_length(coalesce(medicines_value,'[]'::jsonb)) > 30 then raise exception 'Prescription is invalid'; end if;
  if jsonb_typeof(coalesce(materials_value,'[]'::jsonb)) <> 'array' then raise exception 'Material usage is invalid'; end if;
  if jsonb_array_length(coalesce(materials_value,'[]'::jsonb)) > 30 then raise exception 'Material usage is invalid'; end if;
  if jsonb_array_length(coalesce(medicines_value,'[]'::jsonb)) > 0 and allergies_reviewed_value is not true
    then raise exception 'Allergies and medication history must be reviewed before prescribing'; end if;
  for medicine in select value from jsonb_array_elements(coalesce(medicines_value,'[]'::jsonb)) loop
    if char_length(trim(coalesce(medicine->>'name',''))) not between 2 and 200
      or char_length(trim(coalesce(medicine->>'dosage',''))) not between 2 and 200
      or char_length(trim(coalesce(medicine->>'frequency',''))) not between 2 and 200
      or char_length(trim(coalesce(medicine->>'duration',''))) not between 2 and 200 then raise exception 'Prescription is invalid'; end if;
    if coalesce(medicine->>'quantity','') !~ '^[0-9]+$' then raise exception 'Prescription is invalid'; end if;
    if (medicine->>'quantity')::numeric not between 1 and 1000 then raise exception 'Prescription is invalid'; end if;
  end loop;
  for material in select value from jsonb_array_elements(coalesce(materials_value,'[]'::jsonb)) loop
    if char_length(trim(coalesce(material->>'name',''))) not between 2 and 200 then raise exception 'Material usage is invalid'; end if;
    if coalesce(material->>'quantity','') !~ '^[0-9]+$' then raise exception 'Material usage is invalid'; end if;
    if (material->>'quantity')::numeric not between 1 and 10000 then raise exception 'Material usage is invalid'; end if;
  end loop;
  insert into public.appointment_clinical_notes(appointment_id,clinician_name,summary,diagnosis,care_plan,follow_up,allergies_reviewed,entered_by)
    values(a.id,coalesce(actor.full_name,(select full_name from public.doctors where id=actor.doctor_id)),trim(summary_value),trim(diagnosis_value),trim(care_plan_value),trim(follow_up_value),coalesce(allergies_reviewed_value,false),actor_id_value);
  for medicine in select value from jsonb_array_elements(coalesce(medicines_value,'[]'::jsonb)) loop
    insert into public.prescription_items(appointment_id,medicine_name,dosage,frequency,duration,quantity,entered_by)
      values(a.id,medicine->>'name',medicine->>'dosage',medicine->>'frequency',medicine->>'duration',(medicine->>'quantity')::integer,actor_id_value);
  end loop;
  for material in select value from jsonb_array_elements(coalesce(materials_value,'[]'::jsonb)) loop
    insert into public.clinical_material_usage(appointment_id,material_name,quantity,entered_by)
      values(a.id,material->>'name',(material->>'quantity')::integer,actor_id_value);
  end loop;
  return query select * from public.transition_clinic_appointment(a.id,null,null,'completed');
end $$;
revoke execute on function public.finalize_clinic_visit(uuid,uuid,text,text,text,text,boolean,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.finalize_clinic_visit(uuid,uuid,text,text,text,text,boolean,jsonb,jsonb) to service_role;

create or replace function public.complete_clinic_visit(appointment_id_value uuid, clinician_name_value text,
  summary_value text, diagnosis_value text, care_plan_value text, follow_up_value text, actor_id_value uuid)
returns setof public.appointments language plpgsql security definer set search_path = public as $$
begin raise exception 'Use department head finalization'; end $$;

create or replace function public.append_clinical_note_addendum(appointment_id_value uuid, actor_id_value uuid, content_value text)
returns setof public.clinical_note_addenda language plpgsql security definer set search_path = public as $$
declare actor public.app_users; a public.appointments; addendum public.clinical_note_addenda;
begin
  select * into a from public.appointments where id=appointment_id_value for update;
  if not found or a.status <> 'completed' then raise exception 'Only a completed visit can receive an addendum'; end if;
  select * into actor from public.app_users where id=actor_id_value;
  if not found or actor.role <> 'head' or actor.status <> 'active' or actor.doctor_id is null
    or not exists(select 1 from public.doctors d where d.id=actor.doctor_id and d.specialty_id=a.specialty_id)
    then raise exception 'Only the assigned department head can add a note'; end if;
  if char_length(trim(coalesce(content_value,''))) not between 10 and 4000 then raise exception 'Addendum must be 10 to 4000 characters'; end if;
  if not exists(select 1 from public.appointment_clinical_notes where appointment_id=a.id) then raise exception 'Visit note was not found'; end if;
  insert into public.clinical_note_addenda(appointment_id,entered_by,author_name,content)
    values(a.id,actor_id_value,coalesce(actor.full_name,(select full_name from public.doctors where id=actor.doctor_id)),trim(content_value))
    returning * into addendum;
  return next addendum;
end $$;
revoke execute on function public.append_clinical_note_addendum(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.append_clinical_note_addendum(uuid,uuid,text) to service_role;

create or replace function public.clinic_activity_report(from_date_value date, to_date_value date,
  specialty_id_value uuid default null, doctor_id_value uuid default null)
returns jsonb language sql security definer set search_path = public as $$
  with scope as (
    select id,appointment_date,patient_medical_profile_id,specialty_id,doctor_id,status from public.appointments
    where appointment_date between from_date_value and to_date_value
      and (specialty_id_value is null or specialty_id=specialty_id_value)
      and (doctor_id_value is null or doctor_id=doctor_id_value)
  ), totals as (
    select count(*) as appointments,count(distinct patient_medical_profile_id) as patients,
      count(*) filter(where status='completed') as completed,
      count(*) filter(where status='pending') as pending,
      count(*) filter(where status='confirmed') as confirmed,
      count(*) filter(where status='cancelled') as cancelled,
      count(*) filter(where status='no_show') as no_show from scope
  ), rx as (
    select count(*) as items,coalesce(sum(p.quantity),0) as quantity
    from public.prescription_items p join scope s on s.id=p.appointment_id where s.status='completed'
  ), material as (
    select count(*) as items,coalesce(sum(m.quantity),0) as quantity
    from public.clinical_material_usage m join scope s on s.id=m.appointment_id where s.status='completed'
  ), money as (
    select coalesce(sum(p.amount),0) as revenue from public.payments p
    join scope s on s.id=p.appointment_id where p.status='paid'
  )
  select jsonb_build_object(
    'appointments',(select appointments from totals),'patients',(select patients from totals),
    'completed',(select completed from totals),'prescriptionItems',(select items from rx),
    'appointmentStatuses',jsonb_build_object('pending',(select pending from totals),
      'confirmed',(select confirmed from totals),'completed',(select completed from totals),
      'cancelled',(select cancelled from totals),'no_show',(select no_show from totals)),
    'medicineQuantity',(select quantity from rx),'materialItems',(select items from material),
    'materialQuantity',(select quantity from material),'revenue',(select revenue from money),
    'bySpecialty',coalesce((select jsonb_agg(jsonb_build_object('specialtyId',g.specialty_id,
      'name',c.name,'appointments',g.appointments,'completed',g.completed) order by c.name)
      from (select specialty_id,count(*) as appointments,count(*) filter(where status='completed') as completed
        from scope group by specialty_id) g join public.clinic_specialties c on c.id=g.specialty_id),'[]'::jsonb),
    'byDoctor',coalesce((select jsonb_agg(jsonb_build_object('doctorId',g.doctor_id,
      'name',d.full_name,'encounters',g.encounters,'completed',g.completed,'avgMinutes',g.avg_minutes) order by d.full_name)
      from (select e.doctor_id,count(*) as encounters,count(*) filter(where e.status='completed') as completed,
          round(avg(extract(epoch from (e.completed_at-e.created_at))/60) filter(where e.completed_at is not null),1) as avg_minutes
        from public.clinical_encounters e join scope s on s.id=e.appointment_id
        where specialty_id_value is null or e.specialty_id=specialty_id_value group by e.doctor_id) g
        join public.doctors d on d.id=g.doctor_id),'[]'::jsonb),
    'byDate',coalesce((select jsonb_agg(jsonb_build_object('date',g.appointment_date,
      'appointments',g.appointments,'completed',g.completed) order by g.appointment_date)
      from (select appointment_date,count(*) as appointments,count(*) filter(where status='completed') as completed
        from scope group by appointment_date) g),'[]'::jsonb),
    'medicineBySpecialty',coalesce((select jsonb_agg(jsonb_build_object('name',c.name,'items',g.items,'quantity',g.quantity) order by c.name)
      from (select s.specialty_id,count(*) as items,sum(p.quantity) as quantity from public.prescription_items p
        join scope s on s.id=p.appointment_id where s.status='completed' group by s.specialty_id) g
        join public.clinic_specialties c on c.id=g.specialty_id),'[]'::jsonb),
    'medicineByDoctor',coalesce((select jsonb_agg(jsonb_build_object('name',d.full_name,'items',g.items,'quantity',g.quantity) order by d.full_name)
      from (select u.doctor_id,count(*) as items,sum(p.quantity) as quantity from public.prescription_items p
        join scope s on s.id=p.appointment_id join public.app_users u on u.id=p.entered_by
        where s.status='completed' and u.doctor_id is not null group by u.doctor_id) g
        join public.doctors d on d.id=g.doctor_id),'[]'::jsonb),
    'materialBySpecialty',coalesce((select jsonb_agg(jsonb_build_object('name',c.name,'items',g.items,'quantity',g.quantity) order by c.name)
      from (select s.specialty_id,count(*) as items,sum(m.quantity) as quantity from public.clinical_material_usage m
        join scope s on s.id=m.appointment_id where s.status='completed' group by s.specialty_id) g
        join public.clinic_specialties c on c.id=g.specialty_id),'[]'::jsonb),
    'materialByDoctor',coalesce((select jsonb_agg(jsonb_build_object('name',d.full_name,'items',g.items,'quantity',g.quantity) order by d.full_name)
      from (select u.doctor_id,count(*) as items,sum(m.quantity) as quantity from public.clinical_material_usage m
        join scope s on s.id=m.appointment_id join public.app_users u on u.id=m.entered_by
        where s.status='completed' and u.doctor_id is not null group by u.doctor_id) g
        join public.doctors d on d.id=g.doctor_id),'[]'::jsonb)
  );
$$;
revoke execute on function public.clinic_activity_report(date,date,uuid,uuid) from public, anon, authenticated;
grant execute on function public.clinic_activity_report(date,date,uuid,uuid) to service_role;
create or replace function public.guard_pending_paypal_cancellation()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'no_show' and old.status <> 'confirmed' then
    raise exception 'Only confirmed appointments can be marked absent';
  end if;
  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
    and exists (select 1 from public.payments p where p.appointment_id = old.id
      and p.provider = 'paypal' and p.status = 'pending') then
    raise exception 'PayPal payment is still pending reconciliation';
  end if;
  return new;
end $$;
drop trigger if exists guard_pending_paypal_cancellation on public.appointments;
create trigger guard_pending_paypal_cancellation before update of status on public.appointments
for each row execute function public.guard_pending_paypal_cancellation();
notify pgrst, 'reload schema';
commit;
