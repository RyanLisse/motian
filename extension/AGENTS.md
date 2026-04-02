<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# extension

## Purpose
Standalone WXT browser extension for importing LinkedIn data into Motian.

## Key Files
| File | Description |
|------|-------------|
| `package.json` | Extension scripts and dependency manifest. |
| `README.md` | Setup, build, and troubleshooting notes. |
| `wxt.config.ts` | WXT build/runtime configuration. |
| `tsconfig.json` | TypeScript config for the extension. |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `entrypoints/` | Background, content, and popup entrypoints. |
| `assets/` | Static extension assets. |
| `public/` | Public files copied into extension builds. |
| `.wxt/` | Generated config artifacts; do not hand-edit. |
| `.output/` | Build output; do not hand-edit. |

## For AI Agents

### Working In This Directory
- Treat this as a standalone subproject with its own compile/build commands.
- Do not hand-edit generated `.wxt/` or `.output/` artifacts.
- Preserve the root lockfile assumption described in the README.

### Testing Requirements
- Run `pnpm compile` or the relevant WXT build command after changing extension code.
- Run root-level `pnpm lint` if shared conventions or copied code are touched.

### Common Patterns
- WXT-managed browser extension entrypoints with a React popup UI.

## Dependencies

### Internal
- Integrates with the Motian platform but remains packaged independently.

### External
- `wxt`, React, and browser extension APIs.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
