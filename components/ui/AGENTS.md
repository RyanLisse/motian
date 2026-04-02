<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-02 | Updated: 2026-04-02 -->

# ui

## Purpose
Base UI primitives used across the application. These components provide the shared design vocabulary for buttons, inputs, overlays, navigation shells, tables, and feedback states.

## Key Files
| File | Description |
|------|-------------|
| `button.tsx` | Core button primitive. |
| `input.tsx` | Core text input primitive. |
| `dialog.tsx` | Modal/dialog primitive. |
| `sheet.tsx` | Side-sheet overlay primitive. |
| `sidebar.tsx` | Sidebar layout primitive. |
| `table.tsx` | Shared table primitive. |
| `tabs.tsx` | Tabs primitive. |
| `searchable-combobox.tsx` | Shared searchable select control. |

## For AI Agents

### Working In This Directory
- Preserve API consistency for widely reused primitives.
- Prefer extending existing variants over creating duplicate primitives.
- Be careful with accessibility regressions; many feature surfaces depend on these controls.

### Testing Requirements
- Run relevant component/UI regression tests and `pnpm lint` after changes.

### Common Patterns
- shadcn/ui-style wrappers with Tailwind classes.
- Low-level primitives consumed by feature components in `components/`.

## Dependencies

### Internal
- Used broadly across `components/` and `app/`.

### External
- React and common Radix-style UI patterns already present in the repo.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
