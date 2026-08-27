-- ============================================================
-- MYLATINOLIST — SUPABASE DATABASE SCHEMA
-- Version: 001 — Initial schema
-- Paste this entire file into Supabase SQL Editor and run
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy text search

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  first_name      TEXT,
  last_name       TEXT,
  language        TEXT DEFAULT 'English',
  business_id     UUID,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BUSINESSES
-- ============================================================
CREATE TABLE businesses (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  slug                TEXT UNIQUE NOT NULL,
  category            TEXT NOT NULL,
  phone               TEXT,
  email               TEXT,
  website             TEXT,
  description         TEXT,
  address             TEXT,
  city                TEXT,
  state               TEXT,
  zip                 TEXT,
  country             TEXT DEFAULT 'US',
  emoji               TEXT DEFAULT '🏢',
  bg_color            TEXT DEFAULT '#E6F1FB',
  tags                TEXT[] DEFAULT '{}',
  hours               JSONB,        -- { mon: "9am-5pm", tue: "9am-5pm", ... }
  social_links        JSONB,        -- { instagram: "", facebook: "", ... }
  plan                TEXT DEFAULT 'free' CHECK (plan IN ('free','pro','featured')),
  modules             TEXT[] DEFAULT '{"directory"}',
  status              TEXT DEFAULT 'active' CHECK (status IN ('active','pending','suspended','inactive')),
  is_featured         BOOLEAN DEFAULT FALSE,
  rating              DECIMAL(2,1) DEFAULT 0.0,
  review_count        INTEGER DEFAULT 0,
  profile_completion  INTEGER DEFAULT 0,
  logo_url            TEXT,
  stripe_customer_id  TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key back to profiles
ALTER TABLE profiles ADD CONSTRAINT fk_profile_business
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE SET NULL;

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  reviewer_name TEXT NOT NULL,
  reviewer_email TEXT,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body          TEXT,
  status        TEXT DEFAULT 'published' CHECK (status IN ('published','pending','removed')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEADS (customer inquiries from directory)
-- ============================================================
CREATE TABLE leads (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          TEXT,
  email         TEXT,
  phone         TEXT,
  action        TEXT NOT NULL, -- 'call','email','directions','website','inquiry'
  message       TEXT,
  source        TEXT DEFAULT 'directory',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PRODUCTS (marketplace)
-- ============================================================
CREATE TABLE products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  seller_name   TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  price         DECIMAL(10,2) NOT NULL,
  category      TEXT,
  emoji         TEXT DEFAULT '📦',
  bg_color      TEXT DEFAULT '#E6F1FB',
  images        TEXT[] DEFAULT '{}',
  inventory     INTEGER DEFAULT 999,
  rating        DECIMAL(2,1) DEFAULT 0.0,
  sales_count   INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','sold_out')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORDERS (marketplace purchases)
-- ============================================================
CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id        UUID NOT NULL REFERENCES products(id),
  business_id       UUID NOT NULL REFERENCES businesses(id),
  buyer_name        TEXT,
  buyer_email       TEXT NOT NULL,
  quantity          INTEGER DEFAULT 1,
  unit_price        DECIMAL(10,2) NOT NULL,
  total_price       DECIMAL(10,2) NOT NULL,
  status            TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','shipped','delivered','cancelled','refunded')),
  stripe_payment_id TEXT,
  shipping_address  JSONB,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- JOBS
-- ============================================================
CREATE TABLE jobs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  company_name    TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  requirements    TEXT,
  city            TEXT,
  state           TEXT,
  salary_range    TEXT,
  job_type        TEXT DEFAULT 'Full-time' CHECK (job_type IN ('Full-time','Part-time','Contract','Seasonal','Internship')),
  bilingual_required BOOLEAN DEFAULT FALSE,
  emoji           TEXT DEFAULT '💼',
  emoji_bg        TEXT DEFAULT '#E6F1FB',
  type_bg         TEXT DEFAULT '#E6F1FB',
  type_color      TEXT DEFAULT '#0C447C',
  applications_count INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','filled','closed','draft')),
  posted_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- JOB APPLICATIONS
-- ============================================================
CREATE TABLE job_applications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  business_id   UUID NOT NULL REFERENCES businesses(id),
  applicant_name  TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  applicant_phone TEXT,
  resume_url    TEXT,
  cover_letter  TEXT,
  status        TEXT DEFAULT 'new' CHECK (status IN ('new','reviewed','interview','hired','rejected')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AFFILIATE PROGRAMS
-- ============================================================
CREATE TABLE affiliate_programs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  category        TEXT,
  emoji           TEXT DEFAULT '🤝',
  bg_color        TEXT DEFAULT '#E6F1FB',
  badge_bg        TEXT DEFAULT '#E6F1FB',
  badge_color     TEXT DEFAULT '#0C447C',
  description     TEXT,
  commission_text TEXT,
  commission_rate DECIMAL(5,2), -- percentage or flat $ per referral
  commission_type TEXT DEFAULT 'flat' CHECK (commission_type IN ('flat','percentage')),
  partner_url     TEXT,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AFFILIATE ENROLLMENTS (businesses joined to programs)
-- ============================================================
CREATE TABLE affiliate_enrollments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  program_id    UUID NOT NULL REFERENCES affiliate_programs(id),
  referral_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  clicks        INTEGER DEFAULT 0,
  conversions   INTEGER DEFAULT 0,
  total_earned  DECIMAL(10,2) DEFAULT 0.00,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, program_id)
);

-- ============================================================
-- VOZ LATINO RESOURCES
-- ============================================================
CREATE TABLE resources (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL, -- 'finance','legal','tax','licensing','grants','immigration'
  icon        TEXT DEFAULT '📋',
  bg_color    TEXT DEFAULT '#E6F1FB',
  tag         TEXT,
  tag_bg      TEXT,
  tag_color   TEXT,
  url         TEXT,
  is_bilingual BOOLEAN DEFAULT TRUE,
  states      TEXT[] DEFAULT '{}', -- empty = national
  status      TEXT DEFAULT 'active',
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLANS (subscription tracking)
-- ============================================================
CREATE TABLE subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id           UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan                  TEXT NOT NULL CHECK (plan IN ('free','pro','featured')),
  stripe_subscription_id TEXT,
  stripe_customer_id    TEXT,
  status                TEXT DEFAULT 'active',
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES (for performance)
-- ============================================================
CREATE INDEX idx_businesses_status       ON businesses(status);
CREATE INDEX idx_businesses_category     ON businesses(category);
CREATE INDEX idx_businesses_city         ON businesses(city);
CREATE INDEX idx_businesses_owner        ON businesses(owner_id);
CREATE INDEX idx_businesses_slug         ON businesses(slug);
CREATE INDEX idx_businesses_featured     ON businesses(is_featured, rating DESC);
CREATE INDEX idx_businesses_name_trgm    ON businesses USING GIN (name gin_trgm_ops);

CREATE INDEX idx_products_business       ON products(business_id);
CREATE INDEX idx_products_status         ON products(status);
CREATE INDEX idx_products_category       ON products(category);

CREATE INDEX idx_jobs_business           ON jobs(business_id);
CREATE INDEX idx_jobs_status_posted      ON jobs(status, posted_at DESC);

CREATE INDEX idx_leads_business          ON leads(business_id);
CREATE INDEX idx_leads_created           ON leads(created_at DESC);

CREATE INDEX idx_orders_business         ON orders(business_id);
CREATE INDEX idx_orders_status           ON orders(status);

CREATE INDEX idx_aff_enrollments_biz     ON affiliate_enrollments(business_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Profiles: users can only see/edit their own profile
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Businesses: public can read active ones; owners can edit their own
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "businesses_public_read"  ON businesses FOR SELECT USING (status = 'active');
CREATE POLICY "businesses_owner_all"    ON businesses FOR ALL    USING (auth.uid() = owner_id);

-- Reviews: public can read published; authenticated can insert
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews_public_read"  ON reviews FOR SELECT USING (status = 'published');
CREATE POLICY "reviews_auth_insert"  ON reviews FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Leads: only business owner can see their leads
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leads_owner_read" ON leads FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
CREATE POLICY "leads_public_insert" ON leads FOR INSERT WITH CHECK (true);

-- Products: public read active; owner can manage own
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_public_read"  ON products FOR SELECT USING (status = 'active');
CREATE POLICY "products_owner_all"    ON products FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Orders: only buyer or seller can see
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders_seller_read"  ON orders FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
CREATE POLICY "orders_buyer_insert" ON orders FOR INSERT WITH CHECK (true);

-- Jobs: public read active; owner manages own
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_public_read"  ON jobs FOR SELECT USING (status = 'active');
CREATE POLICY "jobs_owner_all"    ON jobs FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Job applications: owner of job sees applications
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "applications_owner_read" ON job_applications FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));
CREATE POLICY "applications_public_insert" ON job_applications FOR INSERT WITH CHECK (true);

-- Affiliate programs: public read
ALTER TABLE affiliate_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "affiliate_programs_public_read" ON affiliate_programs FOR SELECT USING (status = 'active');

-- Affiliate enrollments: owner manages own
ALTER TABLE affiliate_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aff_enrollments_owner_all" ON affiliate_enrollments FOR ALL
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- Resources: public read
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resources_public_read" ON resources FOR SELECT USING (status = 'active');

-- Subscriptions: owner sees own
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions_owner_read" ON subscriptions FOR SELECT
  USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()));

-- ============================================================
-- TRIGGERS (auto-update updated_at)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_businesses_updated  BEFORE UPDATE ON businesses  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated    BEFORE UPDATE ON products    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated      BEFORE UPDATE ON orders      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated    BEFORE UPDATE ON profiles    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUTO-UPDATE business rating when review is added
-- ============================================================
CREATE OR REPLACE FUNCTION update_business_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE businesses
  SET
    rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE business_id = NEW.business_id AND status = 'published'),
    review_count = (SELECT COUNT(*) FROM reviews WHERE business_id = NEW.business_id AND status = 'published')
  WHERE id = NEW.business_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_rating
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_business_rating();
