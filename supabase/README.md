# MidHealth Supabase

Thu muc nay dung de thiet lap va dong bo database Supabase cho do an.

## Cac file chinh

- `schema.sql`: dinh nghia cau truc database hien tai, gom bang, view, function, trigger, index va RLS policy.
- `seed.sql`: du lieu khoi tao/mau cho chuyen khoa, benh vien, phong kham, bac si, dich vu va slot kham.
- `migrations/`: lich su thay doi schema khi dung Supabase CLI.
- `config.toml`: cau hinh Supabase CLI cho project local/remote.

## Migration hien tai

- `migrations/20260601023000_create_shared_reference_data_table.sql`

File nay tao bang `public.reference_data`.

Bang `reference_data` dung de luu du lieu tham chieu dung chung cho frontend/backend, vi du:

- danh sach khu vuc/tinh thanh,
- danh sach dan toc,
- danh sach nghe nghiep,
- du lieu dia chi can cho form ho so va dat lich.

Ten file migration co dang:

`YYYYMMDDHHMMSS_mo_ta_thay_doi.sql`

Phan so dau la timestamp de Supabase CLI biet thu tu chay migration. Phan sau la mo ta noi dung thay doi.

## Cach dung

Neu chay bang Supabase SQL Editor:

1. Chay `schema.sql`
2. Chay `seed.sql`

Neu chay bang Supabase CLI:

```bash
supabase db push
```

Sau do seed du lieu tham chieu qua backend:

```bash
npm run seed:reference
```

## Ghi chu

`schema.sql` da co bang `reference_data` de nhin duoc schema tong the.

Migration van nen giu rieng vi Supabase CLI can no de dong bo thay doi database theo tung moc thoi gian. Khong nen xoa folder `migrations` neu project can nguoi khac cai dat lai database dung cach.
