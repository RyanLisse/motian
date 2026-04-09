<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# telemetry

## Purpose
Autopilot telemetry helpers for run lifecycle events and metrics emission.

## Key Files
| File | Description |
|------|-------------|
| `events.ts` | Telemetry event definitions and emission helpers. |
| `index.ts` | Export surface for telemetry helpers. |

## For AI Agents

### Working In This Directory
- Preserve event names and key properties where dashboards or logs may depend on them.
- Keep instrumentation thin and avoid embedding business logic here.

### Testing Requirements
- Run telemetry-related tests and `pnpm lint`.

### Common Patterns
- Lightweight wrappers around event emission and shared naming conventions.

## Dependencies

### Internal
- Used by autopilot orchestration, evidence, reporting, and persistence flows.

### External
- Observability and analytics integrations configured in the repo.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
