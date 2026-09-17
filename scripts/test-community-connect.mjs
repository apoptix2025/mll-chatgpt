#!/usr/bin/env node
/**
 * Source guards for homepage community connect section (updated).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failed = 0
function assert(label, cond) {
  if (cond) console.log('PASS  ' + label)
  else {
    failed += 1
    console.error('FAIL  ' + label)
  }
}

const js = readFileSync(join(root, 'frontend/js/community-connect.js'), 'utf8')
const css = readFileSync(join(root, 'frontend/css/community-connect.css'), 'utf8')
const index = readFileSync(join(root, 'frontend/index.html'), 'utf8')
const nav = readFileSync(join(root, 'frontend/js/nav.js'), 'utf8')

assert('uses existing data-en/data-es i18n attrs', /data-en=/.test(js) && /data-es=/.test(js))
assert('reuses mll_lang / mll:langswitch', /mll_lang/.test(js) && /mll:langswitch/.test(js))
assert('no second language selector', !/lang-toggle/.test(js) && /switchLang/.test(nav))
assert('English + Spanish community copy present', /Follow Us & Connect/.test(js) && /Síguenos y Conecta/.test(js))
assert('only Aleja video in featuredVideos array', /aleja-recomienda-mll/.test(js) && !/placeholder-negocio/.test(js) && !/placeholder-creador/.test(js))
assert('no Coming Soon cards rendered', !/Próximamente/.test(js) && !/Coming Soon/.test(js))
assert('view-more only when multiple videos', /showViewMore = videos\.length > 1/.test(js))
assert('single layout class present', /cc-video-layout--single/.test(js) && /cc-video-layout--single/.test(css))
assert('future grid/many modes documented', /cc-video-layout--grid/.test(js) && /cc-video-layout--many/.test(css))
assert('featured side panel copy present', /Supporting Our Community/.test(js) && /Apoyando nuestra comunidad/.test(js))
assert('TikTok lazy iframe only — no embed.js loader', /IntersectionObserver/.test(js) && /loading = 'lazy'/.test(js) && !/tiktok\.com\/embed\.js/.test(js) && !/createElement\('script'\)/.test(js))
assert('no local mp4', !/\.mp4/.test(js))
assert('YouTube kept as TODO config but not rendered', /TODO:.*YouTube/i.test(js) && /href !== '#' && !s\.todo/.test(js))
assert('enroll route unchanged', /pages\/enroll\.html/.test(js))
assert('section still mounted on homepage', /mll-community-connect/.test(index))
assert('9:16 aspect ratio kept', /aspect-ratio:\s*9\s*\/\s*16/.test(css))

console.log(failed ? `\n${failed} failed` : '\ncommunity-connect update guards PASS')
process.exit(failed ? 1 : 0)
