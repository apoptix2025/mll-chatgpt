CREATE OR REPLACE FUNCTION public.update_business_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.businesses
  SET
    rating = (
      SELECT ROUND(AVG(r.rating)::numeric, 1)
      FROM public.reviews r
      WHERE r.business_id = NEW.business_id
        AND r.status = 'published'
    ),
    review_count = (
      SELECT COUNT(*)
      FROM public.reviews r
      WHERE r.business_id = NEW.business_id
        AND r.status = 'published'
    )
  WHERE id = NEW.business_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;