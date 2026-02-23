---
title: "feat: Koppel opdracht aan kandidaat via matching-context"
type: feat
date: 2026-02-23
brainstorm: docs/brainstorms/2026-02-23-opdracht-koppel-aan-kandidaat-brainstorm.md
detail_level: more
---

# ✨ feat: Koppel opdracht aan kandidaat via matching-context

## Overview
Vervang de actie "Reageren" op opdrachtdetail door "Koppel aan kandidaat" (desktop + mobiel) en stuur gebruikers naar `/matching` met de gekozen opdracht als context. Binnen deze context kan de recruiter zowel AI-matches als handmatige kandidaatselectie gebruiken. Het koppelmoment beheert alleen `job_matches` (status `approved`) en maakt in deze fase geen `applications` aan.

## Problem Statement / Motivation
De huidige knop "Reageren" op `app/opdrachten/[id]/page.tsx` is niet gekoppeld aan de gewenste matching-flow en creëert geen expliciete koppeling tussen opdracht en kandidaat. Recruiters moeten kandidaten kunnen koppelen vanuit een bestaande workflow die al match-review ondersteunt.

Doel:
- Eén consistente plek voor koppelen: `/matching`
- AI + handmatige selectie in dezelfde flow
- Geen premature uitbreiding naar sollicitatie-creatie (YAGNI)

## Research Consolidation
### Found brainstorm context
Gevonden en gebruikt: `docs/brainstorms/2026-02-23-opdracht-koppel-aan-kandidaat-brainstorm.md`.

### Repo findings (relevant references)
- Huidige CTA labels op opdrachtdetail: `app/opdrachten/[id]/page.tsx:488`, `app/opdrachten/[id]/page.tsx:503`
- Matching page query- en filterstructuur: `app/matching/page.tsx:26`, `app/matching/page.tsx:96`, `app/matching/page.tsx:182`
- Match review actiecomponent: `app/matching/match-actions.tsx:7`
- Bestaande server action voor statusupdate: `app/matching/actions.ts:8`
- Match service (list/count/update/create): `src/services/matches.ts:29`, `src/services/matches.ts:56`, `src/services/matches.ts:79`, `src/services/matches.ts:98`
- Match unique constraint (`jobId + candidateId`): `src/db/schema.ts:234`
- Kandidaten zoeken + tellen: `src/services/candidates.ts:71`, `src/services/candidates.ts:95`
- Kandidaten API met paginatie/zoekparams: `app/api/kandidaten/route.ts:23`
- Sollicitatie-POST bestaat maar valt buiten scope: `app/api/sollicitaties/route.ts:42`
- FilterTabs bouwen links via `buildHref`, risico op queryverlies: `components/shared/filter-tabs.tsx:13`

### Institutional learnings
- `docs/solutions/` is niet aanwezig in deze repo (`docs`, `docs/brainstorms`, `docs/plans` bestaan).

### External research decision
Externe research is overgeslagen: sterke lokale patronen en laag-risico domein (geen security/payment/external API wijziging).

## SpecFlow Analysis (User Flows + Gaps)
### Primary flow
1. Recruiter opent opdrachtdetail (`/opdrachten/[id]`).
2. Klik op "Koppel aan kandidaat".
3. Navigatie naar `/matching` met opdrachtcontext (bijv. queryparam `jobId`).
4. Recruiter ziet:
- bestaande AI-matches voor deze opdracht
- handmatige kandidaatselectie
5. Recruiter koppelt kandidaat:
- bestaand match-record: status naar `approved`
- geen match-record: record aanmaken + status `approved`
6. UI toont directe bevestiging in matching-overzicht.

### Edge cases to cover
- `jobId` ontbreekt/ongeldig in URL: toon neutrale matching-weergave met duidelijke melding.
- Kandidaat al gekoppeld en al `approved`: idempotent gedrag, geen duplicate of fout.
- Candidate/job records ontbreken door verwijdering: nette foutmelding i.p.v. silent fail.
- Filter/tab wissel verwijdert `jobId` niet onbedoeld.

