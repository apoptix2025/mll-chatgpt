import type { Env } from '../index'

const ALLOWED_ORIGINS = [
  'https://mylatinolist.io',
  'https://www.mylatinolist.io',
  'https://staging.mylatinolist.pages.dev',
  'https://dev.mylatinolist.pages.dev',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
]

export function withCors(response: Response, env: Env, requestOrigin?: string): Response {
  const headers = new Headers(response.headers)

  const origin = requestOrigin || '*'
  if (ALLOWED_ORIGINS.includes(origin) || env.ENVIRONMENT === 'development') {
    headers.set('Access-Control-Allow-Origin', origin)
  } else {
    headers.set('Access-Control-Allow-Origin', 'https://mylatinolist.io')
  }

  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
  headers.set('Access-Control-Max-Age', '86400')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
