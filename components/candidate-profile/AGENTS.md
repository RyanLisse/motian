<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# candidate-profile

## Purpose
Candidate profile display components focused on structured skill, experience, and match-signal presentation.

## Key Files
| File | Description |
|------|-------------|
| `employment-card.tsx` | Employment/history presentation card. |
| `match-scores-chart.tsx` | Match score visualization. |
| `open-to-offers-ring.tsx` | Open-to-offers status visualization. |
| `skills-experience-section.tsx` | Skills-to-experience section UI. |
| `skills-experience-matching.ts` | Deterministic skill/experience matching helper. |

## For AI Agents

### Working In This Directory
- Keep Dutch profile labels while preserving deterministic English-code helper logic.
- Be careful with skill-to-experience heuristics because charts and recruiter interpretation depend on them.

### Testing Requirements
- Run candidate profile and skill-matching tests plus `pnpm lint`.

### Common Patterns
- Presentation components backed by a small deterministic helper module.

## Dependencies

### Internal
- candidate profile pages/components
- candidate intelligence and matching-related schemas/services

### External
- React chart/display primitives already used in the app.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
