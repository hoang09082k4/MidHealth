import { useEffect, useMemo, useState } from 'react';
import BieuTuongLogo from '../dung_chung/bieu_tuong_logo';
import {
  fetchHealthArticle,
  fetchHealthArticles,
  fetchHealthCategories,
  fetchHealthExperts,
  searchHealthArticles,
} from '../../lib/health_news';

const CATEGORY_PLACEHOLDERS = {
  thuoc: 'Nhập tên thuốc cần tìm...',
  'duoc-lieu': 'Nhập tên dược liệu cần tìm...',
  benh: 'Nhập tên bệnh, triệu chứng cần tìm...',
  'co-the': 'Nhập tên bộ phận cơ thể...',
};

const DEFAULT_CATEGORY = 'thuoc';

const NAV_GROUPS = [
  {
    label: 'Tra cứu bệnh',
    columns: [
      {
        title: '',
        items: ['Bệnh bạch hầu', 'Rối loạn tiền đình', 'Sốt xuất huyết', 'Trào ngược dạ dày thực quản', 'Viêm da dị ứng', 'Đột quỵ', 'Bệnh Parkinson'],
        action: 'Tra cứu thêm',
      },
    ],
  },
  {
    label: 'Tra cứu Thuốc & Dược liệu',
    wide: true,
    columns: [
      { title: 'Thuốc & Thực phẩm chức năng', items: ['Paracetamol', 'Glucosamine', 'Aspirin', 'Panadol Extra', 'Ginkgo Biloba', 'Hoạt huyết dưỡng não'], action: 'Tra cứu Thuốc' },
      { title: 'Dược liệu', items: ['Linh chi', 'Hạt chia', 'Đông trùng hạ thảo', 'Cây Lưỡi hổ', 'Hương thảo', 'Bồ công anh'], action: 'Tra cứu Dược liệu' },
      { title: 'Hiểu Về Cơ Thể Bạn', items: ['Dạ dày', 'Thận', 'Dương vật', 'Âm đạo', 'Gan', 'DNA là gì?'], action: 'Tra cứu các bộ phận cơ thể' },
    ],
  },
  {
    label: 'Mang thai & Nuôi dạy con',
    wide: true,
    columns: [
      { title: 'Mang thai', items: ['Chuẩn bị mang thai', 'Dinh dưỡng thai kỳ', 'Tiêm phòng thai kỳ', 'Chăm sóc mẹ bầu', '42 tuần mang thai', 'Quá trình sinh nở'] },
      { title: 'Nuôi dạy con', items: ['Tiêm phòng cho bé', 'Năm đầu đời', 'Các bệnh thường gặp ở trẻ', 'Đồng hành cùng con', 'Phát triển thể chất và trí não', 'Tuổi dậy thì'] },
      { title: 'Bài viết được quan tâm nhiều', items: ['Dấu hiệu mang thai', 'Mang thai tuần 1', 'Tiêm phòng trước khi mang thai', 'Chăm sóc trẻ sơ sinh', 'Dậy thì sớm'], action: 'Xem tất cả' },
    ],
  },
  {
    label: 'Chủ đề được quan tâm nhiều',
    wide: true,
    columns: [
      { title: '', items: ['Răng - Hàm - Mặt', 'Nhãn khoa', 'Dinh Dưỡng', 'Sức khỏe tình dục', 'Hô hấp', 'Tiêu hóa', 'Xét nghiệm'] },
      { title: '', items: ['Tai - Mũi - Họng', 'Cơ Xương Khớp', 'Sức khỏe nam giới', 'Thần kinh', 'Dị ứng', 'Thận - Tiết niệu', 'Thể dục thể thao'] },
      { title: '', items: ['Da liễu', 'Bí quyết sống khỏe', 'Sức khoẻ nữ giới', 'Tim mạch', 'Nội tiết', 'Ung bướu'] },
    ],
  },
  {
    label: 'Kinh nghiệm đi khám',
    wide: true,
    columns: [
      { title: 'Bệnh viện', items: ['Bệnh viện Chợ Rẫy', 'Bệnh viện Từ Dũ', 'Bệnh viện Đại học Y dược TP.HCM', 'Bệnh viện Da Liễu TP. HCM', 'Bệnh tại Bệnh viện Bạch Mai'], action: 'Tra cứu Bệnh viện - Phòng khám' },
      { title: 'Khám ở đâu tốt?', items: ['Khám Da liễu', 'Khám Tai Mũi Họng tốt tại TP. HCM', 'Khám Nhi', 'Khám Mắt', 'Khám Sản phụ khoa'], action: 'Tra cứu Nơi khám' },
      { title: 'Bài viết được quan tâm nhiều', items: ['Bệnh viện Y học cổ truyền TPHCM', 'Bệnh viện Hữu nghị Việt Đức', 'Bệnh viện Việt Pháp Hà Nội', 'Bệnh viện Da liễu Trung ương', 'Bệnh viện Nhi Trung ương'], action: 'Xem tất cả' },
    ],
  },
  { label: 'Bản tin sức khỏe', columns: [] },
];

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN').format(new Date(value));
}

