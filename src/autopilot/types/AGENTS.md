<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# types

## Purpose
Shared contract layer for autopilot runs, evidence, findings, journeys, and reports.

## Key Files
| File | Description |
|------|-------------|
| `evidence.ts` | Evidence type contracts. |
| `finding.ts` | Finding and issue-related type contracts. |
| `journey.ts` | Journey definition contracts. |
| `report.ts` | Report output contracts. |
| `run.ts` | Run summary/state contracts. |
| `index.ts` | Shared type export surface. |

## For AI Agents

### Working In This Directory
- Treat these files as cross-subsystem contracts; changes ripple into analysis, capture, persistence, reporting, and UI.
- Prefer additive type changes over breaking renames or removals.

### Testing Requirements
- Run autopilot type/schema-adjacent tests and `pnpm lint`.

### Common Patterns
- Small domain-specific type modules re-exported through `index.ts`.

## Dependencies

### Internal
- `src/autopilot/analysis/`
- `src/autopilot/evidence/`
- `src/autopilot/reporting/`
- `app/autopilot/`

### External
- TypeScript only; no direct runtime dependency requirements in most files.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
