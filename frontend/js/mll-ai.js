(function () {
  var VISITOR_LIMIT = 3
  var ENTITLEMENTS = { visitor: 3, free: 10, basic: 25, pro: 60, featured: 100, agency: 200 }
  var API = (window.MLL_CONFIG && window.MLL_CONFIG.API_URL) || ''
  var opened = false
  var inited = false
  var enabled = false
  var remaining = VISITOR_LIMIT

  function quotaKey() { return 'mll_ai_free_used' }
  function usedCount() {
    try { return parseInt(localStorage.getItem(quotaKey()) || '0', 10) || 0 } catch (e) { return 0 }
  }
  function bumpUsed() {
    try { localStorage.setItem(quotaKey(), String(usedCount() + 1)) } catch (e) {}
  }
  function localRemaining() { return Math.max(0, VISITOR_LIMIT - usedCount()) }

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
            '<div class="mll-ai-quota" id="mll-ai-quota">3 free AI searches</div>' +
          '</div>' +
          '<div class="mll-ai-body" id="mll-ai-body"></div>' +
          '<form class="mll-ai-foot" id="mll-ai-form">' +
            '<input type="text" id="mll-ai-input" maxlength="240" placeholder="Ask MLL AI anything..." aria-label="Ask MLL AI">' +
            '<button type="submit" class="mll-ai-send" aria-label="Send">→</button>' +
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
    remaining = Math.min(remaining, localRemaining())
    document.getElementById('mll-ai-quota').textContent = remaining + ' free AI searches'
    var body = document.getElementById('mll-ai-body')
    if (!enabled) {
      body.innerHTML = '<p class="mll-ai-msg">MLL AI is coming soon.</p>'
      document.getElementById('mll-ai-form').hidden = true
      return
    }
    document.getElementById('mll-ai-form').hidden = false
    body.innerHTML =
      '<p class="mll-ai-msg">Hi! I\'m MLL AI. I can help you find Latino-owned businesses, jobs, resources and more.</p>' +
      '<p class="mll-ai-msg">What are you looking for?</p>' +
      '<div class="mll-ai-prompts">' +
        chip('Find a contractor near me') +
        chip('Latino restaurants nearby') +
        chip('Spanish-speaking attorney') +
        chip('Hair salon in Silver Spring') +
        chip('Find a job') +
        chip('Immigration help') +
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
      var res = await fetch(API + '/api/ai/status')
      var data = res.ok ? await res.json() : { enabled: false }
      enabled = !!data.enabled
      if (typeof data.remaining === 'number') remaining = data.remaining
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

  function renderResults(data) {
    var body = document.getElementById('mll-ai-body')
    var html = '<p class="mll-ai-msg">' + (data.message || 'Here is what I found on My Latino List.') + '</p>'
    var biz = (data.results && data.results.businesses) || []
    var jobs = (data.results && data.results.jobs) || []
    var res = (data.results && data.results.resources) || []
    if (!biz.length && !jobs.length && !res.length) {
      html += '<p class="mll-ai-empty">No matching listings yet. Try a different category or location, or browse the directory.</p>'
    }
    biz.forEach(function (b) {
      var href = '/pages/business?slug=' + encodeURIComponent(b.slug || '')
      html += '<div class="mll-ai-result"><a href="' + href + '">' + escapeHtml(b.name || 'Business') + '</a>' +
        (b.category ? '<div>' + escapeHtml(b.category) + '</div>' : '') +
        (b.city ? '<div>' + escapeHtml([b.city, b.state].filter(Boolean).join(', ')) + '</div>' : '') +
        '</div>'
    })
    jobs.forEach(function (j) {
      html += '<div class="mll-ai-result"><a href="pages/jobs.html">' + escapeHtml(j.title || 'Job') + '</a>' +
        (j.company_name ? '<div>' + escapeHtml(j.company_name) + '</div>' : '') + '</div>'
    })
    res.forEach(function (r) {
      var href = r.url && /^https?:/.test(r.url) ? r.url : 'pages/voz.html'
      html += '<div class="mll-ai-result"><a href="' + href + '">' + escapeHtml(r.title || 'Resource') + '</a></div>'
    })
    body.innerHTML = html
    if (typeof data.remaining === 'number') {
      remaining = data.remaining
      document.getElementById('mll-ai-quota').textContent = remaining + ' free AI searches'
    }
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  }

  async function send(query) {
    if (!enabled) return
    if (localRemaining() <= 0) {
      document.getElementById('mll-ai-body').innerHTML = '<p class="mll-ai-empty">You have used your 3 free AI searches. Sign in later for more.</p>'
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
        body: JSON.stringify({ query: query.slice(0, 240) })
      })
      var data = await res.json()
      if (data && data.enabled === false) {
        enabled = false
        welcome()
        return
      }
      bumpUsed()
      renderResults(data || {})
    } catch (e) {
      document.getElementById('mll-ai-body').innerHTML = '<p class="mll-ai-empty">MLL AI is unavailable right now. Use Search on the homepage.</p>'
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
  else mount()
})()