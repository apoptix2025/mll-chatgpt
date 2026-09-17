#!/usr/bin/env node
/**
 * Source guards for homepage community connect section (poster + MLL branding).
 */
import { readFileSync, existsSync } from 'node:fs'
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
const posterPath = join(root, 'frontend/assets/community/mll-featured-poster.jpg')

assert('uses existing data-en/data-es i18n attrs', /data-en=/.test(js) && /data-es=/.test(js))
assert('reuses mll_lang / mll:langswitch', /mll_lang/.test(js) && /mll:langswitch/.test(js))
assert('no second language selector', !/lang-toggle/.test(js) && /switchLang/.test(nav))
assert('English + Spanish community copy present', /Follow Us & Connect/.test(js) && /Síguenos y Conecta/.test(js))
assert('single featured TikTok video', /mll-featured-negocio/.test(js) && /7686468241471835406/.test(js))
assert('no Coming Soon cards rendered', !/Próximamente/.test(js) && !/Coming Soon/.test(js))
assert('Aleja removed from visible UI strings', !/\bAleja\b/.test(js))
assert('MLL brand attribution', /brand:\s*'MLL'/.test(js) && /cc-meta-link/.test(js) && /escapeHtml\(brand\)/.test(js))
assert('fallback CTA hidden until iframe failure', /cc-fallback\[hidden\]/.test(css) && /hidden/.test(js) && /Watch on TikTok/.test(js))
assert('play button lowered below face', /top:\s*62%/.test(css))
assert('single-stage max-width tightened', /max-width:\s*720px/.test(css))
assert('Spanish badge MLL RECOMIENDA', /MLL RECOMIENDA/.test(js))
assert('no duplicate video title below media', !/cc-video-title/.test(js))
assert('posterUrl data field present', /posterUrl:/.test(js) && /sourceType:\s*'tiktok'/.test(js))
assert('local poster asset exists', existsSync(posterPath))
assert('poster uses object-fit cover', /object-fit:\s*cover/.test(css))
assert('click-to-play mounts iframe', /cc-play/.test(js) && /mountTikTokEmbed/.test(js) && !/IntersectionObserver/.test(js))
assert('TikTok iframe only — no embed.js loader', /loading = 'lazy'/.test(js) && !/tiktok\.com\/embed\.js/.test(js) && !/createElement\('script'\)/.test(js))
assert('no local mp4', !/\.mp4/.test(js))
assert('YouTube kept as TODO config but not rendered', /TODO:.*YouTube/i.test(js) && /href !== '#' && !s\.todo/.test(js))
assert('enroll route unchanged', /pages\/enroll\.html/.test(js))
assert('section still mounted on homepage', /mll-community-connect/.test(index))
assert('9:16 aspect ratio kept', /aspect-ratio:\s*9\s*\/\s*16/.test(css))
assert('side panel Spanish copy updated', /Apoyando Nuestra Comunidad/.test(js) && /Descubre historias, negocios y creadores/.test(js))

console.log(failed ? `\n${failed} failed` : '\ncommunity-connect update guards PASS')
process.exit(failed ? 1 : 0)
