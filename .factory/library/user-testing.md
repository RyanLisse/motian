# User Testing

## Validation Surface

### Browser/runtime surface

- **Primary routes**: `/overzicht`, `/vacatures`, `/kandidaten`, `/pipeline`, `/scraper`, `/databronnen`
- **Tool**: `agent-browser`
- **Setup**: start the local app on `http://localhost:3002` via `.factory/services.yaml`
- **Auth**: no login required for local recruiter runtime validation

### HTTP/API surface

- **Primary endpoints**:
  - `/api/gezondheid`
  - `/api/vacatures`
  - `/api/vacatures/zoeken`
  - `/api/opdrachten/zoeken`
- **Tool**: `curl`
- **Setup**: app must already be healthy on port `3002`

### Benchmark/metrics surface

- **Primary commands**:
  - `pnpm benchmark:hybrid-search`
  - `pnpm metrics:search-path-latency`
  - `pnpm metrics:search-explain`
  - `pnpm perf:budget:shell`
- **Tool**: shell commands
- **Setup**: `.env.local` must point at the configured Neon database; benchmark artifacts are written into `docs/metrics/`

## Known Limitations

- Browser validation is blocked until the Phase 0 boot fix restores a healthy app on port `3002`.
- Benchmark commands write shared artifact files, so they should not run in parallel with the same command family.
- Search/database metrics depend on live environment-backed database connectivity; failures caused by missing or malformed env must be treated as setup blockers, not product regressions.

## Validation Concurrency

- **Machine**: 32 GB RAM, 10 CPU cores
- **Current posture before boot fix**: serialize validation (`max concurrent = 1`)
- **Browser/runtime surface after boot fix**: `max concurrent = 2`
- **Benchmark/metrics surface**: `max concurrent = 1`
- **Mixed validation posture**: at most one benchmark command at a time; optionally one browser validator alongside it if the app is already stable

## Rationale

- The dev server is a shared dependency for all route checks.
- The benchmark commands hit the same Neon-backed data path and overwrite the same artifact files, so parallel runs create noise.
- A conservative 2-way browser ceiling preserves headroom while the mission actively changes cache, data-loading, and query behavior.
