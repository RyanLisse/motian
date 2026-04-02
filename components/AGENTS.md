<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# components

## Purpose
Reusable React UI layer for the Motian web application. This includes shadcn/ui primitives, page-level composites, feature-specific widgets, chat surfaces, candidate tooling, and shared sidebar/layout pieces.

## Key Files
| File | Description |
|------|-------------|
| `app-sidebar.tsx` | Main application navigation shell. |
| `command-palette.tsx` | Cross-app command palette UI. |
| `opdrachten-sidebar.tsx` | Shared vacancy filtering sidebar. |
| `job-detail.tsx` | Vacancy detail composition component. |
| `score-ring.tsx` | Shared score visualization component. |
| `settings-form.tsx` | Settings surface form wrapper. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `ui/` | shadcn/ui-style primitives and base controls. |
| `shared/` | Cross-page reusable app components. |
| `chat/` | Chat-specific UI surfaces. |
| `autopilot/` | Autopilot UI widgets and evidence viewers. |
| `matching/` | Matching workflow components. |
| `candidate-profile/` | Candidate detail/profile presentation. |
| `screening-call/` | Screening call UI flow. |
| `sidebar/` | Sidebar and shell-related helpers. |

## For AI Agents

### Working In This Directory
- Preserve the existing visual language instead of introducing a new design system.
- Prefer editing existing components over adding near-duplicate wrappers.
- Keep Dutch labels in rendered UI while code identifiers remain English.

### Testing Requirements
- Update component and route regression tests in `tests/` when markup or behavior changes.
- Run `pnpm lint` and any relevant browser-facing tests if interaction changes are significant.

### Common Patterns
- Small composable feature components around shared primitives.
- Client components only where hooks, events, or browser APIs are needed.
- Shared filter, status, and badge patterns reused across recruiter surfaces.

## Dependencies

### Internal
- `app/` pages compose these components.
- `src/components/ai-elements/` for chat-specific primitives.
- `src/hooks/` and `src/lib/` for stateful or utility support.

### External
- React 19.
- Tailwind CSS.
- shadcn/ui conventions and related icon/util packages already used in the repo.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
