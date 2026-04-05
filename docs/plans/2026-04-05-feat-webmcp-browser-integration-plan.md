---
title: WebMCP browser integration for Motian
status: active
created: 2026-04-05
owner: Codex
---

# WebMCP browser integration for Motian

## Problem frame
Motian already exposes MCP through stdio (`pnpm mcp`) and HTTP (`/api/mcp`), but the web app itself cannot yet surface browser-native tools to WebMCP-capable clients. We want Motian pages to register useful browser-side tools so agents can interact with the live UI context directly, and we need the docs/readmes to explain the new integration path.

## Goals
- Add browser-side WebMCP support to the Next.js app.
- Register a small, safe set of Motian-specific tools that expose page context and simple navigation actions.
- Document the new WebMCP path in README files and the developer page.
- Add regression coverage for the new app-shell wiring and developer docs copy.

## Scope boundaries
- Do not replace or remove the existing stdio/HTTP MCP server.
- Do not add complex mutation tools that bypass existing auth/validation flows.
- Do not modify database schema or server-side MCP tool contracts.

## Local research summary
- `app/layout.tsx` is the safest global mount point for browser-side script/bootstrap additions.
- `app/providers.tsx` is the shared client-provider boundary for app-wide client integrations.
- `app/ontwikkelaar/page.tsx` already documents MCP connection modes and is the natural place to add WebMCP guidance.
- `tests/app-layout-command-palette.test.ts` and `tests/mcp-server-setup.test.ts` show the existing structural regression-test style.
- `README.md` and `README.en.md` already describe stdio/HTTP MCP flows and should be expanded, not rewritten.

## External references
- WebMCP legacy demo: https://webmcp.dev/
- Modern WebMCP/MCP-B package docs: https://github.com/WebMCP-org/npm-packages
- Example implementations: https://github.com/WebMCP-org/examples
- MCP UI + WebMCP reference architecture: https://github.com/WebMCP-org/mcp-ui-webmcp

## Key decisions
1. Use the current MCP-B packages (`@mcp-b/global` and `@mcp-b/react-webmcp`) rather than the older `webmcp.js` widget path.
2. Mount WebMCP from a dedicated client component so the integration stays browser-only and isolated from server rendering.
3. Start with low-risk tools:
   - current route + document title snapshot
   - current page summary from visible text
   - in-app navigation to core recruiter pages
4. Keep naming Motian-specific and explicit so they do not collide with existing MCP server tools.

## Implementation units

### Unit 1 — Browser integration bootstrap
- **Goal:** Load the WebMCP runtime in the client app shell and register site tools globally.
- **Files:**
  - `app/providers.tsx`
  - `components/webmcp/motian-webmcp-provider.tsx` (new)
  - `components/webmcp/AGENTS.md` (new, if needed for local guidance)
- **Approach:**
  - Import `@mcp-b/global` in a client-only component.
  - Use `useWebMCP` hooks to register a few tools bound to browser APIs and Next navigation.
  - Keep all tool execution browser-local.
- **Patterns to follow:**
  - Existing app-wide providers in `app/providers.tsx`
  - Existing small client integrations under `components/` and `src/components/`
- **Test scenarios:**
  - App providers include the WebMCP provider.
  - Registered tool names and descriptions are present in source.
  - Navigation tool targets canonical Dutch routes.
- **Verification:** structural Vitest coverage plus lint/typecheck.

### Unit 2 — Developer surface and docs
- **Goal:** Expose WebMCP as a supported integration surface in product docs.
- **Files:**
  - `app/ontwikkelaar/page.tsx`
  - `README.md`
  - `README.en.md`
- **Approach:**
  - Add a WebMCP method/card alongside stdio/HTTP/CLI.
  - Document browser setup with the MCP-B extension and the browser-native tool path.
  - Clarify that WebMCP complements, not replaces, Motian's server MCP transports.
- **Patterns to follow:**
  - Existing MCP docs sections in both READMEs.
  - Existing developer-page card/table structure in `app/ontwikkelaar/page.tsx`.
- **Test scenarios:**
  - Developer page source contains a WebMCP method and setup guidance.
  - README files mention WebMCP and the package/extension setup.
- **Verification:** structural Vitest coverage plus manual README diff review.

### Unit 3 — Regression tests
- **Goal:** Lock in the new wiring and docs text.
- **Files:**
  - `tests/app-layout-command-palette.test.ts` (update)
  - `tests/ontwikkelaar-webmcp-docs.test.ts` (new)
- **Approach:**
  - Extend the app layout/provider structural checks.
  - Add a focused test for developer-page and README WebMCP references.
- **Verification:** `pnpm test` targeted run and full lint.

## Dependencies and sequence
1. Add dependencies and browser-side provider.
2. Wire provider into app shell.
3. Update developer page and README docs.
4. Add/update structural tests.
5. Run lint, targeted tests, then full tests/typecheck if feasible.

## Risks
- Browser-only APIs may accidentally leak into server render paths if imported from the wrong module boundary.
- Tool registration names could drift from canonical Dutch routes if not asserted in tests.
- WebMCP package APIs may have changed; rely on current WebMCP-org docs/examples rather than the original legacy widget repo.

## Deferred to implementation
- Exact final tool naming and parameter shape, provided they remain low-risk and browser-local.
- Whether to expose a page-summary tool from `document.body.innerText` or a narrower DOM slice, based on implementation ergonomics.

## Done criteria
- Motian registers browser-side WebMCP tools from the app shell.
- Developer docs and both README files describe the WebMCP path.
- Regression tests cover the new wiring/docs.
- Lint and relevant tests pass.
