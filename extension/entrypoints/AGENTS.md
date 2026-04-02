<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# entrypoints

## Purpose
Runtime entrypoints for the browser extension, split across background, content, and popup surfaces.

## Key Files
| File | Description |
|------|-------------|
| `background.ts` | Background worker entrypoint. |
| `content.ts` | Content script injected into supported pages. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `popup/` | React popup UI files. |

## For AI Agents

### Working In This Directory
- Keep clear boundaries between content-script, background, and popup responsibilities.
- Be mindful of browser-extension permission and messaging assumptions when moving logic between entrypoints.

### Testing Requirements
- Run `pnpm compile` or an extension build after changing entrypoint code.

### Common Patterns
- One file per runtime surface, with popup-specific React files in `popup/`.

## Dependencies

### Internal
- Part of the standalone `extension/` package.

### External
- WXT and browser extension APIs.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
