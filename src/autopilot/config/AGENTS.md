<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# config

## Purpose
Configuration layer for autopilot runs, especially journey definitions and runtime selection logic.

## Key Files
| File | Description |
|------|-------------|
| `journeys.ts` | Canonical journey definitions for autopilot audits. |
| `index.ts` | Config export surface. |

## For AI Agents

### Working In This Directory
- Treat journey definitions as operational coverage config, not throwaway test code.
- Be explicit with routes, selectors, and timing assumptions because nightly audits rely on this behavior.

### Testing Requirements
- Run autopilot config/journey tests and `pnpm lint`.

### Common Patterns
- Static journey definitions exported through a small config surface.

## Dependencies

### Internal
- consumed by autopilot run orchestration and evidence capture.

### External
- Browser automation/runtime settings indirectly used by journeys.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
