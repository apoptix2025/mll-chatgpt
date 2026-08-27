-- Add basic and agency to the businesses plan constraint
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_plan_check;
ALTER TABLE businesses ADD CONSTRAINT businesses_plan_check
  CHECK (plan IN ('free', 'basic', 'pro', 'featured', 'agency', 'admin'));
