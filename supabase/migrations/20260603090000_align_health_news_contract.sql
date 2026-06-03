alter table public.health_authors
  add column if not exists full_name text,
  add column if not exists avatar_url text,
  add column if not exists bio text;

alter table public.health_experts
  add column if not exists full_name text,
  add column if not exists avatar_url text;

alter table public.health_articles
  add column if not exists thumbnail_url text,
  add column if not exists published_at timestamptz,
  add column if not exists is_featured boolean not null default false;

update public.health_authors
set full_name = coalesce(full_name, name),
    avatar_url = coalesce(avatar_url, avatar),
    bio = coalesce(bio, description);

update public.health_experts
set full_name = coalesce(full_name, name),
    avatar_url = coalesce(avatar_url, avatar);

update public.health_articles
set thumbnail_url = coalesce(thumbnail_url, thumbnail),
    published_at = coalesce(published_at, published_date);

update public.health_articles
set is_featured = slug in (
  'thuoc-saxenda-thanh-phan-cong-dung-cach-dung-an-toan',
  'thuoc-ozempic-thanh-phan-cong-dung-luu-y',
  'kham-phu-khoa-la-gi-kham-nhung-gi',
  'tinh-dau-sa-cong-dung-cach-dung-luu-y',
  'tim-hieu-he-noi-tiet-cua-co-the'
);

alter table public.health_authors
  alter column full_name set not null;

alter table public.health_experts
  alter column full_name set not null;

alter table public.health_articles
  alter column thumbnail_url set not null,
  alter column published_at set not null;

create index if not exists health_articles_published_at_idx
on public.health_articles(published_at desc);

create index if not exists health_articles_featured_idx
on public.health_articles(is_featured, published_at desc)
where status = 'published';
