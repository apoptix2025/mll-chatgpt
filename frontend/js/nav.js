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
  });
})();
