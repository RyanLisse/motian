# Striive write API discovery (POST/PUT) — research log

**Date:** 2026-04-09 (UTC)  
**Issue:** RJC-54  
**Goal:** Reverse-engineer write endpoints used by the Striive supplier portal when creating/editing job listings.

## Executive summary

I was **not able to directly capture Striive POST/PUT write calls** in this environment on 2026-04-09, because the portal and login hosts returned `403 Forbidden` to non-interactive CLI requests and no authenticated browser session (with valid supplier credentials + UI access) is available in this runtime.

What is confirmed from code and previous integration work:

- Read-only supplier API is already used at `GET https://supplier.striive.com/api/v2/job-requests`.
- Detail reads are used at `GET https://supplier.striive.com/api/job-requests/{id}`.
- Authentication is cookie/session-based after login via `https://login.striive.com`.
- The current Motian scraper has no discovered write endpoint yet.

## Evidence collected

### 1) Network reachability from this runtime

- `curl -I https://supplier.striive.com` → `HTTP/1.1 403 Forbidden`
- `curl -I https://login.striive.com` → `HTTP/1.1 403 Forbidden`

Because both hosts reject basic CLI probing from this runtime, endpoint discovery requires an interactive browser session that can pass Striive’s anti-bot/access controls.

### 2) Existing Motian Striive integration (read path only)

From the current scraper implementation:

- `STRIIVE_API_LIST = "https://supplier.striive.com/api/v2/job-requests"`
- `STRIIVE_API_DETAIL = "https://supplier.striive.com/api/job-requests"`
- Login flow uses Playwright against `https://login.striive.com`, then reuses cookies for API calls.

No POST/PUT endpoint constants or write payload builders are present in the current code.

## Discovery matrix requested in issue

## 1) Endpoint URLs (POST/PUT)

**Status:** Not yet discovered in this environment.  
**Required next capture:** DevTools Network or Playwright `context.on("request")` while creating/editing a vacancy in supplier UI.

## 2) Request payload schema

**Status:** Not yet discovered in this environment.  
**Required next capture:** Raw request JSON body from create/edit flow (including nullable fields and enum-like fields).

## 3) Response format

**Status:** Not yet discovered in this environment.  
**Required next capture:** Raw JSON response and status codes for successful create, validation error, and unauthorized/forbidden flows.

## 4) Required auth headers

**Current inference (high confidence from read flow):**

- Session cookie authentication is required.
- `Accept: application/json` works for read endpoints.
- Additional CSRF/auth headers for write requests are **unknown** until create/edit capture is performed.

## 5) Verify write permissions for `STRIIVE_USERNAME` / `STRIIVE_PASSWORD`

**Status:** Not verifiable in this runtime due to missing authenticated interactive session and host-level `403` from CLI probes.  
**Required next check:** Attempt create/edit in supplier UI with the production/intended credentials and inspect whether request returns `2xx`, `403`, or role/permission errors.

## Recommended next execution plan (to unblock RJC-54 quickly)

1. Run an authenticated browser session (local desktop or remote browser) and open DevTools Network tab.
2. Perform both flows:
   - Create new job listing (minimal required fields)
   - Edit existing job listing (single-field patch)
3. Export HAR and redact secrets.
4. Record in this doc:
   - Exact method + URL
   - Request headers (especially CSRF/session headers)
   - Request body schema with required/optional fields
   - Response schema and error cases
5. Add a tiny adapter contract note in `src/services/channel-adapters/striive.ts` once schema is stable.

## Suggested capture checklist template

Use this when doing the live capture:

- **Operation:** create or edit
- **Method/URL:**
- **Auth primitives:** cookie names, CSRF header names, origin/referer requirements
- **Body shape:** top-level keys, nested objects, enum values
- **Validation errors:** field-level error format
- **Success response:** ID fields, status fields, timestamps
- **Rate limits:** any 429 behavior

## Notes

- This document is intentionally explicit about what was and was not confirmed on **2026-04-09** to avoid false certainty.
- Once a real browser capture is available, replace all “not yet discovered” sections with concrete artifacts.
