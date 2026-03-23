-- Truncate dedupe columns to 200 chars to prevent B-tree index overflow.
-- The composite index idx_jobs_dedupe_partition has a 2704 byte row limit.
-- With 3 text columns, each must stay under ~800 bytes (200 chars × 4 bytes max UTF-8).

-- First, fix any existing rows that exceed the limit
UPDATE jobs SET
  dedupe_title_normalized = LEFT(dedupe_title_normalized, 200),
  dedupe_client_normalized = LEFT(dedupe_client_normalized, 200),
  dedupe_location_normalized = LEFT(dedupe_location_normalized, 200)
WHERE
  LENGTH(dedupe_title_normalized) > 200
  OR LENGTH(dedupe_client_normalized) > 200
  OR LENGTH(dedupe_location_normalized) > 200;--> statement-breakpoint

-- Create trigger function to auto-truncate on insert/update
CREATE OR REPLACE FUNCTION truncate_dedupe_columns()
RETURNS TRIGGER AS $$
BEGIN
  NEW.dedupe_title_normalized := LEFT(NEW.dedupe_title_normalized, 200);
  NEW.dedupe_client_normalized := LEFT(NEW.dedupe_client_normalized, 200);
  NEW.dedupe_location_normalized := LEFT(NEW.dedupe_location_normalized, 200);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_truncate_dedupe ON jobs;--> statement-breakpoint

CREATE TRIGGER trg_truncate_dedupe
  BEFORE INSERT OR UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION truncate_dedupe_columns();
