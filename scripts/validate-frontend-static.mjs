#!/usr/bin/env node
/**
 * Static frontend checks for MLL 2.0 (no bundler).
 * Does not print secrets. Does not deploy.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const frontend = join(root, 'frontend')
const pages = [
  'index.html',
  'pages/login.html',
  'pages/enroll.html',
  'pages/directory.html',
  'pages/dashboard.html',
  'pages/listing.html',
  'pages/analytics.html',
  'pages/marketplace.html',
  'pages/jobs.html',
  'pages/voz.html',
  'pages/affiliates.html',
  'pages/partners.html',
  'pages/billing.html',
  'pages/admin.html',
  'pages/business.html',
  'pages/reset-password.html',
  'js/config.js',
  'css/main.css',
]

let failed = 0
for (const rel of pages) {
  const p = join(frontend, rel)
  if (!existsSync(p)) {
    console.error('MISSING ' + rel)
    failed += 1
  }
}

const config = readFileSync(join(frontend, 'js/config.js'), 'utf8')
const checks = [
  ["production host mylatinolist.io", /host === 'mylatinolist.io'/],
  ["www host", /host === 'www.mylatinolist.io'/],
  ["production API", /https:\/\/api\.mylatinolist\.io/],
  ["staging API constant", /mll-api-staging\.sparkling-hill-934f\.workers\.dev/],
  ["production assignment", /isProduction[\s\S]*PRODUCTION_API/],
]
for (const [label, re] of checks) {
  if (!re.test(config)) {
    console.error('CONFIG FAIL ' + label)
    failed += 1
  }
}
if (config.includes('bjtfrmkhishoadjtpzgg')) {
  console.error('CONFIG FAIL staging supabase ref hardcoded')
  failed += 1
}

if (failed) {
  console.error('frontend static validation FAIL ' + failed)
  process.exit(1)
}
console.log('frontend static validation PASS')
console.log('  pages and config.js production mapping verified')
