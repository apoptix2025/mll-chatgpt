const EXACT_ORIGINS = new Set([
  'https://mylatinolist.io',
  'https://www.mylatinolist.io',
  'https://staging.mylatinolist.pages.dev',
  'https://dev.mylatinolist.pages.dev',
  'https://mylatinolist-staging.pages.dev',
  'http://localhost:3000',
  'http://localhost:8787',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:8787',
])

export function resolveCorsOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null
  if (EXACT_ORIGINS.has(origin)) return origin
  try {
    const url = new URL(origin)
    if (url.protocol === 'https:' && url.hostname.endsWith('.mylatinolist-staging.pages.dev')) {
      return origin
    }
  } catch {
    return null
  }
  return null
}

export function withCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers)
  const allowed = resolveCorsOrigin(request.headers.get('Origin'))
  headers.append('Vary', 'Origin')

  if (allowed) {
    headers.set('Access-Control-Allow-Origin', allowed)
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
    headers.set('Access-Control-Max-Age', '86400')
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
