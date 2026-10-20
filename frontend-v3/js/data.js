// ============================================================
// MYLATINOLIST — API CONFIG
// All data now fetched live from Cloudflare Workers + Supabase
// ============================================================
const MLL_API = window.MLL_CONFIG.API_URL;

// ── Core fetch helper ─────────────────────────────────────────
async function mllFetch(endpoint, options = {}) {
  try {
    const res = await fetch(`${MLL_API}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`mllFetch error [${endpoint}]:`, err);
    return null;
  }
}

// ── API methods ───────────────────────────────────────────────
const MLL = {
  // Fetch businesses with optional filters
  async getBusinesses({ q = '', category = '', city = '', page = 1 } = {}) {
    const params = new URLSearchParams();
    if (q)        params.set('q', q);
    if (category) params.set('category', category);
    if (city)     params.set('city', city);
    params.set('page', page);
    return mllFetch(`/api/businesses?${params}`);
  },
  // Fetch single business by id or slug
  async getBusiness(idOrSlug) {
    return mllFetch(`/api/businesses/${idOrSlug}`);
  },
  // Fetch marketplace products
  async getProducts({ category = '', page = 1 } = {}) {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    params.set('page', page);
    return mllFetch(`/api/marketplace?${params}`);
  },
  // Fetch jobs
  async getJobs({ page = 1 } = {}) {
    return mllFetch(`/api/jobs?page=${page}`);
  },
  // Fetch affiliate programs
  async getAffiliates() {
    return mllFetch('/api/affiliates');
  },
  // Submit enrollment form
  async enroll(formData) {
    return mllFetch('/api/enroll', {
      method: 'POST',
      body: JSON.stringify(formData),
    });
  },
  // Auth
  async login(email, password) {
    return mllFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  async getMe(token) {
    return mllFetch('/api/auth/me', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
  },
};

// ── Token helpers (stored in sessionStorage — never localStorage) ──
const MLL_AUTH = {
  getToken()        { return sessionStorage.getItem('mll_token'); },
  setToken(token)   { sessionStorage.setItem('mll_token', token); },
  clearToken()      { sessionStorage.removeItem('mll_token'); },
  isLoggedIn()      { return !!sessionStorage.getItem('mll_token'); },
};
