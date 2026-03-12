---
name: public-board-triage
description: Triage a public job board into the shared onboarding system. Use when assessing a new source, classifying adapter kind, capturing blocker evidence, or deciding whether a board can be self-served or needs implementation.
---

# Public Board Triage

## Goal
Move a public board into the shared onboarding workflow with explicit evidence, not ad-hoc notes.

## Decision Flow
1. Inspect the source URL and classify it as:
   `http_html_list_detail`, `browser_bootstrap_http_harvest`, or `api_json`.
2. Create or update the catalog entry.
3. Save a runtime config with the current source path, feed URL, or auth reference.
4. Run validation.
5. Run a smoke import.
6. Capture blocker kind and evidence.

## Blocker Handling
- If validation or smoke import returns a board-specific blocker, preserve the exact `blockerKind`.
- Always retain `evidence` such as final URL, matched markers, relevant snippets, or operator notes.
- If the board needs a scraper strategy the shared system does not support, set status to `needs_implementation`.

## Shared Tools
- Catalog + config: `platformCatalogCreate`, `platformConfigCreate`, `platformOnboardingStatus`
- Validation + smoke import: `platformConfigValidate`, `platformTestImport`
- Activation after success: `platformActivate`

## Exit Criteria
- Supported board:
  catalog entry exists, runtime config saved, validation run completed, smoke import completed, status visible in onboarding.
- Unsupported board:
  catalog entry exists, onboarding status is `needs_implementation`, blocker and evidence are recorded, and the next action is explicit.
