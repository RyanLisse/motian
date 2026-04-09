<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# [id]

## Purpose
Candidate detail API routes keyed by candidate ID. This folder covers candidate retrieval and candidate-scoped actions such as note handling, linking, match access, and explicit no-match flows.

## Key Files
| File | Description |
|------|-------------|
| `route.ts` | Main kandidaat detail route. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `geen-match/` | Candidate-specific no-match action routes. |
| `koppel/` | Candidate linking routes. |
| `match/` | Candidate-scoped match retrieval or actions. |
| `notities/` | Candidate notes routes. |

## For AI Agents

### Working In This Directory
- Preserve ID-scoped semantics and avoid mixing collection-level behavior into these routes.
- Keep candidate detail contracts aligned with `src/services/candidates.ts` and related linking/note services.

### Testing Requirements
- Run candidate detail, notes, and linking tests plus `pnpm lint`.

### Common Patterns
- Thin detail routes delegating to service-layer functions.
- Action-oriented nested route groups under a shared candidate identity.

## Dependencies

### Internal
- `src/services/candidates.ts`
- candidate note/linking and match-related services.

### External
- Next.js route handlers.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
