// ============================================================
// MYLATINOLIST — JS i18n string table + lookup (loaded before nav.js)
// Translates JS-rendered strings that data-en/data-es can't reach.
// Keyed by the English source string; English is the fallback.
// See docs/i18n-js-pass.md. Seeded incrementally per chunk.
// ============================================================
(function () {
  function mllLang() {
    try { return localStorage.getItem('mll_lang') || 'en'; } catch (e) { return 'en'; }
  }

  // ES overrides only. English keys; missing key -> English fallback.
  // Use {n}-style tokens for interpolation.
  window.I18N_ES = {
    // ── voz.html (Chunk 1) ──────────────────────────────────
    '{n} resources': '{n} recursos',
    'No resources found. Try a different filter.': 'No se encontraron recursos. Prueba otro filtro.',
    'Could not load resources. Please try again.': 'No pudimos cargar los recursos. Inténtalo de nuevo.',

    // ── marketplace.html (Chunk 2) ──────────────────────────
    '{n} products': '{n} productos',
    'No products found.': 'No se encontraron productos.',
    'No products found in this category.': 'No se encontraron productos en esta categoría.',
    'Be the first to sell here →': 'Sé el primero en vender aquí →',
    'Could not load products. Please try again.': 'No pudimos cargar los productos. Inténtalo de nuevo.',
    'by {seller}': 'por {seller}',

    // ── jobs.html (Chunk 2) ─────────────────────────────────
    '{n} open positions': '{n} empleos disponibles',
    'No jobs found matching your filters.': 'No hay empleos que coincidan con tus filtros.',
    'Post the first job →': 'Publica el primer empleo →',
    'Could not load jobs. Please try again.': 'No pudimos cargar los empleos. Inténtalo de nuevo.',
    'Bilingual': 'Bilingüe',
    'Posted': 'Publicado',
    '{n}h ago': 'hace {n}h',
    '{n} days ago': 'hace {n} días',
    '{n} weeks ago': 'hace {n} semanas',

    // ── directory.html (Chunk 3) ────────────────────────────
    'Featured': 'Destacado',
    'No businesses found': 'No se encontraron negocios',
    'Try adjusting your search or filters.': 'Prueba ajustando tu búsqueda o filtros.',
    'Clear all filters': 'Borrar todos los filtros',
    'Load more businesses ({n} remaining)': 'Ver más negocios ({n} restantes)',
    '{n} businesses': '{n} negocios',
    '{n} of {m} businesses': '{n} de {m} negocios',
    'Could not load businesses': 'No pudimos cargar los negocios',
    'Please check your connection and try again.': 'Revisa tu conexión e inténtalo de nuevo.',
    'Retry': 'Reintentar'
  };

  // t('English source', {n: 5}) -> ES if lang=es and key present, else English.
  window.t = function (en, vars) {
    var s = (mllLang() === 'es' && window.I18N_ES[en]) || en;
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) {
      return (vars[k] != null) ? vars[k] : m;
    });
  };
})();
