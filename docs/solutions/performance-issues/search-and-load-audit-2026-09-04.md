---
title: "Search and load audit — slow app, wrong result counts, strip candidates"
date: 2026-09-04
category: performance-issues
module: Platform
problem_type: performance_audit
component: full_stack
severity: high
symptoms:
  - "Multi-word search queries take minutes; senior java developer measured at 232s"
  - "Every keyword search reports the same result count regardless of query"
  - "Pagination past page 2 returns zero rows while still claiming 100 results"
  - "/kandidaten is the slowest route at ~3.2s while rendering one candidate"
  - "Previous query's results are shown as if they answered the new query"
root_cause: multiple
resolution_type: code_fix
tags: [search, hybrid-search, pagination, neon, embeddings, tanstack-query, de-bloat]
---

# Search and load audit — 2026-09-04

Triggered by: *"app loads slow, search results slow and niet helemaal werkend, app is bloated, focus is moving to Catapulze."*

All timings below are against production (`https://motian.vercel.app`) on 2026-09-04. Public routes have no auth wall; `/scraper` is gated.

## 1. Search returns a fabricated result count

The most serious finding, and the most likely meaning of *"niet helemaal"*.

`GET /api/vacatures/zoeken?q=developer`:

| `limit` | reported `total` | rows |
|---|---|---|
| 5 | **15** | 5 |
| 10 | **30** | 10 |
| 20 | **60** | 20 |
| 50 | **100** | 50 |
| 100 | **100** | 100 |

`total` is exactly `min(limit × 3, 100)` — the retrieval window, not a count. It was identical for `developer`, `java`, `projectmanager` and `verpleegkundige`.

Pagination:

| request | `total` | rows |
|---|---|---|
| `&limit=50&pagina=2` | 100 | 50 |
| `&limit=50&pagina=3` | 100 | **0** |
| `&limit=50&pagina=5` | 100 | **0** |

So the UI reported "100 resultaten, 2 pagina's" for every keyword query whether it matched three vacancies or thirty thousand, and nothing past the first 100 was reachable. The no-query listing path reports a genuine 124,485 by contrast.

**Cause:** `total` was assigned from `filtered.length` in `hybridSearchWithTotal` / `hybridSearchPageWithTotal`, and `filtered` only holds what the retrieval branches fetched.

**Fixed in:** PR #244 — count the matches; raise the window 100 → 500; clamp advertised pages to what RRF can actually fill.

## 2. Multi-word search has no upper bound

| query | words | time |
|---|---|---|
| `developer` | 1 | 1.56s |
| `projectmanager` | 1 | 1.53s |
| `verpleegkundige` | 1 | 1.54s |
| `java` | 1 | 6.45s |
| **`senior java developer`** | **3** | **232.25s** |

Single-word queries skip the vector branch by policy, so they never pay it. Multi-word queries take it every time, and nothing bounds it: `embed()` carries its own retries and accepts no `AbortSignal`, and `withRetry` adds three more attempts.

This is why a browser-only repro reads search as healthy — the queries usually typed first are single-word, which is the fast path.

**Fixed in:** PR #243 — bound the call; the existing catch already degrades to text-only.

### Related: the vector branch cannot add recall

`findSimilarJobsByEmbedding` is passed `retrievalFilterCondition`, and that condition **already includes the keyword match** — `buildMultiTermSearchCondition` is pushed into `filterConditions` before the filter is built. So vector search can only reorder rows the keywords already matched.

The Dutch-synonym recall its own comment describes ("projectleider" for "project manager") does not happen. It is currently pure cost on the hot path — a ~900ms embedding call, and the source of the 232s hang.

**Not fixed.** Either the filter should be relaxed for the vector branch so it can actually contribute recall, or the branch should be dropped. That is a product call, not a cleanup.

## 3. `/kandidaten` serialises two queries ahead of its own

~3.2s for a single candidate — the slowest route measured. `KandidatenContent` awaited `getSkillsFilterData()` (two queries) before starting the `Promise.all` that fetches candidates, stats and count. With the Neon pool at `max: 1` that wait is strictly serial.

