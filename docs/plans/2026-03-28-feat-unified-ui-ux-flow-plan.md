---
title: "feat: Unified UI/UX Flow"
type: feat
date: 2026-03-28
---

# Unified UI/UX Flow — Motian Recruitment Platform

## Overview

Consolidate the Motian recruitment platform's UI/UX into a cohesive, recruiter-optimized experience. This plan addresses 9 identified UX problems: dead sidebar code, missing navigation items, inconsistent page headers, no breadcrumbs, no command palette, confusing chat entry points, and poor navigation grouping. The result is a unified flow where every page is discoverable, navigation is logically grouped, and power users have keyboard shortcuts for everything.

## Problem Statement

The platform has grown organically with 19 pages, but the navigation only exposes 7. Four pages (Messages, Agents, Matching, Autopilot) are hidden — users can't reach them without knowing the URL. Page headers use inconsistent sizing (text-lg/xl/2xl). Deep routes have no breadcrumbs. A `cmdk` command palette exists as a UI primitive but isn't wired up. Legacy dead code (`sidebar.tsx`) adds confusion for developers.

**Impact:** Recruiters miss features they're paying for. Developers waste time navigating competing sidebar implementations. The lack of breadcrumbs creates disorientation on detail pages.

## Proposed Solution

A four-phase approach that progressively improves the UX without breaking existing functionality:

1. **Phase 1 — Navigation Cleanup**: Remove dead code, restructure sidebar with grouped nav items, add all missing pages
2. **Phase 2 — Unified Page Headers + Breadcrumbs**: Create a `PageShell` component that provides consistent headers and breadcrumbs for every page
3. **Phase 3 — Command Palette (⌘K)**: Wire the existing `cmdk` primitive into a global command palette with page navigation, entity search, and AI actions
4. **Phase 4 — Polish & Mobile**: Responsive refinements, keyboard navigation testing, chat widget clarity

## Technical Approach

### Architecture

All changes are within the existing Next.js 16 App Router + shadcn/ui stack. No new dependencies required — `cmdk` is already installed.

**Key constraint from learnings:** Any component that syncs state with URL params MUST use the `selfPushRef` + `startTransition` pattern (documented fix from commit 88101ad1) to prevent input resets during typing.

**Performance constraint:** Use `React.cache()` for any server-side data used in navigation metadata. Use dynamic imports for the command palette to keep initial bundle size flat.

---

### Implementation Phases

#### Phase 1: Navigation Cleanup & Restructuring

**Goal:** Every page is reachable from the sidebar. Dead code is removed. Navigation is grouped logically.

##### 1.1 Remove legacy sidebar

**File:** `components/sidebar.tsx` — DELETE entirely

This file defines a legacy 4-item nav (Vacatures, Scraper, Kandidaten [disabled], Agents) with its own mobile Sheet. It's never imported by the active layout chain (`SidebarLayout` → `AppSidebar`). Removing it eliminates developer confusion.

**Verification:** Grep for imports of `components/sidebar.tsx` or the `Sidebar` export name. Confirm zero active imports outside Storybook.

##### 1.2 Restructure sidebar navigation groups

**File:** `components/app-sidebar.tsx` — MODIFY

Replace the flat `navMain` array with grouped navigation:

```typescript
const data = {
  teams: [{ name: "Motian", logo: GalleryVerticalEnd }],
  navGroups: [
    {
      label: "Werving",
      items: [
        { title: "Overzicht", url: "/overzicht", icon: LayoutDashboard, isActive: true },
        { title: "Vacatures", url: "/vacatures", icon: Briefcase },
        { title: "Kandidaten", url: "/kandidaten", icon: Users },
        { title: "Pipeline", url: "/pipeline", icon: Kanban, prefetch: false },
        { title: "Interviews", url: "/interviews", icon: Calendar },
        { title: "Berichten", url: "/messages", icon: MessageSquare },
      ],
    },
    {
      label: "Automatisering",
      items: [
        { title: "Matching", url: "/matching", icon: GitCompareArrows },
        { title: "Agents", url: "/agents", icon: Bot },
        { title: "Autopilot", url: "/autopilot", icon: Sparkles },
        { title: "Databronnen", url: "/scraper", icon: Activity },
      ],
    },
    {
      label: "Hulpmiddelen",
      items: [
        {
          title: "AI Assistent",
          url: "/chat",
          icon: Zap,
          badge: { text: "⌘J", variant: "outline" },
          tooltip: "AI Assistent openen (⌘/Ctrl+J)",
        },
      ],
    },
  ],
};
```

