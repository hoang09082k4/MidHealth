import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(projectRoot, 'dist');
const indexFile = join(distDir, 'index.html');

const routes = [
  'admin',
  'dang-nhap',
  'dang-ky',
  'phieu-kham',
  'phieu-kham-dien-tu',
  'tai-khoan',
  'tai-khoan/lich-kham',
  'tai-khoan/thanh-toan',
  'tai-khoan/ho-so',
  'tai-khoan/thong-bao',
  'tai-khoan/bao-mat',
  'dat-kham',
  'dat-kham/bac-si',
  'dat-kham/benh-vien',
  'dat-kham/phong-kham',
  'dat-kham/chuyen-khoa',
  'dat-kham/tim-kiem',
  'tin-tuc',
  'tin-tuc/tim-kiem',
  'tin-tuc/doi-ngu-chuyen-gia',
  'tin-y-te',
  'tin-y-te/tim-kiem',
  'tin-y-te/doi-ngu-chuyen-gia',
  'tin-tu',
  'tin-tu/tim-kiem',
  'tin-tu/doi-ngu-chuyen-gia',
  'thong-tin/gioi-thieu',
  'thong-tin/huong-dan-dat-kham',
  'thong-tin/cau-hoi-thuong-gap',
  'thong-tin/lien-he',
  'thong-tin/dieu-khoan-su-dung',
  'thong-tin/chinh-sach-bao-mat',
  'thong-tin/chinh-sach-cookie',
  'thong-tin/thanh-toan-va-hoan-tien',
  'thong-tin/giai-quyet-khieu-nai',
  'thong-tin/mien-tru-trach-nhiem-y-khoa',
  'danh-cho-bac-si',
  'danh-cho-bac-si/dang-nhap',
  'danh-cho-bac-si/login',
  'danh-cho-bac-si/dang-ky',
  'danh-cho-bac-si/register',
  'danh-cho-bac-si/xac-thuc-otp',
  'danh-cho-bac-si/otp',
  'danh-cho-bac-si/thiet-lap',
  'danh-cho-bac-si/setup',
  'danh-cho-bac-si/ho-so',
  'danh-cho-bac-si/profile',
  'danh-cho-bac-si/chinh-sua-ho-so',
  'danh-cho-bac-si/edit',
  'danh-cho-bac-si/tong-quan',
  'danh-cho-bac-si/lich-hen',
  'danh-cho-bac-si/lich-lam-viec',
  'danh-cho-bac-si/dich-vu',
  'danh-cho-bac-si/tu-van',
  'danh-cho-bac-si/bao-cao',
  'doi-tac-y-te',
  'doi-tac-y-te/login',
  'bacsi',
  'bacsi/login',
];

if (!existsSync(indexFile)) {
  throw new Error(`Missing ${indexFile}. Run Vite build before creating SPA route fallbacks.`);
}

for (const fileName of ['404.html', '200.html']) {
  copyFileSync(indexFile, join(distDir, fileName));
}

for (const route of routes) {
  const routeIndex = join(distDir, route, 'index.html');
  mkdirSync(dirname(routeIndex), { recursive: true });
  copyFileSync(indexFile, routeIndex);
}

console.log(`Created SPA fallbacks for ${routes.length} routes.`);
