# MidHealth Supabase

Thu muc nay dung de thiet lap va dong bo database Supabase cho do an.

## Cac file chinh

- `schema.sql`: dinh nghia cau truc database hien tai, gom bang, view, function, trigger, index va RLS policy.
- `seed.sql`: du lieu khoi tao/mau cho chuyen khoa, benh vien, phong kham, bac si, dich vu va slot kham.
- `chatbot_optimization.sql`: bang rule trieu chung -> chuyen khoa va log tuong tac chatbot AI.
- `config.toml`: cau hinh Supabase CLI cho project local/remote.

## Cach quan ly database trong do an

Do an dung huong snapshot schema + seed:

- `schema.sql` la nguon chinh cho cau truc database hien tai. File nay phu hop de khoi tao nhanh database khi demo, bao ve do an hoac can reset moi.
- `seed.sql` la du lieu mau cot loi cho luong dat lich kham: chuyen khoa, co so y te, bac si, dich vu va slot kham.
- Cac script seed backend nhu `npm run seed:reference` va `npm run seed:health-news` dung cho cac tap du lieu lon/de cap nhat rieng.
- `config.toml` cau hinh `db reset` chay `schema.sql` truoc `seed.sql`.

Cach giai thich ngan khi bao ve:

> Em quan ly database theo huong snapshot schema. Toan bo cau truc hien tai nam trong `schema.sql`, du lieu mau nam trong `seed.sql` va cac script seed rieng. Cach nay giup em khoi tao lai database demo nhanh, tranh phai giai thich tung thay doi nho, nhung van dam bao schema co day du bang, khoa ngoai, index, trigger va RLS policy ma ung dung dang su dung.

## Luong khoi tao toi uu

Luong khoi tao database cua do an la:

1. `schema.sql`
2. `seed.sql`
3. script seed backend neu can

Bang `reference_data` dung de luu du lieu tham chieu dung chung cho frontend/backend, vi du:

- danh sach khu vuc/tinh thanh,
- danh sach dan toc,
- danh sach nghe nghiep,
- du lieu dia chi can cho form ho so va dat lich.

## Cach dung

Neu chay bang Supabase SQL Editor:

1. Chay `schema.sql`
2. Chay `seed.sql`
3. Chay `chatbot_optimization.sql` neu muon chatbot AI doc rule tu database va luu log hoi thoai.
4. Vao thu muc `backend`, chay cac script seed bo sung neu can:

```bash
npm run seed:reference
npm run seed:health-news
```

Neu chay local bang Supabase CLI:

```bash
supabase db reset
```

Trong `config.toml`, `db reset` duoc cau hinh de chay `schema.sql` + `seed.sql`. Sau do seed du lieu bo sung qua backend:

```bash
npm run seed:reference
npm run seed:health-news
```

Neu muon ap dung rieng phan toi uu chatbot len database remote, chay SQL trong `chatbot_optimization.sql` bang Supabase SQL Editor hoac lenh CLI phu hop voi project da link.

## Ghi chu

`schema.sql` da co schema tong the cho cac module chinh: tai khoan/phan quyen, ho so benh nhan, dat lich kham, thanh toan, du lieu tham chieu va Tin y te.

Trong pham vi do an/demo, workflow snapshot schema + seed la don gian va on dinh: chi can cap nhat `schema.sql` khi thay doi cau truc va cap nhat `seed.sql` hoac script seed khi thay doi du lieu mau.
