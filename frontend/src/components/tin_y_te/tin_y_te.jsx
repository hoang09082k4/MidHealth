import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchHealthArticle,
  fetchHealthArticles,
  fetchHealthCategories,
  fetchHealthExperts,
  searchHealthArticles,
} from '../../lib/health_news';
import BieuTuongLogo from '../dung_chung/bieu_tuong_logo';

const DEFAULT_CATEGORY = 'suc-khoe-tong-quat';

const TEXT = {
  healthNews: 'Tin Y t\u1ebf',
  healthNewsLower: 'Tin y t\u1ebf',
  tagline: 'Ch\u00ednh th\u1ed1ng - Minh b\u1ea1ch - Trung l\u1eadp',
  magazineTitle: 'C\u1ea9m nang s\u1ee9c kh\u1ecfe y khoa',
  magazineIntro: 'Th\u00f4ng tin y t\u1ebf theo chuy\u00ean m\u1ee5c, d\u1ec5 \u0111\u1ecdc v\u00e0 c\u1eadp nh\u1eadt cho ng\u01b0\u1eddi d\u00f9ng.',
  search: 'T\u00ecm ki\u1ebfm',
  searchArticles: 'T\u00ecm ki\u1ebfm b\u00e0i vi\u1ebft y t\u1ebf...',
  searchDefault: 'T\u00ecm ki\u1ebfm b\u00e0i vi\u1ebft...',
  navLabel: '\u0110i\u1ec1u h\u01b0\u1edbng tin y t\u1ebf',
  homeAria: 'Trang ch\u1ee7 Tin y t\u1ebf',
  logoAria: 'Trang ch\u1ee7 Tin Y t\u1ebf MidHealth',
  more: 'Kh\u00e1c',
  latest: 'B\u00e0i vi\u1ebft m\u1edbi nh\u1ea5t',
  articleCount: 'b\u00e0i vi\u1ebft',
  loadingArticles: '\u0110ang t\u1ea3i b\u00e0i vi\u1ebft...',
  loadingDetail: '\u0110ang t\u1ea3i chi ti\u1ebft b\u00e0i vi\u1ebft...',
  emptyCategory: 'Ch\u01b0a c\u00f3 b\u00e0i vi\u1ebft trong chuy\u00ean m\u1ee5c n\u00e0y.',
  emptySearch: 'Kh\u00f4ng t\u00ecm th\u1ea5y b\u00e0i vi\u1ebft ph\u00f9 h\u1ee3p.',
  searching: '\u0110ang t\u00ecm ki\u1ebfm...',
  resultFor: 'K\u1ebft qu\u1ea3 cho',
  found: 'T\u00ecm th\u1ea5y',
  matchingResults: 'k\u1ebft qu\u1ea3 ph\u00f9 h\u1ee3p',
  posted: 'Ng\u00e0y \u0111\u0103ng',
  updated: 'C\u1eadp nh\u1eadt',
  author: 'T\u00e1c gi\u1ea3',
  content: 'N\u1ed9i dung b\u00e0i vi\u1ebft',
  related: 'B\u00e0i vi\u1ebft li\u00ean quan',
  backToNews: 'Quay l\u1ea1i Tin y t\u1ebf',
  experts: '\u0110\u1ed9i ng\u0169 chuy\u00ean gia',
  expertsCopy: 'H\u1ed9i \u0111\u1ed3ng tham v\u1ea5n y khoa c\u00f9ng \u0111\u1ed9i ng\u0169 bi\u00ean t\u1eadp vi\u00ean l\u00e0 c\u00e1c b\u00e1c s\u0129, d\u01b0\u1ee3c s\u0129 \u0111\u1ea3m b\u1ea3o n\u1ed9i dung ch\u00fang t\u00f4i cung c\u1ea5p ch\u00ednh x\u00e1c v\u1ec1 m\u1eb7t y khoa v\u00e0 c\u1eadp nh\u1eadt nh\u1eefng th\u00f4ng tin m\u1edbi nh\u1ea5t.',
  footerTitle: 'MidHealth Tin Y t\u1ebf',
  footerCopy: 'Th\u00f4ng tin s\u1ee9c kh\u1ecfe ch\u1ec9 d\u00f9ng \u0111\u1ec3 tham kh\u1ea3o, kh\u00f4ng thay th\u1ebf ch\u1ea9n \u0111o\u00e1n v\u00e0 \u0111i\u1ec1u tr\u1ecb tr\u1ef1c ti\u1ebfp t\u1eeb nh\u00e2n vi\u00ean y t\u1ebf.',
  profileName: 'ThS.BS Nguy\u1ec5n H\u1ed3ng V\u00e2n Kh\u00e1nh',
  editor: 'Bi\u00ean T\u1eadp Vi\u00ean',
  degree: 'H\u1ecdc h\u00e0m, h\u1ecdc v\u1ecb',
  degreeValue: 'Th\u1ea1c s\u0129, B\u00e1c s\u0129',
  specialty: 'Chuy\u00ean khoa',
  specialtyValue: 'Gan m\u1eadt t\u1ee5y - Gh\u00e9p gan, Nhi',
  currentRole: 'Ch\u1ee9c v\u1ee5 hi\u1ec7n t\u1ea1i',
  currentRoleValue: 'Ph\u00f3 khoa Gan m\u1eadt t\u1ee5y - Gh\u00e9p gan',
  workplace: 'N\u01a1i c\u00f4ng t\u00e1c',
  workplaceValue: 'B\u1ec7nh vi\u1ec7n Nhi \u0110\u1ed3ng 2 TP.HCM',
  intro: 'Gi\u1edbi thi\u1ec7u',
  education: 'H\u1ecdc v\u1ea5n',
  experience: 'Kinh nghi\u1ec7m',
  policy: 'Bi\u00ean t\u1eadp vi\u00ean v\u00e0 ch\u00ednh s\u00e1ch n\u1ed9i dung',
};

