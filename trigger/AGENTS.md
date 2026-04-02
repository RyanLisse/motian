<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# trigger

## Purpose
Trigger.dev task definitions for background processing, scheduled maintenance, scraping, embeddings, agent workflows, notifications, and CV analysis.

## Key Files
| File | Description |
|------|-------------|
| `scrape-pipeline.ts` | Main background scrape orchestration task. |
| `cv-analysis-pipeline.ts` | CV analysis workflow task. |
| `embeddings-batch.ts` | Batch embedding generation. |
| `autopilot-nightly.ts` | Nightly autopilot audit pipeline. |
| `nightly-maintenance.ts` | General nightly maintenance task. |
| `platform-onboard.ts` | Platform onboarding automation task. |
| `scraper-health.ts` | Scraper monitoring and health checks. |

## For AI Agents

### Working In This Directory
- Follow the repo’s Trigger.dev v4 conventions from the root instructions.
- Keep tasks idempotent where possible and route durable business logic into `src/services/`.
- Avoid unsupported concurrency patterns like wrapping Trigger wait APIs in `Promise.all`.

### Testing Requirements
- Update task-oriented tests in `tests/` when inputs, outputs, or scheduling assumptions change.
- Run `pnpm lint` and targeted task tests.

### Common Patterns
- Task files map closely to named workflows.
- Background orchestration delegates most logic to service modules.

## Dependencies

### Internal
- `src/services/` for real work execution.
- `src/autopilot/` for nightly audit workflows.

### External
- `@trigger.dev/sdk`.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
