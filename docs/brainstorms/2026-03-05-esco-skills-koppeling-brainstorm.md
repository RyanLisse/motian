date: 2026-03-05
topic: esco-skills-koppeling

# ESCO Skills Koppeling

## What We're Building
We bouwen een ESCO-gedreven skilllaag die alle skill-invoer in het platform normaliseert naar canonieke ESCO-concepten (URI-gebaseerd), en die laag direct inzet als leidende factor in matching en ranking.

Scope fase 1 is breed: skill-invoer uit kandidaatprofielen (CV, handmatige invoer, LinkedIn), vacatures, en chat/agent-tooling valt allemaal onder dezelfde mapping- en scoringketen.

De recruiter-UX wordt in dezelfde fase aangepast: filters, suggesties en match-uitleg werken op canonieke skills in plaats van losse vrije tekst. Onzekere mappings gaan alleen naar review wanneer de skill functioneel kritisch is (bijv. knock-out/vereist).

## Why This Approach
We kiezen voor een pragmatische “direct value” route: ESCO-score wordt leidend vanaf fase 1, maar met guardrails.

Dit sluit aan op de productdoelstelling (hogere top-match precisie) én voorkomt dat we te lang in parallelle systemen blijven hangen. Tegelijk beperken guardrails regressierisico: bij lage confidence op kritieke paden gebruiken we gecontroleerde fallback in plaats van onverklaarbare mis-ranking.

YAGNI: we vermijden in fase 1 brede governance-uitbouw of volledige taxonomie-automatisering. Focus ligt op end-to-end waarde: canonieke mapping, rankingimpact, en recruiter-bruikbaarheid.

## Key Decisions
- ESCO is de canonieke skill-representatie; vrije skilltekst blijft alleen als bron/evidence.
- Ranking schakelt in fase 1 over naar ESCO-first (niet shadow-only).
- Scope omvat kandidaten, vacatures én chat/agent-ingangen.
- Review queue geldt alleen voor onzekere mappings op kritieke skills.
- Primair succescriterium voor 4-6 weken: hogere precisie in top-matches.
- UX gebruikt canonieke skills voor zoeken/filteren/suggesties/uitlegbaarheid.
- Guardrails blijven verplicht bij lage confidence in kritieke matchlogica.

## Resolved Questions
- Doelgebied ESCO: zowel matching als recruiter UX.
- Fase 1 scope: volledige skill-keten (kandidaten, vacatures, chat/tools).
- Onzekere mappings: alleen human review voor kritieke skills.
- KPI-prioriteit: precisie van top-matches boven snelheid/uitlegbaarheid.
- Uitrolrisico: directe ranking switch, maar met fallback-guardrails (Approach A).

## Open Questions
- Geen open productvragen op dit moment.

## Next Steps
→ `/prompts:workflows-plan` om dit om te zetten naar concrete implementatiestappen, datamodel-wijzigingen, migratiepad, en acceptatiecriteria.
