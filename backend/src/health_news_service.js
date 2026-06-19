import { hasSupabaseConfig, supabase } from './supabase.js';
import {
  articles as fallbackArticleRows,
  authors as fallbackAuthorRows,
  categories as fallbackCategoryRows,
} from '../scripts/health_news_content_data.js';

const ARTICLE_FIELDS = `
  id,
  title,
  slug,
  summary,
  content,
  thumbnail_url,
  published_at,
  updated_at,
  is_featured,
  status,
  view_count,
  category:health_categories(id, name, slug, description),
  author:health_authors(id, full_name, title, specialty, avatar_url, bio, status)
`;

function parseLimit(value, fallback = 12) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.min(Math.floor(number), 50);
}

function isUuid(value = '') {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function cleanSearchKeyword(value = '') {
  return value.replace(/[,%]/g, ' ').replace(/\s+/g, ' ').trim();
}

function mapArticle(article) {
  if (!article) return null;
  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    summary: article.summary || '',
    content: article.content || '',
    thumbnail: article.thumbnail_url || '',
    thumbnailUrl: article.thumbnail_url || '',
    publishedDate: article.published_at,
    publishedAt: article.published_at,
    updatedDate: article.updated_at,
    updatedAt: article.updated_at,
    isFeatured: Boolean(article.is_featured),
    status: article.status,
    viewCount: article.view_count || 0,
    category: article.category || null,
    author: article.author ? mapPerson(article.author) : null,
  };
}

function mapPerson(person) {
  return {
    id: person.id,
    name: person.full_name || person.name,
    fullName: person.full_name || person.name,
    title: person.title || '',
    specialty: person.specialty || '',
    avatar: person.avatar_url || person.avatar || '',
    avatarUrl: person.avatar_url || person.avatar || '',
    description: person.description || person.bio || '',
    bio: person.bio || person.description || '',
    status: person.status,
  };
}

function fallbackCategories() {
  return {
    ok: true,
    status: 200,
    data: fallbackCategoryRows.map((item) => ({
      id: item.slug,
      name: item.name,
      slug: item.slug,
      description: item.description || '',
      status: item.status || 'active',
    })),
  };
}

function fallbackPerson(person, index = 0) {
  return mapPerson({
    id: person.id || `fallback-person-${index + 1}`,
    full_name: person.full_name || person.name,
    name: person.name,
    title: person.title,
    specialty: person.specialty,
    avatar_url: person.avatar_url || person.avatar,
    description: person.description,
    bio: person.bio || person.description,
    status: person.status || 'active',
  });
}

function fallbackArticle(item, index = 0) {
  const category = fallbackCategories().data.find((categoryItem) => categoryItem.slug === item.categorySlug) || null;
  const authorRow = fallbackAuthorRows.find((author) => author.name === item.authorName || author.full_name === item.authorName) || fallbackAuthorRows[0];
  return {
    id: item.id || `fallback-article-${index + 1}`,
    title: item.title,
    slug: item.slug,
    summary: item.summary || '',
    content: item.content || '',
    thumbnail: item.thumbnail_url || item.thumbnail || '',
    thumbnailUrl: item.thumbnail_url || item.thumbnail || '',
    publishedDate: item.published_at || item.published_date,
    publishedAt: item.published_at || item.published_date,
    updatedDate: item.updated_at || item.updated_date,
    updatedAt: item.updated_at || item.updated_date,
    isFeatured: Boolean(item.is_featured),
    status: item.status || 'published',
    viewCount: item.view_count || 0,
    category,
    author: fallbackPerson(authorRow, 0),
  };
}

function fallbackArticles({ category, keyword, featured, limit } = {}) {
  const normalizedKeyword = cleanSearchKeyword(decodeURIComponent(keyword || '')).toLowerCase();
  const rows = fallbackArticleRows
    .filter((item) => !category || item.categorySlug === category)
    .filter((item) => featured === undefined || featured === null || featured === '' || String(Boolean(item.is_featured)) === String(featured))
    .filter((item) => !normalizedKeyword || `${item.title} ${item.summary} ${item.content}`.toLowerCase().includes(normalizedKeyword))
    .slice(0, parseLimit(limit))
    .map(fallbackArticle);
  return { ok: true, status: 200, data: rows };
}

function fallbackArticleDetail(identifier) {
  const item = fallbackArticleRows.find((row) => row.slug === identifier || row.id === identifier);
  return item
    ? { ok: true, status: 200, data: fallbackArticle(item) }
    : { ok: true, status: 200, data: fallbackArticles({ limit: 1 }).data[0] || null };
}

function fallbackExperts() {
  return { ok: true, status: 200, data: fallbackAuthorRows.map(fallbackPerson) };
}

export async function listHealthCategories() {
  if (!hasSupabaseConfig) return fallbackCategories();

  try {
    const { data, error } = await supabase
      .from('health_categories')
      .select('id, name, slug, description, status')
      .eq('status', 'active')
      .order('name', { ascending: true });

    if (error) throw error;

    const order = [
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
    ];
    const orderIndex = (slug) => {
      const index = order.indexOf(slug);
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };
    const categories = (data || []).sort((a, b) => orderIndex(a.slug) - orderIndex(b.slug));
    return { ok: true, status: 200, data: categories };
  } catch (error) {
    return fallbackCategories();
  }
}

