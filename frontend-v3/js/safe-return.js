// Same-origin relative login return only. Rejects open redirects.
(function (global) {
  function safeLoginReturn(raw) {
    if (typeof raw !== 'string') return 'dashboard.html';
    var t = raw.trim();
    if (!t) return 'dashboard.html';
    if (
      t.indexOf('\\') !== -1 ||
      t.indexOf('..') !== -1 ||
      t.indexOf(':') !== -1 ||
      t.indexOf('?') !== -1 ||
      t.indexOf('#') !== -1 ||
      t.indexOf('//') === 0
    ) {
      return 'dashboard.html';
    }
    var page = t;
    if (t.indexOf('/pages/') === 0) page = t.slice(7);
    if (!page || page.charAt(0) === '/') return 'dashboard.html';
    if (!/\.html$/.test(page)) page += '.html';
    if (!/^[a-z0-9][a-z0-9-]*\.html$/.test(page)) return 'dashboard.html';
    return page;
  }

  function loginReturnFromSearch(search) {
    var raw = '';
    var q = String(search || '');
    if (q.charAt(0) === '?') q = q.slice(1);
    var parts = q.split('&');
    for (var i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf('=');
      var key = eq === -1 ? parts[i] : parts[i].slice(0, eq);
      var val = eq === -1 ? '' : parts[i].slice(eq + 1);
      try { key = decodeURIComponent(key.replace(/\+/g, ' ')); } catch (e1) { /* keep */ }
      if (key !== 'return') continue;
      try { raw = decodeURIComponent(val.replace(/\+/g, ' ')); } catch (e2) { raw = val; }
      break;
    }
    return safeLoginReturn(raw);
  }

  global.MLL_SAFE_RETURN = {
    safeLoginReturn: safeLoginReturn,
    loginReturnFromSearch: loginReturnFromSearch,
  };
})(typeof window !== 'undefined' ? window : globalThis);