### Scope guardrails
- Geen automatische `applications`-creatie.
- Geen datamodelwijziging nodig.

## Proposed Solution
### A. Entry-point aanpassen op opdrachtdetail
- Vervang beide "Reageren" labels door "Koppel aan kandidaat".
- Maak knopnavigatie expliciet naar `/matching` met opdrachtcontext.
- Bestand: `app/opdrachten/[id]/page.tsx`

### B. Matching-context uitbreiden
- Lees opdrachtcontext uit `searchParams` (bijv. `jobId`).
- Filter de matchlijst op gekozen opdracht wanneer context actief is.
- Voeg contextheader/badge toe zodat zichtbaar is dat gebruiker in "koppelmodus" werkt.
- Bestanden: `app/matching/page.tsx`, mogelijk `components/shared/filter-tabs.tsx` voor query-preservatie.

### C. Handmatige kandidaatselectie toevoegen
- Gebruik bestaande kandidaten API (`/api/kandidaten`) voor zoeken/pagineren.
- Voeg selecteeractie toe naast bestaande AI-match-acties.
- Bestand: `app/matching/page.tsx` (UI) + eventueel nieuwe kleine clientcomponent binnen `app/matching/`.

### D. Upsert-achtige koppelactie voor matches
- Introduceer server-side actie/servicepad dat:
  1. match op (`jobId`, `candidateId`) zoekt
  2. bij bestaand record status `approved` zet
  3. anders match aanmaakt met veilige defaults en status `approved`
- Houd rekening met unique constraint `uq_job_matches_job_candidate`.
- Bestanden: `app/matching/actions.ts`, `src/services/matches.ts`.

### E. Revalidatie en UX feedback
- Revalidate minimaal `/matching` na koppelactie.
- Toon duidelijke succes/foutfeedback (inline of compacte statusmelding).
- Bestand: `app/matching/actions.ts`, `app/matching/page.tsx`.

## Technical Considerations
- **Data integrity:** `uq_job_matches_job_candidate` voorkomt duplicaten; implementatie moet race-safe en idempotent zijn.
- **Statusdomein:** huidige statusset is `pending|approved|rejected` (`src/db/schema.ts:225`), hierop aansluiten.
- **Paginatie en query consistency:** bestaande tabs gebruiken losse href-builders; `jobId` moet behouden blijven bij tab/status/paginawissels.
- **Scope discipline:** bestaande `createApplication` route/service niet aanroepen in deze fase.

## Implementation Work Breakdown
- [ ] `app/opdrachten/[id]/page.tsx`: vervang CTA-tekst (desktop + mobiel) en routeer naar matching-context.
- [ ] `app/matching/page.tsx`: lees `jobId` context, filter resultaten, voeg contextuele UI toe.
- [ ] `app/matching/page.tsx` of `app/matching/candidate-linker.tsx`: handmatige kandidaatzoek/selectie toevoegen.
- [ ] `app/matching/actions.ts`: nieuwe koppelactie (approve existing or create+approve).
- [ ] `src/services/matches.ts`: ondersteunende servicefunctie voor veilige find-or-create/update-flow.
- [ ] `components/shared/filter-tabs.tsx` of call-sites in `app/matching/page.tsx`: borg queryparam-preservatie.
- [ ] `tests/matching-linking-flow.test.ts` (nieuw): service/action gedrag voor bestaande en nieuwe matchcases.
- [ ] `tests/harness/structural.test.ts` (indien nodig): structurele assertions updaten voor nieuwe exports/components.

## Pseudo Code (for planning clarity)
### `app/matching/actions.ts`
```ts
export async function linkCandidateToJob(jobId: string, candidateId: string) {
  const existing = await getMatchByJobAndCandidate(jobId, candidateId);

  if (existing) {
    return await updateMatchStatus(existing.id, "approved", "system");
  }

  return await createApprovedMatch({
    jobId,
    candidateId,
    matchScore: 0,
    confidence: null,
    reasoning: "Handmatige koppeling",
    model: "manual",
  });
}
```

