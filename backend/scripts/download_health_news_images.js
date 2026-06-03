import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

const outputDir = resolve(process.cwd(), '..', 'frontend', 'public', 'image_tin_y_te');
const metadataPath = resolve(outputDir, 'credits.json');
const startFrom = process.argv[2] || '';

const imageJobs = [
  {
    file: 'tang-huyet-ap-kiem-tra-dinh-ky.jpg',
    query: 'blood pressure measurement sphygmomanometer',
    title: 'Do huyet ap va kiem tra suc khoe dinh ky',
  },
  {
    file: 'van-dong-the-chat-nguoi-lon.jpg',
    query: ['adults physical activity walking exercise', 'people walking exercise', 'walking for health'],
    title: 'Van dong the chat cho nguoi lon',
  },
  {
    file: 'sot-xuat-huyet-dau-hieu-canh-bao.jpg',
    query: ['Aedes aegypti mosquito dengue', 'Aedes aegypti', 'dengue mosquito'],
    title: 'Sot xuat huyet va muoi truyen benh',
  },
  {
    file: 'dai-thao-duong-type-2.jpg',
    query: ['diabetes blood glucose meter', 'blood glucose meter', 'diabetes test'],
    title: 'Theo doi duong huyet trong dai thao duong type 2',
  },
  {
    file: 'paracetamol-cach-dung-an-toan.jpg',
    query: ['acetaminophen tablets paracetamol medicine', 'paracetamol tablets', 'acetaminophen pills'],
    title: 'Paracetamol va cach dung an toan',
  },
  {
    file: 'ibuprofen-luu-y-su-dung.jpg',
    query: ['ibuprofen tablets medicine', 'ibuprofen pills', 'medicine tablets'],
    title: 'Ibuprofen va cac luu y khi su dung',
  },
  {
    file: 'che-do-an-lanh-manh.jpg',
    query: ['healthy diet vegetables fruit plate', 'healthy food plate', 'vegetables fruit healthy diet'],
    title: 'Che do an lanh manh',
  },
  {
    file: 'chi-so-bmi-can-nang.jpg',
    query: ['weighing scale tape measure', 'bathroom scale', 'waist circumference measuring tape', 'obesity waist circumference'],
    title: 'Chi so BMI va can nang',
  },
  {
    file: 'kham-thai-lan-dau.jpg',
    query: ['pregnancy prenatal care ultrasound doctor', 'prenatal care ultrasound', 'pregnant woman doctor'],
    title: 'Kham thai lan dau',
  },
  {
    file: 'tram-cam-sau-sinh.jpg',
    query: ['postpartum depression mother baby', 'mother baby sadness', 'postpartum mother baby'],
    title: 'Tram cam sau sinh',
  },
  {
    file: 'tram-cam-dau-hieu.jpg',
    query: ['depression mental health woman', 'sad woman mental health', 'depression illustration'],
    title: 'Dau hieu tram cam',
  },
  {
    file: 'roi-loan-lo-au.jpg',
    query: ['anxiety mental health stress', 'stress anxiety woman', 'anxiety illustration'],
    title: 'Roi loan lo au',
  },
  {
    file: 'khong-tu-dung-khang-sinh.jpg',
    query: ['antibiotic pills medicine', 'antibiotics medicine', 'medicine pills'],
    title: 'Khong tu dung khang sinh',
  },
  {
    file: 'tiem-chung-phong-benh.jpg',
    query: ['vaccination vaccine injection', 'vaccine injection', 'vaccination'],
    title: 'Tiem chung phong benh',
  },
  {
    file: 'kinh-nghiem-kham-tong-quat.jpg',
    query: ['doctor medical checkup stethoscope', 'medical checkup doctor', 'doctor stethoscope patient'],
    title: 'Kinh nghiem kham tong quat',
  },
  {
    file: 'dau-hieu-can-di-cap-cuu.jpg',
    query: ['emergency department hospital ambulance', 'hospital emergency department', 'ambulance emergency'],
    title: 'Dau hieu can di cap cuu',
  },
  {
    file: 'gung-duoc-lieu.jpg',
    query: ['ginger root', 'ginger rhizome', 'Zingiber officinale'],
    title: 'Gung duoc lieu',
  },
  {
    file: 'nghe-curcumin-duoc-lieu.jpg',
    query: ['turmeric curcumin rhizome', 'turmeric root', 'Curcuma longa'],
    title: 'Nghe curcumin duoc lieu',
  },
  {
    file: 'mat-ngu-nguyen-nhan.jpg',
    query: ['insomnia sleep disorder bed', 'insomnia woman bed', 'sleep disorder'],
    title: 'Mat ngu va nguyen nhan',
  },
  {
    file: 'hen-suyen-kiem-soat-kem.jpg',
    query: ['asthma inhaler', 'inhaler asthma', 'metered dose inhaler'],
    title: 'Hen suyen va ong hit',
  },
  {
    file: 'he-mien-dich.jpg',
    query: ['immune system white blood cells', 'white blood cells', 'lymphocyte immune system'],
    title: 'He mien dich',
  },
  {
    file: 'giac-ngu-va-co-the.jpg',
    query: ['sleeping person bed', 'sleep bed', 'sleeping woman bed'],
    title: 'Giac ngu va co the',
  },
];

