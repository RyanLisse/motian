---
title: "feat: Simplify recruiter information architecture"
type: feat
date: 2026-03-28
status: draft
---

# Simplify Recruiter Information Architecture

## Overview

Reduce the visible product surface area so Motian feels like a focused recruiter workspace instead of a collection of loosely related tools. This milestone keeps all existing capabilities, but collapses redundant top-level destinations into a clearer primary navigation model and adds a single automation hub for operational tooling.

## Problem Frame

The current app exposes too many peer destinations in the main sidebar, even when some of them are:

- not true primary workflows for recruiters
- already accessible from contextual flows
- operational/admin surfaces rather than day-to-day workspaces
- redundant with global overlays such as chat and command palette

Today, the primary sidebar in [components/app-sidebar.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/components/app-sidebar.tsx) lists:

- Overzicht
- Vacatures
- Kandidaten
- Pipeline
- Interviews
- Berichten
- Matching
- Agents
- Autopilot
- Databronnen
- AI Assistent

That breadth creates three UX issues:

1. Recruiters have to decide between too many destinations before they can act.
2. Internal/operational tools compete visually with core recruiting work.
3. The command palette and global AI widget duplicate navigation responsibilities instead of reducing them.

## Scope Boundaries

This milestone is intentionally bounded. It will:

- simplify the primary navigation
- add a consolidated automation landing page
- improve discoverability for demoted tools via secondary entry points
- unify page chrome where the simplification work touches it
- keep all existing routes working

This milestone will not:

- redesign the full candidates or vacatures data models
- merge interviews or messages into new database-backed subviews
- remove existing routes from the application
- rewrite detail pages into a brand-new tabbed architecture

## Requirements Trace

Source request: improve the UX/UI and simplify/minimize pages.

Interpreted product requirements for this milestone:

- The app should feel smaller and easier to scan.
- Top-level navigation should reflect recruiter priorities, not system internals.
- Secondary/admin tools must remain available, but should not dominate the main workspace.
- Chat should feel like an assistive overlay, not a competing destination.
- Existing routes and functionality must remain reachable.

## Existing Patterns To Follow

- Shared page wrapper and mobile shell in [components/sidebar-layout.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/components/sidebar-layout.tsx)
- Primary navigation rendering in [components/nav-main.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/components/nav-main.tsx)
- Global command/search overlay in [components/command-palette.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/components/command-palette.tsx)
- Page heading structure in [components/page-header.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/components/page-header.tsx)
- Shared cards and empty states in [components/shared/kpi-card.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/components/shared/kpi-card.tsx) and [components/shared/empty-state.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/components/shared/empty-state.tsx)
- Global chat surface in [app/layout.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/app/layout.tsx) and [components/chat/chat-page-content.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/components/chat/chat-page-content.tsx)

## Key Technical Decisions

### Decision 1: Reduce primary nav to recruiter-first workspaces

Primary navigation should expose only the main recruiter jobs:

- Overzicht
- Vacatures
- Kandidaten
- Pipeline
- Interviews
- Berichten
- Automatisering

Rationale:

- `Interviews` and `Berichten` still appear to be active standalone operational lists, so hiding them now would likely reduce discoverability before contextual replacements exist.
- `Matching` already redirects and should not appear as a primary destination.
- `Agents`, `Autopilot`, and `Databronnen` are operational surfaces that fit better under one parent hub.
- `AI Assistent` is already available as a global overlay and command action.

### Decision 2: Add a consolidated automation hub instead of multiple peer pages

Create a new `/automatisering` page that acts as the entry point for:

- Agents
- Autopilot
- Databronnen
- AI-assisted operational tools

Rationale:

- It preserves access without crowding the primary nav.
- It gives us a stable home for future system/admin capabilities.
- It lets the command palette and overview page point to one destination instead of several.

### Decision 3: Keep existing operational routes, but demote them

Routes such as `/agents`, `/autopilot`, and `/scraper` will remain intact and linked from the automation hub and command palette.

Rationale:

- Zero migration risk for bookmarks and internal usage.
- Minimal code churn versus route removal or renaming.

Additional constraint:

- Because `/agents`, `/autopilot`, and `/scraper` are not nested under `/automatisering`, the sidebar needs alias-based active matching so `Automatisering` still highlights when users are on those operational pages.

### Decision 4: Treat chat as an overlay-first interaction

