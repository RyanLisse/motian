# Visual JSON Editor — Brainstorm

**Date:** 2026-02-23
**Status:** Draft
**Library:** [vercel-labs/visual-json](https://github.com/vercel-labs/visual-json)

---

## What We're Building

A reusable, schema-aware visual JSON editor integrated across Motian's data surfaces. Replaces the current bare `JSON.stringify` viewer with an interactive, embeddable component system from `@visual-json/react`.

### Capabilities

| Capability  | Description                                                                          |
| ----------- | ------------------------------------------------------------------------------------ |
| **Inspect** | Interactive tree view with expand/collapse, search, breadcrumbs, keyboard navigation |
| **Edit**    | Schema-aware form editing with validation, required fields, enum dropdowns           |
| **Diff**    | Side-by-side comparison of original vs. modified data with color-coded changes       |
| **Raw**     | Direct JSON text editing as fallback                                                 |

### Target Data Surfaces

| Surface                             | Schema                                           | Current State               | Priority |
| ----------------------------------- | ------------------------------------------------ | --------------------------- | -------- |
| Vacancy detail (`/opdrachten/[id]`) | `unifiedJobSchema` (90+ fields)                  | `JSON.stringify` in `<pre>` | P0       |
| AI matching results                 | `structuredMatchOutputSchema`                    | Rendered in report button   | P1       |
| Parsed CV data                      | `parsedCVSchema` (skills, experience, education) | Side panel display          | P1       |
| Admin/debug panel                   | Any JSON blob                                    | None exists                 | P2       |

---

## Why This Approach

### Current Pain Points

- **Zero interactivity** — `json-viewer.tsx` dumps raw JSON with no search, no collapse, no navigation
- **No schema awareness** — Users see raw field names, no descriptions, no validation feedback
- **No diffing** — Can't compare raw scraped data vs. AI-enriched data
- **No editing** — Manual DB edits required to fix scraped data issues

### Why visual-json Specifically

1. **Schema-aware** — Zod schemas can be converted to JSON Schema, enabling type-safe form views with descriptions, enums, and validation
2. **Embeddable** — Not a standalone app; drops into existing React component tree
3. **Composable** — Pick only the views you need per surface (TreeView for debug, FormView for editing, DiffView for comparisons)
4. **Headless core** — `@visual-json/core` provides tree state management, history, search, and diff computation without UI opinions
5. **Apache-2.0** — Permissive license, Vercel-backed, actively maintained

---

## Key Decisions

### 1. Use `@visual-json/react` with a shared wrapper component

Create a single `<VisualJsonViewer>` wrapper that accepts `value`, `schema`, `onChange`, and `mode` props. Each data surface configures it differently:

- Vacancy detail: `mode="tree+form"`, read-only by default
- Matching results: `mode="form+diff"`, comparing raw vs. scored
- CV data: `mode="form"`, schema-powered structured view
- Debug panel: `mode="all"`, full editing enabled

### 2. Convert Zod → JSON Schema for schema-awareness

Use `zod-to-json-schema` (already a common pattern) to feed Zod schemas into visual-json's schema engine. This enables:

- Field descriptions appearing in FormView
- Enum dropdowns for fields like `contractType`, `workArrangement`
- Required field indicators
- Type-specific editors (date pickers, number inputs)

### 3. Progressive rollout (not big-bang)

1. **Phase 1:** Replace `json-viewer.tsx` on vacancy detail with TreeView + FormView (read-only)
2. **Phase 2:** Add DiffView for matching results (raw job data vs. AI-scored output)
3. **Phase 3:** CV data FormView in candidate panel
4. **Phase 4:** Standalone debug/admin panel with full editing + paste support

### 4. Read-only by default, editing gated by role

Most surfaces default to `readOnly={true}`. Editing is enabled only for admin users or specific debug contexts. This prevents accidental data mutation.

---

## Explored Approaches

### ✅ Approach A: Drop-in visual-json with shared wrapper (Recommended)

Install `@visual-json/core` + `@visual-json/react`, create a reusable `<VisualJsonViewer>` wrapper, convert Zod schemas to JSON Schema.

**Pros:**

- Fastest time to value — library handles tree state, undo/redo, search, keyboard nav
- Schema-aware out of the box
- Consistent UX across all surfaces
- Well-maintained by Vercel Labs

**Cons:**

- Adds ~50KB bundle dependency (tree-shakeable)
- Styling may need customization to match Motian's design system
- New dependency to maintain

### Approach B: Headless core + custom shadcn/ui components

Use only `@visual-json/core` for tree state management, build custom UI with existing shadcn components.

**Pros:**

- Full control over styling, matches existing design system perfectly
- Smaller initial bundle

**Cons:**

- Significantly more development time
- Must rebuild tree rendering, keyboard navigation, drag-and-drop, search
- Loses FormView and DiffView — have to build from scratch
- Visual-json's React components are already well-designed

### Approach C: Build from scratch (no library)

Build a custom JSON tree/form/diff editor using shadcn/ui components and custom state management.

**Pros:**

- Zero dependencies
- Complete control

**Cons:**

- Enormous development effort for features that visual-json provides free
- Tree traversal, schema validation, diffing are complex to get right
- YAGNI violation — reinventing a solved problem

---

## Open Questions

1. **Styling integration** — Does visual-json support CSS custom properties / theming that maps to Motian's Tailwind design tokens? May need a thin CSS layer.
2. **Bundle impact** — What's the actual tree-shaken size? Worth checking before committing.
3. **Zod → JSON Schema fidelity** — Do all Zod features (preprocess, coerce, discriminated unions) convert cleanly? Need to test with `unifiedJobSchema`.
4. **Write-back path** — If editing is enabled, how do changes persist? Direct DB update via API route, or queue for review?

---

## Success Criteria

- [ ] `json-viewer.tsx` replaced with interactive TreeView on vacancy detail
- [ ] Zod schemas drive FormView with descriptions and validation
- [ ] DiffView available for comparing raw vs. enriched data
- [ ] Component is reusable across ≥3 data surfaces
- [ ] No regressions in existing vacancy detail page functionality
