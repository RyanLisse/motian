<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# app

## Purpose
Next.js App Router surface for Motian. This directory holds page routes, route groups, shared app shell files, and API handlers exposed under Dutch URL paths.

## Key Files
| File | Description |
|------|-------------|
| `layout.tsx` | Root app layout shared by all routes. |
| `page.tsx` | Root landing entry for the app. |
| `globals.css` | Global styles and theme-level CSS. |
| `providers.tsx` | Client providers wired into the app shell. |
| `error.tsx` | Top-level route error boundary. |
| `loading.tsx` | Top-level loading UI. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `api/` | REST and integration endpoints; see `api/AGENTS.md`. |
| `vacatures/` | Canonical vacatures UI routes. |
| `kandidaten/` | Canonical kandidaten UI routes. |
| `matching/` | Matching and recruiter workflow screens. |
| `chat/` | Full-screen AI chat surface. |
| `autopilot/` | Autopilot evidence, runs, and reporting UI. |
| `ontwikkelaar/` | Developer portal surface and internal tooling pages. |

## For AI Agents

### Working In This Directory
- Preserve Dutch route names and user-facing copy.
- Keep route-level files small and move reusable logic into `components/` or `src/services/` when complexity grows.
- When adding cache invalidation, remember Next.js 16 requires `revalidateTag(tag, "default")`.

### Testing Requirements
- Run the relevant route and UI regression tests in `tests/` for any changed page or route segment.
- Run `pnpm lint` after editing route files.

### Common Patterns
- App Router server components by default, client components only where interactivity is required.
- Dutch URL segments even when the underlying implementation or domain naming stays English.

## Dependencies

### Internal
- `components/` for page composition and reusable UI.
- `src/services/` for business logic and database-facing behavior.
- `src/ai/`, `src/autopilot/`, and `src/mcp/` for specialized feature surfaces.

### External
- `next` App Router.
- `react` and `react-dom`.
- Tailwind CSS and shadcn/ui patterns used throughout the app shell.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
