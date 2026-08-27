ALTER TABLE businesses ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS expired_notified_75 BOOLEAN DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS expired_notified_82 BOOLEAN DEFAULT FALSE;
UPDATE businesses SET expires_at = created_at + INTERVAL '90 days' WHERE plan = 'free' AND expires_at IS NULL;
