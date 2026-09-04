# Coolify Dockerfile Runbook (RJC-419)

This runbook covers building and running Motian from the root `Dockerfile` on Coolify or any Docker host. The image uses Next.js `output: "standalone"` and listens on port **3001**.

## Build

From the repository root:

```bash
docker build -t motian:latest .
```

The build stage:

- Uses `node:22-bookworm-slim` with `pnpm@9.15.0` via Corepack
- Installs workspace dependencies with `pnpm install --frozen-lockfile`
- Runs `SKIP_ENV_VALIDATION=1 pnpm build` so env validation does not block image creation

Do **not** bake secrets into the Dockerfile. Provide runtime configuration through Coolify environment variables or mounted secrets.

## Runtime

| Variable | Default in image | Purpose |
|----------|------------------|---------|
| `PORT` | `3001` | HTTP listen port |
| `HOSTNAME` | `0.0.0.0` | Bind address |
| `INTERNAL_SERVER_URL` | `http://127.0.0.1:3001` | Server-to-self loopback base URL inside the container |
| `DATABASE_URL` | *(required at runtime)* | Neon PostgreSQL connection string |
| `API_SECRET` | *(required in production)* | Bearer token for protected `/api` routes |

Coolify should map container port **3001** to your public HTTPS endpoint.

## INTERNAL_SERVER_URL

Server-side code that builds absolute URLs for in-container HTTP calls (Slack links, OpenAPI base URL when configured, etc.) resolves base URLs in this order:

1. `INTERNAL_SERVER_URL`
2. `PUBLIC_API_BASE_URL`
3. `NEXT_URL`
4. `http://127.0.0.1:3001`

Set `INTERNAL_SERVER_URL=http://127.0.0.1:3001` when the app runs behind a reverse proxy but must call itself on loopback inside the container. This avoids routing server-to-self traffic through the public hostname (see JI #124).

For public-facing API documentation or external clients, set `PUBLIC_API_BASE_URL` to your HTTPS origin instead.

Example Coolify env block:

```env
DATABASE_URL=postgresql://...
API_SECRET=...
INTERNAL_SERVER_URL=http://127.0.0.1:3001
PUBLIC_API_BASE_URL=https://motian.example.com
PORT=3001
HOSTNAME=0.0.0.0
```

## Health check

The image defines a Docker `HEALTHCHECK` that curls:

```text
http://127.0.0.1:${PORT}/api/gezondheid
```

Ensure `/api/gezondheid` remains available without auth so orchestrators can mark the service healthy.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Container unhealthy | App not listening on `PORT` | Confirm `HOSTNAME=0.0.0.0` and port mapping |
| Slack/OpenAPI links point at wrong host | Missing public base URL | Set `PUBLIC_API_BASE_URL` to the external HTTPS origin |
| Server self-requests fail behind proxy | Public URL used for loopback | Set `INTERNAL_SERVER_URL=http://127.0.0.1:3001` |
| Build fails on env validation | Missing `.env` at build time | Build already sets `SKIP_ENV_VALIDATION=1`; check for new required build-time vars |

## Related code

- `next.config.ts` — `output: "standalone"`
- `src/lib/internal-server-url.ts` — URL resolution helper
- `Dockerfile` — multi-stage production image
- `.env.example` — documented env vars for local and container setups
