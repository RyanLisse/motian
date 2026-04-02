<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# api

## Purpose
HTTP API layer for the main Motian application. This directory exposes CRUD routes, AI endpoints, scraping controls, SSE streams, MCP/OpenAPI surfaces, and external integration feeds.

## Key Files
| File | Description |
|------|-------------|
| `_shared/` | Shared helpers used across multiple route handlers. |
| `openapi/` | OpenAPI document endpoint backing Scalar docs. |
| `mcp/` | HTTP-facing MCP transport surface. |
| `gezondheid/` | Health check endpoint used by automation and monitoring. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `kandidaten/` | Candidate CRUD and candidate-specific APIs. |
| `vacatures/` | Vacancy CRUD and list/detail endpoints. |
| `matches/` | Match lifecycle and AI-assisted matching APIs. |
| `sollicitaties/` | Application workflow endpoints. |
| `interviews/` | Interview scheduling and feedback APIs. |
| `berichten/` | Communication logging and message endpoints. |
| `cv-analyse/` | SSE-backed CV analysis workflow. |
| `scrape/` | Manual scrape triggers. |
| `scraper-configuraties/` | Platform runtime config management. |
| `salesforce-feed/` | Read-only XML export for Salesforce pulls. |
| `events/` | SSE event stream endpoints. |
| `autopilot/` | Autopilot run and evidence APIs. |

## For AI Agents

### Working In This Directory
- Keep API path segments Dutch unless there is a deliberate compatibility surface.
- Reuse shared service functions from `src/services/` instead of embedding domain logic inside route handlers.
- Validate inputs with Zod schemas where applicable and keep auth/origin handling consistent with existing route patterns.

### Testing Requirements
- Add or update targeted API tests in `tests/` whenever request/response shape changes.
- Run `pnpm lint` and the relevant Vitest route suite.

### Common Patterns
- Thin route handlers that delegate to `src/services/`.
- JSON endpoints for product surfaces, XML for the Salesforce feed, and SSE for streaming workflows.
- Bearer auth for protected APIs; allowlisted origin checks for external access.

## Dependencies

### Internal
- `src/services/` for domain operations.
- `src/schemas/` for request validation.
- `src/mcp/` and `src/ai/` for specialized protocol surfaces.

### External
- Next.js route handlers.
- Zod validation and Drizzle-backed services underneath.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
