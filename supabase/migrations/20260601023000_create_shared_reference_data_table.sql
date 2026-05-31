create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.reference_data (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

alter table public.reference_data enable row level security;

drop policy if exists "public can read reference data" on public.reference_data;
create policy "public can read reference data"
on public.reference_data for select
using (true);

grant select on public.reference_data to anon, authenticated;

drop trigger if exists set_reference_data_updated_at on public.reference_data;
create trigger set_reference_data_updated_at
before update on public.reference_data
for each row execute function public.set_updated_at();
