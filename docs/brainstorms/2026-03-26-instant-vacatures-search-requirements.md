---
date: 2026-03-26
topic: instant-vacatures-search
---

# Instant Vacatures Search

## Problem Frame
Users searching vacatures should feel like the page is responding as they type, without waiting for a full submit or obvious page refresh. The goal is a search experience that feels snappy, stable, and progressive rather than blocking or jumpy.

## Requirements
- R1. The vacatures search should update automatically while the user types, without requiring an explicit submit action.
- R2. Live search should begin once the query reaches 2 characters or more.
- R3. While a new search is in flight, the current result list should remain visible until the updated results arrive.
- R4. The search state should remain shareable and refresh-safe by updating the URL after a short pause rather than on every keystroke.
- R5. If the query is shortened below the live-search threshold, the page should fall back to the default vacatures listing behavior.

## Success Criteria
- Typing into the vacatures search feels immediate and continuous.
- Results visibly change while the user is typing, without a disruptive loading flash.
- The current list never disappears just because a new search started.
- A copied URL still reflects the active search state after typing settles.

## Scope Boundaries
- This work applies to vacatures only, not kandidaten.
- This does not change the ranking model or the underlying search relevance logic.
- This does not introduce new filter types or redesign the full vacatures page.

## Key Decisions
- Progressive updates: keep the previous results visible while the next query runs so the UI feels stable.
- Live-search threshold: start live searching at 2 characters to balance responsiveness and noise.
- URL sync timing: update the URL after a short pause so the page stays shareable without feeling noisy.

## Dependencies / Assumptions
- The current vacatures search stack can support incremental updates quickly enough for the UI to feel responsive.

## Next Steps
-> Run `/prompts:ce-plan` for structured implementation planning