## Acceptance Criteria
- [ ] Op `app/opdrachten/[id]/page.tsx` staat overal "Koppel aan kandidaat" i.p.v. "Reageren".
- [ ] CTA navigeert naar `/matching` met opdrachtcontext.
- [ ] In matching-context worden relevante matches voor die opdracht getoond.
- [ ] Handmatige kandidaatselectie is beschikbaar in hetzelfde scherm.
- [ ] Selectie van een kandidaat zonder bestaand match-record maakt een nieuw `job_matches` record met status `approved`.
- [ ] Selectie van een kandidaat met bestaand match-record zet status op `approved` zonder duplicate.
- [ ] Er wordt geen `applications` record aangemaakt door deze flow.
- [ ] Bij succes/fout krijgt gebruiker directe zichtbare feedback.
- [ ] Querycontext (`jobId`) blijft behouden bij relevante filterinteracties.
- [ ] Tests dekken ten minste: bestaand match-record, nieuw match-record, idempotente herhaalklik.

## Success Metrics
- Recruiter kan binnen 2 klikken vanaf opdrachtdetail in koppelcontext komen.
- 100% van handmatige koppelingen resulteert in een geldig `job_matches` record (geen duplicate constraint-fouten in normale flow).
- Geen toename in onbedoelde `applications` creaties tijdens koppelen.

## Dependencies & Risks
### Dependencies
- Bestaande candidates search endpoint: `app/api/kandidaten/route.ts`
- Bestaande match statusupdate patroon: `app/matching/actions.ts`, `src/services/matches.ts`

### Risks
- **Query state loss:** filtertab-links kunnen context verwijderen.
- **Race condition op create:** gelijktijdige clicks kunnen unique-conflict geven.
- **UX ambiguïteit:** onduidelijk verschil tussen "match goedkeuren" en "koppelen" zonder expliciete contextlabeling.

### Mitigations
- Query-preserving href builders toepassen op matching-filters.
- Upsert-safe servicepad met conflictafhandeling/idempotentie.
- Duidelijke context copy in matching-header (bijv. "Koppelen voor opdracht: X").

## Testing & Verification Plan
- [ ] `pnpm test -- tests/matching-linking-flow.test.ts`
- [ ] `pnpm test` (relevante regressie)
- [ ] `pnpm lint`
- [ ] Handmatige flowcheck:
  - `app/opdrachten/[id]/page.tsx` desktop CTA
  - `app/opdrachten/[id]/page.tsx` mobiel CTA
  - `/matching?jobId=<id>` context + AI + handmatig

## AI-Era Notes
- Plan is opgesteld met AI-assisted repo-analyse (Codex) op basis van concrete code-referenties.
- Implementatie moet expliciet menselijk gevalideerd worden op UX-copy en query-state gedrag in browser.

## References & Research
### Internal references
- `docs/brainstorms/2026-02-23-opdracht-koppel-aan-kandidaat-brainstorm.md`
- `app/opdrachten/[id]/page.tsx:488`
- `app/opdrachten/[id]/page.tsx:503`
- `app/matching/page.tsx:48`
- `app/matching/page.tsx:96`
- `app/matching/page.tsx:182`
- `app/matching/match-actions.tsx:7`
- `app/matching/actions.ts:8`
- `src/services/matches.ts:79`
- `src/services/matches.ts:98`
- `src/services/candidates.ts:71`
- `app/api/kandidaten/route.ts:23`
- `src/db/schema.ts:234`
- `app/api/sollicitaties/route.ts:42`
- `components/shared/filter-tabs.tsx:13`
- `docs/plans/2026-02-21-feat-phase12-professionals-matching-plan.md`

### Related work
- Geen direct gekoppelde issue/PR vastgelegd in repo metadata.

## Final Notes
- ERD-update is niet van toepassing: geen nieuwe tabellen/kolommen/indexen gepland.
- Dit plan beschrijft **HOW** op basis van bestaande brainstormbeslissingen voor **WHAT**.
