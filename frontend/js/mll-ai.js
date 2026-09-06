(function () {
  var VISITOR_LIMIT = 3
  var AUTH_LIMIT = 10
  var ENTITLEMENTS = { visitor: 3, auth: 10 }
  var API = (window.MLL_CONFIG && window.MLL_CONFIG.API_URL) || ''
  var opened = false
  var inited = false
  var enabled = false
  var remaining = VISITOR_LIMIT
  var signedIn = false

  function hasToken() {
    try { return !!sessionStorage.getItem('mll_token') } catch (e) { return false }
  }

  function quotaLabel() {
    if (!enabled) return 'Coming soon'
    if (remaining <= 0) return "You've used your free MLL AI searches."
    if (remaining === (signedIn ? AUTH_LIMIT : VISITOR_LIMIT)) return remaining + ' free AI searches available'
    return remaining + ' free AI searches remaining'
  }

  function setQuota() {
    var node = document.getElementById('mll-ai-quota')
    if (node) node.textContent = quotaLabel()
  }

  function el(html) {
    var d = document.createElement('div')
    d.innerHTML = html.trim()
    return d.firstElementChild
  }

  function mount() {
    if (document.getElementById('mll-ai-root')) return
    var root = el(
      '<div id="mll-ai-root">' +
        '<button type="button" class="mll-ai-launch" id="mll-ai-launch" aria-expanded="false" aria-controls="mll-ai-panel">✨ Ask MLL AI</button>' +
        '<div class="mll-ai-backdrop" id="mll-ai-backdrop" hidden></div>' +
        '<aside class="mll-ai-panel" id="mll-ai-panel" role="dialog" aria-modal="true" aria-labelledby="mll-ai-title" hidden>' +
          '<div class="mll-ai-head">' +
            '<div class="mll-ai-head-row">' +
              '<div><div class="mll-ai-title" id="mll-ai-title">✨ MLL AI <span class="mll-ai-beta">BETA</span></div>' +
              '<div class="mll-ai-sub">Ask. Discover. Support Latino.</div></div>' +
              '<button type="button" class="mll-ai-close" id="mll-ai-close" aria-label="Close MLL AI">×</button>' +
            '</div>' +
          '</div>' +
          '<div class="mll-ai-body" id="mll-ai-body"></div>' +
          '<form class="mll-ai-foot" id="mll-ai-form">' +
            '<div class="mll-ai-quota" id="mll-ai-quota">3 free AI searches available</div>' +
            '<div class="mll-ai-compose">' +
              '<input type="text" id="mll-ai-input" maxlength="300" placeholder="Ask MLL AI anything..." aria-label="Ask MLL AI">' +
              '<button type="submit" class="mll-ai-send" aria-label="Send">→</button>' +
            '</div>' +
          '</form>' +
        '</aside>' +
      '</div>'
    )
    document.body.appendChild(root)
    document.getElementById('mll-ai-launch').addEventListener('click', open)
    document.getElementById('mll-ai-close').addEventListener('click', close)
    document.getElementById('mll-ai-backdrop').addEventListener('click', close)
    document.getElementById('mll-ai-form').addEventListener('submit', onSubmit)
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && opened) close()
    })
  }

  function setOpen(on) {
    opened = on
    var panel = document.getElementById('mll-ai-panel')
    var back = document.getElementById('mll-ai-backdrop')
    var btn = document.getElementById('mll-ai-launch')
    panel.classList.toggle('is-open', on)
    back.classList.toggle('is-open', on)
    panel.hidden = !on
    back.hidden = !on
    btn.setAttribute('aria-expanded', on ? 'true' : 'false')
    document.body.classList.toggle('mll-ai-open', on)
  }

  function welcome() {
    signedIn = hasToken()
    setQuota()
    document.getElementById('mll-ai-form').hidden = false
    var body = document.getElementById('mll-ai-body')
    body.innerHTML =
      '<p class="mll-ai-msg">Hi! I\'m MLL AI. I can help you find Latino-owned businesses, jobs, and La Voz Latino resources.</p>' +
      '<div class="mll-ai-prompts">' +
        chip('Find a contractor near Silver Spring') +
        chip('Show me Latino restaurants') +
        chip('Find a Spanish-speaking attorney') +
        chip('Find IT jobs') +
        chip('Help me find immigration resources') +
      '</div>'
    body.querySelectorAll('[data-prompt]').forEach(function (b) {
      b.addEventListener('click', function () { send(b.getAttribute('data-prompt')) })
    })
  }

  function chip(text) {
    return '<button type="button" class="mll-ai-chip" data-prompt="' + text.replace(/"/g, '&quot;') + '">' + text + '</button>'
  }

  async function ensureStatus() {
    if (inited) return
    inited = true
    try {
      var headers = {}
      var token = null
      try { token = sessionStorage.getItem('mll_token') } catch (e) {}
      if (token) headers.Authorization = 'Bearer ' + token
      var res = await fetch(API + '/api/ai/status', { headers: headers })
      var data = res.ok ? await res.json() : { enabled: false }
      enabled = !!data.enabled
      if (typeof data.remaining === 'number') remaining = data.remaining
      signedIn = hasToken()
    } catch (e) {
      enabled = false
    }
  }

  async function open() {
    setOpen(true)
    await ensureStatus()
    welcome()
    var input = document.getElementById('mll-ai-input')
    if (input && !document.getElementById('mll-ai-form').hidden) input.focus()
  }

  function close() { setOpen(false) }

  async function onSubmit(e) {
    e.preventDefault()
    var q = document.getElementById('mll-ai-input').value.trim()
    if (q) send(q)
  }

  function imageFor(b) {
    if (window.MLL_MEDIA && typeof window.MLL_MEDIA.imageUrl === 'function') return window.MLL_MEDIA.imageUrl(b)
    return b.image || b.logo_url || ''
  }

  function resultList(data) {
    if (Array.isArray(data.results)) return data.results
    var nested = data.results || {}
    return [].concat(nested.businesses || [], nested.jobs || [], nested.resources || [])
  }

  function exhaustedHtml() {
    return '<p class="mll-ai-empty">You\'ve used your free MLL AI searches.</p>' +
      '<div class="mll-ai-cta">' +
        '<a class="mll-ai-btn" href="pages/login.html">Create Account</a>' +
        '<a class="mll-ai-btn ghost" href="pages/pricing.html">View Plans</a>' +
      '</div>'
  }

  function renderResults(data) {
    var body = document.getElementById('mll-ai-body')
    if (typeof data.remaining === 'number') remaining = data.remaining
    setQuota()
    if (remaining <= 0 && (!data.results || !resultList(data).length) && data.error === 'quota_exceeded') {
      body.innerHTML = exhaustedHtml()
      return
    }
    var html = '<p class="mll-ai-msg">' + escapeHtml(data.message || 'Here is what I found on My Latino List.') + '</p>'
    var items = resultList(data)
    if (!items.length) {
      html += '<p class="mll-ai-empty">No matching listings yet. Try a different category or location, or browse the directory.</p>'
    }
    items.forEach(function (item) {
      if (item.slug || item.name) html += bizCard(item)
      else if (item.title && (item.company_name || item.job_type || item.href && String(item.href).indexOf('jobs') !== -1)) html += jobCard(item)
      else html += resourceCard(item)
    })
    if (remaining <= 0) html += exhaustedHtml()
    body.innerHTML = html
  }

  function bizCard(b) {
    var href = '/pages/business?slug=' + encodeURIComponent(b.slug || '')
    var img = imageFor(b)
    var loc = [b.city, b.state].filter(Boolean).join(', ')
    var maps = loc ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent((b.name || '') + ' ' + loc) : ''
    return '<div class="mll-ai-result">' +
      (img ? '<img class="mll-ai-thumb" src="' + escapeHtml(img) + '" alt="">' : '') +
      '<div class="mll-ai-result-copy">' +
        '<a href="' + href + '">' + escapeHtml(b.name || 'Business') + '</a>' +
        (b.verified ? '<span class="v2-verified">Verified</span>' : '') +
        (b.category ? '<div>' + escapeHtml(b.category) + '</div>' : '') +
        (loc ? '<div>' + escapeHtml(loc) + '</div>' : '') +
        '<div class="mll-ai-actions">' +
          '<a href="' + href + '">View</a>' +
          (b.phone ? '<a href="tel:' + escapeHtml(String(b.phone).replace(/[^\d+]/g, '')) + '">Call</a>' : '') +
          (maps ? '<a href="' + maps + '" target="_blank" rel="noopener">Directions</a>' : '') +
        '</div>' +
      '</div></div>'
  }

  function jobCard(j) {
    var href = j.href || ('/pages/jobs.html?id=' + encodeURIComponent(j.id || ''))
    return '<div class="mll-ai-result"><div class="mll-ai-result-copy">' +
      '<a href="' + escapeHtml(href) + '">' + escapeHtml(j.title || 'Job') + '</a>' +
      (j.company_name ? '<div>' + escapeHtml(j.company_name) + '</div>' : '') +
      ([j.city, j.state].filter(Boolean).length ? '<div>' + escapeHtml([j.city, j.state].filter(Boolean).join(', ')) + '</div>' : '') +
      '<div class="mll-ai-actions"><a href="' + escapeHtml(href) + '">View</a></div>' +
      '</div></div>'
  }

  function resourceCard(r) {
    var href = r.href || (r.url && /^https?:/.test(r.url) ? r.url : '/pages/voz.html')
    return '<div class="mll-ai-result"><div class="mll-ai-result-copy">' +
      '<a href="' + escapeHtml(href) + '">' + escapeHtml(r.title || 'Resource') + '</a>' +
      (r.category ? '<div>' + escapeHtml(r.category) + '</div>' : '') +
      '<div class="mll-ai-actions"><a href="' + escapeHtml(href) + '">View</a></div>' +
      '</div></div>'
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  }

  async function send(query) {
    if (!enabled) {
      document.getElementById('mll-ai-body').innerHTML = '<p class="mll-ai-msg">MLL AI is coming soon.</p>'
      return
    }
    if (remaining <= 0) {
      document.getElementById('mll-ai-body').innerHTML = exhaustedHtml()
      setQuota()
      return
    }
    document.getElementById('mll-ai-input').value = query
    document.getElementById('mll-ai-body').innerHTML = '<p class="mll-ai-msg">Searching My Latino List…</p>'
    try {
      var headers = { 'Content-Type': 'application/json' }
      var token = null
      try { token = sessionStorage.getItem('mll_token') } catch (e) {}
      if (token) headers.Authorization = 'Bearer ' + token
      var res = await fetch(API + '/api/ai/search', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ query: query.slice(0, 300) })
      })
      var data = {}
      try { data = await res.json() } catch (e) { data = {} }
      if (data && data.enabled === false) {
        enabled = false
        welcome()
        return
      }
      if (res.status === 429 && data.error === 'quota_exceeded') {
        remaining = 0
        setQuota()
        document.getElementById('mll-ai-body').innerHTML = exhaustedHtml()
        return
      }
      if (res.status === 429 && data.error === 'rate_limited') {
        document.getElementById('mll-ai-body').innerHTML = '<p class="mll-ai-empty">' + escapeHtml(data.message || 'Please wait a few seconds and try again.') + '</p>'
        return
      }
      if (!res.ok && data.error === 'unavailable') {
        document.getElementById('mll-ai-body').innerHTML = '<p class="mll-ai-empty">MLL AI is temporarily unavailable. Try regular search.</p>'
        return
      }
      if (!res.ok) {
        document.getElementById('mll-ai-body').innerHTML = '<p class="mll-ai-empty">' + escapeHtml(data.message || 'MLL AI is temporarily unavailable. Try regular search.') + '</p>'
        return
      }
      renderResults(data || {})
    } catch (e) {
      document.getElementById('mll-ai-body').innerHTML = '<p class="mll-ai-empty">MLL AI is temporarily unavailable. Try regular search.</p>'
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
})()