##### 1.3 Update NavMain for grouped rendering

**File:** `components/nav-main.tsx` — MODIFY

Change the component to accept `groups` instead of flat `items`. Each group gets its own `SidebarGroup` + `SidebarGroupLabel`:

```typescript
export function NavMain({
  groups,
}: {
  groups: {
    label: string;
    items: NavItem[];
  }[];
}) {
  const pathname = usePathname();

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => {
              const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`);
              // ... existing render logic per item
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}
```

##### 1.4 Files changed in Phase 1

| File | Action | Risk |
|------|--------|------|
| `components/sidebar.tsx` | DELETE | Low — unused |
| `components/app-sidebar.tsx` | MODIFY | Medium — nav structure |
| `components/nav-main.tsx` | MODIFY | Medium — rendering logic |
| `stories/sidebar.stories.tsx` (if exists) | DELETE/UPDATE | Low |

---

#### Phase 2: Unified Page Headers + Breadcrumbs

**Goal:** Every page has a consistent header with breadcrumbs. Detail pages show navigation context.

##### 2.1 Create breadcrumb utility

**File:** `src/lib/breadcrumbs.ts` — CREATE

A utility that generates breadcrumb segments from the current pathname:

```typescript
export interface BreadcrumbSegment {
  label: string;
  href: string;
}

const ROUTE_LABELS: Record<string, string> = {
  overzicht: "Overzicht",
  vacatures: "Vacatures",
  kandidaten: "Kandidaten",
  pipeline: "Pipeline",
  interviews: "Interviews",
  messages: "Berichten",
  matching: "Matching",
  agents: "Agents",
  autopilot: "Autopilot",
  scraper: "Databronnen",
  chat: "AI Assistent",
  settings: "Instellingen",
  runs: "Runs",
};

