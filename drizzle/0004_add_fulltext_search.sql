-- Full-text search indexes using expression-based GIN indexes.
-- No schema changes needed — PostgreSQL indexes the to_tsvector expression directly.

-- Jobs: search across title, company, description, location, province
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_fts
  ON jobs
  USING GIN (
    to_tsvector('dutch',
      coalesce(title, '') || ' ' ||
      coalesce(company, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(location, '') || ' ' ||
      coalesce(province, '')
    )
  );

-- Candidates: search across name, role, location
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_candidates_fts
  ON candidates
  USING GIN (
    to_tsvector('dutch',
      coalesce(name, '') || ' ' ||
      coalesce(role, '') || ' ' ||
      coalesce(location, '')
    )
  );
