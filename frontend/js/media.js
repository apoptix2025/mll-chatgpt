// Category photography + reusable business card markup (staging demo imagery).
// Photos are generic Unsplash category images bundled locally — not third-party business photos.
(function () {
  var BASE = '/assets/businesses/';
  var BY_SLUG = {
    'la-cocina-de-maryland': BASE + 'restaurant.jpg',
    'mendez-remodeling-co': BASE + 'remodeling.jpg',
    'flores-beauty-studio': BASE + 'beauty.jpg',
    'vega-immigration-law': BASE + 'legal.jpg',
    'herrera-homes': BASE + 'real-estate.jpg',
    'herrera-homes-realty': BASE + 'real-estate.jpg',
    'ortega-auto-care': BASE + 'auto.jpg',
    'vargas-tax': BASE + 'accounting.jpg',
    'vargas-tax-accounting': BASE + 'accounting.jpg',
    'salud-latina-wellness': BASE + 'wellness.jpg'
  };
  var BY_CATEGORY = {
    'Food & Dining': BASE + 'restaurant.jpg',
    'Construction': BASE + 'remodeling.jpg',
    'Beauty & Salon': BASE + 'beauty.jpg',
    'Legal Services': BASE + 'legal.jpg',
    'Real Estate': BASE + 'real-estate.jpg',
    'Auto & Repair': BASE + 'auto.jpg',
    'Finance': BASE + 'accounting.jpg',
    'Health & Wellness': BASE + 'wellness.jpg'
  };

  function savedList() {
    try { return JSON.parse(localStorage.getItem('mll_saved') || '[]'); }
    catch (e) { return []; }
  }
  function isSaved(slug) { return savedList().indexOf(slug) !== -1; }
  function toggleSaved(slug) {
    var list = savedList();
    var i = list.indexOf(slug);
    if (i === -1) list.push(slug); else list.splice(i, 1);
    try { localStorage.setItem('mll_saved', JSON.stringify(list)); } catch (e) {}
    return list.indexOf(slug) !== -1;
  }

  function imageUrl(biz) {
    if (!biz) return BASE + 'community.jpg';
    if (biz.slug && BY_SLUG[biz.slug]) return BY_SLUG[biz.slug];
    if (biz.logo_url && /^https?:/.test(biz.logo_url) && biz.logo_url.indexOf('media.mylatinolist.io') === -1) {
      return biz.logo_url;
    }
    return BY_CATEGORY[biz.category] || (BASE + 'community.jpg');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function cardHTML(biz, opts) {
    opts = opts || {};
    var href = (opts.prefix || 'pages/') + 'business.html?id=' + encodeURIComponent(biz.slug);
    var saved = isSaved(biz.slug) ? ' is-saved' : '';
    var rating = biz.rating != null && biz.rating !== '' ? Number(biz.rating).toFixed(1) : '—';
    var reviews = biz.review_count != null ? biz.review_count : 0;
    var loc = esc(biz.city || '') + (biz.state ? ', ' + esc(biz.state) : '');
    return (
      '<article class="v2-card">' +
        '<div class="v2-card-media">' +
          '<a href="' + href + '"><img src="' + esc(imageUrl(biz)) + '" alt="' + esc(biz.name) + '"></a>' +
          '<button type="button" class="v2-heart' + saved + '" data-save="' + esc(biz.slug) + '" aria-label="Save">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" stroke="currentColor" stroke-width="1.8"/></svg>' +
          '</button>' +
          '<span class="v2-chip">' + esc(biz.category || '') + '</span>' +
        '</div>' +
        '<div class="v2-card-body">' +
          '<a href="' + href + '"><h3>' + esc(biz.name) + '</h3></a>' +
          '<div class="v2-card-meta">' +
            '<span class="v2-stars">★ ' + rating + '</span>' +
            '<span>(' + reviews + ')</span>' +
            '<span>·</span>' +
            '<span>' + loc + '</span>' +
          '</div>' +
          (opts.showDesc && biz.description ? '<p class="v2-card-desc">' + esc(biz.description) + '</p>' : '') +
          '<a class="v2-card-cta" href="' + href + '">' + (opts.cta || 'View profile →') + '</a>' +
        '</div>' +
      '</article>'
    );
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-save]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    var on = toggleSaved(btn.getAttribute('data-save'));
    btn.classList.toggle('is-saved', on);
  });

  window.MLL_MEDIA = {
    imageUrl: imageUrl,
    cardHTML: cardHTML,
    isSaved: isSaved,
    toggleSaved: toggleSaved,
    BY_CATEGORY: BY_CATEGORY
  };
})();
