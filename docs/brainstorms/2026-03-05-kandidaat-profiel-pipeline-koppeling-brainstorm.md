date: 2026-03-05
topic: kandidaat-profiel-pipeline-koppeling

# Kandidaat Profiel + Pipeline Koppeling

## What We're Building
We bouwen een 2-staps flow binnen dezelfde kandidaat-aanmaakervaring:

1. **Profielstap (eerst):** recruiter maakt kandidaat aan met verplichte velden `naam` en `rol`, plus begeleide invoer voor werkervaringen en skills.
2. **Koppelstap (direct erna):** systeem toont top-3 best passende **actieve vacatures**, met top-1 standaard voorgeselecteerd. Recruiter kan 1 of meerdere vacatures bevestigen.

Na bevestiging maakt het systeem per gekozen vacature een pipeline-item (`application`) aan in fase `screening`. De kandidaat verschijnt daardoor direct in pipeline én blijft zichtbaar in talentpool.

De flow ondersteunt bidirectioneel werken: vacatures koppelen vanaf kandidaatzijde en kandidaten koppelen vanaf vacaturezijde, met hetzelfde koppelgedrag.

## Why This Approach
We kiezen een pragmatische hybride: **profile-first** zonder extra navigatie/frictie.

Dit combineert de voordelen van aanpak B (eerst kwalitatief profiel) met de snelheid van directe opvolging (koppeling direct na opslaan in dezelfde flow). Daardoor krijgt matching betere input (ervaring + skills), terwijl recruiters geen extra losse pagina hoeven te openen.

YAGNI: we houden het simpel door alleen top-3 suggestie + handmatige bevestiging te doen, zonder volledig geautomatiseerde plaatsing zonder recruiterbesluit.

## Key Decisions
- Kandidaat-aanmaak blijft gescheiden van pipeline totdat recruiter vacatureselectie bevestigt.
- `naam` + `rol` zijn verplicht; werkervaringen en skills worden sterk gestuurd (aanbevolen), niet hard geblokkeerd.
- Suggesties tonen alleen actieve vacatures.
- Top-3 suggesties, top-1 standaard aangevinkt.
- Recruiter kan meerdere vacatures tegelijk kiezen.
- Per gekozen vacature wordt een `application` aangemaakt in fase `screening`.
- Als kandidaat+vacature al gekoppeld is: niet dupliceren, toon “al gekoppeld”.
- Talentpool en pipeline blijven beide up-to-date zichtbaar na bevestiging.

## Resolved Questions
- Auto naar pipeline? Ja, via recruiterbevestiging op top-3 suggesties.
- Lage score gedrag? Geen auto-plaatsing; recruiter kiest uit suggesties.
- Profielinvoer? Hybride: naam + rol verplicht, ervaring/skills aanbevolen.
- Meerdere koppelingen per kandidaat? Ja, toegestaan.
- Startfase in pipeline? `screening`.
- Plaats van suggesties? In dezelfde kandidaat-toevoegflow.
- Default selectie? Beste match voorgeselecteerd.
- Duplicaten? Idempotent behandelen (niet opnieuw aanmaken).

## Open Questions
- Geen open productvragen op dit moment.

## Next Steps
→ `/prompts:workflows-plan` om dit om te zetten naar concrete implementatiestappen en acceptatiecriteria.