const CATEGORY_LABELS = {
  'suc-khoe-tong-quat': 'S\u1ee9c kh\u1ecfe t\u1ed5ng qu\u00e1t',
  'benh-thuong-gap': 'B\u1ec7nh th\u01b0\u1eddng g\u1eb7p',
  thuoc: 'Thu\u1ed1c',
  'dinh-duong': 'Dinh d\u01b0\u1ee1ng',
  'me-va-be': 'M\u1eb9 v\u00e0 b\u00e9',
  'suc-khoe-tinh-than': 'S\u1ee9c kh\u1ecfe tinh th\u1ea7n',
  'tin-y-te': 'Tin y t\u1ebf',
  'kinh-nghiem-di-kham': 'Kinh nghi\u1ec7m \u0111i kh\u00e1m',
  'duoc-lieu': 'D\u01b0\u1ee3c li\u1ec7u',
  benh: 'B\u1ec7nh',
  'co-the': 'C\u01a1 th\u1ec3',
};

const CATEGORY_PLACEHOLDERS = {
  'suc-khoe-tong-quat': 'T\u00ecm ch\u1ee7 \u0111\u1ec1 s\u1ee9c kh\u1ecfe...',
  'benh-thuong-gap': 'T\u00ecm b\u1ec7nh, tri\u1ec7u ch\u1ee9ng...',
  thuoc: 'T\u00ecm t\u00ean thu\u1ed1c, ho\u1ea1t ch\u1ea5t...',
  'dinh-duong': 'T\u00ecm dinh d\u01b0\u1ee1ng, th\u1ef1c \u0111\u01a1n...',
  'me-va-be': 'T\u00ecm ch\u0103m s\u00f3c m\u1eb9 v\u00e0 b\u00e9...',
  'suc-khoe-tinh-than': 'T\u00ecm stress, gi\u1ea5c ng\u1ee7...',
  'tin-y-te': 'T\u00ecm b\u1ea3n tin y t\u1ebf...',
  'kinh-nghiem-di-kham': 'T\u00ecm b\u1ec7nh vi\u1ec7n, quy tr\u00ecnh kh\u00e1m...',
  'duoc-lieu': 'T\u00ecm d\u01b0\u1ee3c li\u1ec7u...',
  benh: 'T\u00ecm t\u00ean b\u1ec7nh...',
  'co-the': 'T\u00ecm b\u1ed9 ph\u1eadn c\u01a1 th\u1ec3...',
};

const NEWS_CATEGORIES = [
  'suc-khoe-tong-quat',
  'benh-thuong-gap',
  'thuoc',
  'dinh-duong',
  'me-va-be',
  'suc-khoe-tinh-than',
  'tin-y-te',
  'kinh-nghiem-di-kham',
  'duoc-lieu',
  'benh',
  'co-the',
].map((slug) => ({ id: slug, slug, name: CATEGORY_LABELS[slug] }));

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN').format(new Date(value));
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase();
}

