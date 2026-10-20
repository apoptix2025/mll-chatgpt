/* Safe rendering and filtering adapted from directory.html and media.js.
 * Generic stock-photo and slug/photo fallback maps were intentionally excluded.
 */
(function (global) {
  'use strict';
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function webURL(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value);
      return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url.href : '';
    } catch (_) { return ''; }
  }
  function imageURL(record) {
    return webURL(record?.image_url) || webURL(record?.logo_url) || '';
  }
  function rating(record) {
    const score = Number(record?.rating), count = Number(record?.review_count);
    return record?.rating != null && record?.rating !== '' && Number.isFinite(score) && score >= 0 && score <= 5 && Number.isInteger(count) && count > 0
      ? { score, count } : null;
  }
  function sortBusinesses(records, mode) {
    return records.slice().sort((a, b) => mode === 'az'
      ? String(a.name || '').localeCompare(String(b.name || ''))
      : mode === 'rating'
        ? (rating(b)?.score ?? -1) - (rating(a)?.score ?? -1)
        : Number(!!b.is_featured) - Number(!!a.is_featured));
  }
  function searchRecords(records, query, city, fields) {
    const q = String(query || '').trim().toLocaleLowerCase();
    const location = String(city || '').trim().toLocaleLowerCase();
    return records.filter(record => (!q || fields.some(key => String(record[key] || '').toLocaleLowerCase().includes(q))) &&
      (!location || [record.city, record.state].filter(Boolean).join(', ').toLocaleLowerCase().includes(location)));
  }
  function hasNext(data, loaded) {
    if (Number.isFinite(data.total)) return loaded < data.total;
    return Number.isFinite(data.limit) && data.limit > 0 && data.businesses?.length === data.limit;
  }
  global.MLL_VIEW = Object.freeze({ esc, webURL, imageURL, rating, sortBusinesses, searchRecords, hasNext });
})(typeof window === 'undefined' ? globalThis : window);
