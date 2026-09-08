(function (root) {
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + String(n);
  }

  function copyText(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
  }

  function copyBtn(text, label) {
    var aria = label || 'Copy';
    return '<button type="button" class="mcc-copy" data-copy="' + encodeURIComponent(text || '') + '" aria-label="' + escapeHtml(aria) + '"><span class="mcc-copy-label">Copy</span></button>';
  }

  function packSection(title, count, body) {
    var countHtml = count != null ? '<span class="mcc-pack-count"> · ' + count + '</span>' : '';
    return '<section class="mcc-pack-section"><h3 class="mcc-pack-h">' + escapeHtml(title) + countHtml + '</h3>' + body + '</section>';
  }

  function reportCard(label, bodyHtml, text, copyLabel) {
    return '<article class="mcc-report-card"><div class="mcc-report-top"><span class="mcc-report-label">' + escapeHtml(label) + '</span>' + copyBtn(text, copyLabel || ('Copy ' + label)) + '</div>' + bodyHtml + '</article>';
  }

  function fieldBlock(label, text) {
    if (!text) return '';
    return '<div class="mcc-field"><span class="mcc-field-lbl">' + escapeHtml(label) + '</span><p class="mcc-field-body">' + escapeHtml(text) + '</p></div>';
  }

  function renderFacebook(arr) {
    var rows = arr || [];
    if (!rows.length) return packSection('FACEBOOK', 0, '<div class="mcc-empty">No Facebook drafts yet.</div>');
    var cards = rows.map(function (x, i) {
      var text = typeof x === 'string' ? x : JSON.stringify(x);
      return reportCard('Post ' + pad2(i + 1), '<p class="mcc-report-body">' + escapeHtml(text) + '</p>', text, 'Copy Facebook post ' + (i + 1));
    }).join('');
    return packSection('FACEBOOK', rows.length, cards);
  }

  function renderInstagram(arr) {
    var rows = arr || [];
    if (!rows.length) return packSection('INSTAGRAM', 0, '<div class="mcc-empty">No Instagram drafts yet.</div>');
    var cards = rows.map(function (x, i) {
      var text = typeof x === 'string' ? x : JSON.stringify(x);
      return reportCard('Caption ' + pad2(i + 1), '<p class="mcc-report-body">' + escapeHtml(text) + '</p>', text, 'Copy Instagram caption ' + (i + 1));
    }).join('');
    return packSection('INSTAGRAM', rows.length, cards);
  }

  function renderReels(arr) {
    var rows = arr || [];
    if (!rows.length) return packSection('REEL / TIKTOK', 0, '<div class="mcc-empty">No reel concepts yet.</div>');
    var cards = rows.map(function (x, i) {
      var hook = '';
      var visual = '';
      var talking = '';
      var cta = '';
      var text = '';
      if (typeof x === 'string') {
        hook = x;
        talking = x;
        text = x;
      } else {
        hook = x.hook || '';
        visual = x.visual || '';
        talking = x.talking_point || '';
        cta = x.cta || '';
        text = [hook, visual, talking, cta].filter(Boolean).join('\n');
      }
      var body = fieldBlock('HOOK', hook) + fieldBlock('VISUAL', visual) + fieldBlock('TALKING POINT', talking) + fieldBlock('CTA', cta);
      return reportCard('Concept ' + pad2(i + 1), body, text, 'Copy reel concept ' + (i + 1));
    }).join('');
    return packSection('REEL / TIKTOK', rows.length, cards);
  }

  function renderSeo(seo) {
    var keywords = (seo && seo.keywords) || [];
    var local = (seo && seo.local_discovery) || [];
    if (!keywords.length && !local.length) return packSection('SEO & LOCAL DISCOVERY', 0, '<div class="mcc-empty">No SEO phrases yet.</div>');
    function chips(rows, kind) {
      return rows.map(function (x, i) {
        var text = typeof x === 'string' ? x : JSON.stringify(x);
        return '<button type="button" class="mcc-chip" data-copy="' + encodeURIComponent(text) + '" aria-label="Copy ' + kind + ' ' + (i + 1) + '"><span class="mcc-chip-text">' + escapeHtml(text) + '</span><span class="mcc-copy-label">Copy</span></button>';
      }).join('');
    }
    var body = '';
    if (keywords.length) body += '<div class="mcc-field"><span class="mcc-field-lbl">Keywords</span><div class="mcc-chip-row">' + chips(keywords, 'keyword') + '</div></div>';
    if (local.length) body += '<div class="mcc-field"><span class="mcc-field-lbl">Local discovery</span><div class="mcc-chip-row">' + chips(local, 'local phrase') + '</div></div>';
    return packSection('SEO & LOCAL DISCOVERY', keywords.length + local.length, '<article class="mcc-report-card">' + body + '</article>');
  }

  function renderSpotlight(spotlight) {
    var en = (spotlight && spotlight.en) || '';
    var es = (spotlight && spotlight.es) || '';
    var body =
      '<div class="mcc-report-top"><span class="mcc-report-label">BUSINESS SPOTLIGHT</span><span class="mcc-copy-row">' +
      copyBtn(en, 'Copy English spotlight') +
      copyBtn(es, 'Copy Spanish spotlight') +
      '</span></div>' +
      fieldBlock('English', en) +
      fieldBlock('Español', es);
    return packSection('BUSINESS SPOTLIGHT', null, '<article class="mcc-report-card">' + body + '</article>');
  }

  function renderEmail(mail) {
    var subject = (mail && mail.subject) || '';
    var preview = (mail && mail.preview) || '';
    var bodyText = (mail && mail.body) || '';
    var cta = (mail && mail.cta) || '';
    var text = [subject, preview, bodyText, cta].filter(Boolean).join('\n');
    var body = fieldBlock('SUBJECT', subject) + fieldBlock('PREVIEW TEXT', preview) + fieldBlock('BODY', bodyText) + fieldBlock('CTA', cta);
    return packSection('EMAIL CAMPAIGN', null, reportCard('EMAIL CAMPAIGN', body, text, 'Copy email campaign'));
  }

  function renderPack(pack) {
    if (!pack) return '<div class="mcc-empty">No pack generated yet. Drafts only — nothing auto-posts.</div>';
    return (
      renderFacebook(pack.facebook_posts) +
      renderInstagram(pack.instagram_captions) +
      renderReels(pack.tiktok_concepts) +
      renderSeo(pack.seo) +
      renderSpotlight(pack.bilingual_spotlight) +
      renderEmail(pack.email_campaign)
    );
  }

  function bindCopy(rootEl, onCopy) {
    if (!rootEl || rootEl._mllPackCopyBound) return;
    rootEl._mllPackCopyBound = true;
    rootEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-copy]');
      if (!btn || !rootEl.contains(btn)) return;
      var raw = btn.getAttribute('data-copy') || '';
      var text = raw;
      try { text = decodeURIComponent(raw); } catch (err) { text = raw; }
      copyText(text);
      var label = btn.querySelector('.mcc-copy-label');
      if (!label) return;
      btn.classList.add('is-copied');
      label.textContent = 'Copied';
      clearTimeout(btn._copiedTimer);
      btn._copiedTimer = setTimeout(function () {
        btn.classList.remove('is-copied');
        label.textContent = 'Copy';
      }, 1600);
      if (typeof onCopy === 'function' && text) onCopy();
    });
  }

  root.MLL_MARKETING_PACK = {
    render: renderPack,
    bindCopy: bindCopy,
  };
})(typeof window !== 'undefined' ? window : globalThis);
