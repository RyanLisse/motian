---
date: 2026-03-02
topic: genui-chat
---

# GenUI in de chat (Generative UI)

## What We're Building

**Generative UI (GenUI)** in de Motian AI-chat: wanneer het model een tool aanroept, het **resultaat** niet alleen als JSON in een collapsible blok tonen, maar waar zinvol een **eigen React-component** renderen (bijv. vacaturekaart, kandidaatkaart, matchkaart). De [AI SDK-docs](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces) beschrijven dit patroon: tools returnen data → die data wordt aan een component gegeven → de gebruiker ziet rijke, domeinspecifieke UI in plaats van ruwe JSON.

De bestaande chat gebruikt al `useChat`, `streamText` met tools en `toUIMessageStreamResponse`. Tool-calls worden nu generiek getoond via `ChatToolCall` (label + inklapbare JSON). GenUI voegt daar **per-tool custom components** aan toe voor een betere UX.

**Let op:** Het [Vercel RSC GenUI-template](https://vercel.com/templates/next.js/rsc-genui) gebruikt `streamUI` en React Server Components; de template vermeldt dat *"Development of AI SDK RSC is currently paused"*. We richten ons daarom op **client-side GenUI**: dezelfde `streamText` + tools, maar in de client switch op `part.type === 'tool-<toolName>'` en `part.output` doorgeven aan een React-component. Geen RSC nodig.

## Why This Approach

Drie opties zijn overwogen:

1. **Alleen generieke tool-weergave (huidige staat)** — Alle tools blijven JSON in een collapsible. Geen extra werk, maar weinig visuele waarde voor “detail”-tools (vacature, kandidaat, match).
2. **Client-side GenUI (gekozen)** — Voor gekozen tools een eigen component (bijv. `OpdrachtDetailCard`, `KandidaatDetailCard`) en in `ChatMessages` bij `output-available` die component met `part.output` renderen. Sluit aan bij [AI SDK Generative UI](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces), geen RSC, incrementeel uit te breiden.
3. **RSC / streamUI** — Server Components streamen die direct in de chat worden gerenderd. **Niet gekozen:** AI SDK RSC is op pauze; template en migratiepad zijn onzeker.

GenUI verbetert vooral de ervaring bij **detail-** en **zoek-**tools (getOpdrachtDetail, getKandidaatDetail, getMatchDetail, queryOpdrachten, zoekKandidaten, etc.): kaarten met titel, bedrijf, locatie, link naar detailpagina, in plaats van een blok JSON.

## Key Decisions

| Beslissing | Keuze | Rationale |
|------------|--------|-----------|
| **GenUI-laag** | Client-side, in bestaande chat | Geen RSC/streamUI; bestaande `streamText` + tools + `toUIMessageStreamResponse` blijven. Frontend switcht op tool type en rendert een component. |
| **Plaats in de UI** | Zelfde message/parts-loop als nu | In `ChatMessages`, bij `isToolUIPart(part)`: als er een GenUI-component voor deze tool is en `state === 'output-available'`, die component met `part.output` renderen; anders bestaande `ChatToolCall`. |
| **Welke tools eerst** | Detail-tools + zoek-resultaten | Hoogste impact: getOpdrachtDetail, getKandidaatDetail, getMatchDetail; daarna evt. queryOpdrachten/zoekKandidaten (lijst als kaarten). Mutatie-tools kunnen generiek blijven. |
| **Fallback** | Altijd ChatToolCall als er geen GenUI-component is | Bestaand gedrag blijft; nieuwe components zijn additief. |
| **Type-safety** | Componenten ontvangen tool output-type | Tool return types (bijv. job object van getOpdrachtDetail) als props-type voor de kaart-component; runtime valideren of output past (bijv. error-object). |

## Open Questions

- **Prioriteit tools:** Starten we met alleen getOpdrachtDetail / getKandidaatDetail / getMatchDetail, of meteen ook zoek-resultaten (queryOpdrachten, zoekKandidaten) als kaartenlijst?
- **Foutweergave:** Bij `part.state === 'output-error'` of tool die `{ error: "..." }` teruggeeft: aparte fout-component of uitgebreide ChatToolCall voor errors?

## Next Steps

→ `/workflows:plan` voor implementatiedetails (welke components, wijzigingen in `ChatMessages` en `chat-tool-call.tsx`, eventuele mapping laag voor part.type).