function slugifyText(value = '') {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function expertSlug(expert) {
  return slugifyText(typeof expert === 'string' ? expert : expert?.name || expert?.fullName || '')
    .replace(/^(ths-bs|thac-si-bac-si|duoc-si|bs|bac-si)-+/, '');
}

const EXPERT_PROFILE_DATA = [
  {
    slug: 'nguyen-hong-van-khanh',
    name: 'ThS.BS Nguyễn Hồng Vân Khánh',
    role: 'Biên tập viên',
    degree: 'Thạc sĩ, Bác sĩ',
    specialty: 'Gan mật tụy - Ghép gan, Nhi',
    bookingSpecialty: 'Nhi khoa',
    currentRole: 'Phó khoa Gan mật tụy - Ghép gan',
    workplace: 'Bệnh viện Nhi Đồng 2 TP.HCM',
    avatarUrl: '/image_doctor/6aec5f71595ed800814f.jpg',
    sourceUrl: 'https://youmed.vn/tin-tuc/bac-si/thac-si-bac-si-nguyen-hong-van-khanh/',
    intro: [
      'Bác sĩ Nguyễn Hồng Vân Khánh là bác sĩ chuyên khoa Nhi, có nền tảng đào tạo bác sĩ nội trú và thạc sĩ tại Đại học Y Dược TP.HCM. Hồ sơ chuyên môn tập trung vào chăm sóc trẻ em, gan mật tụy và ghép gan.',
      'Trong vai trò biên tập và tham vấn nội dung, bác sĩ ưu tiên cách diễn giải rõ ràng, giúp phụ huynh hiểu đúng những vấn đề thường gặp ở trẻ và biết khi nào cần đưa trẻ đi khám.'
    ],
    education: [
      'Bác sĩ nội trú, Đại học Y Dược TP.HCM, giai đoạn 2003 - 2009.',
      'Thạc sĩ, Bác sĩ nội trú, Đại học Y Dược TP.HCM, giai đoạn 2010 - 2013.'
    ],
    experience: [
      'Từ năm 2014: công tác tại Bệnh viện Nhi Đồng 2 TP.HCM.',
      'Tham gia biên tập, tham vấn các nội dung về Nhi khoa, tiêu hóa, gan mật tụy và chăm sóc sức khỏe trẻ em.'
    ],
    achievements: [
      'Có các ghi nhận thi đua và thành tích chuyên môn trong lĩnh vực nhi khoa, trong đó có hoạt động liên quan đến ghép gan nhi.'
    ]
  },
  {
    slug: 'dinh-thi-lan-phuong',
    name: 'ThS.BS Đinh Thị Lan Phương',
    role: 'Biên tập viên',
    degree: 'Thạc sĩ, Bác sĩ',
    specialty: 'Tai - Mũi - Họng',
    bookingSpecialty: 'Tai - Mũi - Họng',
    currentRole: 'Chi hội Trưởng Hội Thầy thuốc trẻ - Bệnh viện Bình Thạnh TP.HCM',
    workplace: 'Bệnh viện Bình Thạnh TP.HCM; PH Clinic; Victoria Healthcare; Bệnh viện FV',
    avatarUrl: '/image_doctor/6e11808d86a207fc5eb3.jpg',
    sourceUrl: 'https://youmed.vn/tin-tuc/bac-si/thac-si-bac-si-dinh-thi-lan-phuong/',
    intro: [
      'Bác sĩ Đinh Thị Lan Phương có chuyên môn Tai - Mũi - Họng, quan tâm đến việc đưa kiến thức y khoa phổ thông đến gần hơn với người bệnh.',
      'Các nội dung bác sĩ tham gia thường xoay quanh bệnh lý tai mũi họng thường gặp, nội soi chẩn đoán và hướng dẫn người bệnh theo dõi triệu chứng đúng cách.'
    ],
    education: [
      '2006 - 2012: Bác sĩ đa khoa, Trường Đại học Y Dược Huế.',
      '2013: Chứng chỉ định hướng chuyên khoa Tai Mũi Họng, Đại học Y Dược TP.HCM.',
      '2015 - 2017: Thạc sĩ chuyên ngành Tai Mũi Họng, Đại học Y Dược TP.HCM.',
      '2017: Chứng chỉ nội soi chẩn đoán bệnh lý, Đại học Y Dược TP.HCM.'
    ],
    experience: [
      'Cố vấn chuyên môn tại PH Clinic - Phòng khám Chuyên khoa Tai Mũi Họng.',
      'Có kinh nghiệm công tác tại Victoria Healthcare Việt Nam và hợp tác chuyên môn với Bệnh viện FV.',
      'Tham gia giảng dạy, chia sẻ kiến thức về các bệnh lý Tai - Mũi - Họng thường gặp.'
    ],
    achievements: [
      'Có đề tài nghiên cứu về đánh giá kết quả phẫu thuật nội soi u nền sọ trước trong chuyên ngành Tai - Mũi - Họng.'
    ]
  },
  {
    slug: 'vu-thanh-do',
    name: 'ThS.BS Vũ Thành Đô',
    role: 'Hội đồng tham vấn y khoa',
    degree: 'Thạc sĩ, Bác sĩ',
    specialty: 'Tim - Thận - Khớp - Nội tiết',
    bookingSpecialty: 'Nội tiết',
    currentRole: 'Trưởng khoa Cấp cứu',
    workplace: 'Bệnh viện Quân y 13, Quân khu 5',
    avatarUrl: '/image_doctor/790b4c984ab7cbe992a6.jpg',
    sourceUrl: 'https://youmed.vn/tin-tuc/bac-si/bac-si-vu-thanh-do/',
    intro: [
      'Bác sĩ Vũ Thành Đô được đào tạo trong môi trường quân y, chuyên sâu các vấn đề nội khoa liên quan đến tim mạch, thận, khớp và nội tiết.',
      'Vai trò tham vấn tập trung vào kiểm tra tính chính xác của thông tin y khoa, nhất là các nội dung về bệnh mạn tính, cấp cứu nội khoa và chuyển hóa.'
    ],
    education: [
      '2006 - 2013: Bác sĩ đa khoa, Học viện Quân y.',
      '2018 - 2021: Thạc sĩ chuyên ngành Nội chung, Học viện Quân y.',
      '2022: Đào tạo sơ bộ Hồi sức cấp cứu và Thận nhân tạo tại Bệnh viện Quân y 175.',
      '2022: Chứng nhận Advanced Cardiovascular Life Support.'
    ],
    experience: [
      'Bác sĩ điều trị khoa Nội chung, Bệnh viện Quân y 13.',
      'Tham gia hội đồng tham vấn y khoa trang tin y tế từ năm 2020.',
      'Từ năm 2022: Trưởng khoa Cấp cứu, Bệnh viện Quân y 13.'
    ],
    achievements: [
      'Có công trình nghiên cứu về vôi hóa động mạch chủ bụng ở người bệnh thận mạn giai đoạn cuối.'
    ]
  },
  {
    slug: 'phan-le-nam',
    name: 'ThS.BS Phan Lê Nam',
    role: 'Hội đồng tham vấn y khoa',
    degree: 'Thạc sĩ, Bác sĩ',
    specialty: 'Sản phụ khoa',
    bookingSpecialty: 'Sản phụ khoa',
    currentRole: 'Bác sĩ Sản phụ khoa',
    workplace: 'Bệnh viện Hữu nghị Việt Nam - Cuba Đồng Hới',
    avatarUrl: '/image_doctor/91270d870ba88af6d3b9.jpg',
    sourceUrl: 'https://youmed.vn/tin-tuc/bac-si/thac-si-bac-si-noi-tru-phan-le-nam/',
    intro: [
      'Bác sĩ Phan Lê Nam là bác sĩ Sản phụ khoa, được đào tạo bác sĩ nội trú và thường xuyên cập nhật kiến thức chuyên ngành.',
      'Hồ sơ tham vấn phù hợp với các nội dung về sức khỏe phụ nữ, thai kỳ, bệnh lý cổ tử cung và những vấn đề sản phụ khoa thường gặp.'
    ],
    education: [
      'Được đào tạo bác sĩ nội trú tại Trường Đại học Y Dược Huế.',
      'Hoàn thành chương trình sau đại học trong lĩnh vực Sản phụ khoa.'
    ],
    experience: [
      'Công tác trong lĩnh vực khám và điều trị Sản phụ khoa tại Bệnh viện Hữu nghị Việt Nam - Cuba Đồng Hới.',
      'Tham gia nghiên cứu, cập nhật kiến thức chuyên ngành và hỗ trợ đào tạo chuyên môn tuyến dưới.'
    ],
    achievements: [
      'Tham gia biên soạn và tham vấn nhiều nội dung về HPV, ung thư cổ tử cung, bệnh lý phụ khoa và chăm sóc mẹ bầu.'
    ]
  },
  {
    slug: 'duong-anh-hoang',
    name: 'Dược sĩ Dương Anh Hoàng',
    role: 'Biên tập viên',
    degree: 'Dược sĩ',
    specialty: 'Dược',
    bookingSpecialty: 'Dược',
    currentRole: 'Co-founder và Marketing Director',
    workplace: 'Công ty TNHH YouMed Việt Nam',
    avatarUrl: '/image_doctor/bfbae228e40765593c16.jpg',
    sourceUrl: 'https://youmed.vn/tin-tuc/bac-si/duoc-si-duong-anh-hoang/',
    intro: [
      'Dược sĩ Dương Anh Hoàng có nền tảng dược học và kinh nghiệm trong lĩnh vực dược phẩm trước khi tham gia xây dựng nền tảng thông tin y tế số.',
      'Trong mảng nội dung, dược sĩ phù hợp với các bài viết về thuốc, thực phẩm bổ sung, an toàn sử dụng thuốc và cách đọc thông tin dược phẩm cho người dùng phổ thông.'
    ],
    education: [
      '2006 - 2011: Dược sĩ đại học, Đại học Y Dược TP.HCM.'
    ],
    experience: [
      '2011 - 2012: Product Executive tại Roche.',
      '2012 - 2020: Product Specialist tại Sanofi.',
      'Từ năm 2017: tham gia điều hành và phát triển Công ty TNHH YouMed Việt Nam.'
    ],
    achievements: [
      'Tham gia xây dựng định hướng nội dung thuốc, dược liệu và thông tin sức khỏe dễ tiếp cận cho người dùng.'
    ]
  }
];

const EXPERT_PROFILES = new Map(EXPERT_PROFILE_DATA.map((profile) => [profile.slug, profile]));

function profileForExpert(expert) {
  return EXPERT_PROFILES.get(expertSlug(expert)) || null;
}

function decodeEntities(value = '') {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
}


function sanitizeHtml(value = '') {
  const decoded = decodeEntities(value);
  const doc = new DOMParser().parseFromString(decoded, 'text/html');
  const allowedTags = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'UL', 'OL', 'LI', 'H2', 'H3', 'H4', 'A', 'BLOCKQUOTE']);

  doc.body.querySelectorAll('*').forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const valueAttribute = attribute.value.toLowerCase();
      const isSafeHref = name === 'href' && !valueAttribute.startsWith('javascript:');
      if (!isSafeHref) node.removeAttribute(attribute.name);
    });
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noreferrer');
    }
  });

  return doc.body.innerHTML;
}

