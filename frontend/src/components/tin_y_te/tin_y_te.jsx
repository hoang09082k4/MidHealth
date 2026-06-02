import { useEffect, useMemo, useState } from 'react';
import {
  fetchHealthArticle,
  fetchHealthArticles,
  fetchHealthCategories,
  fetchHealthExperts,
  searchHealthArticles,
} from '../../lib/health_news';

const CATEGORY_PLACEHOLDERS = {
  thuoc: 'Nhập tên thuốc...',
  'duoc-lieu': 'Nhập tên dược liệu cần tìm...',
  benh: 'Nhập tên bệnh, triệu chứng cần tìm...',
  'co-the': 'Nhập tên bộ phận cơ thể...',
};

const DEFAULT_CATEGORY = 'thuoc';

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN').format(new Date(value));
}

function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
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

function resolveImage(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return path.startsWith('/') ? path : `/${path}`;
}

function ArticleCard({ article, onOpen }) {
  return (
    <button className="health-article-card" type="button" onClick={() => onOpen(article.slug)}>
      <img src={resolveImage(article.thumbnail)} alt="" />
      <div>
        <h3>{decodeEntities(article.title)}</h3>
        <p>{article.author?.name || 'MidHealth'} · Cập nhật: {formatDate(article.updatedDate)}</p>
      </div>
    </button>
  );
}

