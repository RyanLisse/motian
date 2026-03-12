# Autopilot Gebruik

## Overzicht

Motian Autopilot draait als een Trigger.dev taak (`autopilot-nightly`) en controleert de belangrijkste recruiter-oppervlakken met browser journeys. Elke run:

1. voert journeys uit tegen de geconfigureerde basis-URL;
2. verzamelt bewijslast per journey;
3. analyseert die bewijslast met AI;
4. bewaart run + findings in de database;
5. uploadt rapport, summary en artifacts naar Vercel Blob;
6. publiceert optioneel GitHub issues voor findings.

De review UI staat op `/autopilot`. De detailpagina `/autopilot/[runId]` toont de runstatus, findings en de rijke bewijslast.

## Bewijslast in Phase 4

Per journey kan Autopilot nu deze artifacts opslaan:

- `screenshot`: PNG momentopname van de pagina
- `console-log`: browser console-uitvoer
- `video`: WebM opname van de journey
- `trace`: Playwright trace voor timeline/snapshots/network
- `har`: HAR-export van request/response verkeer

De evidence viewer op de run-detail pagina toont:

- een ingebouwde videospeler voor WebM;
- screenshot-galerijen per journey;
- een link naar de externe Playwright Trace Viewer;
- een download-link voor het HAR-bestand.

Artifacts worden via de interne proxyroute `/api/autopilot/runs/[runId]/evidence/[journeyId]/[artifactId]` geserveerd. Daardoor blijft blob-toegang server-side en kan gecomprimeerde trace/HAR-inhoud transparant worden gedecomprimeerd voor de browser.

## Dagelijkse workflow

1. Open `/autopilot` om recente runs te bekijken.
2. Open een run detailpagina.
3. Controleer de bevindingen en severity/status.
4. Gebruik het blok `Bewijs` om video, screenshots, trace of HAR te bekijken.
5. Gebruik de blob-rapportlink voor het volledige markdownrapport.

## Wanneer welke artifact handig is

- `video`: dynamische bugs, klikken, animaties en timingproblemen
- `trace`: diepere debugging met snapshots, DOM-state en network timeline
- `har`: API-fouten, trage requests, redirects en header/debugging
- `screenshot`: snelle visuele controle of issue-context in GitHub

## Nightly taak

De Trigger.dev taak staat in `trigger/autopilot-nightly.ts` en draait dagelijks om `04:00` Europe/Amsterdam.

Belangrijke defaults:

- `AUTOPILOT_BASE_URL` valt terug op `VERCEL_URL` en daarna `http://localhost:3002`
- `AUTOPILOT_EVIDENCE_DIR` valt terug op `/tmp/autopilot-evidence`
- GitHub-publicatie gebruikt `AUTOPILOT_GITHUB_TOKEN` of `GITHUB_TOKEN`

Zie [`docs/autopilot-configuration.md`](./autopilot-configuration.md) voor alle instellingen.
