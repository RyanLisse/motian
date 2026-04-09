<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# autopilot

## Purpose
Autopilot UI components for displaying captured evidence and run artifacts.

## Key Files
| File | Description |
|------|-------------|
| `evidence-viewer.tsx` | Main artifact/evidence presentation component. |

## For AI Agents

### Working In This Directory
- Preserve artifact-kind handling for screenshots, videos, traces, and HAR assets.
- Keep UI behavior aligned with the run-detail output shape and download/open flows.

### Testing Requirements
- Run autopilot UI/evidence tests plus `pnpm lint`.

### Common Patterns
- UI components tightly coupled to autopilot artifact contracts.

## Dependencies

### Internal
- `src/autopilot/run-detail.ts`
- `src/autopilot/types/`
- `app/autopilot/`

### External
- React and browser media/viewer behavior.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
