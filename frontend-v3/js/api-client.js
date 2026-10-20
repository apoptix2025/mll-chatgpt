/* Reviewed read-only adaptation of the original frontend/js/data.js.
 * Deliberately excludes enrollment, login, reviews POST, analytics and AI search.
 * The strict preview policy pins all public reads to the existing staging API.
 */
(function (global) {
  'use strict';
  const diagnostics = [];
  class APIError extends Error {
    constructor(endpoint, status, message) {
      super(message);
      this.name = 'APIError';
      this.endpoint = endpoint;
      this.status = status;
    }
  }
  async function get(path, { token, signal } = {}) {
    const base = global.MLL_CONFIG.API_URL;
    const endpoint = base + path;
    // An explicit visual-only policy is mandatory. Never infer safety from a URL alone.
    if (global.MLL_STAGING?.visualOnly !== true ||
        global.MLL_STAGING.api !== 'https://mll-api-staging.sparkling-hill-934f.workers.dev' ||
        global.MLL_CONFIG.ENVIRONMENT !== 'staging' ||
        base !== 'https://mll-api-staging.sparkling-hill-934f.workers.dev') {
      throw new APIError(endpoint, null, 'The approved visual-only staging policy is required.');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const cancel = () => controller.abort();
    if (signal?.aborted) controller.abort();
    signal?.addEventListener('abort', cancel, { once: true });
    let status = null;
    try {
      const response = await fetch(endpoint, {
        method: 'GET', credentials: 'omit', redirect: 'error',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        signal: controller.signal
      });
      status = response.status;
      if (!response.ok) throw new APIError(endpoint, status, 'HTTP ' + status);
      const data = await response.json();
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new APIError(endpoint, status, 'Unexpected API response.');
      }
      diagnostics.push({ endpoint, status, ok: true });
      return data;
    } catch (error) {
      const failure = error instanceof APIError ? error : new APIError(endpoint, status, error.message);
      diagnostics.push({ endpoint, status, ok: false, error: failure.message });
      throw failure;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }
  function collection(route, key, filters = {}, options) {
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(filters)) {
      if (value !== '' && value != null) params.set(name, String(value));
    }
    return get(route + (params.size ? '?' + params : ''), options).then(data => {
      if (!Array.isArray(data[key])) throw new APIError(global.MLL_CONFIG.API_URL + route + (params.size ? '?' + params : ''), 200, 'Missing ' + key + ' collection.');
      return data;
    });
  }
  global.MLL = Object.freeze({
    getBusinesses: ({ q = '', category = '', city = '', page = 1 } = {}, options) =>
      collection('/api/businesses', 'businesses', { q, category, city, page }, options),
    getBusiness: (slug, options) => {
      if (!/^[\w-]+$/.test(slug || '')) return Promise.reject(new APIError('/api/businesses/', null, 'Invalid business identifier.'));
      return get('/api/businesses/' + encodeURIComponent(slug), options);
    },
    getProducts: ({ category = '', page = 1 } = {}, options) =>
      collection('/api/marketplace', 'products', { category, page }, options),
    getJobs: ({ page = 1 } = {}, options) => collection('/api/jobs', 'jobs', { page }, options),
    getResources: (options) => collection('/api/resources', 'resources', {}, options),
    // Staging is anonymous. Do not forward old local/session authorization.
    getAIStatus: () => get('/api/ai/status'),
    diagnostics: () => diagnostics.map(item => ({ ...item }))
  });
})(window);
