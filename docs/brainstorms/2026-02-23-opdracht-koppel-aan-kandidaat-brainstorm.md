date: 2026-02-23
topic: opdracht-koppel-aan-kandidaat

# Opdracht: Koppel Aan Kandidaat

## What We're Building
We vervangen de actie “Reageren” op de opdrachtdetailpagina door “Koppel aan kandidaat” (desktop en mobiel). Deze actie opent geen direct sollicitatiepad, maar stuurt de gebruiker naar `/matching` met de huidige opdracht voorgeselecteerd.

In deze context kan de recruiter kandidaten koppelen via twee paden in hetzelfde scherm: AI-matches en handmatige kandidaatselectie. Het doel is om koppelen naar kandidaten centraal te maken in de matching-ervaring, in plaats van vanuit opdrachtdetail direct te reageren.

De eerste versie richt zich op het bevestigen van een opdracht-kandidaat match-relatie. Er wordt bewust nog geen sollicitatie aangemaakt tijdens dit koppelmoment.

## Why This Approach
We hebben drie richtingen verkend. De gekozen aanpak is een contextuele matching-workspace (Aanpak A): doorsturen naar `/matching` met voorgeselecteerde opdracht, waar AI- en handmatige selectie samenkomen.

Deze optie is gekozen omdat hij het beste aansluit op bestaande patronen in de codebase (`matching` + bestaande match/application services), met minimale nieuwe productcomplexiteit. Het voorkomt ook dat we parallel een tweede koppelflow introduceren op opdrachtdetail.

Volgens YAGNI is dit de kleinste bruikbare stap: eerst consistente koppeling in één plek, daarna pas uitbreiding naar sollicitatie-automatisering als dat echt nodig blijkt.

## Key Decisions
- Actielabel op opdrachtdetail wijzigen naar “Koppel aan kandidaat” (desktop + mobiel): maakt intentie expliciet.
- Navigatie naar `/matching` met voorgeselecteerde opdracht: koppelen gebeurt in bestaande matching-context.
- Matching-context toont zowel AI-matches als handmatige kandidaatselectie: recruiters hebben flexibiliteit in één flow.
- Koppelen maakt géén sollicitatie aan: deze actie gaat alleen over match-relatiebeheer.
- Als er nog geen match-row bestaat voor opdracht+kandidaat, maken we die aan met status `approved`: handmatige selectie blijft volledig mogelijk.

## Open Questions
- Hoe tonen we “voorgeselecteerde opdracht” het duidelijkst in de matching-UI zodat contextverlies minimaal is?
- Welke feedback krijgt de gebruiker na koppelen (toast, inline status, badge-update)?
- Moet koppelen idempotent/merge-gedrag expliciet zichtbaar zijn wanneer een bestaande match al `approved` is?
- Wanneer (en door wie) wordt een `approved` match omgezet naar een echte sollicitatie in de pipeline?

## Next Steps
→ `/workflows:plan` om de implementatie uit te werken op basis van deze keuzes.
