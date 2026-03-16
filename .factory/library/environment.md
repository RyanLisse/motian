# Environment

Environment variables, external dependencies, and setup notes for the candidate matching mission.

## New Environment Variables

The following environment variables control the new recency and quality features:

| Variable | Default | Description |
|----------|---------|-------------|
| `RECENCY_BOOST_DAYS` | 30 | Days within which a candidate receives a recency boost |
| `RECENCY_PENALTY_DAYS` | 60 | Days after which a candidate receives a recency penalty |
| `QUALITY_SIGNAL_DECAY_DAYS` | 90 | Days of match history to consider for approval rate |

## Testing Notes

- The scoring service uses these env vars with fallbacks to defaults
- Tests should mock or override these values to verify behavior
- Existing behavior is preserved when env vars are not set

## Existing Services

- **Turso Database**: Managed externally, connection via `DATABASE_URL`
- **Next.js Dev Server**: Port 3002 (not modified by this mission)
