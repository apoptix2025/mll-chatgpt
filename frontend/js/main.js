// ============================================================
// MYLATINOLIST — MAIN JS
// Fetches live data from Cloudflare Workers API
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // --- NAV SCROLL ---
  const nav = document.getElementById('nav');
  if (nav) {
    window.addEventListener('scroll', () => {
      nav.classList.toggle('scrolled', window.scrollY > 20);
    });
  }

  const isLoggedIn = !!sessionStorage.getItem('mll_token');
  const mobSignin   = document.getElementById('mob-signin');
  const mobDash     = document.getElementById('mob-dashboard');
  if (mobSignin && mobDash) {
    mobSignin.style.display  = isLoggedIn ? 'none' : '';
    mobDash.style.display    = isLoggedIn ? '' : 'none';
  }

  if (isLoggedIn) {
    const signinBtn = document.getElementById('nav-signin') || document.querySelector('.nav-actions .btn-ghost');
    if (signinBtn) {
      signinBtn.textContent = 'My dashboard';
      signinBtn.href = 'pages/dashboard.html';
    }
  }

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.12 });

  function observeReveal() {
    document.querySelectorAll('.reveal:not(.observed)').forEach(el => {
      el.classList.add('observed');
      revealObserver.observe(el);
    });
  }
  observeReveal();

  function skeletonCard() {
    return '<article class="v2-card" style="pointer-events:none;"><div class="v2-card-media" style="background:var(--surface-3);"></div><div class="v2-card-body"><div style="height:16px;background:var(--surface-3);border-radius:8px;margin-bottom:10px;width:70%;"></div><div style="height:12px;background:var(--surface-3);border-radius:8px;width:50%;"></div></div></article>';
  }

  function pickBySlug(list, slugs) {
    const found = [];
    slugs.forEach(slug => {
      const hit = list.find(b => b.slug === slug);
      if (hit) found.push(hit);
    });
    list.forEach(b => {
      if (found.length >= 4) return;
      if (!found.some(x => x.slug === b.slug)) found.push(b);
    });
    return found.slice(0, 4);
  }

  function renderCards(el, businesses, limit) {
    if (!el) return;
    if (!businesses || !businesses.length) {
      el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--ink-muted);">No businesses found.</div>';
      return;
    }
    const media = window.MLL_MEDIA;
    el.innerHTML = businesses.slice(0, limit || businesses.length).map(b =>
      media ? media.cardHTML(b, { cta: 'View profile →' }) : ''
    ).join('');
  }

  const popularGrid  = document.getElementById('popular-grid');
  const featuredGrid = document.getElementById('featured-grid');
  const bizGrid      = document.getElementById('biz-grid');

  if (popularGrid) popularGrid.innerHTML = Array(4).fill(skeletonCard()).join('');
  if (featuredGrid) featuredGrid.innerHTML = Array(4).fill(skeletonCard()).join('');

  MLL.getBusinesses().then(data => {
    const businesses = (data && data.businesses) || [];
    const preferred = ['la-cocina-de-maryland','mendez-remodeling-co','flores-beauty-studio','vega-immigration-law'];
    const popular = pickBySlug(businesses, preferred);
    renderCards(popularGrid, popular, 4);

    const featured = businesses.filter(b => b.is_featured);
    const featuredFill = featured.length ? featured : businesses.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
    renderCards(featuredGrid, featuredFill, 4);

    if (bizGrid && !popularGrid) renderCards(bizGrid, businesses, 6);
  });

  fetch((window.MLL_CONFIG && window.MLL_CONFIG.API_URL) + '/api/stats')
    .then(r => r.ok ? r.json() : null)
    .then(stats => {
      if (!stats) return;
      const set = (id, val) => {
        const el = document.getElementById(id);
        if (el && val != null) el.textContent = Number(val).toLocaleString();
      };
      set('community-biz-count', stats.businesses);
      set('community-state-count', stats.states || stats.cities);
    })
    .catch(() => {});

  MLL.getJobs().then(data => {
    const el = document.getElementById('community-job-count');
    if (el && data && data.jobs) el.textContent = String(data.jobs.length);
  });

  fetch((window.MLL_CONFIG && window.MLL_CONFIG.API_URL) + '/api/resources')
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      const el = document.getElementById('community-res-count');
      if (el && data && data.resources) el.textContent = String(data.resources.length);
      const grid = document.getElementById('voz-latest-grid');
      if (!grid) return;
      const items = (data && data.resources) || [];
      if (!items.length) {
        grid.innerHTML = '<p class="mll-voz-empty">No articles available yet.</p>';
        return;
      }
      const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
      grid.innerHTML = items.slice(0, 4).map(r => {
        const href = r.url && /^https?:/i.test(r.url) ? r.url : 'pages/voz.html';
        const tag = r.category || r.tag || '';
        return (
          '<a class="mll-voz-card" href="' + href + '">' +
            (tag ? '<span class="mll-voz-tag">' + esc(tag) + '</span>' : '') +
            '<b>' + esc(r.title || 'Resource') + '</b>' +
            (r.description ? '<p>' + esc(r.description) + '</p>' : '') +
          '</a>'
        );
      }).join('');
    })
    .catch(() => {});

  function skeletonProduct() {
    return `
      <div class="product-card" style="pointer-events:none;">
        <div class="product-img" style="background:var(--surface-3);"></div>
        <div class="product-body">
          <div style="height:14px;background:var(--surface-3);border-radius:4px;margin-bottom:6px;width:80%;"></div>
          <div style="height:12px;background:var(--surface-3);border-radius:4px;width:55%;"></div>
        </div>
      </div>`;
  }
  function skeletonJob() {
    return `
      <div class="job-item" style="pointer-events:none;">
        <div style="width:44px;height:44px;border-radius:10px;background:var(--surface-3);flex-shrink:0;"></div>
        <div style="flex:1;">
          <div style="height:15px;background:var(--surface-3);border-radius:4px;margin-bottom:6px;width:65%;"></div>
          <div style="height:12px;background:var(--surface-3);border-radius:4px;width:40%;"></div>
        </div>
      </div>`;
  }

  const productGrid = document.getElementById('product-grid');
  if (productGrid) {
    productGrid.innerHTML = Array(4).fill(skeletonProduct()).join('');
    MLL.getProducts().then(data => {
      if (!data || !data.products?.length) {
        productGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--ink-muted);">No products yet.</div>`;
        return;
      }
      productGrid.innerHTML = data.products.slice(0, 4).map(p => `
        <div class="product-card reveal">
          <div class="product-img" style="background:${p.bg_color || '#EBF2FF'};">
            <span style="font-size:40px;">${p.emoji || '📦'}</span>
          </div>
          <div class="product-body">
            <div class="product-name">${p.name}</div>
            <div class="product-seller">by ${p.seller_name}</div>
            <div class="product-bottom">
              <span class="product-price">$${Number(p.price).toFixed(2)}</span>
              <span class="product-rating">★ ${p.rating}</span>
            </div>
          </div>
        </div>
      `).join('');
      observeReveal();
    });
  }

  const affGrid = document.getElementById('aff-grid');
  if (affGrid) {
    MLL.getAffiliates().then(data => {
      if (!data || !data.affiliates?.length) return;
      affGrid.innerHTML = data.affiliates.slice(0, 3).map(a => `
        <div class="aff-card reveal">
          <div class="aff-top">
            <div class="aff-logo" style="background:${a.bg_color || '#EBF2FF'};">${a.emoji || '🤝'}</div>
            <div>
              <div class="aff-name">${a.name}</div>
              <div class="aff-category">${a.category}</div>
            </div>
          </div>
          <div class="aff-desc">${a.description}</div>
          <div class="aff-footer">
            <span class="aff-commission">${a.commission_text}</span>
            <span class="aff-badge" style="background:${a.badge_bg};color:${a.badge_color};">Active</span>
          </div>
        </div>
      `).join('');
      observeReveal();
    });
  }

  const jobsList = document.getElementById('jobs-list');
  if (jobsList) {
    jobsList.innerHTML = Array(3).fill(skeletonJob()).join('');
    MLL.getJobs().then(data => {
      if (!data || !data.jobs?.length) {
        jobsList.innerHTML = `<div style="text-align:center;padding:40px;color:var(--ink-muted);">No jobs posted yet.</div>`;
        return;
      }
      jobsList.innerHTML = data.jobs.map(j => `
        <div class="job-item reveal" onclick="window.location='pages/jobs.html?id=${j.id}'">
          <div class="job-co-logo" style="background:${j.emoji_bg || '#EBF2FF'};">${j.emoji || '💼'}</div>
          <div class="job-info">
            <div class="job-title">${j.title}</div>
            <div class="job-meta">
              <span>${j.company_name}</span>
              <span>${j.city}, ${j.state}</span>
              <span>Posted ${timeAgo(j.posted_at)}</span>
            </div>
          </div>
          <div class="job-right">
            <span class="job-type" style="background:${j.type_bg || '#E1F5EE'};color:${j.type_color || '#085041'};">${j.job_type}</span>
            <span class="job-salary">${j.salary_range}</span>
          </div>
        </div>
      `).join('');
      observeReveal();
    });
  }

  window.handleSearch = () => {
    const q    = document.getElementById('search-input')?.value?.trim();
    const cat  = document.getElementById('search-cat')?.value;
    const city = document.getElementById('search-city')?.value;
    const params = new URLSearchParams();
    if (q)    params.set('q', q);
    if (cat)  params.set('category', cat);
    if (city) {
      const map = { MD: 'Maryland', VA: 'Virginia', DC: 'District of Columbia' };
      const m = city.match(/,\s*([A-Z]{2})$/);
      params.set('city', (m && map[m[1]]) ? map[m[1]] : city);
    }
    window.location.href = `pages/directory.html?${params.toString()}`;
  };

  document.getElementById('search-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') window.handleSearch();
  });

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 3600)  return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    return `${Math.floor(diff / 604800)} weeks ago`;
  }

});
