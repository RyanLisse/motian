# Weekly Speed and Performance Overview (2026-04-01 to 2026-04-07)

This recap explains what we shipped this week for speed/performance, and why each change matters for recruiter-facing latency and perceived responsiveness.

## Executive Summary

- We reduced expensive search work on common query paths (short queries, list views, metadata fetches).
- We improved shell responsiveness on mobile by moving heavy client features out of the global critical path.
- We added guardrails to keep performance from regressing (route budgets, hydration timing, QA automation).
- We tightened observability so regressions are visible faster and easier to triage.

## What We Did and Why

## 1) Search Hot-Path Optimization

### What changed
- Skipped vector search for short queries (<= 2 words) on the vacature search path.
- Reduced unnecessary count operations and parallelized expensive list/count work.
- Reduced initial sidebar load size and served stale metadata where full refresh cost was too high for interactive flows.
- Hardened production search + observability paths after regressions.

### Why it matters
- Most recruiter searches are short and intent-focused; vector calls on these paths add cost/latency without proportional relevance gains.
- Removing/deferring count-heavy and refresh-heavy calls improves time-to-first-results and list interaction fluidity.
- Better observability makes search regressions measurable and reversible before they impact daily usage.

## 2) Mobile Shell Performance + Native Feel

### What changed
- Added route-level shell overlays and dynamic loading so heavyweight client features are not eagerly loaded globally.
- Introduced mobile bottom navigation and safe-area aware layout behavior.
- Added virtualization for long mobile sidebar/list views.
- Scoped chat context/provider usage to route boundaries instead of full-app mounting.

### Why it matters
- The app shell now hydrates with less work on non-chat/non-dev routes.
- Mobile interactions feel closer to native patterns (thumb navigation, safe areas, smoother large lists).
- Reduced over-rendering and layout pressure on constrained mobile devices.

## 3) Performance Guardrails and Verification

### What changed
- Added shell route bundle-budget checks (`perf:budget:shell`) and integrated `perf:check:shell`.
- Added hydration timing instrumentation for shell routes with warning thresholds.
- Added mobile QA automation scripts (Expect CLI) and browser test workflow improvements.
- Isolated app-focused lint/test checks to stabilize verification while broader repo debt exists.

### Why it matters
- Performance targets are now enforceable in tooling, not just aspirational.
- Hydration regressions become visible in telemetry and can trigger investigation sooner.
- QA coverage now includes explicit mobile shell validation paths.

## 4) Background Runtime Cost and Throughput

### What changed
- Reduced idle background spend in Trigger/Vercel realtime plumbing.
- Consolidated scheduled task behavior and cleaned up runtime overhead in supporting flows.

### Why it matters
- Lower idle spend and reduced background churn frees budget for high-value compute paths.
- Fewer unnecessary background operations reduces noise and production variance.

## Outcome Snapshot

- **User-facing speed:** Faster initial shell load and faster common search interactions.
- **Mobile responsiveness:** Better perceived performance and interaction reliability on small screens.
- **Operational reliability:** Stronger perf regression detection and clearer telemetry signals.
- **Cost efficiency:** Less background waste in runtime/automation infrastructure.

## Validation Paths Used

- `pnpm perf:check:shell`
- `pnpm lint:shell`
- `pnpm test:app`
- `pnpm qa:mobile:expect` (environment-dependent; useful when runner/tooling session is stable)

## Next Performance Priorities

1. Tune route budgets against production manifest trends weekly.
2. Extend virtualization and list windowing to remaining heavy list surfaces.
3. Continue removing non-critical global providers from initial shell where possible.
4. Add real-device iOS Safari validation runs into repeatable QA cadence.