The dependency is narrow: the catalog only decides which query to run when a skill filter is selected.

**Fixed in:** PR #245. Same anti-pattern the April cold-start writeup called out, one route over.

## 4. Stale results are presented as answers

`placeholderData: (prev) => prev` (`use-sidebar-filters.ts:285`) keeps the previous query's rows mounted so the list does not collapse between queries — correct, but nothing marks them. For the 1.5s+ a search takes, rows for the *previous* query look settled.

**Fixed in:** PR #246 — mark them via `isPlaceholderData` (dim + `aria-busy`) rather than dropping the placeholder, which would reintroduce the collapse.

## 5. Strip candidates

### Not removable — ruled out on inspection

A dependency scan flagged five unused packages. Four are false positives, recorded here so nobody removes them later:

| Package | Why it must stay |
|---|---|
| `critters` | Required by `experimental.optimizeCss` in `next.config.ts` |
| `tw-animate-css` | Imported from `app/globals.css:2`, not from TS |
| `jimp` | Peer dependency of `@whiskeysockets/baileys` (see `pnpm-lock.yaml:120`) |
| `@visual-json/core` | Peer of `@visual-json/react`, used by `components/visual-json-viewer.tsx` |

Only `just-bash` has no reference in source, lockfile aside. One dependency is not worth a PR on its own.

**The bloat is product surface, not `node_modules`.** 68 dependencies, ~90 API routes, 25 pages.

### Surface worth a decision (needs Ryan)

Ordered by weight. None removed here — each is a user-facing flow, and the brief was to check before deleting.

| Surface | Evidence | Note |
|---|---|---|
| WhatsApp / Baileys | 8 files, `app/api/whatsapp/`, `src/services/whatsapp*.ts`; pulls `jimp` + `sharp` | Heaviest single dependency chain |
| LiveKit screening calls | 22 files, 5 `@livekit/*` packages incl. server agents | Largest by dependency count |
| Autopilot | `app/autopilot/`, 2 API routes incl. nested evidence artifacts | Repro found `/pipeline` empty |
| Agents / MCP | `app/agents/`, `app/api/mcp/`, `@mcp-b/*`, `modal` (7 files) | |
| Broken scrapers | MiPublic (anti-bot), Striive (sandbox), Opdrachtoverheid (partial validation) — 3 of 8 platforms in `packages/scrapers/src/platform-definitions.ts` | `/scraper` presents all three as live and failing |

The cheapest honest step for the scrapers is to **gate rather than delete**: mark the three as unavailable so `/scraper` stops presenting broken sources as operational. That keeps the connectors for reference during migration.

## 6. What stays in Motian vs what is Catapulze-only

An assessment for Ryan to confirm, not a decision taken here.

**Catapulze already owns this — freeze in Motian:**
Job ingest and everything downstream of it. Platform scraping, scrape runs, circuit breakers, dedup, the job search stack and the scraper dashboard. `catapulze-job-intelligence` has rebuilt all of it with a stricter model (per-source `bron_id`, a fixed failure envelope, dedup as a unique index rather than a precomputed rank table). Motian's versions are the v1 these were learned from. New work here is duplicated effort.

**Only exists in Motian:**
Recruitment operations — candidates, matching, CV analysis, interviews, screening calls, pipeline, messaging. Catapulze JI has no equivalent. If any of it matters, it needs an owner decision; it will not arrive via the Catapulze migration.

**Recommendation:** keep Motian on the fixes in this audit, stop investing in its scraping and search stack, and decide surface-by-surface which recruitment-ops flows are worth carrying. Where "kill Motian" is on the table, note the dashboard is the only place these numbers are visible today.

## Verification notes

- `expect` fails in CI on every branch, including ones touching only `app/kandidaten/` and only `components/sidebar/`. Pre-existing, unrelated to this work.
- On a fresh checkout, `bun install` cannot link the `@whiskeysockets/libsignal-node` git dependency, which breaks `packages/scrapers` resolution and fails several suites locally with `z.object` undefined. Identical on pristine `main`. **The repo is pnpm** (`pnpm-lock.yaml`); use pnpm rather than bun locally.
