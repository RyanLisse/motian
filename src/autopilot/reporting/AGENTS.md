<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# reporting

## Purpose
Autopilot reporting helpers for markdown generation, uploads, and final report assembly.

## Key Files
| File | Description |
|------|-------------|
| `index.ts` | Reporting export surface. |
| `markdown.ts` | Markdown report generation. |
| `upload.ts` | Report upload/publish helpers. |

## For AI Agents

### Working In This Directory
- Preserve report format stability where downstream views or uploads expect a fixed structure.

### Testing Requirements
- Run relevant autopilot report tests and `pnpm lint`.

## Dependencies

### Internal
- `src/autopilot/evidence/`
- `src/autopilot/persistence/`

### External
- Storage/upload integrations as configured in the project.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
