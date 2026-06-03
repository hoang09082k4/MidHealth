import { hasSupabaseConfig, supabase } from '../src/supabase.js';
import { articles, authors, categories } from './health_news_content_data.js';

async function upsertRows(table, rows, onConflict) {
  const { data, error } = await supabase
    .from(table)
    .upsert(rows, { onConflict })
    .select();

  if (error) throw new Error(`${table}: ${error.message}`);
  return data || [];
}

async function selectMap(table, keyColumn, columns = '*') {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw new Error(`${table}: ${error.message}`);
  return new Map((data || []).map((row) => [row[keyColumn], row]));
}

async function syncRowsByName(table, rows) {
  const existingByName = await selectMap(table, 'name', 'id, name');
  const inserts = [];

  for (const row of rows) {
    const existing = existingByName.get(row.name);
    if (!existing) {
      inserts.push(row);
      continue;
    }

    const { error } = await supabase
      .from(table)
      .update(row)
      .eq('id', existing.id);

    if (error) throw new Error(`${table}: ${error.message}`);
  }

  if (inserts.length) {
    const { error } = await supabase.from(table).insert(inserts);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function seedHealthNewsContent() {
  if (!hasSupabaseConfig) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend environment.');
  }

  await upsertRows('health_categories', categories, 'slug');
  await syncRowsByName('health_authors', authors);

  const categoryBySlug = await selectMap('health_categories', 'slug', 'id, slug');
  const authorByName = await selectMap('health_authors', 'name', 'id, name');

  const articleRows = articles.map(({ categorySlug, authorName, ...item }) => {
    const category = categoryBySlug.get(categorySlug);
    if (!category) throw new Error(`Missing category slug: ${categorySlug}`);

    const author = authorByName.get(authorName);
    if (!author) throw new Error(`Missing author: ${authorName}`);

    return {
      ...item,
      category_id: category.id,
      author_id: author.id,
    };
  });

  const activeArticleSlugs = new Set(articleRows.map((item) => item.slug));
  const existingArticles = await selectMap('health_articles', 'slug', 'id, slug');
  const staleArticles = [...existingArticles.values()].filter((item) => !activeArticleSlugs.has(item.slug));

  for (const article of staleArticles) {
    const { error } = await supabase
      .from('health_articles')
      .update({ status: 'archived' })
      .eq('id', article.id);

    if (error) throw new Error(`health_articles archive ${article.slug}: ${error.message}`);
  }

  await upsertRows('health_articles', articleRows, 'slug');

  console.log(`Seeded ${categories.length} categories, ${authors.length} authors, ${articleRows.length} health articles. Archived ${staleArticles.length} stale articles.`);
}

seedHealthNewsContent().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
