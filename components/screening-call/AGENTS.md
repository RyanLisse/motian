<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# screening-call

## Purpose
UI components for starting, displaying, and controlling screening-call workflows.

## Key Files
| File | Description |
|------|-------------|
| `screening-call-button.tsx` | Trigger/control button for screening calls. |
| `screening-call-panel.tsx` | Main screening-call panel UI. |

## For AI Agents

### Working In This Directory
- Preserve screening-call lifecycle states and recruiter control flow.
- Keep UI orchestration aligned with the screening-call API rather than embedding call business logic in components.

### Testing Requirements
- Run screening-call UI and related route tests plus `pnpm lint`.

### Common Patterns
- Small orchestration components around API-backed state transitions.

## Dependencies

### Internal
- screening-call APIs in `app/api/screening-calls/` or related service routes
- recruiter workflow pages in `app/`

### External
- React UI/state primitives.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