export async function listHealthArticles({ category, keyword, featured, limit } = {}) {
  if (!hasSupabaseConfig) return fallbackArticles({ category, keyword, featured, limit });

  const normalizedKeyword = cleanSearchKeyword(decodeURIComponent(keyword || ''));

  try {
    let query = supabase
      .from('health_articles')
      .select(ARTICLE_FIELDS)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(parseLimit(limit));

    if (featured === 'true' || featured === true) {
      query = query.eq('is_featured', true);
    }

    if (normalizedKeyword) {
      query = query.or(`title.ilike.%${normalizedKeyword}%,summary.ilike.%${normalizedKeyword}%,content.ilike.%${normalizedKeyword}%`);
    }

    if (category) {
      const { data: categoryRow, error: categoryError } = await supabase
        .from('health_categories')
        .select('id')
        .eq('slug', category)
        .eq('status', 'active')
        .maybeSingle();

      if (categoryError) throw categoryError;
      if (!categoryRow) return { ok: true, status: 200, data: [] };
      query = query.eq('category_id', categoryRow.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, status: 200, data: (data || []).map(mapArticle) };
  } catch (error) {
    return fallbackArticles({ category, keyword, featured, limit });
  }
}

export async function listFeaturedHealthArticles(limit) {
  if (!hasSupabaseConfig) return fallbackArticles({ featured: true, limit });

  try {
    const { data, error } = await supabase
      .from('health_articles')
      .select(ARTICLE_FIELDS)
      .eq('status', 'published')
      .eq('is_featured', true)
      .order('view_count', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(parseLimit(limit, 8));

    if (error) throw error;
    return { ok: true, status: 200, data: (data || []).map(mapArticle) };
  } catch (error) {
    return fallbackArticles({ featured: true, limit });
  }
}

export async function getHealthArticle(identifier) {
  if (!hasSupabaseConfig) return fallbackArticleDetail(identifier);

  try {
    const column = isUuid(identifier) ? 'id' : 'slug';
    const { data, error } = await supabase
      .from('health_articles')
      .select(ARTICLE_FIELDS)
      .eq(column, identifier)
      .eq('status', 'published')
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ok: false, status: 404, data: { message: 'Không tìm thấy bài viết tin y tế.' } };

    await supabase
      .from('health_articles')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', data.id);

    return { ok: true, status: 200, data: mapArticle(data) };
  } catch (error) {
    return fallbackArticleDetail(identifier);
  }
}

export async function searchHealthArticles({ keyword, category, limit } = {}) {
  if (!hasSupabaseConfig) return fallbackArticles({ keyword, category, limit });

  const normalizedKeyword = cleanSearchKeyword(decodeURIComponent(keyword || ''));
  if (!normalizedKeyword) return { ok: true, status: 200, data: [] };

  try {
    let query = supabase
      .from('health_articles')
      .select(ARTICLE_FIELDS)
      .eq('status', 'published')
      .or(`title.ilike.%${normalizedKeyword}%,summary.ilike.%${normalizedKeyword}%,content.ilike.%${normalizedKeyword}%`)
      .order('published_at', { ascending: false })
      .limit(parseLimit(limit, 30));

    if (category) {
      const { data: categoryRow, error: categoryError } = await supabase
        .from('health_categories')
        .select('id')
        .eq('slug', category)
        .eq('status', 'active')
        .maybeSingle();

      if (categoryError) throw categoryError;
      if (!categoryRow) return { ok: true, status: 200, data: [] };
      query = query.eq('category_id', categoryRow.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { ok: true, status: 200, data: (data || []).map(mapArticle) };
  } catch (error) {
    return fallbackArticles({ keyword, category, limit });
  }
}

export async function listHealthExperts() {
  if (!hasSupabaseConfig) return fallbackExperts();

  try {
    const { data, error } = await supabase
      .from('health_experts')
      .select('id, full_name, title, specialty, avatar_url, description, status')
      .eq('status', 'active')
      .order('full_name', { ascending: true });

    if (error) throw error;
    return { ok: true, status: 200, data: (data || []).map(mapPerson) };
  } catch (error) {
    return fallbackExperts();
  }
}

export async function listHealthAuthors() {
  if (!hasSupabaseConfig) return fallbackExperts();

  try {
    const { data, error } = await supabase
      .from('health_authors')
      .select('id, full_name, title, specialty, avatar_url, bio, status')
      .eq('status', 'active')
      .order('full_name', { ascending: true });

    if (error) throw error;
    return { ok: true, status: 200, data: (data || []).map(mapPerson) };
  } catch (error) {
    return fallbackExperts();
  }
}

export async function getHealthAuthor(authorId) {
  if (!hasSupabaseConfig) return { ok: true, status: 200, data: fallbackExperts().data[0] || null };

  try {
    const { data, error } = await supabase
      .from('health_authors')
      .select('id, full_name, title, specialty, avatar_url, bio, status')
      .eq('id', authorId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ok: false, status: 404, data: { message: 'Không tìm thấy tác giả.' } };
    return { ok: true, status: 200, data: mapPerson(data) };
  } catch (error) {
    return { ok: true, status: 200, data: fallbackExperts().data[0] || null };
  }
}
