<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# github

## Purpose
GitHub publishing helpers for autopilot findings, including issue formatting and issue creation/update workflows.

## Key Files
| File | Description |
|------|-------------|
| `issue-formatter.ts` | Formats findings into GitHub issue content. |
| `issue-publisher.ts` | Creates or updates GitHub issues for autopilot findings. |
| `index.ts` | Export surface for GitHub publishing helpers. |

## For AI Agents

### Working In This Directory
- Preserve dedupe markers, body structure, and label conventions because update-vs-create behavior depends on them.
- Keep evidence URLs and report links stable and explicit.

### Testing Requirements
- Run autopilot GitHub/publishing tests and `pnpm lint`.

### Common Patterns
- Formatting separated from side-effecting publish logic.

## Dependencies

### Internal
- `src/autopilot/analysis/`
- `src/autopilot/reporting/`
- `src/autopilot/types/`

### External
- GitHub API or CLI integrations used by autopilot.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
