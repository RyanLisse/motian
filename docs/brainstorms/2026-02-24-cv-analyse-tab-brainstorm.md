---
date: 2026-02-24
topic: cv-analyse-tab
---

# CV Analyse Tab — Visuele Kandidaat Matching

## Wat We Bouwen

Een nieuwe **"CV Analyse"** tab op de `/matching` pagina die de huidige lege "CV Beheer" placeholder vervangt. Recruiters droppen een PDF, zien direct visuele match-resultaten tegen alle actieve vacatures, met de mogelijkheid om het originele PDF ernaast te bekijken.

## Waarom Deze Aanpak

Drie aanpakken overwogen:

1. **Nieuwe pagina `/cv-analyse`** — Afgewezen: extra navigatie, splitst matching-flow
2. **Tab op `/matching`** — Gekozen: past in bestaande flow, vervangt lege placeholder, geen nieuwe route
3. **Split-screen overlay** — Afgewezen: te complex, verstoort andere pagina's

## Kernbeslissingen

| Beslissing | Keuze | Rationale |
|---|---|---|
| Locatie | Tab op `/matching` (vervangt "CV Beheer") | Bestaande navigatie, geen nieuwe route |
| Visualisatie | Minimaal + actiegericht | Score, go/no-go, top 3 risico's/sterke punten |
| PDF flow | Drop → match tegen ALLE actieve vacatures | Max waarde per upload |
| PDF viewer | Toggle panel rechts (uitklapbaar) | Analyse = primair, PDF = referentie |
| Opslaan | Altijd als kandidaat in DB | Elke upload maakt/update een kandidaat |
| Geschiedenis | Laatste 10 analyses tonen | Lijst onder drop zone voor terugkijken |

## UX Flow

```
1. Recruiter opent /matching → kiest "CV Analyse" tab
2. Ziet drop zone + lijst van recente analyses
3. Sleept PDF op drop zone
4. Systeem: parse CV → maak/update kandidaat → match tegen alle vacatures
5. Resultaten verschijnen als visuele match-kaarten (gesorteerd op score)
6. Recruiter klikt "Bekijk CV" → PDF panel klapt open rechts
7. Recruiter beoordeelt: [Goedkeuren] [Afwijzen] per match
```

## Visueel Ontwerp

### Match-kaart (per vacature)

```
┌──────────────────────────────────────────────────┐
│  ┌────┐                                          │
│  │ 87 │  ✅ GO    Vacaturetitel                   │
│  │/100│           Bedrijfsnaam                    │
│  └────┘                                          │
│                                                  │
│  ✓ Sterke punten          ✗ Risico's             │
│  • 8 jaar Java ervaring   • Geen AWS certificaat │
│  • HBO Informatica        • Locatie: reistijd    │
│  • Scrum master cert.     • Tarief boven budget  │
│                                                  │
│  [Goedkeuren] [Afwijzen] [Bekijk details →]      │
└──────────────────────────────────────────────────┘
```

### Pagina layout met PDF panel

```
┌─────────────────────────────────────┬────────────────┐
│                                     │                │
│  📥 Drop CV hier (of klik)         │   📄 PDF       │
│  ────────────────────               │   Viewer       │
│  Recente analyses:                  │   (toggle)     │
│  • Jan Jansen — 2 min geleden      │                │
│  • Piet de Vries — 1 uur geleden   │   Pagina 1/3   │
│  ────────────────────               │                │
│  Match resultaten:                  │                │
│  [kaart] [kaart]                    │                │
│  [kaart] [kaart]                    │                │
│                                     │                │
└─────────────────────────────────────┴────────────────┘
```

## Technische Aanpak

### Hergebruik (bestaand)

- `cv-parser.ts` — Gemini CV parsing
- `/api/cv-upload` + `/api/cv-upload/save` — Upload & opslaan
- `auto-matching.ts` — Match candidate → alle jobs
- `CvDocumentViewer` — react-pdf viewer
- `ScoreRing` — Score visualisatie
- `MatchActions` — Goedkeuren/Afwijzen knoppen

### Nieuw te bouwen

| Component | Doel |
|---|---|
| `app/matching/cv-analyse-tab.tsx` | Client component: drop zone + analyse weergave |
| `components/matching/cv-match-card.tsx` | Visuele match-kaart met score, go/no-go, risico's |
| `components/matching/cv-pdf-panel.tsx` | Toggle zijpaneel voor PDF viewer |
| `components/matching/recent-analyses.tsx` | Lijst van recente CV uploads |
| `app/api/cv-analyse/route.ts` | API: parse + save + match in één call |

### Data flow

```
PDF drop
  → POST /api/cv-analyse (nieuw, combineert bestaande services)
    → cv-parser.ts (Gemini parse)
    → kandidaat aanmaken/updaten in DB
    → auto-matching (candidate → alle actieve jobs)
    → return { kandidaat, matches[], fileUrl }
  → Client toont match-kaarten
  → PDF panel gebruikt fileUrl via CvDocumentViewer
```

## Open Vragen

Geen — alle beslissingen zijn genomen.

## Volgende Stappen

→ `/workflows:plan` voor gedetailleerde implementatiestappen
