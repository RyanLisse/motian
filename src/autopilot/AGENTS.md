<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# autopilot

## Purpose
Autopilot subsystem for scheduled audits, captured evidence, GitHub/report publishing, and operational visibility. It is a self-contained feature area with analysis, storage, telemetry, and presentation concerns.

## Key Files
| File | Description |
|------|-------------|
| `index.ts` | Main autopilot entry surface. |
| `run-detail.ts` | Run detail assembly used by the UI and reporting surfaces. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `analysis/` | Run analysis and decision helpers. |
| `config/` | Autopilot configuration loading. |
| `evidence/` | Screenshot, video, HAR, and trace handling. |
| `github/` | GitHub publishing and artifact integration. |
| `persistence/` | Storage and retrieval of autopilot state. |
| `reporting/` | Report generation helpers. |
| `telemetry/` | Metrics and tracing support. |
| `types/` | Shared autopilot type definitions. |

## For AI Agents

### Working In This Directory
- Treat evidence formats as compatibility-sensitive because UI, storage, and reports all depend on them.
- Preserve separations between capture, persistence, and rendering logic.
- Prefer additive changes over changing artifact contracts unless all consumers are updated together.

### Testing Requirements
- Update the relevant autopilot tests in `tests/` for any schema, storage, or UI evidence change.
- Run `pnpm lint` and targeted autopilot suites.

### Common Patterns
- Artifact-rich workflows with screenshots, logs, traces, and generated summaries.
- Shared type modules mediate between capture and display layers.

## Dependencies

### Internal
- `app/autopilot/` for presentation.
- `trigger/` for scheduled execution entry points.

### External
- Browser automation tooling, GitHub integrations, and observability utilities already configured in the repo.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
