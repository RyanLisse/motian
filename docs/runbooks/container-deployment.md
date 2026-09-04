# Container deployment (Coolify)

Motian ships as a single Next.js container built from the root `Dockerfile`.
This is the M0 groundwork for moving off Vercel; it does not change how the app
behaves on Vercel, where `output: "standalone"` is simply ignored.

## Build

```bash
docker build -t motian:local .
docker run --rm -p 3000:3000 --env-file .env.production motian:local
```

The image listens on `PORT` (default `3000`) and binds `HOSTNAME` (default
`0.0.0.0`).

## Build args vs runtime env

The distinction matters more than it looks: anything passed at build time is
baked into image layers and can be read back out of the image by anyone who can
pull it. Nothing secret is a build arg.

### Build args — non-secret, inlined into the client bundle

`NEXT_PUBLIC_*` values are substituted into JavaScript at build time, so they
cannot be supplied at runtime. They are public by construction.

| Build arg | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | no | Browser error reporting. Empty disables it. |
| `NEXT_PUBLIC_POSTHOG_KEY` | no | Product analytics. Empty disables it. |
| `NEXT_PUBLIC_POSTHOG_HOST` | no | Defaults to PostHog cloud when unset. |

The build also sets `SKIP_ENV_VALIDATION=1`. Without it, the t3-env schema in
`src/env.ts` demands `DATABASE_URL` before `next build` will run, which would
force a real connection string into the build context for no benefit — the
schema is enforced again at boot, where the real values live.

**Sentry sourcemap upload is deliberately off in the image build.**
`next.config.ts` throws when a production build has a Sentry DSN but no
`SENTRY_AUTH_TOKEN`, and that token is a credential that must not end up in a
layer. Upload belongs in CI, which can hold the token outside the image.

### Runtime env — set these in Coolify

Names only; values live in Coolify's secret store. The full inventory, grouped
by service, is in `docs/rjc-420-vercel-env-inventory.md`.

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **yes** | Neon connection string. |
| `INTERNAL_SERVER_URL` | defaulted in the image | `http://127.0.0.1:3000`. Override only if `PORT` differs. See below. |
| `API_SECRET` | yes | Bearer the BFF attaches when forwarding to `/api/**`. |
| `TRIGGER_SECRET_KEY` | yes | Trigger.dev; must be a `tr_prod_…` key in production. |
| `OPENROUTER_API_KEY` | yes for AI paths | Chat, enrichment and embeddings. |
| `SENTRY_DSN` | no | Server-side error reporting. |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | no | Dashboard and sidebar caches. |
| `BROWSERBASE_*`, `FIRECRAWL_API_KEY`, `MODAL_*`, `STRIIVE_*` | no | Scraper-specific; only needed for the sources that use them. |

`PORT` and `HOSTNAME` are already set in the image and only need overriding if
Coolify maps a different port.

## `INTERNAL_SERVER_URL`

The BFF (`src/lib/bff.ts`) forwards a first-party browser request to the
matching `/api/**` route with a server-attached bearer. It has to fetch its own
server to do that.

On Vercel the inbound origin *is* the server's own origin, so the hop is local
and no configuration is needed. Behind a reverse proxy it is not: `request.url`
carries the public hostname, so forwarding to it sends the request back out of
the container, through the proxy, and in again. That costs a full round trip on
every BFF call, and fails outright when the container cannot resolve or reach
its own public name — the normal case on a Docker network.

The image already sets it to the loopback it listens on, so a stock Coolify
deployment needs no configuration:

```
INTERNAL_SERVER_URL=http://127.0.0.1:3000
```

Override it only when `PORT` is changed. It is registered in `src/env.ts` as an
optional URL, so a bad value fails validation at boot rather than silently
mis-routing every BFF call.

`resolveBffUpstreamOrigin` falls back to the inbound origin when the variable is
unset *or unparseable*, so a malformed value degrades to the Vercel behaviour
instead of taking the BFF down.

## Health checks

Two endpoints, deliberately different:

| Endpoint | Used by | Touches the database |
|---|---|---|
| `/api/health` | Docker `HEALTHCHECK`, Coolify | no |
| `/api/gezondheid` | operators, dashboards | yes |

The container probe must not depend on Neon. If it did, a transient database
blip would fail the healthcheck and Coolify would restart a container whose
process is fine — turning a short degradation into a restart loop. Liveness
answers "is this process serving?"; readiness and data health are
`/api/gezondheid`'s job, and it is expected to fail loudly when they are broken.

`HEALTHCHECK` allows a 40s `start-period` so a cold Next boot is not counted as
a failure.

## Not covered here

Database migrations, the Trigger.dev worker deployment, and DNS cutover. The
image runs the web app only.
