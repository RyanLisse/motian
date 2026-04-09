---
name: launch-app
description: Launch the Motian Next.js dev server for runtime validation and testing.
---

# Launch App

Motian is a Next.js 16 app with Turbopack.

## Launch

```bash
pnpm install
pnpm dev
```

The dev server starts on port 3002 (override with `PORT` env var).

## Verify running

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002
```

Expected: `200`.

## Key pages to validate

- `/` — landing / dashboard
- `/kandidaten` — candidate list
- `/vacatures` — job listings
- `/chat` — AI chat interface

## Environment

The app requires a `.env.local` file with database and API keys. If missing, copy from Vercel:

```bash
vercel env pull .env.local
```

## Testing

```bash
pnpm test          # Vitest one-shot
pnpm lint          # Biome check
pnpm exec tsc --noEmit  # Type check
```
