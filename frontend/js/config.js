// My Latino List environment-aware API configuration
// Production remains on api.mylatinolist.io. Development/staging never falls back to production.
(function () {
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  const isProduction = host === 'mylatinolist.io' || host === 'www.mylatinolist.io';
  const isPagesStaging = host === 'staging.mylatinolist.pages.dev' || host.endsWith('.mylatinolist.pages.dev');

  const STAGING_API = 'https://mll-api-staging.sparkling-hill-934f.workers.dev';
  const PRODUCTION_API = 'https://api.mylatinolist.io';
  const LOCAL_API = 'http://localhost:8787';

  let apiUrl;
  let environment;
  if (isLocal) {
    apiUrl = LOCAL_API;
    environment = 'local';
  } else if (isProduction) {
    apiUrl = PRODUCTION_API;
    environment = 'production';
  } else if (isPagesStaging || host.endsWith('.workers.dev') || host.includes('staging')) {
    apiUrl = STAGING_API;
    environment = 'staging';
  } else {
    apiUrl = STAGING_API;
    environment = 'staging';
  }

  window.MLL_CONFIG = Object.freeze({
    ENVIRONMENT: environment,
    API_URL: apiUrl,
    STAGING_API: STAGING_API,
    PRODUCTION_API: PRODUCTION_API
  });
})();