function normalizeArticle(article) {
  if (!article) return article;
  const categorySlug = article.category?.slug;
  return {
    ...article,
    category: article.category ? {
      ...article.category,
      name: CATEGORY_LABELS[categorySlug] || article.category.name,
    } : article.category,
  };
}

function mergeCategories(apiCategories = []) {
  const categoryMap = new Map(NEWS_CATEGORIES.map((category) => [category.slug, category]));
  apiCategories.forEach((category) => {
    if (!category?.slug) return;
    categoryMap.set(category.slug, {
      ...category,
      name: CATEGORY_LABELS[category.slug] || category.name,
    });
  });
  return [...categoryMap.values()];
}

function publishedArticles(articles = []) {
  return articles.filter((article) => article.status !== 'draft').sort((a, b) => new Date(b.publishedDate || b.updatedDate || 0) - new Date(a.publishedDate || a.updatedDate || 0));
}

function articleImage(article, className = 'health-image-placeholder') {
  const src = article?.thumbnailUrl || article?.thumbnail || article?.thumbnail_url || '';
  if (!src) return <div className={className} aria-hidden="true" />;
  return <img className={className} src={src} alt={decodeEntities(article?.title || '')} loading="lazy" />;
}

function HomeIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M4 10.8 12 4l8 6.8v8.7a.5.5 0 0 1-.5.5h-5v-5.8h-5V20h-5a.5.5 0 0 1-.5-.5v-8.7Z" /></svg>;
}

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M10.7 4a6.7 6.7 0 1 0 0 13.4 6.7 6.7 0 0 0 0-13.4Zm0 2a4.7 4.7 0 1 1 0 9.4 4.7 4.7 0 0 1 0-9.4Z" /><path d="m15.6 16.9 4 4a1 1 0 0 0 1.4-1.4l-4-4a1 1 0 1 0-1.4 1.4Z" /></svg>;
}

function ChevronDownIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false"><path d="M7.2 9.3a1 1 0 0 1 1.4 0L12 12.7l3.4-3.4a1 1 0 1 1 1.4 1.4l-4.1 4.1a1 1 0 0 1-1.4 0l-4.1-4.1a1 1 0 0 1 0-1.4Z" /></svg>;
}

