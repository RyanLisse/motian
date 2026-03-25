---
name: platform-onboarding
description: Run the shared platform onboarding workflow for recruiters or agents. Use when adding a supported board, researching an arbitrary recruitment site, requesting credentials, running a smoke import, implementing an adapter, or verifying scheduled success.
---

# Platform Onboarding

## Quick Start
Use the same primitives the product exposes:

1. `platformsList` or `GET /api/platforms`
2. `platformCatalogCreate` if the catalog entry does not exist yet
3. Inspect the site and capture evidence in the onboarding run (`inspect_site`)
4. `platformConfigCreate` or `POST /api/scraper-configuraties`
5. `platformConfigValidate` or `POST /api/platforms/[slug]/validate`
6. `platformTestImport` or `POST /api/platforms/[slug]/test-import`
7. `platformActivate` or `POST /api/platforms/[slug]/activate`
8. `platformOnboardingStatus` or `GET /api/platforms/[slug]/status`

## When To Use
Use this skill when a recruiter or an agent wants to:

- add a supported platform
- research an arbitrary recruitment site before choosing the scraping path
- configure a runtime source
- request credentials or access details and resume later
- run a first smoke import
- inspect blocker evidence
- implement an adapter when the site does not fit an existing pattern
- verify schedule confirmation and the first successful scrape after activation

## Workflow
Follow the shared onboarding state machine:

1. Create a draft catalog entry if the slug is new.
2. Inspect the site and record onboarding evidence.
3. Choose the adapter kind:
   `http_html_list_detail`, `browser_bootstrap_http_harvest`, or `api_json`.
4. If access is blocked, transition to `waiting_for_credentials` or another explicit waiting state and resume from the blocked step.
5. Save runtime config with base URL, parameters, and credentials reference/auth.
6. Validate access.
7. Run a smoke import.
8. If the source still needs custom code, transition into `implement_adapter` rather than ending the run.
9. Activate only after validation + smoke import succeed or return an acceptable partial result.
10. Re-check onboarding status for blocker kind, evidence, next actions, and verification state.
11. Use `verify_schedule` and first-run evidence before treating the run as complete.

## Agent Surface Map
- AI tools: `platformsList`, `platformCatalogCreate`, `platformCatalogUpdate`, `platformConfigCreate`, `platformConfigUpdate`, `platformConfigValidate`, `platformTestImport`, `platformActivate`, `platformOnboardingStatus`
- CLI: `platforms:list`, `platforms:add`, `platforms:configure`, `platforms:validate`, `platforms:test-import`, `platforms:activate`, `platforms:status`
- MCP: `platforms_list`, `platform_catalog_create`, `platform_config_create`, `platform_config_validate`, `platform_test_import`, `platform_activate`, `platform_onboarding_status`
- Voice: `platformsLijst`, `platformCatalogMaakAan`, `platformConfigAanmaken`, `platformConfigValideren`, `platformTestImport`, `platformActiveren`, `platformOnboardingStatus`

## Operating Rules
- Prefer shared primitives over ad-hoc scripts.
- Keep blocker evidence explicit; never collapse a blocked run into “0 listings”.
- Treat `needs_implementation` as a non-terminal state that leads to `implement_adapter`.
- Use `waiting_for_credentials` when external access details are missing.
- Completion means the first successful scrape happened and `verify_schedule` shows future runs remain configured.
- Treat the UI and agent surfaces as equivalent entry points into the same workflow state.
