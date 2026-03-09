# Decision: pricing free-tier-first

**Date:** 2026-03-09  
**Status:** Accepted

## Decision

Motian should stay on free tiers for most external services and optimize usage before upgrading. Paid upgrades are capability unlocks, not defaults.

Recommended upgrade order if/when free tiers stop fitting actual usage:

1. Neon
2. Sentry
3. Trigger.dev
4. LangSmith
5. PostHog

## Decision matrix

| Tool | Current recommendation | Stay-free threshold | Upgrade trigger | Next paid cost | Optimization action | Priority |
|---|---|---|---|---|---|---|
| Neon | Stay on Free while DB workload stays intermittent | 100 CU-hours/project/month, 0.5 GB/project, scale-to-zero intact | Upgrade first when production workload becomes always-on, storage exceeds free limits, or restore/metrics needs outgrow Free | Launch is usage-based, typical ~`$15/mo` for intermittent 1 GB workload | Preserve scale-to-zero, keep branches short-lived, minimize restore window/history | 1 |
| Sentry | Stay on Developer | 1 user, 5k errors, 5 GB logs, 50 replays, 1 uptime + 1 cron monitor | Upgrade when team workflows, integrations, or quota pressure become real operational pain | Team starts at `$26/mo` | Use inbound filtering, sample replay/profiling, reduce noisy logs/errors, avoid Seer by default | 2 |
| Trigger.dev | Stay on Free | 20 concurrent runs, 10 schedules, 1-day retention, `$5` included monthly usage | Upgrade when job concurrency, schedule count, retention, or reliability/visibility needs exceed Free | Hobby starts at `$10/mo` with `$10` included usage | Batch work, use waits/checkpointing, keep smallest machine size, limit preview branches | 3 |
| LangSmith | Stay on Developer | 1 seat, 5k base traces/month | Upgrade when more than one active user, managed deployment, or higher trace/workspace needs appear | Plus starts at `$39/seat/mo`, then pay-as-you-go | Use selective tracing, keep extended retention only where valuable, avoid always-on deployments unless justified | 4 |
| PostHog | Stay on Free | Keep within active product quotas (notably 1M analytics events, 1M flag requests, 100k exceptions, 100k LLM analytics events, 50 GB logs) | Upgrade only after real quota pressure or if more projects/retention/support are needed | Pay-as-you-go starts at `$0/mo` base; e.g. analytics from `$0.00005/event` after free tier | Remove noisy events, enable only used products, prefer anonymous events where possible, set per-product billing caps | 5 |

## Operating guidance

- Optimize before upgrading.
- Keep current spend near zero unless a limit blocks delivery or reliability.
- Reassess using real usage data: DB compute/storage, Sentry event volume, Trigger job volume, LangSmith traces, and PostHog events/logs.

## Pricing references checked

- Trigger.dev pricing
- PostHog pricing
- LangSmith pricing
- Sentry pricing
- Neon pricing