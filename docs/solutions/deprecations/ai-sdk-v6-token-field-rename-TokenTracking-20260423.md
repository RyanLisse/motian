---
title: AI SDK v6 renamed `promptTokens`/`completionTokens` → `inputTokens`/`outputTokens`
date: 2026-04-23
category: deprecations
module: AI Services
problem_type: deprecation_migration
component: service_object
symptoms:
  - "chat_sessions.tokens_used stays 0 across 85 sessions over 2 months"
  - "No tokens recorded for any flow — cost reporting returns $0.00"
  - "(undefined ?? 0) + (undefined ?? 0) = 0 silently"
root_cause: wrong_api
resolution_type: code_fix
severity: medium
tags: [ai-sdk, vercel, deprecation, migration, token-tracking, silent-failure]
---

# AI SDK v6 renamed `promptTokens`/`completionTokens` → `inputTokens`/`outputTokens`

## Problem

Chat session token counters had been stuck at 0 across all 85 sessions for 2+ months. Root cause: the tracking helper at `app/api/chat/_helpers.ts` reads `usage.promptTokens` and `usage.completionTokens`, which are **AI SDK v4** field names. Our repo is on `ai@^6.0.149` where those fields were renamed to `inputTokens` / `outputTokens` / `totalTokens`. The old field names resolve to `undefined`, `(undefined ?? 0) + (undefined ?? 0) = 0`, early-return — nothing is written.

## Symptoms

- `select sum(tokens_used) from chat_sessions where created_at > now() - interval '30 days'` → 0 across 42 sessions
- No runtime error, no Sentry alert — just zero counters
- Would have been caught earlier by a cost-tracking dashboard that alerts on "N sessions but $0.00 spent"

## What Didn't Work

- Assuming the usage object still matched v4 shape. The `ai@6` upgrade was done ~2 months ago; the tracking helper wasn't touched at that time.
- Relying solely on Vercel AI SDK changelogs — the rename is called out in the v5→v6 migration guide but our tracker was written before v5 and never revisited.

## Solution

Read both name shapes so a future SDK bump (or provider that still uses the old names) doesn't silently zero-out the counter again:

```ts
const usage = (final as {
  usage?: {
    // v6 names (preferred)
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    // v4 names (fallback)
    promptTokens?: number;
    completionTokens?: number;
  };
})?.usage;

if (!usage) return;
const prompt = usage.inputTokens ?? usage.promptTokens ?? 0;
const completion = usage.outputTokens ?? usage.completionTokens ?? 0;
// Prefer the provider-reported total over our sum — providers sometimes
// report reasoning/thinking tokens separately that the sum would miss.
const total = usage.totalTokens ?? prompt + completion;
if (total <= 0) return;
```

After the fix, PR #227 replaced this narrow chat-only counter with a full `ai_usage` ledger that auto-records every call through `tracedGenerateText/Object/StreamText/Embed/EmbedMany` with per-call cost in USD micros (see `src/services/ai-usage.ts`, `src/lib/ai-pricing.ts`).

## Why This Works

The OR chain lets the helper survive provider-specific or SDK-version-specific field naming without silently going to zero. Preferring `usage.totalTokens` matters because some providers (Google Gemini with "thinking") report reasoning tokens in a separate field that isn't captured by summing input + output.

## Prevention

- **Every AI SDK major-version bump requires a revisit of the usage/tracing path.** Add a grep hit for `promptTokens|completionTokens` to the SDK upgrade checklist.
- **Tracking code must exercise runtime assertions.** A lint rule or test that verifies `recordAiUsage` actually writes ≥1 row per provider after an upgrade would have caught this on day 1.
- **`ai_usage` table + `scripts/cost-report.ts`** (PR #227) surfaces "zero tokens recorded" as a visible signal in the monthly cost report. If the report shows `$0.00` for a month with real traffic, that's a canary.

## Related Issues

- PR #227 — the broader ledger that subsumed this narrow fix.
- `docs/solutions/deprecations/generateobject-to-generatetext-ai-sdk6-20260223.md` — the other v6 migration doc; references the remaining call sites not yet moved to `Output.object({ schema })`.
- `src/lib/ai-pricing.ts` — the rate-card source used to turn tokens into USD micros.
