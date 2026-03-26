# Platform Onboarding Runbook

This runbook describes the shared onboarding workflow used by recruiters, chat agents, MCP, voice, and CLI surfaces.

## Workflow

1. Create or inspect the platform catalog entry.
2. Inspect the site and capture structured evidence about login walls, consent, pagination, detail pages, and likely extraction paths.
3. Save the runtime config.
4. If access details are missing, move the run to `waiting_for_credentials` and resume from the blocked step once secrets are available.
5. Validate access.
6. Run a smoke import.
7. If the source still does not fit `http_html_list_detail`, `browser_bootstrap_http_harvest`, or `api_json`, move into an implementation path instead of ending the workflow.
8. Activate the platform.
9. Verify scheduling and monitor the first successful scrape before marking the run complete.

The onboarding workflow is only complete after the first successful scrape is recorded and future runs remain scheduled.

## HTTP Endpoints

- `GET /api/platforms`
- `POST /api/platforms`
- `POST /api/scraper-configuraties`
- `PATCH /api/scraper-configuraties/[id]`
- `POST /api/platforms/[slug]/validate`
- `POST /api/platforms/[slug]/test-import`
- `POST /api/platforms/[slug]/activate`
- `GET /api/platforms/[slug]/status`

## Shared Tooling

### AI
- `platformsList`
- `platformCatalogCreate`
- `platformCatalogUpdate`
- `platformConfigCreate`
- `platformConfigUpdate`
- `platformConfigValidate`
- `platformTestImport`
- `platformActivate`
- `platformOnboardingStatus`

### CLI
- `platforms:list`
- `platforms:add`
- `platforms:configure`
- `platforms:validate`
- `platforms:test-import`
- `platforms:activate`
- `platforms:status`

### MCP
- `platforms_list`
- `platform_catalog_create`
- `platform_config_create`
- `platform_config_validate`
- `platform_test_import`
- `platform_activate`
- `platform_onboarding_status`

### Voice
- `platformsLijst`
- `platformCatalogMaakAan`
- `platformConfigAanmaken`
- `platformConfigValideren`
- `platformTestImport`
- `platformActiveren`
- `platformOnboardingStatus`

## Operator Notes

- Validation and test-import responses must preserve `blockerKind` and `evidence`.
- Recruiter UI and agents should point to the same onboarding status, not separate tracking.
- Public boards that are blocked by consent, anti-bot, redirects, or markup drift should surface that blocker explicitly instead of returning empty imports.
- Waiting states such as `waiting_for_credentials` must preserve enough context to resume the exact blocked step.
- `needs_implementation` is no longer a dead-end operator outcome; it is a visible state on the way to `implement_adapter`.
- Activation is not completion; use schedule verification plus the first successful scrape as the finishing signal.
