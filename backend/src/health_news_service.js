import { hasSupabaseConfig, supabase } from './supabase.js';

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

function unavailable() {
  return {
    ok: false,
    status: 503,
    data: { message: 'Backend chua cau hinh SUPABASE_URL hoac SUPABASE_SERVICE_ROLE_KEY.' },
  };
}

function fail(error, message = 'Khong the tai du lieu tin y te tu Supabase.') {
  return {
    ok: false,
    status: 500,
    data: { message, detail: error.message },
  };
}

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

export async function listHealthCategories() {
  if (!hasSupabaseConfig) return unavailable();

  try {
    const { data, error } = await supabase
      .from('health_categories')
      .select('id, name, slug, description, status')
      .eq('status', 'active')
      .order('name', { ascending: true });

    if (error) throw error;

    const order = ['thuoc', 'duoc-lieu', 'benh', 'co-the'];
    const categories = (data || []).sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug));
    return { ok: true, status: 200, data: categories };
  } catch (error) {
    return fail(error);
  }
}

export async function listHealthArticles({ category, keyword, featured, limit } = {}) {
  if (!hasSupabaseConfig) return unavailable();

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
    return fail(error);
  }
}

export async function listFeaturedHealthArticles(limit) {
  if (!hasSupabaseConfig) return unavailable();

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
    return fail(error);
  }
}

export async function getHealthArticle(identifier) {
  if (!hasSupabaseConfig) return unavailable();

  try {
    const column = isUuid(identifier) ? 'id' : 'slug';
    const { data, error } = await supabase
      .from('health_articles')
      .select(ARTICLE_FIELDS)
      .eq(column, identifier)
      .eq('status', 'published')
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ok: false, status: 404, data: { message: 'Khong tim thay bai viet tin y te.' } };

    await supabase
      .from('health_articles')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', data.id);

    return { ok: true, status: 200, data: mapArticle(data) };
  } catch (error) {
    return fail(error);
  }
}

export async function searchHealthArticles({ keyword, category, limit } = {}) {
  if (!hasSupabaseConfig) return unavailable();

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
    return fail(error);
  }
}

export async function listHealthExperts() {
  if (!hasSupabaseConfig) return unavailable();

  try {
    const { data, error } = await supabase
      .from('health_experts')
      .select('id, full_name, title, specialty, avatar_url, description, status')
      .eq('status', 'active')
      .order('full_name', { ascending: true });

    if (error) throw error;
    return { ok: true, status: 200, data: (data || []).map(mapPerson) };
  } catch (error) {
    return fail(error);
  }
}

export async function listHealthAuthors() {
  if (!hasSupabaseConfig) return unavailable();

  try {
    const { data, error } = await supabase
      .from('health_authors')
      .select('id, full_name, title, specialty, avatar_url, bio, status')
      .eq('status', 'active')
      .order('full_name', { ascending: true });

    if (error) throw error;
    return { ok: true, status: 200, data: (data || []).map(mapPerson) };
  } catch (error) {
    return fail(error);
  }
}

export async function getHealthAuthor(authorId) {
  if (!hasSupabaseConfig) return unavailable();

  try {
    const { data, error } = await supabase
      .from('health_authors')
      .select('id, full_name, title, specialty, avatar_url, bio, status')
      .eq('id', authorId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ok: false, status: 404, data: { message: 'Khong tim thay tac gia.' } };
    return { ok: true, status: 200, data: mapPerson(data) };
  } catch (error) {
    return fail(error);
  }
}
