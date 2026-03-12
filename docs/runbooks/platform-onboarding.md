# Platform Onboarding Runbook

This runbook describes the shared onboarding workflow used by recruiters, chat agents, MCP, voice, and CLI surfaces.

## Workflow

1. Create or inspect the platform catalog entry.
2. Save the runtime config.
3. Validate access.
4. Run a smoke import.
5. Activate the platform.
6. Inspect onboarding status and blocker evidence.

If a source does not fit `http_html_list_detail`, `browser_bootstrap_http_harvest`, or `api_json`, stop with `needs_implementation`.

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
