import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'

export async function handleSitemap(request: Request, env: Env): Promise<Response> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
  const { data } = await supabase
    .from('businesses')
    .select('slug, updated_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(5000)

  const base  = env.FRONTEND_URL || 'https://mylatinolist.io'
  const today = new Date().toISOString().split('T')[0]

  const bizUrls = (data || []).map(b => `  <url>
    <loc>${base}/pages/business.html?id=${b.slug}</loc>
    <lastmod>${b.updated_at ? b.updated_at.split('T')[0] : today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${base}/pages/directory.html</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${base}/pages/marketplace.html</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${base}/pages/jobs.html</loc>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
${bizUrls}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