function HealthSearchBar({ activeCategory = DEFAULT_CATEGORY, searchTerm, onSearchTermChange, onSubmit, portal = false }) {
  return (
    <form className={portal ? 'health-mag-search portal' : 'health-mag-search'} onSubmit={onSubmit}>
      <input value={searchTerm} onChange={(event) => onSearchTermChange(event.target.value)} placeholder={portal ? TEXT.searchArticles : CATEGORY_PLACEHOLDERS[activeCategory] || TEXT.searchDefault} />
      <button type="submit" aria-label={TEXT.search}><SearchIcon /></button>
    </form>
  );
}

function ArticleCard({ article, onOpen, className = 'health-mag-card' }) {
  const item = normalizeArticle(article);
  return (
    <button className={className} type="button" onClick={() => onOpen(item.slug)}>
      {articleImage(item)}
      <div>
        <span>{item.category?.name}</span>
        <h3>{decodeEntities(item.title)}</h3>
        <p>{decodeEntities(item.summary)}</p>
        <small>{item.author?.name || 'MidHealth'} {'\u00b7'} {formatDate(item.updatedDate || item.publishedDate)}</small>
      </div>
    </button>
  );
}

function HealthNav({ categories, activeCategory, onNewsHome, onChangeCategory }) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const primaryCategories = categories.slice(0, 7);
  const secondaryCategories = categories.slice(7);
  const hasActiveSecondary = secondaryCategories.some((category) => category.slug === activeCategory);

  useEffect(() => {
    if (!isMoreOpen) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!moreRef.current?.contains(event.target)) setIsMoreOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsMoreOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isMoreOpen]);

  const chooseCategory = (categorySlug) => {
    setIsMoreOpen(false);
    onChangeCategory(categorySlug);
  };

  return (
    <nav className="health-mag-nav" aria-label={TEXT.navLabel}>
      <button className="health-mag-home-icon" type="button" onClick={onNewsHome} aria-label={TEXT.homeAria}><HomeIcon /></button>
      {primaryCategories.map((category) => (
        <button className={category.slug === activeCategory ? 'active' : ''} type="button" key={category.slug} onClick={() => chooseCategory(category.slug)}>{category.name}</button>
      ))}
      {secondaryCategories.length ? (
        <div className={`health-mag-more${isMoreOpen ? ' open' : ''}`} ref={moreRef}>
          <button className={hasActiveSecondary ? 'active' : ''} type="button" aria-expanded={isMoreOpen} onClick={() => setIsMoreOpen((current) => !current)}>
            {TEXT.more} <ChevronDownIcon />
          </button>
          <div className="health-mag-more-menu">
            {secondaryCategories.map((category) => (
              <button className={category.slug === activeCategory ? 'active' : ''} type="button" key={category.slug} onClick={() => chooseCategory(category.slug)}>{category.name}</button>
            ))}
          </div>
        </div>
      ) : null}
    </nav>
  );
}

function HealthPortalHeader({ categories, activeCategory, onSiteHome, onNewsHome, onChangeCategory, onSearch }) {
  const [searchTerm, setSearchTerm] = useState('');
  const submitSearch = (event) => {
    event.preventDefault();
    const trimmed = searchTerm.trim();
    if (trimmed) onSearch(trimmed, activeCategory);
  };

  return (
    <header className="health-mag-header">
      <div className="health-mag-header-main">
        <button className="health-mag-logo" type="button" onClick={onSiteHome} aria-label="Về trang chủ MidHealth"><BieuTuongLogo /></button>
        <HealthSearchBar portal activeCategory={activeCategory} searchTerm={searchTerm} onSearchTermChange={setSearchTerm} onSubmit={submitSearch} />
      </div>
      <HealthNav categories={categories} activeCategory={activeCategory} onNewsHome={onNewsHome} onChangeCategory={onChangeCategory} />
    </header>
  );
}

function ExpertTeam({ experts, onOpenProfile, onOpenExpert, onOpenSpecialty }) {
  if (!experts.length) return null;
  const featuredExperts = experts.slice(0, 6);
  return (
    <section className="health-mag-experts-section">
      <h2>{TEXT.experts}</h2>
      <div className="health-mag-experts">
        <div className="health-mag-expert-grid">
          {featuredExperts.map((expert) => {
            const profile = profileForExpert(expert);
            const avatarUrl = profile?.avatarUrl || expert.avatarUrl;
            const profileSlug = profile?.slug || expertSlug(expert);
            const specialtyLabel = profile?.specialty || expert.specialty || expert.title || 'Y khoa';
            const bookingSpecialty = profile?.bookingSpecialty || specialtyLabel;
            return (
            <article className="health-mag-expert-card" key={expert.id || expert.name}>
              <button className="health-mag-expert-profile-link" type="button" onClick={() => onOpenExpert?.(profileSlug)}>
                <div>{avatarUrl ? <img src={avatarUrl} alt={profile?.name || expert.name} loading="lazy" /> : initials(profile?.name || expert.name)}</div>
              </button>
              <section>
                <button className="health-mag-expert-name-link" type="button" onClick={() => onOpenExpert?.(profileSlug)}>{profile?.name || expert.name}</button>
                {profile?.bookingSpecialty ? (
                  <button className="health-mag-expert-specialty-link" type="button" onClick={() => onOpenSpecialty?.({ name: bookingSpecialty })}>{specialtyLabel}</button>
                ) : (
                  <span>{specialtyLabel}</span>
                )}
              </section>
            </article>
            );
          })}
        </div>
        <div className="health-mag-experts-copy">
          <p>{TEXT.expertsCopy}</p>
          <button type="button" onClick={onOpenProfile}>{TEXT.experts} <span aria-hidden="true">{'\u203a'}</span></button>
        </div>
      </div>
    </section>
  );
}