const reusableLicenses = ['cc0', 'pdm', 'by', 'by-sa'];

const apiEndpoint = 'https://api.openverse.engineering/v1/images/';

const stripHtml = (value = '') => value.replace(/<[^>]*>/g, '').trim();
const sleep = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

const imageSearch = async (search) => {
  const params = new URLSearchParams({
    q: search,
    license_type: 'commercial',
    extension: 'jpg',
    page_size: '12',
  });

  let response;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    response = await fetch(`${apiEndpoint}?${params.toString()}`, {
      headers: { 'User-Agent': 'MidHealth image asset downloader/1.0 (local development asset setup)' },
    });

    if (response.ok) {
      break;
    }

    if (attempt < 4 && [429, 500, 502, 503, 504].includes(response.status)) {
      await sleep(1500 * attempt);
      continue;
    }

    break;
  }

  if (!response.ok) {
    throw new Error(`Openverse search failed (${response.status}) for: ${search}`);
  }

  const data = await response.json();
  return (data.results ?? [])
    .filter((item) => item.url && item.license)
    .filter((item) => reusableLicenses.includes(String(item.license).toLowerCase()))
    .map((item) => ({
      title: item.title || item.id,
      info: {
        url: item.url,
        thumburl: item.thumbnail || item.url,
        descriptionurl: item.foreign_landing_url || item.url,
      },
      metadata: {
        LicenseShortName: {
          value: item.license_version ? `${item.license} ${item.license_version}` : item.license,
        },
        Artist: { value: item.creator || item.provider || '' },
        Attribution: { value: item.attribution || '' },
      },
    }));
};

const downloadFile = async (url, targetPath) => {
  let response;

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    response = await fetch(url, {
      headers: { 'User-Agent': 'MidHealth image asset downloader/1.0 (local development asset setup)' },
    });

    if (response.ok && response.body) {
      break;
    }

    if (attempt < 4 && [429, 500, 502, 503, 504].includes(response.status)) {
      await sleep(1200 * attempt);
      continue;
    }

    break;
  }

  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status}) for: ${url}`);
  }

  await mkdir(dirname(targetPath), { recursive: true });
  await pipeline(response.body, createWriteStream(targetPath));
};

const main = async () => {
  await mkdir(outputDir, { recursive: true });
  const credits = [];
  const startIndex = startFrom
    ? imageJobs.findIndex((job) => job.file === startFrom || job.file.startsWith(startFrom))
    : 0;

  if (startIndex < 0) {
    throw new Error(`Unknown start image: ${startFrom}`);
  }

  for (const job of imageJobs.slice(startIndex)) {
    const queries = Array.isArray(job.query) ? job.query : [job.query];
    let selected = null;

    for (const query of queries) {
      const matches = await imageSearch(query);
      selected = matches[0];
      if (selected) {
        break;
      }
    }

    if (!selected) {
      throw new Error(`No acceptable Openverse image found for: ${queries.join(' | ')}`);
    }

    const url = selected.info.url || selected.info.thumburl;
    const targetPath = resolve(outputDir, job.file);
    await downloadFile(url, targetPath);

    credits.push({
      file: job.file,
      topic: job.title,
      sourceTitle: selected.title,
      sourceUrl: selected.info.descriptionurl,
      license: stripHtml(selected.metadata.LicenseShortName?.value || ''),
      author: stripHtml(selected.metadata.Artist?.value || ''),
      attribution: stripHtml(selected.metadata.Attribution?.value || ''),
    });

    console.log(`Downloaded ${job.file} <- ${selected.title}`);
    await sleep(2200);
  }

  await writeFile(metadataPath, `${JSON.stringify(credits, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${metadataPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
