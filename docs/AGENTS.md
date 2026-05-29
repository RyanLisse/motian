<!-- Parent: ../AGENTS.md -->
<!-- Updated: 2026-05-29 -->

# docs

## Purpose
Canonical customer-handoff, architecture, operational runbook, solution-KB, and product reference documentation for Motian.

## Key Files
| File | Description |
|------|-------------|
| `architecture.md` | Main architecture narrative. |
| `deployment-verification-summary.md` | Current deploy and verification runbook. |
| `customer-handover-readiness-2026-05-28.nl.md` | Current Dutch customer-handover snapshot. |
| `autopilot-usage.md` | Operational guide for autopilot users. |
| `autopilot-configuration.md` | Autopilot configuration reference. |
| `visual-explainer.html` | Browser-rendered visual explainer artifact. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `research/` | Current source research that is still operationally relevant. |
| `runbooks/` | Operational runbooks and ownership-transfer guides. |
| `solutions/` | Solved-problem documentation and implementation notes. |

## Handoff hygiene

- Do not add dated brainstorm, temporary plan, review-output, demo, screenshot, or generated-metrics folders back into Git.
- Generated metrics may be created locally in `docs/metrics/`, but that directory is ignored.
- Use customer-facing route names in docs: `/vacatures`, `/kandidaten`, `/api/gezondheid`, `/api/vacatures`.
- Only document legacy `opdrachten` routes when explicitly describing internal compatibility behavior.

## For AI Agents

### Working In This Directory
- Keep docs aligned with the shipped codebase and current routes/tooling.
- Prefer updating existing canonical docs over creating overlapping narratives.
- Keep customer-facing copy concise and free of stale implementation plans.

### Testing Requirements
- No build step is usually required for docs-only changes, but verify links and referenced commands when editing operational docs.

## Dependencies

### Internal
- Reflects behavior from `app/`, `src/`, `trigger/`, and workspace packages.

### External
- Docs may reference Vercel, Trigger.dev, Neon, Sentry, PostHog, Browserbase, Firecrawl, OpenAI, and Google AI.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