Remove `AI Assistent` from the main sidebar and keep it discoverable through:

- global chat widget
- command palette action
- automation hub shortcut

Rationale:

- The current app already has two chat entry points; a third top-level nav item adds noise.
- Chat is an assistant layer, not a primary object workspace.

### Decision 5: Use this milestone to standardize shared page chrome where touched

When touching hub and operational pages, use the existing `PageHeader` component and a consistent card hierarchy rather than bespoke inline headers.

Rationale:

- This improves cohesion without turning the work into a broad page-by-page redesign.

## High-Level Technical Design

### Navigation Model

Update [components/app-sidebar.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/components/app-sidebar.tsx) so the main nav becomes:

- Werving
  - Overzicht
  - Vacatures
  - Kandidaten
  - Pipeline
  - Interviews
  - Berichten
- Platform
  - Automatisering
- Utilities in footer/user/command surfaces

`Matching` is removed from primary nav entirely.
`AI Assistent` is removed from primary nav entirely.
`Agents`, `Autopilot`, and `Databronnen` are removed from primary nav and rehomed under the new hub.

To preserve orientation, the nav item for `Automatisering` should support `matchPaths` aliases for:

- `/automatisering`
- `/agents`
- `/autopilot`
- `/scraper`

### Automation Hub

Create [app/automatisering/page.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/app/automatisering/page.tsx) as a recruiter-friendly operational dashboard with:

- a short explanation of what belongs here
- 3-4 primary tiles linking to `Agents`, `Autopilot`, `Databronnen`, and chat-assisted operations
- lightweight guidance copy focused on outcomes, not internals

Use existing shared cards and `PageHeader`.

### Command Palette

Update [components/command-palette.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/components/command-palette.tsx):

- add `Automatisering`
- remove `Matching` from page navigation entries
- keep operational destinations available under a secondary group
- keep the explicit AI action

This preserves power-user access to internal surfaces without keeping them always visible in the sidebar.

### Reachability Matrix

- `/automatisering`: sidebar, command palette
- `/agents`: automation hub, command palette
- `/autopilot`: automation hub, command palette
- `/scraper`: automation hub, command palette
- `/settings`: user menu, command palette
- `/chat`: chat widget, command palette action, optional hub shortcut
- `/matching`: compatibility redirect only; not presented as a visible destination

### Operational Pages

Update these pages to feel like children of the new hub:

- [app/agents/page.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/app/agents/page.tsx)
- [app/autopilot/page.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/app/autopilot/page.tsx)
- [app/scraper/page.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/app/scraper/page.tsx)
- [app/settings/page.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/app/settings/page.tsx)

Apply:

- `PageHeader`
- breadcrumbs where useful
- consistent back-links to `Automatisering` on demoted operational pages

### Matching Route

Keep [app/matching/page.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/app/matching/page.tsx) as a compatibility redirect, but remove it from all primary navigation structures.

## Implementation Units

### Unit 1: Simplify primary navigation

Goal:
Reduce sidebar noise and establish the new IA model.

Files:

- [components/app-sidebar.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/components/app-sidebar.tsx)
- [components/nav-main.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/components/nav-main.tsx)

Changes:

- extend the nav item shape to support optional `matchPaths`
- update active-route matching logic to honor `matchPaths`
- replace the current three-group nav with a slimmer recruiter-first set
- add `Automatisering`
- remove `Matching`, `Agents`, `Autopilot`, `Databronnen`, and `AI Assistent` from primary nav
- keep search/command palette affordances in the footer

Patterns to follow:

- existing grouped nav rendering in `NavMain`
- existing sidebar icon and badge conventions

Verification:

- sidebar renders correctly in collapsed and expanded modes
- active route highlighting still works for nested pages
- `Automatisering` is active on `/agents`, `/autopilot`, and `/scraper`
- no removed page becomes unreachable

### Unit 2: Add the automation hub

Goal:
Create one operational landing page that consolidates demoted system/admin tools.

Files:

- [app/automatisering/page.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/app/automatisering/page.tsx)
- [components/page-header.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/components/page-header.tsx) if breadcrumb/back-link support needs extension
- [components/shared/kpi-card.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/components/shared/kpi-card.tsx) only if small reusable tweaks are needed

Changes:

- build a clean landing page with outcome-oriented sections
- link to `Agents`, `Autopilot`, `Databronnen`, and AI-assisted operations
- keep the design calm and scannable

Execution note:

