---
title: "feat: GenUI in de chat — custom components voor tool-resultaten"
type: feat
status: active
date: 2026-03-02
origin: docs/brainstorms/2026-03-02-genui-chat-brainstorm.md
---

# GenUI in de chat — custom components voor tool-resultaten

## Overview

Voeg **Generative UI (GenUI)** toe aan de Motian AI-chat: wanneer het model een tool aanroept en een resultaat teruggeeft, niet alleen generieke JSON tonen maar waar mogelijk een **domeinspecifieke React-component** (vacaturekaart, kandidaatkaart, matchkaart). Client-side aanpak: bestaande `streamText` + tools + `toUIMessageStreamResponse` blijven; in `ChatMessages` wordt per tool-type bij `output-available` een eigen component met `part.output` gerenderd. Fallback blijft de bestaande `ChatToolCall`.

## Problem Statement / Motivation

**Huidige staat:** Tool-calls in de chat worden allemaal hetzelfde getoond via `ChatToolCall`: label + inklapbare JSON (input/output). Voor detail-tools (getOpdrachtDetail, getKandidaatDetail, getMatchDetail) is dat weinig informatief; gebruikers willen snel titel, bedrijf, locatie en een link naar de detailpagina.

**Doel:** Rijke, herkenbare UI voor tool-resultaten: kaarten die passen bij het domein (vacature, kandidaat, match), met links naar bestaande app-pagina’s. Zie [AI SDK Generative UI](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces).

## Proposed Solution

### 1. GenUI-dispatch in ChatMessages

In `components/chat/chat-messages.tsx`, binnen de bestaande `message.parts`-loop:

- Bij `isToolUIPart(part)`:
  - Bepaal toolnaam via `part.toolName ?? getToolName(part)` (of uit `part.type` indien vorm `tool-<toolName>`).
  - Als `part.state === 'output-available'` en er een GenUI-component voor deze tool is geregistreerd:
    - Als `part.output` een error-object is (`'error' in part.output`), toon een korte foutmelding (zie hieronder).
    - Anders: render de GenUI-component met `part.output` als props.
  - Als `part.state === 'output-error'`: toon foutweergave (zelfde als hierboven of uitgebreide ChatToolCall).
  - In alle andere gevallen (geen GenUI, loading, etc.): blijf `ChatToolCall` gebruiken.

Geen wijzigingen aan de API of aan de tools zelf; alleen de frontend-rendering wordt uitgebreid.

### 2. GenUI-componenten (eerste fase: detail-tools)

| Tool | Component | Bron / opmerking |
|------|-----------|-------------------|
| `getOpdrachtDetail` | Compacte vacaturekaart (titel, bedrijf, locatie, link naar `/opdrachten/[id]`) | Hergebruik of variant van `JobCard`; tool retourneert job zonder `rawPayload`/`embedding`. |
| `getKandidaatDetail` | Compacte kandidaatkaart (naam, rol, link naar `/professionals/[id]`) | Nieuwe `ChatKandidaatCard` of hergebruik bestaande kandidaat-weergave; tool retourneert candidate object. |
| `getMatchDetail` | Compacte matchkaart (vacaturetitel, kandidaat, score, status, link naar matching) | Nieuwe `ChatMatchCard`; tool retourneert match met job/candidate info. |

Alle drie de tools kunnen `{ error: string }` teruggeven; in de GenUI-component of in de dispatch: als `output && 'error' in output`, toon een korte foutregel (bijv. “Opdracht niet gevonden”) in plaats van de kaart.

### 3. Registratielaag (eenvoudig)

Optie A (aanbevolen): in `chat-messages.tsx` een map of switch op toolnaam → component. Voorbeeld:

```ts
const GENUI_COMPONENTS: Record<string, React.ComponentType<{ output: unknown }>> = {
  getOpdrachtDetail: OpdrachtGenUICard,
  getKandidaatDetail: KandidaatGenUICard,
  getMatchDetail: MatchGenUICard,
};
```

Optie B: apart bestand `components/chat/genui-registry.tsx` dat de map exporteert en de kaart-componenten importeert, zodat `chat-messages.tsx` alleen `renderGenUI(toolName, output)` aanroept.

### 4. Type-safety en error handling

- Kaart-componenten ontvangen `output` als `unknown`; binnen de component met type guard of Zod/Jason parse valideren (bijv. job-achtig object, of `{ error: string }`).
- Bij `output-error` of `output?.error`: toon dezelfde korte fouttekst of een kleine `ToolErrorBlock`-component; vermijd ruwe stack traces in de chat.

### 5. Later (niet in eerste scope)

- queryOpdrachten / zoekKandidaten: lijst van kaarten (zelfde JobCard/KandidaatCard in een grid of stack).
- Mutatie-tools (updateKandidaat, keurMatchGoed, etc.): kunnen generiek blijven met ChatToolCall.

## Technical Considerations

- **part.type / toolnaam:** Controleren hoe de AI SDK 6 in `message.parts` tool parts benoemt (`part.type === 'tool-getOpdrachtDetail'` vs. `toolName` property). Codebase gebruikt nu `getToolName(part)` en `part.toolName`; dispatch moet dezelfde toolnaam gebruiken als key in de registry.
- **Hergebruik:** `JobCard` in `components/job-card.tsx` verwacht een job-achtig object; getOpdrachtDetail retourneert hetzelfde zonder `rawPayload`/`embedding`. Waarschijnlijk direct bruikbaar; eventueel een “compact” variant voor de chat (minder hoogte).
- **Dutch UI:** Alle labels en foutmeldingen in het Nederlands (conform project).
- **Geen RSC:** Geen gebruik van `streamUI` of React Server Components; zie brainstorm (RSC GenUI is gepauzeerd).

