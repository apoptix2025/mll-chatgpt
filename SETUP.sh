# SETUP GUIDE — MyLatinoList
# Follow these steps IN ORDER after cloning the repo

# ============================================================
# STEP 1 — CLONE & OPEN
# ============================================================

git clone https://github.com/apoptix2025/mll-cloudflare.git
cd mll-cloudflare

# ============================================================
# STEP 2 — INSTALL WRANGLER (Cloudflare CLI)
# ============================================================

npm install -g wrangler
wrangler login
# This opens your browser — log in with your Cloudflare account

# ============================================================
# STEP 3 — CREATE CLOUDFLARE KV + R2
# ============================================================

# Create KV namespace for session cache
wrangler kv:namespace create SESSION_CACHE
wrangler kv:namespace create SESSION_CACHE --preview
# Copy the IDs it gives you into workers/wrangler.toml

# Create R2 bucket for media uploads
wrangler r2 bucket create mll-media
wrangler r2 bucket create mll-media-dev

# ============================================================
# STEP 4 — SUPABASE SETUP
# ============================================================

# 1. Go to https://supabase.com → your project → SQL Editor
# 2. Paste contents of: supabase/migrations/001_initial_schema.sql
# 3. Click RUN — this creates all tables, indexes, RLS policies
# 4. Then paste contents of: supabase/seed/seed.sql
# 5. Click RUN — this adds sample data for dev

# Get your keys from Supabase → Settings → API:
#   - Project URL       → SUPABASE_URL
#   - anon public key   → SUPABASE_ANON_KEY
#   - service_role key  → SUPABASE_SERVICE_KEY (keep this secret!)

# ============================================================
# STEP 5 — LOCAL ENVIRONMENT VARIABLES
# ============================================================

cd workers
cp .dev.vars.example .dev.vars
# Open .dev.vars and fill in ALL values:
#   SUPABASE_URL
#   SUPABASE_ANON_KEY
#   SUPABASE_SERVICE_KEY
#   STRIPE_SECRET_KEY   (get from stripe.com → Developers → API keys)
#   RESEND_API_KEY      (get from resend.com → API Keys)

# ============================================================
# STEP 6 — INSTALL WORKER DEPENDENCIES
# ============================================================

cd workers  # (already here from step 5)
npm install

# ============================================================
# STEP 7 — ADD SECRETS TO CLOUDFLARE
# ============================================================

wrangler secret put SUPABASE_ANON_KEY
# Paste your key when prompted, press Enter

wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put RESEND_API_KEY

# ============================================================
# STEP 8 — RUN LOCALLY
# ============================================================

# Terminal 1 — start Workers dev server
cd workers
wrangler dev
# API now running at http://localhost:8787

# Terminal 2 — serve frontend
# Option A: VS Code Live Server extension (right-click index.html → Open with Live Server)
# Option B: simple python server
cd ../frontend
python -m http.server 3000
# Frontend at http://localhost:3000

# Test your API:
curl http://localhost:8787/api/businesses
curl http://localhost:8787/api/jobs

# ============================================================
# STEP 9 — CONNECT GITHUB TO CLOUDFLARE PAGES
# ============================================================

# 1. Go to dash.cloudflare.com → Pages → your project
# 2. Settings → Build & deployments → Connect to Git
# 3. Select: apoptix2025/mll-cloudflare
# 4. Build settings:
#    - Branch:           main
#    - Build command:    (leave empty)
#    - Output directory: frontend
# 5. Add environment variables (same as wrangler secrets above)
# 6. Save — every git push to main now auto-deploys!

# ============================================================
# STEP 10 — ADD GITHUB SECRETS FOR CI/CD
# ============================================================

# Go to: github.com/apoptix2025/mll-cloudflare → Settings → Secrets → Actions
# Add these secrets:
#
# CLOUDFLARE_API_TOKEN
#   → dash.cloudflare.com → My Profile → API Tokens
#   → Create Token → Edit Cloudflare Workers template
#
# CLOUDFLARE_ACCOUNT_ID
#   → dash.cloudflare.com → right sidebar → Account ID

# ============================================================
# DAILY WORKFLOW
# ============================================================

# Start a new feature
git checkout dev
git checkout -b feature/marketplace-orders

# Make changes, test locally with wrangler dev

# Commit and push
git add .
git commit -m "feat: add marketplace order flow"
git push origin feature/marketplace-orders

# Open a Pull Request → dev branch on GitHub
# Merge PR → auto deploys to dev.mylatinolist.pages.dev

# Ready for production?
git checkout main
git merge dev
git push origin main
# Auto deploys to mylatinolist.io
