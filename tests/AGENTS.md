<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# tests

## Purpose
Vitest regression and structural test suite for the Motian platform. Coverage spans routes, services, AI behavior, autopilot, search, scrapers, platform onboarding, and several end-to-end workflow seams.

## Key Files
| File | Description |
|------|-------------|
| `auto-matching.test.ts` | Matching engine regression coverage. |
| `gdpr-service.test.ts` | GDPR service behavior checks. |
| `pagination.test.ts` | Pagination behavior coverage. |
| `salesforce-feed-route.test.ts` | XML feed route contract coverage. |
| `voice-agent-env.test.ts` | Voice agent environment assumptions. |
| `mcp-server-setup.test.ts` | MCP setup and runtime expectations. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `fixtures/` | Test inputs and sample data. |
| `harness/` | Test harness and verification helpers. |

## For AI Agents

### Working In This Directory
- Prefer updating the narrowest relevant test file rather than broad snapshot churn.
- Keep test names descriptive and aligned with actual product language and route names.
- When fixing behavior, verify whether there is already a regression test covering the affected path before adding a new one.

### Testing Requirements
- Run the smallest relevant Vitest subset first, then broaden if the change crosses subsystems.
- Run `pnpm lint` if you edit test files.

### Common Patterns
- Many tests are structural or regression-oriented and assert source or route conventions directly.
- Domain-specific test files usually mirror service or API module names.

## Dependencies

### Internal
- Exercises `app/`, `components/`, `src/`, `trigger/`, and workspace packages.

### External
- `vitest` and related testing utilities.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
