# Overzicht

Overzicht is the home dashboard. A recruiter lands here after `/` redirects, sees live counts, and jumps to vacatures, pipeline, or interviews from the cards.

## Sub-features

- `overzicht-open` renders heading `Overzicht` with Motian shell navigation.
- `overzicht-cards` shows follow-up cards (`Pipeline waar je op stuurt`, `Nieuwe vacatures om op te volgen`).
- `overzicht-nav` reaches Vacatures, Kandidaten, Pipeline, and Chat from the sidebar.

## How to get to it (user POV)

- Open `/` (permanent redirect to `/overzicht`).
- Open `/overzicht` directly.
- Choose the `Overzicht` link in the Werving sidebar.

## Driving it with capture.mjs

Preconditions:

- `bin/doctor.sh` is OK at the instance `baseUrl`.
- Database can serve overview queries (page returns 200, not an error boundary).

- **Redirect entry.** Open `/`. Run `node .cursor/skills/verify-motian/bin/capture.mjs --path / --name overzicht-redirect --expect-text "Overzicht"`. The captured URL heading is `Overzicht` and `body.txt` contains `Motian`.
- **Direct entry.** Open `/overzicht`. Run `node .cursor/skills/verify-motian/bin/capture.mjs --path /overzicht --name overzicht-direct --expect-text "Pipeline waar je op stuurt"`. `body.txt` also contains `Nieuwe vacatures om op te volgen`.
- **Nav still present.** In the same dump, confirm links/text `Vacatures`, `Kandidaten`, `Pipeline`, `Chat`.
- **Proof.** Keep both PNG + `body.txt` files. They must show the Overzicht heading and at least one numeric KPI or card, not a stack trace.

## Gotchas

- `/` is a redirect, not a dashboard of its own. Assert `/overzicht` content.
- Overview is `force-dynamic` and hits Neon on every load. A hung DB looks like a spinner or error, not an empty-but-valid dashboard.
- `gezondheid.overall` being `kritiek` does not by itself fail this page; a missing `Overzicht` heading does.