function ExpertTeam({ experts }) {
  if (!experts.length) return null;

  return (
    <section className="health-expert-section">
      <h2>Đội ngũ chuyên gia</h2>
      <div className="health-expert-panel">
        <div className="health-expert-grid">
          {experts.map((expert) => (
            <article className="health-expert-item" key={expert.id}>
              <div className="health-expert-avatar">
                {expert.avatar ? <img src={resolveImage(expert.avatar)} alt="" /> : initials(expert.name)}
              </div>
              <div>
                <h3>{expert.title ? `${expert.title} ${expert.name.replace(expert.title, '').trim()}` : expert.name}</h3>
                <p>{expert.specialty}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="health-expert-copy">
          <p>Hội đồng tham vấn y khoa cùng đội ngũ biên tập viên là các bác sĩ, dược sĩ đảm bảo nội dung chúng tôi cung cấp chính xác về chuyên môn và trung lập trong khuyến nghị.</p>
        </div>
      </div>
    </section>
  );
}

function HealthSearchBar({ activeCategory, searchTerm, onSearchTermChange, onSubmit }) {
  return (
    <form className="health-search-box" onSubmit={onSubmit}>
      <button type="submit" aria-label="Tìm kiếm bài viết">⌕</button>
      <input
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
        placeholder={CATEGORY_PLACEHOLDERS[activeCategory] || 'Tìm kiếm bài viết...'}
      />
    </form>
  );
}

function HealthListPage({
  articles,
  categories,
  activeCategory,
  experts,
  isLoading,
  onChangeCategory,
  onOpenArticle,
  onSearch,
}) {
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setSearchTerm('');
  }, [activeCategory]);

  const submitSearch = (event) => {
    event.preventDefault();
    onSearch(searchTerm, activeCategory);
  };

  return (
    <>
      <section className="news-band health-news-page" id="news">
        <div className="intro">
          <h2>Tin Y tế</h2>
          <p>Chính thống - Minh bạch - Trung lập</p>
        </div>
        <div className="health-news-content">
          <div className="health-news-controls">
            <div className="tabs" role="tablist" aria-label="Danh mục tin y tế">
              {categories.map((category) => (
                <button
                  type="button"
                  className={category.slug === activeCategory ? 'active' : ''}
                  key={category.id}
                  onClick={() => onChangeCategory(category.slug)}
                >
                  {category.name}
                </button>
              ))}
            </div>
            <HealthSearchBar
              activeCategory={activeCategory}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              onSubmit={submitSearch}
            />
          </div>

          {isLoading ? (
            <p className="health-state">Đang tải bài viết...</p>
          ) : (
            <div className="horizontal-list health-article-list">
              {articles.map((article) => (
                <ArticleCard article={article} key={article.id} onOpen={onOpenArticle} />
              ))}
            </div>
          )}
        </div>
      </section>
      <ExpertTeam experts={experts} />
    </>
  );
}

function HealthSearchPage({
  activeCategory,
  categories,
  experts,
  keyword,
  results,
  isLoading,
  onChangeCategory,
  onOpenArticle,
  onSearch,
}) {
  const [searchTerm, setSearchTerm] = useState(keyword);

  useEffect(() => {
    setSearchTerm(keyword);
  }, [keyword]);

  const submitSearch = (event) => {
    event.preventDefault();
    onSearch(searchTerm, activeCategory);
  };

  return (
    <>
      <section className="health-result-page">
        <div className="health-page-header">
          <h1>Kết quả tìm kiếm</h1>
          <p>{isLoading ? 'Đang tìm kiếm...' : `Tìm thấy ${results.length} kết quả phù hợp`}</p>
        </div>
        <div className="health-news-controls compact">
          <div className="tabs" role="tablist" aria-label="Danh mục tin y tế">
            {categories.map((category) => (
              <button
                type="button"
                className={category.slug === activeCategory ? 'active' : ''}
                key={category.id}
                onClick={() => onChangeCategory(category.slug)}
              >
                {category.name}
              </button>
            ))}
          </div>
          <HealthSearchBar
            activeCategory={activeCategory}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            onSubmit={submitSearch}
          />
        </div>
        {!isLoading && results.length === 0 ? (
          <p className="health-empty">Không tìm thấy bài viết phù hợp</p>
        ) : (
          <div className="health-result-list">
            {results.map((article) => (
              <button className="health-result-item" type="button" key={article.id} onClick={() => onOpenArticle(article.slug)}>
                <img src={resolveImage(article.thumbnail)} alt="" />
                <div>
                  <span>{article.category?.name}</span>
                  <h2>{decodeEntities(article.title)}</h2>
                  <p>{decodeEntities(article.summary)}</p>
                  <small>{article.author?.name || 'MidHealth'} · Cập nhật: {formatDate(article.updatedDate)}</small>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
      <ExpertTeam experts={experts} />
    </>
  );
}

function HealthDetailPage({ article, isLoading, onBackToList }) {
  const safeContent = useMemo(() => sanitizeHtml(article?.content || ''), [article]);

  if (isLoading) {
    return <p className="health-state detail">Đang tải chi tiết bài viết...</p>;
  }

  if (!article) {
    return (
      <section className="health-detail-page">
        <p className="health-empty">Không tìm thấy bài viết phù hợp</p>
        <button className="health-back-button" type="button" onClick={onBackToList}>Quay lại Tin Y tế</button>
      </section>
    );
  }

  return (
    <article className="health-detail-page">
      <nav className="health-breadcrumb" aria-label="Breadcrumb">
        <button type="button" onClick={onBackToList}>Trang chủ</button>
        <span>/</span>
        <button type="button" onClick={onBackToList}>{article.category?.name || 'Tin Y tế'}</button>
      </nav>

      <h1>{decodeEntities(article.title)}</h1>
      <div className="health-author-row">
        <div className="health-author-avatar">
          {article.author?.avatar ? <img src={resolveImage(article.author.avatar)} alt="" /> : initials(article.author?.name)}
        </div>
        <div>
          <span>Tác giả:</span>
          <strong>{article.author?.name || 'MidHealth'}</strong>
          <p>Ngày Đăng: {formatDate(article.publishedDate)} - Cập nhật lần cuối: {formatDate(article.updatedDate)}</p>
        </div>
      </div>

      <div className="health-toc-box">
        <strong>Nội dung bài viết</strong>
        <span aria-hidden="true">☷</span>
      </div>

      <div className="health-article-content" dangerouslySetInnerHTML={{ __html: safeContent }} />
    </article>
  );
}

function MucTinYTe({ route = { name: 'list' }, onNavigate }) {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(route.category || DEFAULT_CATEGORY);
  const [articles, setArticles] = useState([]);
  const [experts, setExperts] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [currentArticle, setCurrentArticle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([fetchHealthCategories(), fetchHealthExperts()])
      .then(([categoryData, expertData]) => {
        if (!isMounted) return;
        setCategories(categoryData);
        setExperts(expertData);
        if (!categoryData.some((category) => category.slug === activeCategory)) {
          setActiveCategory(categoryData[0]?.slug || DEFAULT_CATEGORY);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCategories([]);
          setExperts([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (route.category && route.category !== activeCategory) {
      setActiveCategory(route.category);
    }
  }, [route.category]);

  useEffect(() => {
    if (route.name !== 'list') return;
    let isMounted = true;
    setIsLoading(true);

    fetchHealthArticles({ category: activeCategory, limit: 12 })
      .then((data) => {
        if (isMounted) setArticles(data);
      })
      .catch(() => {
        if (isMounted) setArticles([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeCategory, route.name]);

  useEffect(() => {
    if (route.name !== 'search') return;
    let isMounted = true;
    setIsLoading(true);

    searchHealthArticles({ keyword: route.keyword, category: activeCategory })
      .then((data) => {
        if (isMounted) setSearchResults(data);
      })
      .catch(() => {
        if (isMounted) setSearchResults([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeCategory, route.keyword, route.name]);

  useEffect(() => {
    if (route.name !== 'detail' || !route.slug) return;
    let isMounted = true;
    setIsLoading(true);

    fetchHealthArticle(route.slug)
      .then((data) => {
        if (isMounted) {
          setCurrentArticle(data);
          setActiveCategory(data.category?.slug || DEFAULT_CATEGORY);
        }
      })
      .catch(() => {
        if (isMounted) setCurrentArticle(null);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [route.name, route.slug]);

  const navigate = (nextRoute) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onNavigate(nextRoute);
  };

  const changeCategory = (categorySlug) => {
    setActiveCategory(categorySlug);
    if (route.name === 'search') {
      navigate({ name: 'search', keyword: route.keyword || '', category: categorySlug });
      return;
    }
    navigate({ name: 'list', category: categorySlug });
  };

  const openArticle = (slug) => {
    navigate({ name: 'detail', slug });
  };

  const submitSearch = (keyword, categorySlug) => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    navigate({ name: 'search', keyword: trimmed, category: categorySlug });
  };

  if (route.name === 'detail') {
    return (
      <HealthDetailPage
        article={currentArticle}
        isLoading={isLoading}
        onBackToList={() => navigate({ name: 'list', category: activeCategory })}
      />
    );
  }

  if (route.name === 'search') {
    return (
      <HealthSearchPage
        activeCategory={activeCategory}
        categories={categories}
        experts={experts}
        keyword={route.keyword || ''}
        results={searchResults}
        isLoading={isLoading}
        onChangeCategory={changeCategory}
        onOpenArticle={openArticle}
        onSearch={submitSearch}
      />
    );
  }

  return (
    <HealthListPage
      articles={articles}
      categories={categories}
      activeCategory={activeCategory}
      experts={experts}
      isLoading={isLoading}
      onChangeCategory={changeCategory}
      onOpenArticle={openArticle}
      onSearch={submitSearch}
    />
  );
}

export default MucTinYTe;
