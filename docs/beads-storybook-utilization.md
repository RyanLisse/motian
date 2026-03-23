# Storybook better utilization — beads (source of truth for bd create)

All beads are self-contained; no need to refer back to the plan. Dependencies are applied after creation.

---

## Bead 1: Add scripts and docs

**Title:** Storybook: Add scripts and docs (package.json, Justfile, README, AGENTS)

**Description:**

Make Storybook a first-class command so the team and agents can run it without guessing. No behavioral change to Storybook itself—only entrypoints and documentation.

**Changes:**
- **package.json**: Add scripts `"storybook": "storybook dev -p 6006"` and `"build-storybook": "storybook build"` in the scripts block (after voice-agent:start).
- **Justfile**: Add a "Storybook" section (e.g. after "Docs (Fumadocs)", before "Build & Deploy"). Add recipe `storybook:` running `pnpm storybook`. Optionally `storybook-build:` running `pnpm build-storybook`.
- **README.md**: In "Ontwikkeling" add a bullet to run Storybook with `pnpm storybook` or `just storybook` (port 6006). In "Handige Commando's" add `just storybook` — Component library (Storybook).
- **AGENTS.md**: In "Build & Quality" add `pnpm storybook` (Start Storybook, port 6006) and `pnpm build-storybook` (Build static Storybook). In Key Files Reference or a short Storybook subsection note: stories in `stories/`, config in `.storybook/`, run with `pnpm storybook` or `just storybook`.

**Success criteria:** `pnpm storybook` and `just storybook` start Storybook on port 6006; README and AGENTS.md document the commands.

**Rationale:** Enables all subsequent Storybook work to be discoverable and runnable by humans and agents.

---

## Bead 2: Config and addons (autodocs, a11y)

**Title:** Storybook: Config and addons (main.ts autodocs, addon-a11y, optional preview)

**Description:**

Upgrade Storybook config so every story gets a Docs tab and accessibility can be checked in the UI. Optional: theme/viewport in preview.

**Changes:**
- **.storybook/main.ts**: Enable autodocs (e.g. `parameters.docs.autodocs: true` or Storybook 10 equivalent). Add addon `@storybook/addon-a11y` to the addons array (install with `pnpm add -D @storybook/addon-a11y` if not present; match Storybook 10).
- **.storybook/preview.tsx** (optional): Add theme toggle (globals.theme light/dark) and/or viewport presets for responsive components. Keep existing dark wrapper and globals.css.

**Success criteria:** Storybook builds and runs; Docs tab appears for stories; a11y addon is visible and runs; no regression in existing stories.

**Rationale:** Autodocs and a11y make Storybook useful for design review and accessibility without extra per-story boilerplate.

**Depends on:** Bead 1 (scripts and docs) so `pnpm storybook` exists before changing config.

---

## Bead 3: Improve existing stories (argTypes + docs)

**Title:** Storybook: Improve existing stories (argTypes, autodocs tags, docs descriptions)

**Description:**

Enrich the five existing story files so Controls and Docs are useful and each component is documented in place. No new story files—only meta and args updates.

**Files to update:**
- **stories/status-badge.stories.tsx**: Add `argTypes.status` with control select and options `['success','partial','failed','gezond','waarschuwing','kritiek','inactief']`. Add `tags: ['autodocs']`. Add `parameters.docs.description` (e.g. used in scraper run list / health indicators).
- **stories/page-header.stories.tsx**: Add `tags: ['autodocs']`, argTypes for title and description (text), and `parameters.docs.description`.
- **stories/job-list-item.stories.tsx**: Add `tags: ['autodocs']`, argTypes for isActive, variant, and key job fields (platform, workArrangement, contractType as selects where applicable). Add `parameters.docs.description` (e.g. used in vacatures sidebar/list).
- **stories/job-card.stories.tsx**: Add `tags: ['autodocs']`, argTypes for enum/boolean props, and a one-line `parameters.docs.description`.
- **stories/opdrachten-filters.stories.tsx**: Add `tags: ['autodocs']`, `parameters.docs.description` (e.g. filter bar for vacatures/opdrachten). Optionally argTypes for status, platform.