export function buildBreadcrumbs(
  pathname: string,
  dynamicLabels?: Record<string, string>,
): BreadcrumbSegment[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: BreadcrumbSegment[] = [];

  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label =
      dynamicLabels?.[segment] ?? ROUTE_LABELS[segment] ?? segment;
    crumbs.push({ label, href: currentPath });
  }

  return crumbs;
}
```

##### 2.2 Extend PageHeader into PageShell

**File:** `components/page-header.tsx` — MODIFY (extend, don't replace)

Add optional breadcrumb support to the existing `PageHeader`:

```typescript
import { buildBreadcrumbs, type BreadcrumbSegment } from "@/src/lib/breadcrumbs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbSegment[];
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  children,
}: PageHeaderProps) {
  return (
    <div className="space-y-2">
      {breadcrumbs && breadcrumbs.length > 1 && (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, i) => (
              <Fragment key={crumb.href}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {i === breadcrumbs.length - 1 ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink href={crumb.href}>
                      {crumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {children && <div className="flex flex-wrap gap-2">{children}</div>}
      </div>
    </div>
  );
}
```

**Key decision:** Standardize ALL page headings to `text-xl font-bold` (the most common pattern, used by 7/19 pages). The outlier `text-2xl` pages (overzicht, kandidaten detail) should be harmonized.

##### 2.3 Verify breadcrumb UI primitives exist

**Check:** `components/ui/breadcrumb.tsx` — shadcn/ui breadcrumb component. If not installed, add via:
```bash
pnpm dlx shadcn@latest add breadcrumb
```

##### 2.4 Migrate all pages to PageHeader

Replace inline headers across all pages. Priority order (by traffic):

| Page | Current Pattern | Action |
|------|----------------|--------|
| `app/overzicht/page.tsx:505-511` | Inline `text-2xl` + shortcut pills | Use `PageHeader` with children slot |
| `app/vacatures/[id]/page.tsx:658-662` | Inline `text-lg font-bold sm:text-xl` | Use `PageHeader` + breadcrumbs |
| `app/kandidaten/page.tsx:164-170` | Inline `text-lg sm:text-xl` | Use `PageHeader` |
| `app/kandidaten/[id]/page.tsx:400-405` | Inline `text-2xl` | Use `PageHeader` + breadcrumbs with candidate name |
| `app/pipeline/page.tsx:297-307` | Inline `text-xl` + view toggle | Use `PageHeader` with children |
| `app/interviews/page.tsx:137-139` | Inline `text-xl` | Use `PageHeader` |
| `app/messages/page.tsx:121-123` | Inline `text-xl` | Use `PageHeader` |
| `app/agents/page.tsx:120-123` | Inline `text-xl` | Use `PageHeader` |
| `app/scraper/page.tsx:658-664` | Already uses `PageHeader` | Add breadcrumbs prop |
| `app/scraper/runs/[id]/page.tsx` | Already uses `PageHeader` | Add breadcrumbs with run ID |
| `app/settings/page.tsx:12-14` | Inline | Use `PageHeader` |
| `app/matching/page.tsx` | Unknown | Audit and migrate |
| `app/autopilot/page.tsx` | Unknown | Audit and migrate |

##### 2.5 Files changed in Phase 2

| File | Action | Risk |
|------|--------|------|
| `src/lib/breadcrumbs.ts` | CREATE | Low — pure utility |
| `components/page-header.tsx` | MODIFY | Medium — extend props |
| `components/ui/breadcrumb.tsx` | CREATE (if missing) | Low — shadcn primitive |
| 13 page files | MODIFY | Low — header replacement |

---

#### Phase 3: Command Palette (⌘K)

**Goal:** A global command palette that lets power users navigate pages, search entities, and trigger AI actions — all from the keyboard.

##### 3.1 Create command palette component

**File:** `components/command-palette.tsx` — CREATE

Uses the existing `cmdk` primitives from `components/ui/command.tsx`:

```typescript
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

// Static page routes for instant navigation
const PAGES = [
  { label: "Overzicht", href: "/overzicht", group: "Navigatie", keywords: ["dashboard", "home"] },
  { label: "Vacatures", href: "/vacatures", group: "Navigatie", keywords: ["jobs", "opdrachten"] },
  { label: "Kandidaten", href: "/kandidaten", group: "Navigatie", keywords: ["talent", "cv"] },
  { label: "Pipeline", href: "/pipeline", group: "Navigatie", keywords: ["kanban", "status"] },
  { label: "Interviews", href: "/interviews", group: "Navigatie", keywords: ["gesprekken", "agenda"] },
  { label: "Berichten", href: "/messages", group: "Navigatie", keywords: ["communicatie", "email"] },
  { label: "Matching", href: "/matching", group: "Automatisering" },
  { label: "Agents", href: "/agents", group: "Automatisering", keywords: ["bot", "automatisch"] },
  { label: "Autopilot", href: "/autopilot", group: "Automatisering" },
  { label: "Databronnen", href: "/scraper", group: "Automatisering", keywords: ["scraper", "bron"] },
  { label: "AI Assistent", href: "/chat", group: "Hulpmiddelen", keywords: ["chat", "ai", "vraag"] },
  { label: "Instellingen", href: "/settings", group: "Hulpmiddelen" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  const grouped = PAGES.reduce(
    (acc, page) => {
      (acc[page.group] ??= []).push(page);
      return acc;
    },
    {} as Record<string, typeof PAGES>,
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Zoek pagina's, kandidaten, vacatures..." />
      <CommandList>
        <CommandEmpty>Geen resultaten gevonden.</CommandEmpty>
        {Object.entries(grouped).map(([group, pages]) => (
          <CommandGroup key={group} heading={group}>
            {pages.map((page) => (
              <CommandItem
                key={page.href}
                value={[page.label, ...(page.keywords ?? [])].join(" ")}
                onSelect={() => navigate(page.href)}
              >
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Acties">
          <CommandItem
            onSelect={() => {
              setOpen(false);
              document.dispatchEvent(new CustomEvent("motian-chat-open"));
            }}
          >
            AI Assistent openen (⌘J)
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

##### 3.2 Wire into root layout

**File:** `app/layout.tsx` — MODIFY

Add `CommandPalette` as a sibling to `ChatWidget` (both are global overlays):

```typescript
import { CommandPalette } from "@/components/command-palette";

// Inside body:
<Providers>
  <ChatContextProvider>
    <SidebarLayout>{children}</SidebarLayout>
    <ChatWidget currentOrigin={currentOrigin} />
    <CommandPalette />
  </ChatContextProvider>
</Providers>
```

**Performance note:** Use `dynamic(() => import("@/components/command-palette"), { ssr: false })` to lazy-load the palette since it's only needed on keyboard shortcut activation.

##### 3.3 Add ⌘K hint to sidebar

**File:** `components/app-sidebar.tsx` — MODIFY

Add a keyboard hint in the sidebar header or footer:

```typescript
<SidebarFooter>
  <button
    onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
    className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
  >
    <Search className="h-3.5 w-3.5" />
    <span>Zoeken</span>
    <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono">
      ⌘K
    </kbd>
  </button>
  <NavUser />
</SidebarFooter>
```

##### 3.4 Files changed in Phase 3

| File | Action | Risk |
|------|--------|------|
| `components/command-palette.tsx` | CREATE | Low — isolated component |
| `app/layout.tsx` | MODIFY | Low — add one component |
| `components/app-sidebar.tsx` | MODIFY | Low — add search hint |

---

#### Phase 4: Polish & Mobile

**Goal:** Ensure mobile responsiveness, consistent keyboard navigation, and clear chat entry points.

##### 4.1 Chat widget clarity

**File:** `components/chat/chat-widget.tsx` — MODIFY

The widget currently hides on `/chat`, `/vacatures`, and `/scraper`. This is correct for `/chat` (full page replaces it) but confusing for other pages. Change behavior:

- Always show the FAB except on `/chat` (where the full page is active)
- Remove the `/vacatures` and `/scraper` hide rules — recruiters should always have AI access

##### 4.2 Mobile sidebar improvements

**File:** `components/sidebar-layout.tsx` — MODIFY

The mobile trigger bar (h-10, sticky top) is minimal. Enhance with:
- Page title in the mobile top bar (read from current route)
- ⌘K search button next to the sidebar trigger

##### 4.3 Keyboard navigation audit

Verify these shortcuts work correctly:
- `⌘K` — Command palette (new)
- `⌘J` — Chat widget toggle (existing)
- `⌘B` — Sidebar collapse (existing)
- `Escape` — Close any open overlay

Ensure no conflicts between shortcuts.

##### 4.4 Files changed in Phase 4

| File | Action | Risk |
|------|--------|------|
| `components/chat/chat-widget.tsx` | MODIFY | Low — hide logic |
| `components/sidebar-layout.tsx` | MODIFY | Medium — mobile header |

---

## Alternative Approaches Considered

1. **Full app rewrite with new routing** — Rejected. The existing App Router structure is sound. The problems are UI-layer, not architectural.

2. **Adding a top navigation bar instead of fixing sidebar** — Rejected. The sidebar pattern is established and works well for data-heavy recruitment workflows. Adding a top bar would waste vertical space.

3. **Building a custom command palette from scratch** — Rejected. `cmdk` is already installed and the `components/ui/command.tsx` primitives are ready. No reason to reinvent.

4. **Mega-menu in sidebar** — Rejected. The sidebar already supports collapsible sub-items. Grouping with `SidebarGroupLabel` is cleaner and doesn't require new UI primitives.

## Acceptance Criteria

### Functional Requirements

- [ ] All 19 pages are reachable from the sidebar navigation
- [ ] Sidebar groups: "Werving" (6 items), "Automatisering" (4 items), "Hulpmiddelen" (1 item)
- [ ] Legacy `components/sidebar.tsx` is deleted with zero import breakage
- [ ] Every page uses the `PageHeader` component with consistent `text-xl` heading
- [ ] Detail pages (`/vacatures/[id]`, `/kandidaten/[id]`, `/scraper/runs/[id]`) show breadcrumbs
- [ ] Breadcrumbs show dynamic entity names (vacancy title, candidate name)
- [ ] `⌘K` opens command palette with all page routes searchable
- [ ] Command palette supports Dutch keywords and synonyms
- [ ] Chat widget FAB is visible on all pages except `/chat`
- [ ] Mobile top bar shows page title and sidebar trigger

### Non-Functional Requirements

- [ ] No increase in initial JavaScript bundle size (command palette lazy-loaded)
- [ ] Lighthouse performance score stays above 90
- [ ] All keyboard shortcuts work without conflicts
- [ ] Dark theme renders correctly for all new components
- [ ] Breadcrumb links are accessible (proper ARIA labels)

### Quality Gates

- [ ] `pnpm lint` passes (Biome)
- [ ] `pnpm test` passes (existing tests)
- [ ] Visual verification on mobile (375px) and desktop (1440px)
- [ ] Storybook stories updated for modified shared components

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Pages reachable from nav | 7/19 (37%) | 19/19 (100%) |
| Pages with consistent headers | 2/19 (11%) | 19/19 (100%) |
| Pages with breadcrumbs (where needed) | 0/5 | 5/5 |
| Keyboard shortcuts for navigation | 2 (⌘J, ⌘B) | 3 (+ ⌘K) |
| Dead sidebar code | 112 lines | 0 lines |

## Dependencies & Prerequisites

- **No external dependencies** — all required packages (`cmdk`, `@radix-ui/react-*`, `lucide-react`) are already installed
- **shadcn/ui breadcrumb** — may need `pnpm dlx shadcn@latest add breadcrumb` if not yet installed
- **No database changes** — this is purely a UI/UX refactor
- **No API changes** — all data fetching patterns remain the same

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Sidebar restructure breaks active state detection | Medium | High | NavMain already uses `pathname.startsWith()` — new groups don't change this logic |
| Command palette conflicts with chat ⌘J shortcut | Low | Medium | ⌘K and ⌘J are different keys; test explicitly |
| Breadcrumb on dynamic routes shows raw UUID | Medium | Medium | Pass `dynamicLabels` from page's server component with entity name |
| Mobile layout shift from new top bar content | Medium | Low | Use fixed height (h-10 already set), test on 375px |
| PageHeader migration breaks page-specific layouts | Low | Medium | Phase 2 migrates one page at a time with visual verification |

## Future Considerations

- **Entity search in command palette** — Phase 3 only includes page navigation. A follow-up could add real-time entity search (candidates, vacancies) via API endpoint
- **Recent items in palette** — Track recently visited pages in localStorage and show as "Recent" group
- **Favorites/pinned pages** — Let recruiters pin frequently used pages to sidebar top
- **Notification badges** — Show unread message count on "Berichten" nav item
- **Sidebar analytics** — Track which nav items are clicked to inform future UX decisions

## References

### Internal References

- Sidebar layout chain: `components/sidebar-layout.tsx:7-24`
- Active sidebar: `components/app-sidebar.tsx:27-78`
- Legacy sidebar (to delete): `components/sidebar.tsx:1-111`
- PageHeader component: `components/page-header.tsx:1-21`
- Command primitives: `components/ui/command.tsx`
- Chat widget hide logic: `components/chat/chat-widget.tsx:286`
- Search reset fix pattern: commit `88101ad1`
- Performance best practices: commit `3b798331`
- Instant search plan: `docs/plans/2026-03-26-001-feat-instant-vacatures-search-plan.md`

### Existing Shared Components (preserve patterns)

- `components/shared/empty-state.tsx` — EmptyState
- `components/shared/filter-tabs.tsx` — FilterTabs (URL-based)
- `components/shared/kpi-card.tsx` — KPICard
- `components/shared/pagination.tsx` — Pagination (Dutch labels)
- `components/shared/list-page-skeleton.tsx` — ListPageSkeleton

### Conventions (from CLAUDE.md)

- Dutch UI strings, English code variables
- Biome for linting/formatting (NOT eslint/prettier)
- API routes use Dutch naming
- `pnpm` as package manager
