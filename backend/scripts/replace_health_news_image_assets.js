import { createWriteStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';

const outputDir = resolve(process.cwd(), '..', 'frontend', 'public', 'image_tin_y_te');
const metadataPath = resolve(outputDir, 'credits.json');

const replacements = [
  {
    file: 'sot-xuat-huyet-dau-hieu-canh-bao.jpg',
    topic: 'Sot xuat huyet va muoi truyen benh',
    sourceTitle: 'Aedes aegypti mosquito',
    sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=94549703',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/9/91/Aedes_aegypti_mosquito.jpg',
    license: 'by',
    author: 'Centers for Disease Control and Prevention',
    attribution: '"Aedes aegypti mosquito" is available under a Creative Commons Attribution license.',
  },
  {
    file: 'tram-cam-sau-sinh.jpg',
    topic: 'Tram cam sau sinh',
    sourceTitle: 'Postpartum baby2',
    sourceUrl: 'https://commons.wikimedia.org/w/index.php?curid=639667',
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/61/Postpartum_baby2.jpg',
    license: 'by-sa',
    author: 'Wikimedia Commons contributor',
    attribution: '"Postpartum baby2" is available under a Creative Commons Attribution-ShareAlike license.',
  },
  {
    file: 'he-mien-dich.jpg',
    topic: 'He mien dich',
    sourceTitle: 'T Regulatory Cells',
    sourceUrl: 'https://www.flickr.com/photos/132318516@N08/46951798801',
    imageUrl: 'https://live.staticflickr.com/7880/46951798801_f8cff5c46e_b.jpg',
    license: 'pdm',
    author: 'NIAID',
    attribution: '"T Regulatory Cells" is marked with Public Domain Mark 1.0.',
  },
  {
    file: 'giac-ngu-va-co-the.jpg',
    topic: 'Giac ngu va co the',
    sourceTitle: 'Man sleeping in bed',
    sourceUrl: 'https://www.flickr.com/photos/95329455@N02/25208888064',
    imageUrl: 'https://live.staticflickr.com/1677/25208888064_44db6788d2_b.jpg',
    license: 'by',
    author: 'Flickr Creative Commons contributor',
    attribution: '"Man sleeping in bed" is available under a Creative Commons Attribution license.',
  },
  {
    file: 'che-do-an-lanh-manh.jpg',
    topic: 'Che do an lanh manh',
    sourceTitle: 'Salad composee',
    sourceUrl: 'https://www.flickr.com/photos/97844767@N00/173689495',
    imageUrl: 'https://live.staticflickr.com/48/173689495_a345eaec99_b.jpg',
    license: 'by',
    author: 'WordRidden',
    attribution: '"Salad composee" is available under a Creative Commons Attribution license.',
  },
];

const downloadFile = async (url, targetPath) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'MidHealth image replacement downloader/1.0' },
  });

  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status}) for: ${url}`);
  }

  await pipeline(response.body, createWriteStream(targetPath));
};

const main = async () => {
  const credits = JSON.parse(await readFile(metadataPath, 'utf8'));
  const byFile = new Map(credits.map((credit) => [credit.file, credit]));

  for (const replacement of replacements) {
    const targetPath = resolve(outputDir, replacement.file);
    await downloadFile(replacement.imageUrl, targetPath);
    const { imageUrl, ...credit } = replacement;
    byFile.set(replacement.file, credit);
    console.log(`Replaced ${replacement.file} <- ${replacement.sourceTitle}`);
  }

  const sortedCredits = credits.map((credit) => byFile.get(credit.file) || credit);
  await writeFile(metadataPath, `${JSON.stringify(sortedCredits, null, 2)}\n`, 'utf8');
  console.log(`Updated ${metadataPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
