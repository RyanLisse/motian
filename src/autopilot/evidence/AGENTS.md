<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# evidence

## Purpose
Autopilot evidence capture and normalization helpers for screenshots, journeys, content typing, and stored artifact handling.

## Key Files
| File | Description |
|------|-------------|
| `capture.ts` | Evidence capture orchestration. |
| `journey-runner.ts` | Journey execution used to produce evidence. |
| `content-type.ts` | Artifact content-type helpers. |
| `index.ts` | Re-export surface. |

## For AI Agents

### Working In This Directory
- Evidence contracts are consumed by storage, reporting, and UI; change cautiously.

### Testing Requirements
- Run autopilot evidence tests and `pnpm lint`.

## Dependencies

### Internal
- Parent autopilot subsystem, reporting, and persistence layers.

### External
- Browser automation and artifact generation tooling.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
