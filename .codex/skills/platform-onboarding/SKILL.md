---
name: platform-onboarding
description: Run the shared platform onboarding workflow for recruiters or agents. Use when adding a supported board, configuring a new runtime source, validating credentials, running a smoke import, or activating a platform.
---

# Platform Onboarding

## Quick Start
Use the same primitives the product exposes:

1. `platformsList` or `GET /api/platforms`
2. `platformCatalogCreate` if the catalog entry does not exist yet
3. `platformConfigCreate` or `POST /api/scraper-configuraties`
4. `platformConfigValidate` or `POST /api/platforms/[slug]/validate`
5. `platformTestImport` or `POST /api/platforms/[slug]/test-import`
6. `platformActivate` or `POST /api/platforms/[slug]/activate`
7. `platformOnboardingStatus` or `GET /api/platforms/[slug]/status`

## When To Use
Use this skill when a recruiter or an agent wants to:

- add a supported platform
- configure a runtime source
- validate credentials or access
- run a first smoke import
- inspect blocker evidence
- activate a platform after a successful test run

## Workflow
Follow the shared onboarding state machine:

1. Create a draft catalog entry if the slug is new.
2. Choose the adapter kind:
   `http_html_list_detail`, `browser_bootstrap_http_harvest`, or `api_json`.
3. Save runtime config with base URL, parameters, and credentials reference/auth.
4. Validate access.
5. Run a smoke import.
6. Activate only after validation + smoke import succeed or return an acceptable partial result.
7. Re-check onboarding status for blocker kind, evidence, and next actions.

## Agent Surface Map
- AI tools: `platformsList`, `platformCatalogCreate`, `platformCatalogUpdate`, `platformConfigCreate`, `platformConfigUpdate`, `platformConfigValidate`, `platformTestImport`, `platformActivate`, `platformOnboardingStatus`
- CLI: `platforms:list`, `platforms:add`, `platforms:configure`, `platforms:validate`, `platforms:test-import`, `platforms:activate`, `platforms:status`
- MCP: `platforms_list`, `platform_catalog_create`, `platform_config_create`, `platform_config_validate`, `platform_test_import`, `platform_activate`, `platform_onboarding_status`
- Voice: `platformsLijst`, `platformCatalogMaakAan`, `platformConfigAanmaken`, `platformConfigValideren`, `platformTestImport`, `platformActiveren`, `platformOnboardingStatus`

## Operating Rules
- Prefer shared primitives over ad-hoc scripts.
- Keep blocker evidence explicit; never collapse a blocked run into “0 listings”.
- If the source does not fit a supported adapter kind, stop with `needs_implementation`.
- Treat the UI and agent surfaces as equivalent entry points into the same workflow state.
