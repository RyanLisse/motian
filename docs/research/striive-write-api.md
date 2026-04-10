# Striive write API discovery (POST/PUT) — research log

**Date:** 2026-04-10 (UTC)
**Issue:** RJC-54  
**Goal:** Reverse-engineer write endpoints used by the Striive supplier portal when creating or editing job listings.

## Executive summary

I was able to run an authenticated browser session against Striive and capture the supplier portal traffic with the current Motian credentials.

Confirmed:

- The current `STRIIVE_USERNAME` / `STRIIVE_PASSWORD` pair is valid for the Striive **supplier** portal.
- The supplier SPA uses a same-origin API base of `/api` with cookie-backed auth and an `X-XSRF-TOKEN` header on observed `POST` requests.
- The supplier role can access the dashboard, inbox (`Opdrachten`), individual job-request detail pages, employees, offers, and saved-search pages.
- The supplier role reads opdrachten via:
  - `GET https://supplier.striive.com/api/v2/job-requests`
  - `GET https://supplier.striive.com/api/job-requests/{id}`
  - `GET https://supplier.striive.com/api/job-requests?similar=true&jobRequestId={id}`
- The only job-request `POST` observed in this role was view tracking:
  - `POST https://supplier.striive.com/api/job-requests/log-view/{id}`

Not confirmed:

- No `POST` / `PUT` / `PATCH` create-or-edit endpoint for job requests was exposed by the current supplier account.
- Candidate create-style routes such as `/jobrequests/new`, `/jobrequests/create`, and `/dashboard/opdrachten/nieuw` all resolve back to the dashboard instead of opening an authoring screen.
- No create/edit control is visible anywhere in the authenticated supplier UI.

**Current conclusion:** the available credentials authenticate successfully, but they do **not** expose a job-listing authoring surface. For this account/role, Striive appears to be an inbox/bidding portal rather than a vacancy-posting portal.

## Key runtime findings

### 1) CLI probes were misleading; real browser access works

Unauthenticated `curl -I` requests to `login.striive.com` and `supplier.striive.com` still return `403 Forbidden`, but a real Chromium session loads both portals successfully.

That means endpoint discovery must be performed with a browser context, not bare HTTP probes.

### 2) Supplier SPA configuration

The supplier frontend bundle exposes these relevant runtime settings:

- `apiUrl: "/api"`
- `withCredentialsInclusions: ["/api"]`
- `websocketUrl: "wss://supplier.striive.com/api/ws/agreement"`

This confirms that authenticated supplier traffic is same-origin and cookie-backed rather than using the older read-only public path directly.

## Authentication flow

### Login portal bootstrap

When loading `https://login.striive.com/`, the browser performs:

- `GET https://login.striive.com/api/auth/check-session`

Observed unauthenticated response:

- HTTP `401`
- Empty body

### Login request

Observed login mutation:

- `POST https://login.striive.com/api/auth/login`

Observed request headers:

- `Accept: application/json, text/plain, */*`
- `Content-Type: application/json`
- `Referer: https://login.striive.com/`
- `X-XSRF-TOKEN: <value from login.striive.com XSRF-TOKEN cookie>`

Observed request body schema:

```json
{
  "username": "<string>",
  "password": "<string>"
}
```

Observed response:

- HTTP `200`
- `Content-Type: application/json`
- Browser redirects into `https://supplier.striive.com/dashboard`

### Post-login cookies

After successful login, the browser holds these auth-relevant cookies:

- `SESSION` on `.striive.com` (`HttpOnly`, `Secure`, `SameSite=Lax`)
- `XSRF-TOKEN` on `supplier.striive.com`
- `XSRF-TOKEN` on `login.striive.com`

### Authenticated user bootstrap

The supplier app validates the session with:

- `GET https://supplier.striive.com/api/auth/user`

Observed response format:

```json
{
  "id": 208802,
  "userNames": {
    "firstName": "<string>",
    "fullName": "<string>",
    "lastName": "<string>"
  },
  "emailAddress": "<string>",
  "workPhoneNumber": "<string>",
  "accountCreatedDate": "<string>",
  "language": "NL",
  "avatar": {
    "full": "<string>"
  }
}
```

The app also loads:

- `GET https://supplier.striive.com/api/company`

Observed response characteristics:

- HTTP `200`
- JSON body
- Includes `accountType`, address, `authorizedPersons`, and avatar metadata

## Authenticated supplier pages and permissions

Confirmed reachable pages with the current credentials:

