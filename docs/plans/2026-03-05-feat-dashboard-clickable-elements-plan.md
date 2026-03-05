---
title: "feat: Make dashboard elements clickable"
type: feat
date: 2026-03-05
---

# feat: Make Dashboard Elements Clickable

## Overview

Make all static dashboard elements on the Overzicht page clickable, navigating to relevant filtered views. Currently only recent jobs and scrape activity have links — KPI cards, platform bars, top companies, top provinces, and system status are dead UI.

## What exists today

| Element | Clickable? | Target |
|---------|-----------|--------|
| KPI: Totaal vacatures | No | → `/opdrachten` |
| KPI: Nieuw deze week | No | → `/opdrachten` |
| KPI: Actieve scrapers | No | → `/scraper` |
| KPI: Platforms | No | → `/scraper` |
| Platform breakdown bars | No | → `/opdrachten?platform=X` |
| Top opdrachtgevers | No | → `/opdrachten?q=X` |
| Top provincies | No | → `/opdrachten?provincie=X` |
| Systeem status rows | No | → `/scraper` |
| Recent jobs | **Yes** | Already works |
| Scrape activiteit | **Yes** | Already works |

## Files to modify

| File | Action | Purpose |
|------|--------|---------|
| `components/shared/kpi-card.tsx` | MODIFY | Add optional `href` prop |
| `app/overzicht/page.tsx` | MODIFY | Add hrefs + wrap list items in Links |

## Implementation

### 1. KPICard: Add `href` prop

Add optional `href` to KPICard. When present, wrap in `<Link>` with hover styles.

### 2. Dashboard page: Wire up navigation

- **KPI cards**: Pass `href` prop to each
- **Platform bars**: Wrap each row in `<Link href="/opdrachten?platform=X">`
- **Top companies**: Wrap each row in `<Link href="/opdrachten?q=X">`
- **Top provinces**: Wrap each row in `<Link href="/opdrachten?provincie=X">`
- **System status**: Wrap each row in `<Link href="/scraper">`
- **Scrape activity rows**: Wrap each row in `<Link href="/scraper">`

### 3. Hover states

Follow existing pattern from `job-card.tsx`:
- `hover:bg-accent transition-colors cursor-pointer`
- Rounded corners on hover for list items

## Acceptance Criteria

- [ ] All 4 KPI cards navigate to correct pages on click
- [ ] Platform bars link to filtered opdrachten view
- [ ] Top companies link to search-filtered opdrachten view
- [ ] Top provinces link to province-filtered opdrachten view
- [ ] System status rows link to scraper dashboard
- [ ] Scrape activity rows link to scraper dashboard
- [ ] Hover states provide clear visual feedback
- [ ] No layout shift from added Link wrappers
