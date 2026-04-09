<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# analysis

## Purpose
Evidence-analysis layer for autopilot runs. This directory turns captured artifacts into structured findings and shared analysis outputs.

## Key Files
| File | Description |
|------|-------------|
| `analyze-evidence.ts` | Main evidence-to-finding analysis workflow. |
| `schemas.ts` | Structured analysis schemas and output contracts. |
| `index.ts` | Export surface for analysis helpers. |

## For AI Agents

### Working In This Directory
- Preserve schema stability for findings because reporting, issue publishing, and UI all depend on it.
- Favor conservative analysis changes that reduce false positives rather than broad heuristic expansion.

### Testing Requirements
- Run autopilot analysis and finding-related tests plus `pnpm lint`.

### Common Patterns
- Structured analysis outputs validated by schemas before downstream use.

## Dependencies

### Internal
- `src/autopilot/evidence/`
- `src/autopilot/types/`
- `src/autopilot/reporting/`

### External
- Browser automation artifact inputs and any model-assisted analysis paths used by autopilot.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
