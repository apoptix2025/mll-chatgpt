// ============================================================
// MYLATINOLIST — NAV + LANGUAGE ENGINE (shared, loaded on every page)
// Class/attribute-based — no per-page element IDs, so multiple
// toggles (desktop nav, mobile menu, footer) coexist on one page.
// ============================================================
(function () {
  // --- LANGUAGE ENGINE ---
  // Persists the choice in localStorage('mll_lang') so it carries
  // across navigation. Translates any element carrying data-en/data-es.
  var currentLang = null;

  // Apply translations to static data-en / data-en-ph elements + toggle state.
  function applyLang(lang) {
    try { localStorage.setItem('mll_lang', lang); } catch (e) {}
    document.querySelectorAll('[data-en]').forEach(function (el) {
      var txt = lang === 'es' ? el.getAttribute('data-es') : el.getAttribute('data-en');
      if (txt != null) el.innerHTML = txt;
    });
    // Placeholders (data-en-ph / data-es-ph) — attribute, not innerHTML
    document.querySelectorAll('[data-en-ph]').forEach(function (el) {
      var ph = lang === 'es' ? el.getAttribute('data-es-ph') : el.getAttribute('data-en-ph');
      if (ph != null) el.setAttribute('placeholder', ph);
    });
    // Active state on every toggle button (nav / mobile / footer).
    // forEach over an empty set is a no-op, so this is inherently
    // null-safe on pages that have no footer or no toggle.
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
  }

  function switchLang(lang) {
    applyLang(lang);
    // Notify JS-rendered pages to re-render — only on an ACTUAL change, so the
    // initial page load doesn't re-render before each page fetches its data.
    // (Initial render is already localized because t() reads mll_lang.)
    if (lang !== currentLang) {
      currentLang = lang;
      document.dispatchEvent(new CustomEvent('mll:langswitch', { detail: { lang: lang } }));
    }
  }
  window.switchLang = switchLang;

  document.addEventListener('DOMContentLoaded', function () {
    // Apply the persisted language on load (default English).
    var saved = null;
    try { saved = localStorage.getItem('mll_lang'); } catch (e) {}
    var lang = saved || 'en';
    currentLang = lang;          // set first so the initial apply does NOT dispatch
    applyLang(lang);

    // --- HAMBURGER (full-nav pages) ---
    document.querySelectorAll('.hamburger').forEach(function (h) {
      h.addEventListener('click', function () {
        var menu = document.querySelector('.nav-mobile');
        if (menu) menu.classList.toggle('open');
      });
    });
    // Close the mobile menu when a link inside it is tapped.
    document.querySelectorAll('.nav-mobile a').forEach(function (a) {
      a.addEventListener('click', function () {
        var menu = a.closest('.nav-mobile');
        if (menu) menu.classList.remove('open');
      });
    });

    injectMobileNav();
  });

  function inPages() {
    return location.pathname.indexOf('/pages/') !== -1;
  }
  function pagesPrefix() { return inPages() ? '' : 'pages/'; }
  function homeHref() { return inPages() ? '../index.html' : '/index.html'; }

  function injectMobileNav() {
    if (document.querySelector('.mll-bottom-nav')) return;
    document.body.classList.add('has-mll-bottom-nav');
    var p = pagesPrefix();
    var home = homeHref();
    var path = location.pathname;
    function active(name) {
      if (name === 'home') return /index\.html\/?$/.test(path) || path.endsWith('/') && !inPages();
      if (name === 'explore') return /directory\.html|business\.html/.test(path);
      if (name === 'saved') return /directory\.html/.test(path) && location.hash === '#saved';
      if (name === 'profile') return /login\.html|dashboard\.html|billing\.html|listing\.html|analytics\.html/.test(path);
      return false;
    }
    var token = null;
    try { token = sessionStorage.getItem('mll_token'); } catch (e) {}
    var profileHref = token ? p + 'dashboard.html' : p + 'login.html';

    var nav = document.createElement('nav');
    nav.className = 'mll-bottom-nav';
    nav.setAttribute('aria-label', 'Mobile');
    nav.innerHTML =
      '<a class="' + (active('home') ? 'is-active' : '') + '" href="' + home + '"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg><span data-en="Home" data-es="Inicio">Home</span></a>' +
      '<a class="' + (active('explore') ? 'is-active' : '') + '" href="' + p + 'directory.html"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.7"/><path d="M16 16l4 4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span data-en="Explore" data-es="Explorar">Explore</span></a>' +
      '<button type="button" class="mll-add" id="mll-add-btn" aria-label="Add">+</button>' +
      '<a href="' + p + 'directory.html#saved"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M7 4h10a1 1 0 011 1v16l-6-3.5L6 21V5a1 1 0 011-1z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg><span data-en="Saved" data-es="Guardados">Saved</span></a>' +
      '<a class="' + (active('profile') ? 'is-active' : '') + '" href="' + profileHref + '"><svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.7"/><path d="M5 19c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><span data-en="Profile" data-es="Perfil">Profile</span></a>';
    document.body.appendChild(nav);

    var backdrop = document.createElement('div');
    backdrop.className = 'mll-sheet-backdrop';
    backdrop.innerHTML =
      '<div class="mll-sheet" role="dialog" aria-label="Create">' +
        '<h3 data-en="Add to My Latino List" data-es="Agregar a My Latino List">Add to My Latino List</h3>' +
        '<a href="' + p + 'enroll.html"><span>🏪</span><span data-en="List my business" data-es="Registrar mi negocio">List my business</span></a>' +
        '<a href="' + p + 'marketplace.html"><span>🛍️</span><span data-en="Sell a product" data-es="Vender un producto">Sell a product</span></a>' +
        '<a href="' + p + 'jobs.html"><span>💼</span><span data-en="Post a job" data-es="Publicar un empleo">Post a job</span></a>' +
        '<a href="' + p + 'voz.html"><span>📚</span><span data-en="Share a resource" data-es="Compartir un recurso">Share a resource</span></a>' +
      '</div>';
    document.body.appendChild(backdrop);
    document.getElementById('mll-add-btn').addEventListener('click', function () {
      backdrop.classList.add('open');
    });
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) backdrop.classList.remove('open');
    });
    applyLang(currentLang || 'en');
  }
})();
