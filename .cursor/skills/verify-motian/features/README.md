# Motian verification map

This directory is the maintained source for verifying Motian's recruiter-facing web app. Read this index before driving, then use the matching feature file as the recipe.

## Baseline preconditions

- Launch with `.cursor/skills/verify-motian/bin/launch.sh` so the app is at `http://127.0.0.1:3012` (or the `baseUrl` in `state/instance.json`).
- `.env.local` exists and contains a working `DATABASE_URL` (shared Neon — not isolated).
- `bin/doctor.sh` exits 0 and reports that port, pid, and `/overzicht` identity.
- Never drive `:3002` or any instance missing `state/instance.json`.
- Stay read-only unless the user authorizes writes. Do not scrape, add candidates, send chat, or move pipeline cards.

## Driving conventions

- Start every recipe from `/overzicht` unless the feature file says otherwise.
- Prefer accessible names: nav links `Vacatures`, `Kandidaten`, `Pipeline`, `Chat`; textbox `Zoek vacature`; button `Zoeken`.
- Vacature search is live after a 300ms debounce. Kandidaten search submits a GET form.
- Run browser steps through `node .cursor/skills/verify-motian/bin/capture.mjs` or Cursor browser tools pointed at `baseUrl` from `instance.json`.
- After a mutation (authorized only), restore or delete `verify-motian-` fixtures. Never delete proof artifacts.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof is `meta.json` + `body.txt` + a full-page PNG that shows Motian chrome and the feature heading.
- HTTP proof is the curl command, status, and a short body excerpt (`overall`, `total`, first job title).
- Record the feature id and entry point in the `--name` folder.
- If an entry point is unreachable, report the command and the unmet precondition. Do not call a different path a pass for that entry point.

## Feature entry contract

Each feature file starts with an H1 and one paragraph of user-visible behavior, then exactly four H2s: `Sub-features`, `How to get to it (user POV)`, `Driving it with capture.mjs`, `Gotchas`.

## Features

- [Overzicht](./overzicht.md) — dashboard KPIs and follow-up cards.
- [Vacatures](./vacatures.md) — search, list, and open a vacancy.
- [Kandidaten](./kandidaten.md) — talent-pool search and open a profile.
- [Pipeline](./pipeline.md) — kanban vs list of applications.
- [Chat](./chat.md) — full-page Motian AI composer (do not send).
