---
title: "feat: Matching als echte pipeline met workflow-visualisatie en reasoning traces"
type: feat
status: active
date: 2026-03-02
origin: docs/brainstorms/2026-02-23-candidate-intelligence-structured-matching-brainstorm.md
---

# Matching als echte pipeline met workflow-visualisatie en reasoning traces

## Overview

Transformeer de CV-matching flow in een **expliciete, visuele pipeline**: eerst CV analyseren, daarna beoordelen (grading), vervolgens matchen met vacatures en **top 3** tonen met een **matching percentage ring**. De flow wordt ondersteund door **grafieken en diagrammen**, een **workflow-visualisatie** (node/edge), en zichtbare **reasoning traces en tool-usage** — geïnspireerd door [AI Elements Workflow](https://elements.ai-sdk.dev/examples/workflow) en [Chatbot](https://elements.ai-sdk.dev/examples/chatbot). Na implementatie: feature branch aanmaken en PR openen.

## Problem Statement / Motivation

**Huidige staat:**

- CV-analyse verloopt via SSE met stappen (upload → parse → deduplicate → match), maar er is geen duidelijke **pipeline-framing** (analyse → grade → match).
- Er is geen **workflow-diagram** dat de stappen en dataflow toont.
- Reasoning van de AI (structured match, judge verdict) en **tool-usage** zijn niet zichtbaar in de UI.
- Top 3 matches hebben wel een score-ring (`ScoreRing`) maar de pipeline-stappen en grading-fase zijn niet expliciet in de UX.

**Doel:**

- Recruiter ziet een **duidelijke pipeline**: Analyse → Grade → Match.
- **Workflow-visualisatie** met nodes en edges (zoals AI Elements workflow-voorbeeld).
- **Charts en grafieken** voor scores, criteria-breakdown, risico’s.
- **Reasoning traces en tools usage** zichtbaar (chatbot-achtige weergave of aparte panel).
- **Top 3** vacatures met **matching percentage ring** prominent.
- Afronden op een **feature branch** met **PR**.

## Proposed Solution

### 1. Pipeline-stappen (backend + SSE)

- **Stap 1 — Analyse:** CV upload + parse (bestaand) → gestructureerde `ParsedCV`.
- **Stap 2 — Grade:** Op basis van parsed CV (en evt. job-context) een expliciete “grading”-fase: structured scoring (Mariënne-methodiek) of een samenvattende kwaliteitsscore. Output: grade/score + korte motivatie.
- **Stap 3 — Match:** Auto-match tegen actieve vacatures, top 3 (≥40%), met deep structured match + judge verdict (bestaand).

SSE-events uitbreiden zodat de frontend “analyse”, “grade” en “match” als aparte stappen kan tonen en de workflow-grafiek kan voeden.

### 2. Workflow-visualisatie (frontend)

- Gebruik **@xyflow/react** (React Flow) zoals in [AI Elements Workflow](https://elements.ai-sdk.dev/examples/workflow).
- **Nodes:** Analyse, Grade, Match (en optioneel subnoden per match).
- **Edges:** Verbindingen tussen stappen; optioneel “animated” voor actieve stap, “temporary” voor fout/conditional.
- **Canvas:** Pan/zoom, minimap of controls (zoals in het voorbeeld).
- Component in de CV Analyse-tab of een aparte “Pipeline”-sectie.

### 3. Charts en grafieken

- **Recharts** (al in project) gebruiken voor:
  - Criteria-breakdown (bar/radar) per match.
  - Risico/sterkte-scores.
- **Score ring** voor top 3: bestaande `ScoreRing` behouden/uitbreiden; duidelijk “match %” tonen.

### 4. Reasoning traces en tools usage

- **Reasoning:** Tekst/stream van de AI (structured match reasoning, judge verdict) tonen in een apart paneel of collapsible sectie — vergelijkbaar met [AI Elements Chatbot](https://elements.ai-sdk.dev/examples/chatbot) (Reasoning/Sources).
- **Tools usage:** Als er in de pipeline tool-aanroepen zijn (bijv. via AI SDK), deze loggen en tonen (welke tool, input/output summary) in een “Tools”-sectie of in dezelfde reasoning-view.

### 5. Feature branch en PR

- Branch: bijv. `feat/matching-pipeline-visual-workflow`.
- Alle wijzigingen daarop; aan het einde een PR openen met beschrijving van de nieuwe pipeline-UI, workflow-viz, charts en reasoning/tools.

## Technical Considerations

- **@xyflow/react:** Toevoegen als dependency; alleen gebruiken voor de workflow-canvas (geen vervanging van bestaande matching-logica).
- **AI Elements:** Geen extra package vereist; bestaande `components/ai-elements` en patronen (Conversation, Message, etc.) hergebruiken waar nuttig voor reasoning/tools-weergave.
- **SSE:** Bestaande `/api/cv-analyse` uitbreiden met extra events voor “grade”-stap en eventueel tussenresultaten voor workflow-state.
- **Nederlandse UI:** Alle labels en teksten in het Nederlands (conform project).
- **Performance:** Workflow-nodes licht houden; grote data in collapsible of lazy-loaded secties.

## System-Wide Impact

- **CV Analyse-tab:** Nieuwe/uitgebreide componenten (workflow canvas, reasoning panel, charts).
- **API:** `/api/cv-analyse` mogelijk uitbreiden (nieuwe events, optioneel “grade-only” of tussentijdse payloads).
- **Dependencies:** `@xyflow/react` toevoegen; recharts blijft.
- **State:** Frontend state voor pipeline-stappen en workflow-node-status (pending/active/complete) afstemmen op SSE.

## Acceptance Criteria

- [ ] Pipeline bestaat uit drie duidelijke stappen: **Analyse** → **Grade** → **Match** (zichtbaar in UI en in SSE).
- [ ] **Workflow-visualisatie** met nodes (Analyse, Grade, Match) en edges, gebaseerd op @xyflow/react (AI Elements workflow-stijl).
- [ ] **Top 3** vacatures getoond met **matching percentage ring** (ScoreRing) en duidelijke score.
- [ ] **Charts/grafieken** (recharts) voor criteria-breakdown en/of risico’s per match.
- [ ] **Reasoning traces** van structured match en judge verdict zichtbaar in de UI.
- [ ] **Tools usage** (indien van toepassing) zichtbaar (welke tools, korte weergave).
- [ ] Feature branch `feat/matching-pipeline-visual-workflow` (of gelijkwaardig) en **PR** aangemaakt na implementatie.
- [ ] Bestaande CV-analyse flow (upload, parse, deduplicate, match) blijft werken; grading is een expliciete tussenstap.

## Success Metrics

- Recruiter kan in één oogopslag de pipeline (analyse → grade → match) en de workflow-grafiek volgen.
- Top 3 matches zijn duidelijk met percentage ring en ondersteunende grafieken.
- Reasoning en tools-gebruik zijn traceerbaar zonder de console te openen.

## Dependencies & Risks

- **Risico:** @xyflow/react bundle size; beperken tot de CV Analyse-tab (lazy load workflow-canvas).
- **Afhankelijkheid:** Bestaande `autoMatchCandidateToJobs`, `runStructuredMatch`, `judgeMatch` en SSE-contract; wijzigingen backwards compatible houden.

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-02-23-candidate-intelligence-structured-matching-brainstorm.md](2026-02-23-candidate-intelligence-structured-matching-brainstorm.md) — Mariënne pipeline, per-criterion scoring, evidence-based reasoning.
- **CV Analyse tab:** [docs/brainstorms/2026-02-24-cv-analyse-tab-brainstorm.md](2026-02-24-cv-analyse-tab-brainstorm.md) — visuele match-kaarten, top 3, PDF panel.
- **AI Elements Workflow:** https://elements.ai-sdk.dev/examples/workflow — nodes, edges, canvas, controls.
- **AI Elements Chatbot:** https://elements.ai-sdk.dev/examples/chatbot — reasoning, sources, message/streaming UI.
- **Bestaande code:** `app/api/cv-analyse/route.ts`, `app/matching/cv-analyse-tab.tsx`, `components/matching/pipeline-progress.tsx`, `components/score-ring.tsx`, `src/services/auto-matching.ts`.

---

## Deepened implementation notes

### Overview

- **Pipeline framing:** Huidige SSE-stappen zijn `upload` → `parse` → `deduplicate` → `match`. Voor “Analyse → Grade → Match” moet de UI/SSE **Grade** als expliciete fase tussen parse en match introduceren; backend kan een nieuwe `grade`-stap toevoegen na `deduplicate` (zie `app/api/cv-analyse/route.ts` regel 64–164).
- **ScoreRing:** Al aanwezig in `CvMatchCard` (`components/matching/cv-match-card.tsx`) met `ScoreRing score={score} size={64} strokeWidth={5}`; hergebruik voor top-3 “match %” en eventueel een aparte “grade”-ring in de Grade-stap.
- **State:** `cv-analyse-tab.tsx` gebruikt `INITIAL_STEPS` met ids `upload`|`parse`|`deduplicate`|`match` en `processLine` mapt SSE `event.step` + `event.status` naar `PipelineStep[]`; uitbreiden met `grade`-stap en eventueel `workflowNodeStatus` voor de workflow-grafiek.

### Proposed Solution — Pipeline-stappen (backend + SSE)

- **SSE-event vorm voor Grade:** Naast bestaande `{ step, status, label, detail? }` een nieuw event type, bijv. `{ step: "grade", status: "active"|"complete", label, detail?, grade?: { score, summary } }` zodat de frontend de Grade-fase kan tonen en de workflow-node kan updaten.
- **Plaats Grade in route:** In `app/api/cv-analyse/route.ts` na “deduplicate” (na `candidate` bekend is) en vóór “match”: stuur `grade` active → roep grading-logica aan (Mariënne/samenvatting) → stuur `grade` complete met score/motivatie; daarna bestaande “match”-stap ongewijzigd.
- **Backwards compatibility:** Behouden van bestaande `step`-waarden (`upload`, `parse`, `deduplicate`, `match`, `done`, `error`); `grade` als optionele extra stap zodat clients zonder grade-UI gewoon verder werken.

### Proposed Solution — Workflow-visualisatie (frontend)

- **@xyflow/react:** Custom node types voor “Analyse”, “Grade”, “Match” (en optioneel subnoden per top-3 match); positioneer ze horizontaal of in een kleine DAG; edges tussen Analyse→Grade→Match; status (pending/active/complete) via node data of styling (kleur/icon).
- **State sync:** Dezelfde SSE `step`/`status` die `PipelineProgress` voedt (`cv-analyse-tab.tsx` regel 154–166) kunnen de workflow-grafiek voeden: map `upload`+`parse`+`deduplicate` → “Analyse”-node, `grade` → “Grade”-node, `match` → “Match”-node; active step = één node highlighted.
- **Plaatsing:** Workflow-canvas in de CV Analyse-tab: boven of naast `PipelineProgress` tijdens “uploading”, en in het resultaat-scherm (status === "done") compact bovenaan of in een collapsible “Pipeline-overzicht”.
- **Performance:** Workflow-component lazy loaden (bijv. `dynamic(() => import("@/components/matching/workflow-canvas"), { ssr: false })`) om @xyflow alleen op de CV Analyse-tab te laden, zoals nu al met `CvDocumentViewer`.

### Proposed Solution — Charts en grafieken

- **Recharts:** Project heeft al `recharts` en `RadarChart`/`BarChart` in `components/skills-radar.tsx` en `components/ai-grading.tsx`; hergebruik patroon voor criteria-breakdown (bijv. `CriterionResult[]` uit `match.structuredResult.criteriaBreakdown` → BarChart per criterion + stars/evidence of Radar voor dimensies).
- **Criteria-breakdown:** `CvMatchCard` krijgt al `criteriaBreakdown` en toont tier/evidence; voeg een kleine Recharts Bar of Radar toe in de card of in een uitklapbare sectie, met data uit `StructuredMatchOutput.criteriaBreakdown` (criterion, tier, stars, evidence) en `riskProfile` voor risico-scores.
- **ScoreRing:** `components/score-ring.tsx` heeft `getGradeLabel(score)` (Uitstekend/Sterk/Goed/Onder); geschikt voor zowel “match %” (top 3) als eventuele “grade”-score in de Grade-stap; kleuren al gedefinieerd (green/blue/amber/red).

### Proposed Solution — Reasoning traces en tools usage

- **Reasoning in UI:** `CvMatchCard` ontvangt al `reasoning` (= `structuredResult?.recommendationReasoning`) en `judgeVerdict`; tonen in een collapsible “Redenering” of “Toelichting”-sectie per match; voor een centraal reasoning-paneel: verzamel alle `recommendationReasoning` + `judgeVerdict.reasoning` (of vergelijkbaar) en toon in één panel (chatbot-achtig of lijst).
- **Waar tonen:** Binnen de result-view (full-screen na “done”): onder of naast de match cards een sectie “Redenering & oordeel” met per match een blok voor structured-match reasoning en judge verdict; of één globaal paneel dat de geselecteerde match toont.
- **Tools usage:** Als de pipeline later AI SDK tools gebruikt (bijv. voor grade of match), log tool calls (name, args summary, result summary) in de backend en stuur als SSE-event, bijv. `{ step: "tool", tool: string, summary: string }`; frontend toont ze in een “Tools”-lijst of in dezelfde reasoning-view.

### Technical Considerations

- **@xyflow/react:** Alleen importeren in de workflow-canvas component die dynamisch geladen wordt in de CV Analyse-tab; geen impact op andere pagina’s; controleer bundle size (lazy load zoals `CvDocumentViewer`).
- **SSE-contract:** Bestaande events behouden; nieuwe velden optioneel (`grade`, `tool`); `cv-analyse-tab.tsx` `processLine` uitbreiden met `event.step === "grade"` en eventueel `event.step === "tool"` zonder bestaande flows te breken.
- **Nederlandse labels:** Alle nieuwe UI-teksten in het Nederlands (zoals nu in `PipelineProgress` labels en `ScoreRing` `getGradeLabel`); workflow-node labels: “Analyse”, “Beoordelen”, “Matchen”.

### Acceptance Criteria (concrete aanknopingspunten)

- **Drie stappen zichtbaar:** `PipelineProgress` uitbreiden met een “Beoordelen”-step (id `grade`) tussen parse/deduplicate en match; SSE in `route.ts` uitbreiden met `grade`-events; workflow-grafiek toont drie hoofdnodes.
- **Workflow-visualisatie:** Nieuw component (bijv. `components/matching/workflow-canvas.tsx`) met @xyflow/react, drie nodes, edges, status uit pipeline state; geïntegreerd in `cv-analyse-tab.tsx` tijdens processing en/of in result-view.
- **Top 3 + ScoreRing:** Blijft zoals nu in `CvMatchCard` (top 3 uit `matches`); ScoreRing blijft `getScore(match)` gebruiken (`structuredResult?.overallScore ?? quickScore`); eventueel expliciet “match %” label bij de ring.
- **Charts criteria/risico’s:** Nieuwe kleine chart(s) in of onder `CvMatchCard` met `criteriaBreakdown` en `riskProfile` uit `AutoMatchResult.structuredResult`, met recharts (Bar of Radar), zie `skills-radar.tsx`/`ai-grading.tsx` voor patronen.
- **Reasoning zichtbaar:** `reasoning` en `judgeVerdict` al beschikbaar op de card; ervoor zorgen dat ze altijd zichtbaar zijn (niet verborgen) in een vaste sectie of collapsible; optioneel centraal reasoning-paneel dat per match dezelfde data toont.
- **Tools usage:** Backend bij tool-aanroepen een SSE-event sturen; frontend een “Tools”-sectie tonen (lijst van tool + korte weergave); als er nog geen tools in de pipeline zitten, placeholder of “N.v.t.” tot implementatie.
