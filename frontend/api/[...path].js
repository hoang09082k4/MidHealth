const categories = [
  { id: 'suc-khoe-tong-quat', name: 'Suc khoe tong quat', slug: 'suc-khoe-tong-quat', status: 'active' },
  { id: 'benh-thuong-gap', name: 'Benh thuong gap', slug: 'benh-thuong-gap', status: 'active' },
  { id: 'thuoc', name: 'Thuoc', slug: 'thuoc', status: 'active' },
  { id: 'dinh-duong', name: 'Dinh duong', slug: 'dinh-duong', status: 'active' },
];

const experts = [
  {
    id: 'fallback-expert-1',
    name: 'Ban bien tap MidHealth',
    fullName: 'Ban bien tap MidHealth',
    title: 'Bien tap vien',
    specialty: 'Thong tin suc khoe',
    description: 'Noi dung tham khao duoc bien tap cho cong dong MidHealth.',
    bio: 'Noi dung tham khao duoc bien tap cho cong dong MidHealth.',
    status: 'active',
  },
];

const articles = categories.map((category, index) => ({
  id: `fallback-article-${category.slug}`,
  title: `${category.name}: nhung dieu can biet truoc khi di kham`,
  slug: `${category.slug}-nhung-dieu-can-biet`,
  summary: 'Thong tin tham khao giup ban chuan bi tot hon truoc khi trao doi voi nhan vien y te.',
  content: '<p>Neu trieu chung keo dai hoac nang len, ban nen dat lich kham de duoc danh gia truc tiep.</p>',
  thumbnail: '',
  thumbnailUrl: '',
  publishedDate: `2026-06-${String(index + 1).padStart(2, '0')}T00:00:00+07:00`,
  publishedAt: `2026-06-${String(index + 1).padStart(2, '0')}T00:00:00+07:00`,
  updatedDate: '2026-06-19T00:00:00+07:00',
  updatedAt: '2026-06-19T00:00:00+07:00',
  isFeatured: index < 2,
  status: 'published',
  viewCount: 0,
  category,
  author: experts[0],
}));

const catalog = {
  doctors: [
    {
      id: 'fallback-doctor-1',
      initials: 'MH',
      image: '',
      name: 'Bac si MidHealth',
      specialty: 'Noi tong quat',
      workplace: 'He thong MidHealth',
      address: 'TP. Ho Chi Minh',
      province: 'TP. Ho Chi Minh',
      district: '',
      homepageFeatured: true,
      homepageOrder: 1,
    },
  ],
  hospitals: [],
  clinics: [],
  specialties: [
    { id: 'fallback-specialty-1', name: 'Noi tong quat', image: 'noi_tong_quat.png' },
    { id: 'fallback-specialty-2', name: 'Nhi khoa', image: 'nhi_khoa.png' },
  ],
};

const referenceData = {
  regions: [
    { name: 'TP. Ho Chi Minh', aliases: ['TPHCM'], districts: ['Quan 1', 'Quan 3', 'Thu Duc'] },
    { name: 'Thanh pho Ha Noi', aliases: ['Ha Noi'], districts: ['Ba Dinh', 'Hoan Kiem'] },
  ],
  addressData: [
    { name: 'TP. Ho Chi Minh', districts: [{ name: 'Quan 1', wards: ['Tat ca phuong/xa/khu vuc'] }] },
    { name: 'Thanh pho Ha Noi', districts: [{ name: 'Ba Dinh', wards: ['Tat ca phuong/xa/khu vuc'] }] },
  ],
  ethnicGroups: ['Kinh', 'Tay', 'Thai', 'Hoa', 'Khmer', 'Khac'],
  occupations: ['Hoc sinh / Sinh vien', 'Nhan vien van phong', 'Kinh doanh', 'Cong nhan', 'Lao dong tu do', 'Khac'],
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function filteredArticles(url) {
  const category = url.searchParams.get('category') || '';
  const keyword = (url.searchParams.get('keyword') || url.searchParams.get('q') || '').trim().toLowerCase();
  const featured = url.searchParams.get('featured');
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 12, 1), 50);

  return articles
    .filter((item) => !category || item.category?.slug === category)
    .filter((item) => featured === null || String(Boolean(item.isFeatured)) === featured)
    .filter((item) => !keyword || `${item.title} ${item.summary} ${item.content}`.toLowerCase().includes(keyword))
    .slice(0, limit);
}

function publicFallback(request, response) {
  if (request.method !== 'GET') return false;

  const url = new URL(request.url, `https://${request.headers.host || 'midhealth.vercel.app'}`);
  const path = url.pathname;

  if (path === '/api/health') {
    sendJson(response, 200, {
      status: 'ok',
      service: 'midhealth-frontend-api',
      firebase: 'unknown',
      emailOtp: 'unknown',
      supabase: 'fallback',
    });
    return true;
  }

  if (path === '/api/catalog') {
    sendJson(response, 200, { data: catalog });
    return true;
  }

  if (path === '/api/reference-data') {
    sendJson(response, 200, { data: referenceData });
    return true;
  }

  if (path === '/api/health/categories' || path === '/api/health-news/categories') {
    sendJson(response, 200, { data: categories });
    return true;
  }

  if (path === '/api/health/experts' || path === '/api/health-news/experts') {
    sendJson(response, 200, { data: experts });
    return true;
  }

  if (path === '/api/health/articles' || path === '/api/health-news/articles') {
    sendJson(response, 200, { data: filteredArticles(url) });
    return true;
  }

  if (path === '/api/health/search' || path === '/api/health-news/search') {
    sendJson(response, 200, { data: filteredArticles(url) });
    return true;
  }

  const articlePrefix = path.startsWith('/api/health/articles/')
    ? '/api/health/articles/'
    : path.startsWith('/api/health-news/articles/')
      ? '/api/health-news/articles/'
      : '';
  if (articlePrefix) {
    const slug = decodeURIComponent(path.slice(articlePrefix.length));
    sendJson(response, 200, { data: articles.find((item) => item.slug === slug || item.id === slug) || null });
    return true;
  }

  return false;
}

module.exports = async function midhealthApi(request, response) {
  try {
    let backendModule;
    try {
      backendModule = await import('../backend/src/server.js');
    } catch {
      backendModule = await import('../../backend/src/server.js');
    }
    const { handleRequest } = backendModule;
    return handleRequest(request, response);
  } catch (error) {
    if (publicFallback(request, response)) return;

    sendJson(response, 503, {
      message: 'Backend function is unavailable on this deployment.',
      detail: error?.message || String(error),
    });
  }
};