- Preserve existing visual language; do not introduce a new design system.

Verification:

- `/automatisering` is usable as a standalone destination
- all demoted surfaces are reachable from it in one click

### Unit 3: Rewire command and secondary entry points

Goal:
Keep discoverability high after shrinking the sidebar.

Files:

- [components/command-palette.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/components/command-palette.tsx)
- [app/layout.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/app/layout.tsx) only if import wiring changes

Changes:

- add `Automatisering` to primary searchable destinations
- move internal tools to a secondary group in the palette
- ensure the AI open action remains prominent

Verification:

- `⌘K` can still reach every operational destination
- no duplicate or dead entries remain

### Unit 4: Polish demoted operational pages

Goal:
Make the operational surfaces feel like part of one smaller system.

Files:

- [app/agents/page.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/app/agents/page.tsx)
- [app/autopilot/page.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/app/autopilot/page.tsx)
- [app/scraper/page.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/app/scraper/page.tsx)

Changes:

- standardize headers onto `PageHeader`
- add lightweight breadcrumbs/back-links where they improve orientation
- make naming and copy feel less like separate micro-products

Verification:

- operational pages present a consistent relationship to the automation hub
- no page loses its existing core content

### Unit 5: Keep settings secondary, but polished

Goal:
Preserve `Instellingen` as a utility page reachable through the user menu and command palette without making it a peer of operational tools.

Files:

- [app/settings/page.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/app/settings/page.tsx)
- [components/nav-user.tsx](/Users/cortex-air/.codex/worktrees/9745/motian/components/nav-user.tsx) if a small discoverability tweak is needed

Changes:

- migrate the page to `PageHeader`
- keep it reachable through `NavUser` and command palette
- do not place it under the automation hub IA

Verification:

- `Instellingen` remains reachable from the user menu
- `Instellingen` remains reachable from the command palette

## Risks And Mitigations

### Risk: users who rely on direct sidebar access may think tools disappeared

Mitigation:

- add the automation hub
- preserve command palette entries
- keep route URLs unchanged

### Risk: navigation simplification hides too much too quickly

Mitigation:

- keep `Interviews` and `Berichten` visible in this milestone
- only demote operational/admin surfaces

### Risk: visual churn across too many pages

Mitigation:

- limit polish to touched operational pages and the new hub
- do not broaden into a full-page redesign

## Test Scenarios

### Navigation

- open the app and confirm the sidebar only shows the simplified primary destinations
- verify `Automatisering` appears in the sidebar and opens `/automatisering`
- navigate from the automation hub to `/agents`, `/autopilot`, and `/scraper`
- confirm those routes are also reachable from the command palette
- confirm `Instellingen` remains reachable from `NavUser` and the command palette
- confirm the sidebar shows the correct active state for demoted operational pages
- confirm `/matching` still resolves as expected even though it is no longer visible in nav

### Command Palette

- open the palette with `⌘K`
- search for `automatisering`
- search for `agents`, `autopilot`, and `databronnen`
- trigger the AI assistant action

### Visual/Responsiveness

- verify sidebar and automation hub on desktop width
- verify sidebar and navigation on mobile width
- verify mobile top bar still exposes sidebar and search after nav simplification
- confirm no obvious overflow or clipped cards on the new hub page

## Verification

- `pnpm lint`
- targeted route smoke check via browser on `/overzicht`, `/automatisering`, `/agents`, `/autopilot`, `/scraper`, `/settings`

## Plan Assessment

Depth: Standard

Why:

- This is cross-cutting UI/IA work touching several routes and global navigation.
- It does not touch high-risk domains such as auth, payments, migrations, or external API contracts.
- Existing local patterns are strong enough that implementation should be grounded mostly in repo conventions.
- The deepen pass tightened active-state behavior, reachability, sequencing, and verification, so the plan is now sufficiently grounded for implementation.

## Open Questions

- Should `Settings` also move into the user menu only in a later milestone? For now, leave routing intact and polish the page, but do not promote it into primary nav.
- Should `Interviews` and `Berichten` eventually become contextual tabs within candidate/pipeline flows? Likely yes, but that belongs to a later workflow once replacement UX exists.

## Execution Order

1. Add `/automatisering`
2. Update command palette and any secondary entry points
3. Add alias-based parent active-state support in nav
4. Remove/demote sidebar items
5. Polish operational pages with back-links/breadcrumbs