## System-Wide Impact

- **Aangepaste bestanden:** `components/chat/chat-messages.tsx` (GenUI-dispatch), eventueel `components/chat/chat-tool-call.tsx` (alleen indien we error-state daar centraliseren).
- **Nieuwe bestanden:** GenUI-kaarten (bijv. `components/chat/genui/opdracht-card.tsx`, `kandidaat-card.tsx`, `match-card.tsx`) en optioneel `genui-registry.tsx`.
- **API / tools:** Geen wijzigingen; bestaande tool return types blijven.

## Acceptance Criteria

- [ ] Voor `getOpdrachtDetail` met succesvolle output wordt in de chat een vacaturekaart getoond (titel, bedrijf, locatie, link naar opdracht) in plaats van alleen JSON.
- [ ] Voor `getKandidaatDetail` met succesvolle output wordt een kandidaatkaart getoond (naam, rol, link naar professional).
- [ ] Voor `getMatchDetail` met succesvolle output wordt een matchkaart getoond (vacature, kandidaat, score/status, link naar matching).
- [ ] Bij tool-output `{ error: "..." }` of `output-error` wordt een duidelijke foutmelding getoond (geen kaart).
- [ ] Tools zonder GenUI-component blijven werken met de bestaande `ChatToolCall` (fallback).
- [ ] Alle nieuwe UI-teksten in het Nederlands.

## Success Metrics

- Gebruikers zien bij “Toon vacature X” / “Geef details van kandidaat Y” direct een kaart met link, zonder JSON open te klappen.
- Geen regressie: bestaande tool-calls (zoals mutaties, zoek-opdrachten) blijven zichtbaar en bruikbaar via ChatToolCall.

## Dependencies & Risks

- **Risico:** Tool-part vorm kan per AI SDK-versie iets verschillen; tijdens implementatie controleren met `part.type` en `part.toolName`/`getToolName(part)`.
- **Afhankelijkheid:** Bestaande `JobCard` en types uit `src/services/jobs` (Job); candidate- en match-types uit candidates/matches services.

## Sources & References

- **Origin brainstorm:** [docs/brainstorms/2026-03-02-genui-chat-brainstorm.md](../brainstorms/2026-03-02-genui-chat-brainstorm.md) — client-side GenUI, detail-tools eerst, fallback ChatToolCall.
- **AI SDK Generative UI:** https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces
- **Bestaande code:** `components/chat/chat-messages.tsx`, `components/chat/chat-tool-call.tsx`, `components/job-card.tsx`, `src/ai/tools/get-opdracht-detail.ts`, `src/ai/tools/kandidaten.ts` (getKandidaatDetail), `src/ai/tools/matches.ts` (getMatchDetail).

## Deepened implementation notes

- **Dispatch location:** In `chat-messages.tsx` at the `isToolUIPart(part)` block (lines 180–200): before rendering `ChatToolCall`, check `toolPart.state === 'output-available'` and whether `name` exists in a `GENUI_COMPONENTS` map; if so and `part.output` is not an error object, render the GenUI component; else keep `ChatToolCall`. Use `name` from `toolPart.toolName ?? getToolName(part)` (camelCase tool names).
- **Error guard:** `const isError = part.output && typeof part.output === 'object' && 'error' in part.output`. If true, render a small inline message (e.g. "Opdracht niet gevonden") or a `ToolErrorBlock` component; do not pass to the card.
- **Opdracht card:** Reuse `JobCard` from `components/job-card.tsx`; it expects `job` with `id`, `title`, `company`, `location`, `platform`, etc. getOpdrachtDetail returns that shape. Wrap in a div with chat-specific margin; ensure dates (e.g. `applicationDeadline`, `postedAt`) are parsed if they come as strings.
- **Kandidaat card:** New file `components/chat/genui/kandidaat-card.tsx`. Props: `output: unknown`. Type guard for `{ id, name, role?, email? }`; link to `/professionals/[id]`. Show name, role, optional email; compact layout similar to JobCard.
- **Match card:** New file `components/chat/genui/match-card.tsx`. getMatchDetail returns match with job/candidate relations or ids; show job title, candidate name, match score/status, link to `/matching?jobId=...` or match detail. Type guard for shape from `getMatchById` return type.
- **Registry:** Define `GENUI_COMPONENTS` in `chat-messages.tsx` (or `components/chat/genui-registry.tsx`) as `Record<string, React.ComponentType<{ output: unknown }>>` with keys `getOpdrachtDetail`, `getKandidaatDetail`, `getMatchDetail`. Import JobCard and the two new cards; JobCard may need a thin wrapper that accepts `output` and passes `output as Job` after guard.
- **Tool part shape (AI SDK 6):** In codebase `part` has `toolName`, `state`, `input`, `output`. `getToolName(part)` from `ai` is already used; ensure registry keys match exact tool names (camelCase) as exported from `src/ai/tools/index.ts`.