**Success criteria:** All five files have autodocs and at least one doc description; status-badge and other components with enums have working Controls.

**Rationale:** Turns existing stories into living component docs and establishes the pattern for new stories.

**Depends on:** Bead 2 (config and addons) so autodocs and addons are in place.

---

## Bead 4: New stories — UI primitives

**Title:** Storybook: New stories — UI primitives (button, badge, card, input, dialog, select)

**Description:**

Add one story file per UI primitive in `stories/`, following the existing pattern (title `Components/<Name>`, Meta with component and tags, 1–2 StoryObj variants, argTypes for Controls).

**Files to create:**
- **stories/button.stories.tsx**: components/ui/button.tsx — variants (default, destructive, outline), sizes (default, sm, lg). argTypes for variant and size (CVA).
- **stories/badge.stories.tsx**: components/ui/badge.tsx — default, secondary, destructive, outline.
- **stories/card.stories.tsx**: components/ui/card.tsx — default card with header/content/footer.
- **stories/input.stories.tsx**: components/ui/input.tsx — default, disabled, placeholder.
- **stories/dialog.stories.tsx**: components/ui/dialog.tsx — closed and open (trigger + DialogContent).
- **stories/select.stories.tsx**: components/ui/select.tsx — default with a few options.

**Success criteria:** All six story files exist; each has at least default + one variant; Controls work where argTypes are set.

**Rationale:** High-value primitives used across the app; design and product can review in isolation.

**Depends on:** Bead 3 (improve existing stories) so the argTypes/autodocs pattern is consistent.

---

## Bead 5: New stories — shared layout/patterns

**Title:** Storybook: New stories — shared (kpi-card, empty-state, filter-tabs, pagination)

**Description:**

Add one story file per shared layout/pattern component in `stories/`, same pattern as UI primitives.

**Files to create:**
- **stories/kpi-card.stories.tsx**: components/shared/kpi-card.tsx — default, with trend or secondary text if supported.
- **stories/empty-state.stories.tsx**: components/shared/empty-state.tsx — title only; with subtitle; with icon (e.g. Lucide).
- **stories/filter-tabs.stories.tsx**: components/shared/filter-tabs.tsx — default tabs and one selected.
- **stories/pagination.stories.tsx**: components/shared/pagination.tsx — first page, middle page, last page (mock props if component has API).

**Success criteria:** All four story files exist; at least one variant per component; Docs/Controls usable.

**Rationale:** Shared patterns are reused across pages; documenting them in Storybook reduces drift.

**Depends on:** Bead 3 (improve existing stories).

---

## Bead 6: New stories — domain (score-ring)

**Title:** Storybook: New stories — domain (score-ring)

**Description:**

Add a single story file for the score-ring domain component. status-badge and job-card / job-list-item already have stories.

**File to create:**
- **stories/score-ring.stories.tsx**: components/score-ring.tsx — e.g. 0%, 50%, 100% (or whatever props the component accepts).

**Success criteria:** score-ring.stories.tsx exists with at least one variant; Docs/Controls work.

**Rationale:** Completes domain building blocks coverage for the plan.

**Depends on:** Bead 3 (improve existing stories).

---

## Bead 7: CI — build-storybook job (optional)

**Title:** Storybook: CI — build-storybook job (optional)

**Description:**

Add a CI job that runs `pnpm build-storybook` on every PR so broken imports or invalid story config are caught. No artifact upload or Chromatic in this bead.

**Changes:**
- **.github/workflows/ci.yml**: Add job `storybook-build` (or similar). Same needs as existing `build` job (lint, typecheck, test). Steps: checkout, pnpm setup, Node setup, cache, `pnpm install --frozen-lockfile`, `pnpm build-storybook`. No artifact upload unless the team wants to deploy the static site later.

**Success criteria:** On push/PR, storybook-build job runs and succeeds when Storybook builds; fails when build fails.

**Rationale:** Ensures Storybook stays buildable as new stories and components are added.

**Depends on:** Bead 1 (scripts and docs) so `build-storybook` script exists.
