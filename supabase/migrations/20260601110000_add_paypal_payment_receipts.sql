alter table public.appointments add column if not exists insurance_used boolean not null default false;
alter table public.appointments add column if not exists insurance_type text;
alter table public.appointments add column if not exists insurance_rate numeric(5, 4) not null default 0;
alter table public.appointments add column if not exists original_amount numeric(12, 2) not null default 0;
alter table public.appointments add column if not exists insurance_discount numeric(12, 2) not null default 0;
alter table public.appointments add column if not exists final_amount numeric(12, 2) not null default 0;
alter table public.appointments add column if not exists payment_status text not null default 'unpaid';

alter table public.payments add column if not exists provider text;
alter table public.payments add column if not exists paypal_order_id text;
alter table public.payments add column if not exists paypal_capture_id text;
alter table public.payments add column if not exists receipt_number text;
alter table public.payments add column if not exists raw_payload jsonb;

create unique index if not exists payments_paypal_order_id_unique_idx
on public.payments(paypal_order_id)
where paypal_order_id is not null;

create unique index if not exists payments_receipt_number_unique_idx
on public.payments(receipt_number)
where receipt_number is not null;

create index if not exists payments_appointment_id_idx
on public.payments(appointment_id);
