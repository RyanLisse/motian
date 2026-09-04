# Dependency residuals — high / critical

> WP8b ledger for `pnpm audit --prod --audit-level high`.
> Measured after WP8a/WP8b remediations on 2026-07-27.
> Gate: every remaining high/critical advisory ID is listed here (R21).
> Do not put secrets in this file.

## Summary

| Date | High | Critical | Notes |
|---|---:|---:|---|
| 2026-07-27 (pre-WP8b) | 61–64 | 4 | Transitive trees under Next, Sentry, LiveKit, Modal |
| 2026-07-27 (post-WP8b) | 2 | 0 | Overrides in `package.json#pnpm` (pnpm 9.15) + Next patch; residuals: sharp + OTEL Jaeger propagator |

pnpm **9.15.0** reads `overrides` / `packageExtensions` / `peerDependencyRules` from
`package.json#pnpm`, not from `pnpm-workspace.yaml`. Workspace YAML previously held
overrides that never entered the lockfile. WP8 moved them to the honored location and
extended them for reachable high/critical findings.

## Remediations applied (not residuals)

| Package | Override / bump | Advisories addressed (representative) |
|---|---|---|
| `brace-expansion` | `>=5.0.8` | GHSA-mh99-v99m-4gvg, GHSA-3jxr-9vmj-r5cp |
| `shell-quote` | `>=1.9.0` | GHSA-w7jw-789q-3m8p, GHSA-395f-4hp3-45gv |
| `protobufjs` | `>=7.6.1` / `>=8.4.1` (+ `8.0.0` → `8.4.2`) | GHSA-xq3m-2v4x-88gg and related |
| `tar` | `>=7.5.19` | GHSA-23hp-3jrh-7fpw, GHSA-8x88-c5mf-7j5w |
| `postcss` | `>=8.5.18` | GHSA-r28c-9q8g-f849, GHSA-6g55-p6wh-862q |
| `axios` | `>=1.16.0` | GHSA-35jp-ww65-95wh family |
| `undici` | `>=7.28.0` | GHSA-vxpw-j846-p89q family |
| `adm-zip` | `>=0.6.0` | GHSA-xcpc-8h2w-3j85 |
| `hono` | `>=4.12.25` | GHSA-88fw-hqm2-52qc |
| `next` | `^16.2.12` (direct) | GHSA-6gpp-xcg3-4w24 family |
| plus existing pins | `basic-ftp`, `@xmldom/xmldom`, `fast-uri`, `fast-xml-builder`, `@grpc/grpc-js`, `form-data`, `ws`, `engine.io`, `systeminformation` | prior + refreshed floors |

## Remaining high / critical

| Advisory ID | Package | Severity | Dependency chain (sample) | Reachability | Compensating control | Owner | Revisit |
|---|---|---|---|---|---|---|---|
| GHSA-f88m-g3jw-g9cj | `sharp@0.34.5` | high | `@livekit/agents@1.2.3` → `sharp` (also via Sentry/Next image path) | Voice-agent / image native pipeline (not recruiter API admission path) | Keep LiveKit agents pinned at `1.2.3` until upstream accepts `sharp>=0.35`; no public HTTP surface serves sharp directly | platform | 2026-08-27 |
| GHSA-45rx-2jwx-cxfr | `@opentelemetry/propagator-jaeger@1.30.1` | high | `@livekit/agents` → `@opentelemetry/sdk-trace-node` → propagator | Telemetry / voice-agent OTEL export only | Malformed Jaeger headers are not accepted on public product routes; propagator stays behind LiveKit agent process | platform | 2026-08-27 |

### Why sharp is not overridden yet

Forcing `sharp>=0.35.0` under `@livekit/agents` risks breaking native bindings / install scripts
on the voice-agent machine profile. Prefer an upstream LiveKit agents release that declares a
patched sharp range, then drop this row.

## How to refresh

```bash
pnpm audit --prod --audit-level high --json > /tmp/audit.json
# Every high/critical github_advisory_id must appear in this file or in package.json#pnpm.overrides
```

`tests/dependency-residuals.test.ts` asserts the correspondence.