function HealthListPage({ articles, categories, activeCategory, isLoading, onOpenArticle }) {
  const currentArticles = articles.map(normalizeArticle);
  const featured = currentArticles.find((article) => article.featured || article.isFeatured) || currentArticles[0];
  const latest = currentArticles.slice(0, 8);

  return (
    <main className="health-mag-page">
      <section className="health-mag-intro">
        <span>{TEXT.healthNewsLower}</span>
        <h1>{TEXT.magazineTitle}</h1>
        <p>{TEXT.magazineIntro}</p>
      </section>

      <section className="health-mag-front">
        {featured ? (
          <button className="health-mag-lead" type="button" onClick={() => onOpenArticle(featured.slug)}>
            {articleImage(featured)}
            <div>
              <span>{featured.category?.name}</span>
              <h2>{decodeEntities(featured.title)}</h2>
              <p>{decodeEntities(featured.summary)}</p>
              <small>{featured.author?.name || 'MidHealth'} {'\u00b7'} {TEXT.posted}: {formatDate(featured.publishedDate)}</small>
            </div>
          </button>
        ) : <p className="health-mag-state">{isLoading ? TEXT.loadingArticles : TEXT.emptyCategory}</p>}
        <div className="health-mag-front-side">
          {currentArticles.filter((article) => article.slug !== featured?.slug).slice(0, 2).map((article) => <ArticleCard article={article} key={article.slug} onOpen={onOpenArticle} className="health-mag-side-card" />)}
        </div>
      </section>

      <section className="health-mag-latest">
        <div className="health-mag-section-head">
          <div>
            <span>{TEXT.latest}</span>
            <h2>{categories.find((category) => category.slug === activeCategory)?.name || TEXT.healthNewsLower}</h2>
          </div>
          <small>{latest.length} {TEXT.articleCount}</small>
        </div>
        {isLoading ? <p className="health-mag-state">{TEXT.loadingArticles}</p> : (
          <div className="health-mag-grid">{latest.map((article) => <ArticleCard article={article} key={article.slug || article.id} onOpen={onOpenArticle} />)}</div>
        )}
      </section>
    </main>
  );
}

function HealthSearchPage({ keyword, category, results, isLoading, onOpenArticle }) {
  const localResults = results.map(normalizeArticle);
  return (
    <main className="health-mag-page">
      <section className="health-mag-result-head compact">
        <span>{TEXT.search}</span>
        <h1>{TEXT.resultFor} &quot;{keyword}&quot;</h1>
        <p>{isLoading ? TEXT.searching : `${TEXT.found} ${localResults.length} ${TEXT.matchingResults}`}</p>
      </section>
      {!isLoading && localResults.length === 0 ? <p className="health-mag-state">{TEXT.emptySearch}</p> : (
        <div className="health-mag-result-list">
          {localResults.map((article) => <button className="health-mag-result-item" type="button" key={article.slug || article.id} onClick={() => onOpenArticle(article.slug)}>{articleImage(article)}<div><span>{article.category?.name}</span><h2>{decodeEntities(article.title)}</h2><p>{decodeEntities(article.summary)}</p><small>{article.author?.name || 'MidHealth'} {'\u00b7'} {TEXT.updated}: {formatDate(article.updatedDate || article.publishedDate)}</small></div></button>)}
        </div>
      )}
    </main>
  );
}