- `https://supplier.striive.com/dashboard`
- `https://supplier.striive.com/inbox`
- `https://supplier.striive.com/inbox/all/{jobRequestId}`
- `https://supplier.striive.com/employees`
- `https://supplier.striive.com/offers`
- `https://supplier.striive.com/profile/search-commands`

Visible top-level navigation in the supplier portal:

- `Overzicht`
- `Opdrachten`
- `Professionals`
- `Biedingen`
- `Solutions`

### Create/edit route probing

I explicitly tested likely authoring routes after successful login:

- `/jobrequests/new`
- `/jobrequests/create`
- `/dashboard/opdrachten/nieuw`

Observed behavior for all of them:

- Initial HTTP `200`
- Final URL becomes `https://supplier.striive.com/dashboard`
- Dashboard UI is shown instead of any create/edit form

This is strong evidence that the current supplier role does **not** have a job-request authoring route.

## Job-request API traffic observed

### Inbox list

The `Opdrachten` inbox uses:

- `GET https://supplier.striive.com/api/v2/job-requests?page=0&size=1000&maxRadius=50&sortBy=&sortOrder=ASCENDING&clientNames=&professionalTypes=&remoteAllowed=&locations=&skills=`

Related support calls on the page:

- `GET https://supplier.striive.com/api/clients?withOpenJobRequests=true`
- `GET https://supplier.striive.com/api/reference/regions?countryCode=NL&search=`
- `GET https://supplier.striive.com/api/search-command`

### Job-request detail

Opening an opdracht detail page triggers:

- `GET https://supplier.striive.com/api/job-requests/{id}`
- `GET https://supplier.striive.com/api/job-requests?similar=true&jobRequestId={id}`
- `POST https://supplier.striive.com/api/job-requests/log-view/{id}`

Observed `POST /api/job-requests/log-view/{id}` request headers:

- `Accept: application/json, text/plain, */*`
- `Content-Type: application/json`
- `Referer: https://supplier.striive.com/inbox/all/{id}`
- `X-XSRF-TOKEN: <value from supplier.striive.com XSRF-TOKEN cookie>`

Observed request body:

```json
293108
```

Observed response:

- HTTP `200`
- `Content-Type: application/json`
- Response body is a full job-request JSON document (same shape as detail read response)

This endpoint is a tracking/logging write, not a create/update mutation.

## Discovery matrix requested in RJC-54

### 1) Create/edit endpoint URLs

**Status:** Not discovered.
**Observed result:** No `POST` / `PUT` / `PATCH` create-or-edit job-request endpoint surfaced in the current supplier UI or route probing.

### 2) Request payload schema

**Status:** Not discovered for create/edit job requests.
**Observed result:** No authoring request was triggered because no authoring UI is available to the current supplier account.

### 3) Response format

**Status:** Not discovered for create/edit job requests.
**Observed result:** No create/edit response exists to capture in this role.

### 4) Required auth headers

**Confirmed for observed writes (`login`, `logout`, `log-view`):**

- Session cookies are required.
- `X-XSRF-TOKEN` is required on observed `POST` requests.
- `Content-Type: application/json`
- `Accept: application/json, text/plain, */*`
- A same-origin `Referer` is present and likely expected.

### 5) Do the current credentials have write permissions?

**Answer:** Partially, but not for vacancy authoring.

What the current credentials can do:

- Successfully authenticate to the supplier portal
- Read inbox job requests and detail payloads
- Perform at least one same-origin POST (`/api/job-requests/log-view/{id}`), which confirms the session is valid for authenticated writes in principle

What the current credentials do **not** expose:

- Any visible UI to create or edit job requests
- Any accessible create-style route for a new job request
- Any observed `POST` / `PUT` / `PATCH` mutation endpoint that creates or edits a job request

## Practical implication for Motian

Motian's current Striive integration is aligned with the supplier role:

- read opdrachten,
- inspect details,
- potentially respond/bid later through a different flow,
- but **not** publish new vacancies into Striive.

If auto-posting vacancies remains a product requirement, the missing piece is not browser automation quality anymore; it is **account role / portal type**. We likely need:

1. employer-side Striive credentials (or a different Striive portal),
2. or documentation that supplier accounts are intentionally read/inbox-only for job requests.

## Notes

- This document now reflects authenticated runtime evidence from 2026-04-10.
- The earlier assumption that credentials were unavailable in-session was wrong; Vercel project linking and `vercel env pull .env.local` provided the required secrets.
- No secret values are recorded here; only endpoint structure, header requirements, cookie names, and observed behavior are documented.
