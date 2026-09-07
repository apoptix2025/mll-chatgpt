(function () {
  var EVENTS = {
    '/': 'homepage_view',
    '/index.html': 'homepage_view',
    '/pages/directory.html': 'directory_view',
    '/pages/business.html': 'business_profile_view',
    '/pages/pricing.html': 'pricing_view',
    '/pages/enroll.html': 'signup_started'
  };

  function api() {
    return (window.MLL_CONFIG && window.MLL_CONFIG.API_URL) || '';
  }

  function sanitize(payload) {
    if (!payload || typeof payload !== 'object') return null;
    var keys = Object.keys(payload);
    for (var i = 0; i < keys.length; i++) {
      if (/password|token|authorization|stripe|card|cvv|prompt|email|message|secret/i.test(keys[i])) return null;
    }
    var event = String(payload.event || '');
    var allowed = {
      homepage_view: 1, directory_view: 1, business_profile_view: 1, business_website_click: 1,
      phone_click: 1, signup_started: 1, signup_completed: 1, pricing_view: 1, checkout_started: 1,
      paid_subscription_created: 1, ai_search: 1, ai_marketing_pack_generated: 1
    };
    if (!allowed[event]) return null;
    var out = { event: event };
    if (payload.path) out.path = String(payload.path).split('?')[0].slice(0, 80);
    if (payload.slug) out.slug = String(payload.slug).replace(/[^a-z0-9-]/gi, '').slice(0, 80);
    return out;
  }

  function track(event, extra) {
    var payload = sanitize(Object.assign({ event: event }, extra || {}));
    if (!payload || !api()) return;
    try {
      fetch(api() + '/api/analytics/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  }

  function pageEvent() {
    var path = location.pathname.replace(/\/$/, '') || '/';
    if (path === '/pages/directory') return 'directory_view';
    if (path === '/pages/business') return 'business_profile_view';
    if (path === '/pages/pricing') return 'pricing_view';
    if (path === '/pages/enroll') return 'signup_started';
    return EVENTS[location.pathname] || EVENTS[path] || (path === '' || path === '/' ? 'homepage_view' : null);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var mapped = pageEvent();
    if (mapped) {
      var extra = { path: location.pathname };
      var slug = new URLSearchParams(location.search).get('slug') || new URLSearchParams(location.search).get('id');
      if (slug) extra.slug = slug;
      track(mapped, extra);
    }
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a || !a.href) return;
      if (a.href.indexOf('tel:') === 0) track('phone_click', { path: location.pathname });
      if (a.id === 'btn-website' || a.id === 'cc-website' || a.className.indexOf('btn-website') !== -1) {
        if (a.href.indexOf('http') === 0) track('business_website_click', { path: location.pathname });
      }
    });
  });

  window.MLL_ANALYTICS = { track: track };
})();