function ExpertDirectoryPage({ onOpenExpert }) {
  return (
    <main className="health-expert-directory-page">
      <section className="health-mag-intro compact">
        <span>{TEXT.experts}</span>
        <h1>Hội đồng tham vấn y khoa</h1>
        <p>Hội đồng tham vấn y khoa của MidHealth gồm các bác sĩ, dược sĩ và chuyên gia y tế tham gia rà soát nội dung trước khi xuất bản, giúp thông tin sức khỏe chính xác, dễ hiểu và có trách nhiệm với người đọc.</p>
        <div className="health-expert-council-note">
          <h2>Hội đồng tham vấn y khoa hoạt động như thế nào?</h2>
          <p>Mỗi bài viết y tế cần được kiểm tra theo chuyên môn phù hợp: thuốc do dược sĩ rà soát, bệnh học và chăm sóc sức khỏe do bác sĩ chuyên khoa tham vấn, còn các nội dung hướng dẫn đi khám được đối chiếu với quy trình thực tế.</p>
          <p>Khi phát hiện điểm chưa rõ, thiếu cập nhật hoặc dễ gây hiểu nhầm, chuyên gia sẽ đề xuất chỉnh sửa để đội ngũ biên tập hoàn thiện bài viết. Mục tiêu là giữ nội dung trung lập, minh bạch, có nguồn tham khảo và không thay thế chẩn đoán trực tiếp từ nhân viên y tế.</p>
        </div>
      </section>
      <div className="health-expert-directory-grid">
        {EXPERT_PROFILE_DATA.map((profile) => (
          <button className="health-expert-directory-card" type="button" key={profile.slug} onClick={() => onOpenExpert(profile.slug)}>
            <img src={profile.avatarUrl} alt={profile.name} loading="lazy" />
            <div>
              <span>{profile.role}</span>
              <h2>{profile.name}</h2>
              <p>{profile.specialty}</p>
              <small>{profile.workplace}</small>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}

function ExpertProfilePage({ slug, onOpenExpert, onBookSpecialty }) {
  const profile = EXPERT_PROFILES.get(slug) || null;
  if (!profile) return <ExpertDirectoryPage onOpenExpert={onOpenExpert} />;

  const renderList = (items = []) => items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : null;

  return (
    <main className="health-expert-profile-page">
      <nav className="health-mag-breadcrumb" aria-label="Breadcrumb">
        <button type="button" onClick={() => onOpenExpert?.('')}>{TEXT.experts}</button>
        <span>/</span>
        <span>{profile.name}</span>
      </nav>
      <section className="health-expert-profile-hero">
        <img className="health-expert-profile-photo" src={profile.avatarUrl} alt={profile.name} loading="lazy" />
        <div className="health-expert-profile-summary">
          <h1>{profile.name}</h1>
          <strong>{profile.role}</strong>
          <dl>
            <div><dt>{TEXT.degree}</dt><dd>{profile.degree}</dd></div>
            <div>
              <dt>{TEXT.specialty}</dt>
              <dd>
                {profile.bookingSpecialty ? (
                  <button className="health-expert-profile-specialty" type="button" onClick={() => onBookSpecialty?.({ name: profile.bookingSpecialty })}>{profile.specialty}</button>
                ) : profile.specialty}
              </dd>
            </div>
            {profile.currentRole ? <div><dt>{TEXT.currentRole}</dt><dd>{profile.currentRole}</dd></div> : null}
            <div><dt>{TEXT.workplace}</dt><dd>{profile.workplace}</dd></div>
          </dl>
        </div>
      </section>
      <article className="health-expert-profile-content">
        <h2>{TEXT.intro}</h2>
        {profile.intro.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        <h2>{TEXT.education}</h2>
        {renderList(profile.education)}
        <h2>{TEXT.experience}</h2>
        {renderList(profile.experience)}
        {profile.achievements?.length ? (
          <>
            <h2>Giải thưởng và công trình</h2>
            {renderList(profile.achievements)}
          </>
        ) : null}
        <h2>{TEXT.policy}</h2>
        <p>Đội ngũ chuyên gia của MidHealth tham gia rà soát nội dung theo chuyên môn, giúp bài viết rõ ràng, cập nhật và có trách nhiệm với người đọc. Thông tin hồ sơ được tổng hợp và viết lại từ nguồn công khai, dùng để hoàn thiện trải nghiệm tin y tế trong dự án.</p>
        <p><a href={profile.sourceUrl} target="_blank" rel="noreferrer">Nguồn tham khảo hồ sơ chuyên gia</a></p>
      </article>
    </main>
  );
}

function HealthDetailPage({ article, relatedArticles, isLoading, onBackToList, onOpenArticle }) {
  const item = normalizeArticle(article);
  const safeContent = useMemo(() => sanitizeHtml(item?.content || ''), [item]);
  if (isLoading) return <p className="health-mag-state detail">{TEXT.loadingDetail}</p>;
  if (!item) return <main className="health-mag-page"><p className="health-mag-state">{TEXT.emptySearch}</p><button className="health-mag-back" type="button" onClick={onBackToList}>{TEXT.backToNews}</button></main>;

  return (
    <main className="health-mag-detail-shell">
      <article className="health-mag-detail">
        <nav className="health-mag-breadcrumb" aria-label="Breadcrumb"><button type="button" onClick={onBackToList}>{TEXT.healthNewsLower}</button><span>/</span><button type="button" onClick={onBackToList}>{item.category?.name || TEXT.healthNewsLower}</button></nav>
        <span className="health-mag-detail-category">{item.category?.name}</span>
        <h1>{decodeEntities(item.title)}</h1>
        <p className="health-mag-detail-summary">{decodeEntities(item.summary)}</p>
        {articleImage(item, 'health-mag-detail-image health-image-placeholder')}
        <div className="health-mag-toc"><strong>{TEXT.content}</strong><span>{'\u2637'}</span></div>
        <div className="health-mag-content" dangerouslySetInnerHTML={{ __html: safeContent }} />
      </article>
      <aside className="health-mag-related"><h2>{TEXT.related}</h2>{relatedArticles.map((related) => <button type="button" key={related.slug} onClick={() => onOpenArticle(related.slug)}>{articleImage(related)}<span>{normalizeArticle(related).category?.name}</span><strong>{decodeEntities(related.title)}</strong></button>)}</aside>
    </main>
  );
}

export function MucTinYTeTrangChu({ onNavigate, onSelectSpecialty }) {
  const [activeCategory, setActiveCategory] = useState(DEFAULT_CATEGORY);
  const [articles, setArticles] = useState([]);
  const [experts, setExperts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let isMounted = true;
    fetchHealthExperts().then((expertData) => { if (isMounted) setExperts(expertData); }).catch(() => { if (isMounted) setExperts([]); });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    fetchHealthArticles({ category: activeCategory, limit: 8 }).then((data) => { if (isMounted) setArticles((data || []).map(normalizeArticle)); }).catch(() => { if (isMounted) setArticles([]); }).finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, [activeCategory]);

  const submitSearch = (event) => {
    event.preventDefault();
    const trimmed = searchTerm.trim();
    if (trimmed) onNavigate?.({ name: 'search', keyword: trimmed, category: activeCategory });
  };

  const homeTabs = [
    { label: CATEGORY_LABELS.thuoc, category: 'thuoc' },
    { label: CATEGORY_LABELS['duoc-lieu'], category: 'duoc-lieu' },
    { label: CATEGORY_LABELS.benh, category: 'benh' },
    { label: CATEGORY_LABELS['co-the'], category: 'co-the' },
  ];
  const currentArticles = articles;

  return (
    <section className="health-home-magazine" id="news">
      <div className="health-home-title"><h2>{TEXT.healthNews}</h2><p>{TEXT.tagline}</p></div>
      <div className="health-home-band"><div className="health-home-inner"><div className="health-home-toolbar"><div className="health-home-topic-tabs" role="tablist" aria-label="Danh mục tin y tế nổi bật">{homeTabs.map((tab) => <button type="button" className={tab.category === activeCategory ? 'active' : ''} key={tab.label} onClick={() => setActiveCategory(tab.category)}>{tab.label}</button>)}</div><HealthSearchBar activeCategory={activeCategory} searchTerm={searchTerm} onSearchTermChange={setSearchTerm} onSubmit={submitSearch} /></div>{isLoading ? <p className="health-mag-state">{TEXT.loadingArticles}</p> : <div className="health-home-rail" aria-label="Danh sách bài viết tin y tế">{currentArticles.slice(0, 8).map((article) => <ArticleCard article={article} key={article.slug || article.id} onOpen={(slug) => onNavigate?.({ name: 'detail', slug })} />)}</div>}</div></div>
      <ExpertTeam
        experts={experts}
        onOpenProfile={() => onNavigate?.({ name: 'expert-profile' })}
        onOpenExpert={(slug) => onNavigate?.({ name: 'expert-profile', slug })}
        onOpenSpecialty={onSelectSpecialty}
      />
    </section>
  );
}

function MucTinYTe({ route = { name: 'list' }, onNavigate, onHome, onBookSpecialty }) {
  const [categories, setCategories] = useState(NEWS_CATEGORIES);
  const [activeCategory, setActiveCategory] = useState(route.category || DEFAULT_CATEGORY);
  const [articles, setArticles] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [currentArticle, setCurrentArticle] = useState(null);
  const [relatedArticles, setRelatedArticles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const routeCategory = route.category || activeCategory || DEFAULT_CATEGORY;

  useEffect(() => {
    if (route.name === 'expert-profile') window.scrollTo({ top: 0, behavior: 'auto' });
  }, [route.name, route.slug]);

  useEffect(() => {
    let isMounted = true;
    fetchHealthCategories().then((categoryData) => { if (isMounted) setCategories(mergeCategories(categoryData)); }).catch(() => { if (isMounted) setCategories(NEWS_CATEGORIES); });
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (route.name === 'detail') return;
    if (routeCategory !== activeCategory) setActiveCategory(routeCategory);
  }, [route.name, routeCategory, activeCategory]);

  useEffect(() => {
    if (route.name !== 'list') return;
    let isMounted = true;
    setIsLoading(true);
    fetchHealthArticles({ category: routeCategory, limit: 24 }).then((data) => { if (isMounted) setArticles((data || []).map(normalizeArticle)); }).catch(() => { if (isMounted) setArticles([]); }).finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, [routeCategory, route.name]);

  useEffect(() => {
    if (route.name !== 'search') return;
    let isMounted = true;
    setIsLoading(true);
    searchHealthArticles({ keyword: route.keyword, category: routeCategory, limit: 30 }).then((data) => { if (isMounted) setSearchResults((data || []).map(normalizeArticle)); }).catch(() => { if (isMounted) setSearchResults([]); }).finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, [routeCategory, route.keyword, route.name]);

  useEffect(() => {
    if (route.name !== 'detail' || !route.slug) return;
    let isMounted = true;
    setIsLoading(true);
    fetchHealthArticle(route.slug).then((data) => {
      if (!isMounted) return;
      const article = normalizeArticle(data || null);
      setCurrentArticle(article);
      setActiveCategory(article?.category?.slug || DEFAULT_CATEGORY);
      if (!article?.category?.slug) {
        setRelatedArticles([]);
        return;
      }
      fetchHealthArticles({ category: article.category.slug, limit: 5 })
        .then((items) => {
          if (isMounted) setRelatedArticles((items || []).map(normalizeArticle).filter((item) => item.slug !== article.slug).slice(0, 4));
        })
        .catch(() => {
          if (isMounted) setRelatedArticles([]);
        });
    }).catch(() => {
      if (!isMounted) return;
      setCurrentArticle(null);
      setActiveCategory(DEFAULT_CATEGORY);
      setRelatedArticles([]);
    }).finally(() => { if (isMounted) setIsLoading(false); });
    return () => { isMounted = false; };
  }, [route.name, route.slug]);

  const navigate = (nextRoute) => { window.scrollTo({ top: 0, behavior: 'smooth' }); onNavigate(nextRoute); };
  const changeCategory = (categorySlug) => { setActiveCategory(categorySlug); navigate(route.name === 'search' ? { name: 'search', keyword: route.keyword || '', category: categorySlug } : { name: 'list', category: categorySlug }); };
  const submitSearch = (keyword, categorySlug = activeCategory) => { const trimmed = keyword.trim(); if (trimmed) navigate({ name: 'search', keyword: trimmed, category: categorySlug }); };
  const openNewsHome = () => navigate({ name: 'list', category: DEFAULT_CATEGORY });

  return (
    <div className="health-mag-shell">
      <HealthPortalHeader categories={categories} activeCategory={activeCategory} onSiteHome={onHome || openNewsHome} onNewsHome={openNewsHome} onChangeCategory={changeCategory} onSearch={submitSearch} />
      {route.name === 'detail' ? <HealthDetailPage article={currentArticle} relatedArticles={relatedArticles} isLoading={isLoading} onBackToList={() => navigate({ name: 'list', category: activeCategory })} onOpenArticle={(slug) => navigate({ name: 'detail', slug })} /> : route.name === 'expert-profile' ? <ExpertProfilePage slug={route.slug} onOpenExpert={(slug) => navigate(slug ? { name: 'expert-profile', slug } : { name: 'expert-profile' })} onBookSpecialty={onBookSpecialty} /> : route.name === 'search' ? <HealthSearchPage keyword={route.keyword || ''} category={routeCategory} results={searchResults} isLoading={isLoading} onOpenArticle={(slug) => navigate({ name: 'detail', slug })} /> : <HealthListPage articles={articles} categories={categories} activeCategory={activeCategory} isLoading={isLoading} onOpenArticle={(slug) => navigate({ name: 'detail', slug })} />}
    </div>
  );
}

export default MucTinYTe;