function initials(name = '') {
  return name.split(' ').filter(Boolean).slice(-2).map((part) => part[0]).join('').toUpperCase();
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

function HealthSearchBar({ activeCategory = DEFAULT_CATEGORY, searchTerm, onSearchTermChange, onSubmit, portal = false }) {
  return (
    <form className={portal ? 'health-portal-search' : 'health-search-box'} onSubmit={onSubmit}>
      {!portal ? <button type="submit" aria-label="Tìm kiếm bài viết">⌕</button> : null}
      <input
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
        placeholder={portal ? 'Tìm kiếm bài viết, thông tin bệnh, thuốc ...' : CATEGORY_PLACEHOLDERS[activeCategory] || 'Tìm kiếm bài viết...'}
      />
      {portal ? <button type="submit" aria-label="Tìm kiếm bài viết">⌕</button> : null}
    </form>
  );
}

function ArticleCard({ article, onOpen, className = 'health-article-card' }) {
  return (
    <button className={className} type="button" onClick={() => onOpen(article.slug)}>
      <img src={resolveImage(article.thumbnail)} alt="" />
      <div>
        <span>{article.category?.name}</span>
        <h3>{decodeEntities(article.title)}</h3>
        {'summary' in article ? <p>{decodeEntities(article.summary)}</p> : null}
        <small>{article.author?.name || 'MidHealth'} · Cập nhật: {formatDate(article.updatedDate)}</small>
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
                <h3>{expert.name}</h3>
                <p>{expert.specialty}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="health-expert-copy">
          <p>Hội đồng tham vấn y khoa cùng đội ngũ biên tập viên là các bác sĩ, dược sĩ đảm bảo nội dung chúng tôi cung cấp chính xác về chuyên môn.</p>
        </div>
      </div>
    </section>
  );
}

function HealthNav({ onHome, onSearch }) {
  const searchMenuItem = (label) => {
    onSearch(label, DEFAULT_CATEGORY);
  };

  return (
    <nav className="health-portal-nav" aria-label="Điều hướng Tin tức">
      <button className="health-home-icon" type="button" aria-label="Trang chủ" onClick={onHome}>⌂</button>
      {NAV_GROUPS.map((group) => (
        <div className={`health-nav-item${group.wide ? ' wide' : ''}`} key={group.label}>
          <button type="button">{group.label}</button>
          {group.columns.length ? (
            <div className="health-nav-dropdown">
              {group.columns.map((column, index) => (
                <div className="health-nav-column" key={`${group.label}-${index}`}>
                  {column.title ? <h3>{column.title}</h3> : null}
                  {column.items.map((item) => (
                    <button type="button" key={item} onClick={() => searchMenuItem(item)}>{item}</button>
                  ))}
                  {column.action ? <button className="health-nav-action" type="button" onClick={() => searchMenuItem(column.action)}>{column.action}<span>→</span></button> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </nav>
  );
}

function HealthPortalHeader({ onHome, onSearch }) {
  const [searchTerm, setSearchTerm] = useState('');

  const submitSearch = (event) => {
    event.preventDefault();
    const trimmed = searchTerm.trim();
    if (!trimmed) return;
    onSearch(trimmed, DEFAULT_CATEGORY);
  };

  return (
    <header className="health-portal-header">
      <div className="health-portal-top">
        <button className="health-portal-logo" type="button" onClick={onHome} aria-label="Về trang chủ MidHealth">
          <BieuTuongLogo />
        </button>
        <HealthSearchBar portal searchTerm={searchTerm} onSearchTermChange={setSearchTerm} onSubmit={submitSearch} />
      </div>
      <HealthNav onHome={onHome} onSearch={onSearch} />
    </header>
  );
}

function HealthListPage({ articles, categories, activeCategory, isLoading, onChangeCategory, onOpenArticle, onSearch }) {
  const [searchTerm, setSearchTerm] = useState('');
  const featured = articles.slice(0, 3);
  const gridArticles = articles.slice(3);

  useEffect(() => {
    setSearchTerm('');
  }, [activeCategory]);

  const submitSearch = (event) => {
    event.preventDefault();
    onSearch(searchTerm, activeCategory);
  };

  return (
    <section className="health-portal-page">
      <div className="health-portal-title">
        <h1>Tin Y tế</h1>
        <p>Chính thống - Minh bạch - Trung lập</p>
      </div>
      <div className="health-news-controls">
        <div className="health-category-tabs" role="tablist" aria-label="Danh mục tin y tế">
          {categories.map((category) => (
            <button type="button" className={category.slug === activeCategory ? 'active' : ''} key={category.id} onClick={() => onChangeCategory(category.slug)}>
              {category.name}
            </button>
          ))}
        </div>
        <HealthSearchBar activeCategory={activeCategory} searchTerm={searchTerm} onSearchTermChange={setSearchTerm} onSubmit={submitSearch} />
      </div>

      {isLoading ? (
        <p className="health-state">Đang tải bài viết...</p>
      ) : (
        <>
          {featured.length ? (
            <div className="health-featured-layout">
              <button className="health-featured-card large" type="button" onClick={() => onOpenArticle(featured[0].slug)}>
                <img src={resolveImage(featured[0].thumbnail)} alt="" />
                <div>
                  <span>{featured[0].category?.name}</span>
                  <h2>{decodeEntities(featured[0].title)}</h2>
                  <p>{decodeEntities(featured[0].summary)}</p>
                  <small>{featured[0].author?.name || 'MidHealth'} · Ngày đăng: {formatDate(featured[0].publishedDate)}</small>
                </div>
              </button>
              <div className="health-featured-side">
                {featured.slice(1).map((article) => (
                  <button className="health-featured-card" type="button" key={article.id} onClick={() => onOpenArticle(article.slug)}>
                    <div>
                      <span>{article.category?.name}</span>
                      <h2>{decodeEntities(article.title)}</h2>
                      <p>{decodeEntities(article.summary)}</p>
                      <small>{article.author?.name || 'MidHealth'} · Ngày đăng: {formatDate(article.publishedDate)}</small>
                    </div>
                    <img src={resolveImage(article.thumbnail)} alt="" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="health-card-grid">
            {gridArticles.map((article) => <ArticleCard article={article} key={article.id} className="health-grid-card" onOpen={onOpenArticle} />)}
          </div>
        </>
      )}
    </section>
  );
}

function HealthSearchPage({ activeCategory, categories, keyword, results, isLoading, onChangeCategory, onOpenArticle, onSearch }) {
  const [searchTerm, setSearchTerm] = useState(keyword);

  useEffect(() => {
    setSearchTerm(keyword);
  }, [keyword]);

  const submitSearch = (event) => {
    event.preventDefault();
    onSearch(searchTerm, activeCategory);
  };

  return (
    <section className="health-result-page">
      <div className="health-page-header">
        <h1>Kết quả tìm kiếm</h1>
        <p>{isLoading ? 'Đang tìm kiếm...' : `Tìm thấy ${results.length} kết quả phù hợp`}</p>
      </div>
      <div className="health-news-controls compact">
        <div className="health-category-tabs" role="tablist" aria-label="Danh mục tin y tế">
          {categories.map((category) => (
            <button type="button" className={category.slug === activeCategory ? 'active' : ''} key={category.id} onClick={() => onChangeCategory(category.slug)}>
              {category.name}
            </button>
          ))}
        </div>
        <HealthSearchBar activeCategory={activeCategory} searchTerm={searchTerm} onSearchTermChange={setSearchTerm} onSubmit={submitSearch} />
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
  );
}

function HealthDetailPage({ article, isLoading, onBackToList }) {
  const safeContent = useMemo(() => sanitizeHtml(article?.content || ''), [article]);

  if (isLoading) return <p className="health-state detail">Đang tải chi tiết bài viết...</p>;

  if (!article) {
    return (
      <section className="health-detail-page">
        <p className="health-empty">Không tìm thấy bài viết phù hợp</p>
        <button className="health-back-button" type="button" onClick={onBackToList}>Quay lại Tin tức</button>
      </section>
    );
  }

  return (
    <article className="health-detail-page">
      <nav className="health-breadcrumb" aria-label="Breadcrumb">
        <button type="button" onClick={onBackToList}>Tin tức</button>
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
          <p>Ngày đăng: {formatDate(article.publishedDate)} - Cập nhật lần cuối: {formatDate(article.updatedDate)}</p>
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

export function MucTinYTeTrangChu({ onNavigate }) {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(DEFAULT_CATEGORY);
  const [articles, setArticles] = useState([]);
  const [experts, setExperts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let isMounted = true;
    Promise.all([fetchHealthCategories(), fetchHealthExperts()])
      .then(([categoryData, expertData]) => {
        if (!isMounted) return;
        setCategories(categoryData);
        setExperts(expertData);
      })
      .catch(() => {
        if (!isMounted) return;
        setCategories([]);
        setExperts([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    fetchHealthArticles({ category: activeCategory, limit: 8 })
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
  }, [activeCategory]);

  const submitSearch = (event) => {
    event.preventDefault();
    const trimmed = searchTerm.trim();
    if (trimmed) onNavigate?.({ name: 'search', keyword: trimmed, category: activeCategory });
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
                <button type="button" className={category.slug === activeCategory ? 'active' : ''} key={category.id} onClick={() => setActiveCategory(category.slug)}>
                  {category.name}
                </button>
              ))}
            </div>
            <HealthSearchBar activeCategory={activeCategory} searchTerm={searchTerm} onSearchTermChange={setSearchTerm} onSubmit={submitSearch} />
          </div>
          {isLoading ? (
            <p className="health-state">Đang tải bài viết...</p>
          ) : (
            <div className="horizontal-list health-article-list">
              {articles.map((article) => <ArticleCard article={article} key={article.id} onOpen={(slug) => onNavigate?.({ name: 'detail', slug })} />)}
            </div>
          )}
        </div>
      </section>
      <ExpertTeam experts={experts} />
    </>
  );
}

function MucTinYTe({ route = { name: 'list' }, onNavigate, onHome }) {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(route.category || DEFAULT_CATEGORY);
  const [articles, setArticles] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [currentArticle, setCurrentArticle] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    fetchHealthCategories()
      .then((categoryData) => {
        if (!isMounted) return;
        setCategories(categoryData);
        if (!categoryData.some((category) => category.slug === activeCategory)) {
          setActiveCategory(categoryData[0]?.slug || DEFAULT_CATEGORY);
        }
      })
      .catch(() => {
        if (isMounted) setCategories([]);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (route.category && route.category !== activeCategory) setActiveCategory(route.category);
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
        if (!isMounted) return;
        setCurrentArticle(data);
        setActiveCategory(data.category?.slug || DEFAULT_CATEGORY);
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

  const submitSearch = (keyword, categorySlug) => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    navigate({ name: 'search', keyword: trimmed, category: categorySlug });
  };

  return (
    <div className="health-portal-shell">
      <HealthPortalHeader onHome={onHome} onSearch={submitSearch} />
      {route.name === 'detail' ? (
        <HealthDetailPage article={currentArticle} isLoading={isLoading} onBackToList={() => navigate({ name: 'list', category: activeCategory })} />
      ) : route.name === 'search' ? (
        <HealthSearchPage
          activeCategory={activeCategory}
          categories={categories}
          keyword={route.keyword || ''}
          results={searchResults}
          isLoading={isLoading}
          onChangeCategory={changeCategory}
          onOpenArticle={(slug) => navigate({ name: 'detail', slug })}
          onSearch={submitSearch}
        />
      ) : (
        <HealthListPage
          articles={articles}
          categories={categories}
          activeCategory={activeCategory}
          isLoading={isLoading}
          onChangeCategory={changeCategory}
          onOpenArticle={(slug) => navigate({ name: 'detail', slug })}
          onSearch={submitSearch}
        />
      )}
    </div>
  );
}

export default MucTinYTe;
