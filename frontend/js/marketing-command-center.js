(function () {
  var API = (window.MLL_CONFIG && window.MLL_CONFIG.API_URL) || '';
  var token = null;
  try { token = sessionStorage.getItem('mll_token'); } catch (e) {}

  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function authHeaders() {
    return { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  }
  async function api(path, opts) {
    var res = await fetch(API + path, Object.assign({ headers: authHeaders() }, opts || {}));
    var data = await res.json().catch(function () { return {}; });
    return { res: res, data: data };
  }

  function showDenied(msg) {
    $('mcc-loading').style.display = 'none';
    $('mcc-app').style.display = 'none';
    $('mcc-denied').style.display = 'block';
    $('mcc-denied-msg').textContent = msg || 'Admin access required.';
  }

  function kpi(el, value, note, emptyNote) {
    if (value == null) {
      el.querySelector('.mcc-kpi-num').textContent = '—';
      el.querySelector('.mcc-kpi-note').textContent = emptyNote;
      return;
    }
    el.querySelector('.mcc-kpi-num').textContent = String(value);
    el.querySelector('.mcc-kpi-note').textContent = note || '';
  }

  function renderScore(score) {
    $('mcc-score-total').textContent = score.total + ' / ' + score.max;
    var html = (score.categories || []).map(function (c) {
      var pct = Math.round((c.score / c.max) * 100);
      var reasons = (c.reasons || []).map(function (r) { return '<li>' + escapeHtml(r) + '</li>'; }).join('');
      return '<div class="mcc-cat"><div class="mcc-cat-top"><strong>' + escapeHtml(c.label) + '</strong><span>' + c.score + '/' + c.max + (c.status === 'not_connected' ? ' · Not connected yet' : '') + '</span></div><div class="mcc-bar"><span style="width:' + pct + '%"></span></div><ul class="mcc-reasons">' + reasons + '</ul></div>';
    }).join('');
    $('mcc-score-breakdown').innerHTML = html || '<div class="mcc-empty">Score unavailable.</div>';
  }

  function renderOpps(rows) {
    if (!rows || !rows.length) {
      $('mcc-opps').innerHTML = '<div class="mcc-empty">No gaps detected from current measurable data.</div>';
      return;
    }
    $('mcc-opps').innerHTML = rows.map(function (o) {
      return '<div class="mcc-opp"><strong>' + escapeHtml(o.title) + '</strong><p>' + escapeHtml(o.detail) + '</p></div>';
    }).join('');
  }

  function copyText(text) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
  }

  function copyable(text) {
    return ' <button type="button" class="mcc-btn" data-copy="' + encodeURIComponent(text) + '">Copy</button>';
  }
  function listStrings(title, arr) {
    var items = (arr || []).map(function (x) {
      var text = typeof x === 'string' ? x : JSON.stringify(x);
      return '<li>' + escapeHtml(text) + copyable(text) + '</li>';
    }).join('');
    return '<div class="mcc-draft"><h3>' + title + '</h3><ul>' + items + '</ul></div>';
  }
  function renderTiktok(arr) {
    if (!arr || !arr.length) return '<div class="mcc-draft"><h3>TikTok / Reel concepts</h3><div class="mcc-empty">No concepts yet.</div></div>';
    var items = arr.map(function (x) {
      if (typeof x === 'string') return '<li>' + escapeHtml(x) + copyable(x) + '</li>';
      var hook = x.hook || '';
      var visual = x.visual || '';
      var talking = x.talking_point || '';
      var cta = x.cta || '';
      var text = [hook, visual, talking, cta].filter(Boolean).join('\n');
      return '<li class="mcc-struct"><strong>Hook:</strong> ' + escapeHtml(hook) +
        '<br><strong>Visual:</strong> ' + escapeHtml(visual) +
        '<br><strong>Talking point:</strong> ' + escapeHtml(talking) +
        '<br><strong>CTA:</strong> ' + escapeHtml(cta) +
        copyable(text) + '</li>';
    }).join('');
    return '<div class="mcc-draft"><h3>TikTok / Reel concepts</h3><ul>' + items + '</ul></div>';
  }
  function renderPromote(p) {
    var rows = p.promote || [];
    if (!rows.length) {
      var msg = p.promote_empty_message || 'No eligible grounded listings available for this pack.';
      return '<div class="mcc-draft"><h3>Promote (grounded listings/categories only)</h3><div class="mcc-empty">' + escapeHtml(msg) + '</div></div>';
    }
    var items = rows.map(function (x) {
      if (typeof x === 'string') return '<li>' + escapeHtml(x) + copyable(x) + '</li>';
      var loc = [x.city, x.state].filter(Boolean).join(', ');
      var line = (x.name || '') + (x.category ? ' · ' + x.category : '') + (loc ? ' · ' + loc : '');
      var reason = x.reason || '';
      var text = line + (reason ? ' — ' + reason : '');
      return '<li class="mcc-struct"><strong>' + escapeHtml(x.name || '') + '</strong>' +
        '<br>' + escapeHtml([x.category, loc].filter(Boolean).join(' · ')) +
        (reason ? '<br>' + escapeHtml(reason) : '') +
        copyable(text) + '</li>';
    }).join('');
    return '<div class="mcc-draft"><h3>Promote (grounded listings/categories only)</h3><ul>' + items + '</ul></div>';
  }
  function renderPack(stored) {
    var box = $('mcc-pack');
    if (!stored || !stored.pack) {
      box.innerHTML = '<div class="mcc-empty">No pack generated yet. Drafts only — nothing auto-posts.</div>';
      return;
    }
    var p = stored.pack;
    var spotlight = p.bilingual_spotlight || {};
    var voz = typeof p.la_voz_idea === 'object' && p.la_voz_idea
      ? p.la_voz_idea
      : { title: p.la_voz_idea || '', angle: '' };
    var mail = typeof p.newsletter === 'object' && p.newsletter
      ? p.newsletter
      : { subject: p.newsletter || '', purpose: '' };
    box.innerHTML =
      '<p class="mcc-empty">Generated ' + escapeHtml(stored.created_at || '') + ' · Drafts only · Approve/copy before publishing' + (stored.fallback ? ' · Grounded fallback used' : '') + '</p>' +
      listStrings('Facebook posts', p.facebook_posts) +
      listStrings('Instagram captions', p.instagram_captions) +
      renderTiktok(p.tiktok_concepts) +
      '<div class="mcc-draft"><h3>Bilingual business spotlight</h3><p><strong>EN:</strong> ' + escapeHtml(spotlight.en || '') + '</p><p><strong>ES:</strong> ' + escapeHtml(spotlight.es || '') + '</p></div>' +
      '<div class="mcc-draft"><h3>La Voz Latino article idea</h3><p><strong>' + escapeHtml(voz.title || '') + '</strong></p><p>' + escapeHtml(voz.angle || '') + '</p></div>' +
      listStrings('SEO / keyword opportunities', p.keywords) +
      '<div class="mcc-draft"><h3>Email / newsletter concept</h3><p><strong>' + escapeHtml(mail.subject || '') + '</strong></p><p>' + escapeHtml(mail.purpose || '') + '</p></div>' +
      renderPromote(p);
  }

  function renderCampaigns(rows) {
    var list = rows || [];
    if (!list.length) {
      $('mcc-campaign-table').innerHTML = '';
      $('mcc-campaign-cards').innerHTML = '<div class="mcc-empty">No campaigns yet. Create a draft to start tracking.</div>';
      return;
    }
    $('mcc-campaign-table').innerHTML = '<table class="mcc-table"><thead><tr><th>Name</th><th>Channel</th><th>Status</th><th>Dates</th><th>Objective</th></tr></thead><tbody>' +
      list.map(function (c) {
        return '<tr><td>' + escapeHtml(c.name) + '</td><td>' + escapeHtml(c.channel) + '</td><td>' + escapeHtml(c.status) + '</td><td>' + escapeHtml((c.start_date || '—') + ' → ' + (c.end_date || '—')) + '</td><td>' + escapeHtml(c.objective) + '</td></tr>';
      }).join('') + '</tbody></table>';
    $('mcc-campaign-cards').innerHTML = list.map(function (c) {
      return '<div class="mcc-campaign-card"><strong>' + escapeHtml(c.name) + '</strong><p>' + escapeHtml(c.channel) + ' · ' + escapeHtml(c.status) + '</p><p>' + escapeHtml(c.objective) + '</p></div>';
    }).join('');
  }

  function renderReport(report) {
    var c = report.current || {};
    var msg = (report.collection && report.collection.message) || (!report.baseline ? 'Baseline collection in progress.' : '');
    var started = report.collection && report.collection.started_at ? ' Collection began ' + report.collection.started_at.slice(0, 10) + '.' : '';
    $('mcc-report').innerHTML =
      (msg ? '<div class="mcc-empty">' + escapeHtml(msg + started) + '</div>' : '') +
      '<ul class="mcc-reasons">' +
      '<li>Digital Footprint Score now: ' + (c.footprint_score == null ? '—' : c.footprint_score) + (report.change && report.change.footprint_score != null ? ' (change ' + report.change.footprint_score + ')' : ' — no invented % improvement') + '</li>' +
      '<li>Traffic activity: ' + (c.traffic_activity == null ? 'Not connected yet' : c.traffic_activity) + '</li>' +
      '<li>Profile discovery views: ' + (c.profile_discovery == null ? '—' : c.profile_discovery) + '</li>' +
      '<li>Signups: ' + (c.signups == null ? '—' : c.signups) + '</li>' +
      '<li>Conversion activity (paid plans + leads): ' + (c.conversion_activity == null ? '—' : c.conversion_activity) + '</li>' +
      '<li>AI search events: ' + (c.ai_search == null ? '—' : c.ai_search) + '</li>' +
      '<li>Campaigns created: ' + (c.campaigns_created == null ? '—' : c.campaigns_created) + '</li>' +
      '<li>Content generated (packs stored): ' + (c.content_generated == null ? '—' : c.content_generated) + '</li>' +
      '</ul>';
  }

  async function loadAll() {
    var summary = await api('/api/admin/marketing/summary');
    if (summary.res.status === 401 || summary.res.status === 403) {
      showDenied(summary.res.status === 401 ? 'Sign in required.' : 'This Command Center is limited to AP Optix admin.');
      return;
    }
    if (!summary.res.ok) {
      showDenied('Could not load marketing summary.');
      return;
    }
    $('mcc-loading').style.display = 'none';
    $('mcc-denied').style.display = 'none';
    $('mcc-app').style.display = 'block';
    var d = summary.data;
    kpi($('kpi-score'), d.score && d.score.total, 'of 100 from measurable MLL data', 'Not connected yet');
    kpi($('kpi-web'), d.activity && d.activity.website, 'first-party views', d.collection_note || 'Analytics collection started — results will appear as traffic is recorded.');
    kpi($('kpi-signups'), d.activity && d.activity.signups, 'profiles in directory DB', 'No signup records yet');
    kpi($('kpi-ai'), d.activity && d.activity.ai_search, 'MLL AI searches recorded', 'No AI search events yet');
    kpi($('kpi-conv'), d.activity && d.activity.conversion, 'paid plans + leads counted', 'No conversion records yet');
    renderScore(d.score || { total: 0, max: 100, categories: [] });
    renderOpps(d.opportunities || []);
    renderPack(d.latest_pack);
    renderCampaigns(d.campaigns || []);
    var report = await api('/api/admin/marketing/report');
    if (report.res.ok) renderReport(report.data);
  }

  document.addEventListener('DOMContentLoaded', async function () {
    if (!token) { showDenied('Sign in with an AP Optix admin account.'); return; }
    var me = await fetch(API + '/api/auth/me', { headers: { Authorization: 'Bearer ' + token } });
    if (!me.ok) { showDenied('Session expired. Please sign in again.'); return; }
    var body = await me.json();
    var email = (body.user && body.user.email) || (body.profile && body.profile.email) || '';
    if (!window.MLL_CURRENT_BUSINESS || !window.MLL_CURRENT_BUSINESS.isAdminEmail(email)) {
      showDenied('This Command Center is limited to AP Optix admin.');
      return;
    }
    await loadAll();
    $('mcc-pack-form').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-copy]');
      if (!btn) return;
      copyText(decodeURIComponent(btn.getAttribute('data-copy') || ''));
    });
    $('btn-generate-pack').addEventListener('click', async function () {
      $('btn-generate-pack').disabled = true;
      $('mcc-pack-status').textContent = 'Generating one grounded draft pack…';
      var out = await api('/api/admin/marketing/pack', { method: 'POST', body: '{}' });
      $('btn-generate-pack').disabled = false;
      if (!out.res.ok) {
        $('mcc-pack-status').textContent = out.data.message || out.data.error || 'Could not generate pack.';
        return;
      }
      $('mcc-pack-status').textContent = 'Draft ready. Nothing was posted.';
      renderPack(out.data.pack);
      var report = await api('/api/admin/marketing/report');
      if (report.res.ok) renderReport(report.data);
    });
    $('btn-create-campaign').addEventListener('click', async function () {
      var payload = {
        name: $('c-name').value,
        channel: $('c-channel').value,
        objective: $('c-objective').value,
        status: $('c-status').value,
        start_date: $('c-start').value || null,
        end_date: $('c-end').value || null,
        destination_url: $('c-url').value || null,
        notes: $('c-notes').value || ''
      };
      var out = await api('/api/admin/marketing/campaigns', { method: 'POST', body: JSON.stringify(payload) });
      $('c-status-msg').textContent = out.res.ok ? 'Campaign saved.' : (out.data.error || 'Rejected.');
      if (out.res.ok) {
        $('c-name').value = '';
        $('c-objective').value = '';
        await loadAll();
      }
    });
  });
})();
