-- ============================================================
-- MYLATINOLIST — 009 Customer AI Marketing Packs
-- PROPOSAL ONLY — DO NOT APPLY until reviewed
--
-- Durable per-business customer Marketing Pack storage and
-- trial usage counters. Separate from marketing_trials lifecycle.
--
-- Conceptual fields:
--   packs_generated
--   last_pack_generated_at
--   content_copy_events
--   last generated pack JSON
--
-- Apply staging (mll-dev) first after approval.
-- Do NOT run against production until a separate approval.
-- This file does not insert any rows.
-- This file does not contain environment business UUIDs.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customer_marketing_packs (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  pack JSONB,
  packs_generated INTEGER NOT NULL DEFAULT 0 CHECK (packs_generated >= 0),
  last_pack_generated_at TIMESTAMPTZ,
  content_copy_events INTEGER NOT NULL DEFAULT 0 CHECK (content_copy_events >= 0),
  model TEXT,
  fallback BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_marketing_packs_last_generated
  ON public.customer_marketing_packs (last_pack_generated_at);

COMMENT ON TABLE public.customer_marketing_packs IS
  'Latest customer AI Marketing Pack and usage counters. One row per business. Do not store trial lifecycle here.';
COMMENT ON COLUMN public.customer_marketing_packs.packs_generated IS
  'Count of successful pack generations for this business. V2 staging pilot limit is enforced in the Worker.';
COMMENT ON COLUMN public.customer_marketing_packs.last_pack_generated_at IS
  'Timestamp of the most recent successful pack generation.';
COMMENT ON COLUMN public.customer_marketing_packs.content_copy_events IS
  'Count of customer copy-button events for generated pack content.';
COMMENT ON COLUMN public.customer_marketing_packs.pack IS
  'Latest grounded Marketing Pack JSON. Drafts only. Nothing auto-posts.';

ALTER TABLE public.customer_marketing_packs ENABLE ROW LEVEL SECURITY;

-- Intentionally no policies. Anon/authenticated PostgREST cannot read or write
-- pack rows. The Worker uses the service role, which bypasses RLS.
