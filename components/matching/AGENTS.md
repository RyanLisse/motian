<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# matching

## Purpose
Recruiter-facing match detail and match report UI components.

## Key Files
| File | Description |
|------|-------------|
| `match-detail.tsx` | Main match detail presentation. |
| `report-button.tsx` | Match report action trigger. |

## For AI Agents

### Working In This Directory
- Keep score labels, recommendation states, and structured criteria wording aligned with backend matching semantics.
- Avoid drifting from service-layer vocabulary like knockout, gunning, process, and recommendation classes.

### Testing Requirements
- Run matching UI and structured-match related tests plus `pnpm lint`.

### Common Patterns
- Small focused display components around match result structures.

## Dependencies

### Internal
- `src/services/structured-matching.ts`
- `src/services/matches.ts`
- matching routes and pages in `app/`

### External
- React UI components and shared primitives.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
