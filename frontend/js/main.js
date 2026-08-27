// ============================================================
// MYLATINOLIST — MAIN JS
// Fetches live data from Cloudflare Workers API
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // --- NAV SCROLL ---
  const nav = document.getElementById('nav');
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });

  // (Hamburger + mobile-menu close handled centrally in js/nav.js)

  // Show dashboard or sign in based on auth state
  const isLoggedIn = !!sessionStorage.getItem('mll_token');
  const mobSignin   = document.getElementById('mob-signin');
  const mobDash     = document.getElementById('mob-dashboard');
  if (mobSignin && mobDash) {
    mobSignin.style.display  = isLoggedIn ? 'none'  : 'block';
    mobDash.style.display    = isLoggedIn ? 'block' : 'none';
  }

  // Also update desktop nav Sign in → Dashboard when logged in
  if (isLoggedIn) {
    const signinBtn = document.querySelector('.nav-actions .btn-ghost');
    if (signinBtn) {
      signinBtn.textContent = 'My dashboard';
      signinBtn.href = 'pages/dashboard.html';
    }
  }

  // --- REVEAL ON SCROLL ---
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

  setTimeout(() => {
    document.querySelectorAll('.hero .reveal').forEach(el => el.classList.add('visible'));
  }, 80);

  // --- SKELETON LOADER ---
  function skeletonCard(type = 'biz') {
    if (type === 'biz') return `
      <div class="biz-card" style="pointer-events:none;">
        <div class="biz-header" style="background:var(--surface-3);"></div>
        <div class="biz-body">
          <div style="height:16px;background:var(--surface-3);border-radius:4px;margin-bottom:8px;width:70%;"></div>
          <div style="height:12px;background:var(--surface-3);border-radius:4px;margin-bottom:6px;width:45%;"></div>
          <div style="height:12px;background:var(--surface-3);border-radius:4px;width:90%;"></div>
        </div>
      </div>`;
    if (type === 'product') return `
      <div class="product-card" style="pointer-events:none;">
        <div class="product-img" style="background:var(--surface-3);"></div>
        <div class="product-body">
          <div style="height:14px;background:var(--surface-3);border-radius:4px;margin-bottom:6px;width:80%;"></div>
          <div style="height:12px;background:var(--surface-3);border-radius:4px;width:55%;"></div>
        </div>
      </div>`;
    if (type === 'job') return `
      <div class="job-item" style="pointer-events:none;">
        <div style="width:44px;height:44px;border-radius:10px;background:var(--surface-3);flex-shrink:0;"></div>
        <div style="flex:1;">
          <div style="height:15px;background:var(--surface-3);border-radius:4px;margin-bottom:6px;width:65%;"></div>
          <div style="height:12px;background:var(--surface-3);border-radius:4px;width:40%;"></div>
        </div>
      </div>`;
    return '';
  }

  // --- RENDER BUSINESSES ---
  const bizGrid = document.getElementById('biz-grid');
  if (bizGrid) {
    bizGrid.innerHTML = Array(6).fill(skeletonCard('biz')).join('');
    MLL.getBusinesses().then(data => {
      if (!data || !data.businesses?.length) {
        bizGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--ink-muted);">No businesses found.</div>`;
        return;
      }
      bizGrid.innerHTML = data.businesses.map(b => `
        <div class="biz-card reveal" onclick="window.location='pages/business.html?id=${b.slug}'">
          <div class="biz-header" style="background:${b.bg_color || '#EBF2FF'};">
            <span style="font-size:40px;">${b.emoji || '🏢'}</span>
            ${b.is_featured ? '<span class="biz-featured-tag">Featured</span>' : ''}
          </div>
          <div class="biz-body">
            <div class="biz-name">${b.name}</div>
            <div class="biz-cat">${b.category} · ${b.city}, ${b.state}</div>
            <div class="biz-desc">${b.description || ''}</div>
            <div class="biz-tags">${(b.tags || []).map(t => `<span class="biz-tag">${t}</span>`).join('')}</div>
          </div>
          <div class="biz-footer">
            <span class="biz-rating">★ ${b.rating} <span style="color:var(--ink-muted);font-weight:400;">(${b.review_count})</span></span>
            <span class="biz-city">${b.city}, ${b.state}</span>
            <span style="font-size:12px;font-weight:600;color:var(--coral);">View →</span>
          </div>
        </div>
      `).join('');
      observeReveal();
    });
  }

  // --- RENDER PRODUCTS ---
  const productGrid = document.getElementById('product-grid');
  if (productGrid) {
    productGrid.innerHTML = Array(4).fill(skeletonCard('product')).join('');
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

  // --- RENDER AFFILIATES ---
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

  // --- RENDER JOBS ---
  const jobsList = document.getElementById('jobs-list');
  if (jobsList) {
    jobsList.innerHTML = Array(3).fill(skeletonCard('job')).join('');
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

  // --- SEARCH ---
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

  // --- HELPERS ---
  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 3600)  return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    return `${Math.floor(diff / 604800)} weeks ago`;
  }

});

