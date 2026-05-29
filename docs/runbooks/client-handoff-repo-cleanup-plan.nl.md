# Klant-handover repo-cleanupplan — 29 mei 2026

## Doel

Maak de repository overdraagbaar door runtimebestanden, lokale caches, historische plan-/brainstormdocumenten en ongebruikte QA-artefacten uit bronbeheer te verwijderen. De klant krijgt daardoor minder ruis en één actuele set runbooks.

## Verwijderd

- Lokale Beads/Dolt runtime: `.beads/backup`, `.beads/dolt`, root `dolt/`, `dolt-server.*` en lokale Beads status/logbestanden.
- Lokale agentconfig: `.serena/`.
- Ongebruikte screenshots en browser-QA captures: root `qa-*.png`, root `vacatures-*.png`, `docs/mobile-test-*.png`.
- Verouderde documenten die drift veroorzaken: `docs/analysis`, `docs/brainstorms`, `docs/plans`, `docs/reviews`, `docs/ideation`, `docs/demos`, `docs/pr-demos`, `docs/feature-walkthrough`, `docs/metrics` en de oude post-Drizzle deploymentnota.
- Historische eenmalige onderhoudsbestanden zonder referenties: `update-werkzoeken-config.ts` en oude research/backlog/evaluatienota's.

## Bewaard

- Broncode, tests, database-migraties, packages, Trigger.dev tasks en Vercel-configuratie.
- Beads brondata voor issue-tracking: `.beads/beads.jsonl`, `.beads/config.yaml`, `.beads/descriptions/**`.
- Canonieke documentatie: `README.md`, `README.en.md`, `docs/architecture.md`, `docs/runbooks/**`, `docs/solutions/**`, `docs/slo-and-observability.md`, autopilot docs en deze handoverdocumenten.

## Guardrails voor toekomstige wijzigingen

- Nieuwe klantdocumentatie moet naar `docs/runbooks/` of een bestaande canonieke doc; geen nieuwe dated brainstorms/plans in de repo.
- Gegenereerde metrics blijven lokaal in `docs/metrics/` en zijn genegeerd door Git.
- Gebruik klantgerichte routes `/vacatures` en `/kandidaten` in documentatie. Interne compatibiliteit met `opdrachten` mag in code blijven staan zolang de canonical routes blijven werken.
- Draai voor overdracht minimaal `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, entropy-check en een build met hosted of expliciet overgeslagen env-validatie.
