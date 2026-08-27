import type { Env } from '../index'

const PRODUCTION_MEDIA_BASE = 'https://media.mylatinolist.io'

export function isStagingEnv(env: Env): boolean {
  return env.ENVIRONMENT === 'staging'
}

/** Public URL for an object in the bound R2 bucket. Staging never uses the production media host. */
export function publicMediaUrl(env: Env, key: string, request: Request): string {
  const clean = key.replace(/^\/+/, '')
  if (env.ENVIRONMENT === 'production') {
    return `${PRODUCTION_MEDIA_BASE}/${clean}`
  }
  const origin = new URL(request.url).origin
  return `${origin}/api/media/${clean}`
}

/** Stream objects from the staging R2 binding. Production keeps serving via media.mylatinolist.io. */
export async function handlePublicMedia(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }
  if (env.ENVIRONMENT === 'production') {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const path = new URL(request.url).pathname
  const prefix = '/api/media/'
  if (!path.startsWith(prefix)) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const key = decodeURIComponent(path.slice(prefix.length))
  if (!key || key.includes('..') || key.startsWith('/')) {
    return Response.json({ error: 'Invalid key' }, { status: 400 })
  }

  const object = await env.MEDIA.get(key)
  if (!object) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const headers = new Headers()
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream')
  headers.set('Cache-Control', 'public, max-age=3600')
  if (object.httpMetadata?.contentEncoding) {
    headers.set('Content-Encoding', object.httpMetadata.contentEncoding)
  }

  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers })
  }
  return new Response(object.body, { status: 200, headers })
}
