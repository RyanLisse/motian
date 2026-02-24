# OpenTUI Demo

This is a React-based OpenTUI console wired to real Motian API actions.

## Run

```bash
cd opentui-demo
bun install
bun run src/index.tsx
```

## Controls

- `up` / `k`: move selection up
- `down` / `j`: move selection down
- `enter`: run selected action
- `q`: quit

## Real actions

- Import jobs from ATS: `POST /api/scrape/starten`
- Run candidate scoring: loops jobs and calls `POST /api/matches/genereren`
- Review GDPR requests: reads candidates via `GET /api/kandidaten` and reports expired retention

## Agent-native parity

Equivalent AI tools are available in the main app:

- `importeerOpdrachtenBatch`
- `runKandidaatScoringBatch`
- `reviewGdprRetentie`

## Environment

- `MOTIAN_BASE_URL` (optional): defaults to `http://localhost:3001`
- `MOTIAN_API_SECRET` (optional): bearer token for protected API environments

Scaffolded with `bun create tui --template react`.
