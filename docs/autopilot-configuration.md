# Autopilot Configuratie

## Omgevingsvariabelen

### Runtime

- `AUTOPILOT_BASE_URL`
  - Basis-URL voor de browser journeys.
  - Fallback: `VERCEL_URL`, daarna `http://localhost:3002`.

- `AUTOPILOT_EVIDENCE_DIR`
  - Lokale tijdelijke map voor screenshots, video, traces en HAR-bestanden.
  - Default: `/tmp/autopilot-evidence`.

### GitHub publicatie

- `AUTOPILOT_GITHUB_TOKEN`
  - Voorkeurs-token voor issue publicatie.
- `GITHUB_TOKEN`
  - Fallback als `AUTOPILOT_GITHUB_TOKEN` ontbreekt.
- `GITHUB_REPOSITORY`
  - Verwachte vorm: `owner/repo`.
- `GITHUB_OWNER`
  - Handmatige fallback voor owner.
- `GITHUB_REPO`
  - Handmatige fallback voor repo.

### Evidence capture / opslag

- `AUTOPILOT_RICH_EVIDENCE`
  - Ondersteunde waarde in deze batch: `failures`.
  - Gedrag:
    - niet gezet: upload alle artifacts;
    - `failures`: sla `video`, `trace` en `har` alleen op voor mislukte journeys; screenshots blijven altijd beschikbaar.

## Compressie-instellingen

De uploadlaag in `src/autopilot/reporting/upload.ts` gebruikt de volgende regels:

- `trace` en `har` bestanden groter dan `1_000_000` bytes worden gecomprimeerd met `gzip`;
- gecomprimeerde blobs krijgen `metadata.contentEncoding = "gzip"` in de geüploade `summary.json`;
- de artifact-proxy route pakt deze blobs weer uit voordat ze aan de browser worden teruggegeven.

Dat houdt Playwright trace downloads bruikbaar zonder dat de summary nog extra databasekolommen nodig heeft.

## Blob cache / bewaarbeleid

Alle Phase 4 uploads krijgen:

- `cacheControlMaxAge: 2_592_000`
- effectief: 30 dagen cache metadata op rapport, summary en artifacts

Dit is de opslag-optimalisatie die in deze batch is geïmplementeerd. De canonical artifact metadata leeft in `summary.json`, niet in aanvullende DB-schemawijzigingen.

## Opgeslagen artifacttypen

- `video` → `video/webm`
- `trace` → `application/zip`
- `har` → `application/json`
- `screenshot` → `image/png`
- `console-log` → `text/plain`

## Operationele observability

Bij succesvolle uploads wordt een PostHog event verstuurd:

- event: `autopilot_storage_usage`

Het event bevat onder andere:

- `originalBytes`
- `uploadedBytes`
- `compressedBytes`
- `traceBytes`
- `harBytes`
- `uploadedArtifacts`
- `skippedRichArtifacts`

Gebruik dit event om opslaggroei, compressieratio en de impact van `AUTOPILOT_RICH_EVIDENCE=failures` te monitoren.
