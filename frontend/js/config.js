// My Latino List environment-aware API configuration
// Production remains on api.mylatinolist.io. Development/staging never falls back to production.
(function () {
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  const isProduction = host === 'mylatinolist.io' || host === 'www.mylatinolist.io';

  let apiUrl;
  if (isLocal) {
    apiUrl = 'http://localhost:8787';
  } else if (isProduction) {
    apiUrl = 'https://api.mylatinolist.io';
  } else {
    // Replace this once Wrangler reports your workers.dev subdomain.
    apiUrl = 'https://mll-api-staging.REPLACE_WITH_WORKERS_SUBDOMAIN.workers.dev';
  }

  window.MLL_CONFIG = Object.freeze({
    ENVIRONMENT: isProduction ? 'production' : (isLocal ? 'local' : 'staging'),
    API_URL: apiUrl
  });
})();
