# Agent-Native Platform Onboarding Via Chat

**Datum:** 2026-03-25
**Status:** Brainstorm afgerond — klaar voor planning
**Aanleiding:** Motian heeft al een gedeelde onboarding-flow voor platforms via UI, API, AI, MCP en voice, maar de flow stopt nu effectief zodra een nieuw platform buiten de bestaande adapter-vormen valt. We willen dat chat de primaire ingang wordt waarmee een gebruiker of AI-agent elk recruitmentplatform kan laten onderzoeken, aansluiten, testen, activeren en inplannen.

---

## Wat we bouwen

We bouwen een agent-first chat-workflow waarmee een gebruiker simpelweg een recruitmentsite noemt, waarna de agent het volledige onboarding-resultaat nastreeft: platform analyseren, scraping-aanpak kiezen, credentials opvragen als dat nodig is, een nieuwe of bestaande adapter laten passen, import testen, eerste succesvolle scrapes draaien en het platform plannen voor vervolgruns.

De workflow richt zich op arbitrary recruitment sites, niet alleen platforms die nu al netjes binnen `http_html_list_detail`, `browser_bootstrap_http_harvest` of `api_json` vallen. Als een site binnen bestaande patronen past, gebruikt de agent de bestaande catalog/config/validate/test/activate flow. Als dat niet zo is, moet de agent het gat zelf kunnen dichten door de scraper-capability uit te breiden, te registreren, te testen en daarna alsnog dezelfde onboardingstatus te bereiken. De chat moet onderweg staged visibility geven: onderzoek, haalbaarheid, implementatie, validatie, activatie en monitoring van de eerste runs.

Succes in de chat betekent niet “conceptueel klaar”, maar: de eerste nieuwe scrapes zijn succesvol uitgevoerd en het platform is ingepland voor vervolgruns.

---

## Waarom deze aanpak

We kiezen voor een agent-native aanpak omdat de huidige architectuur al de basis van onboarding deelt tussen UI, chat, MCP, CLI en voice, maar nog geen parity heeft voor het zwaarste deel van het werk. De bestaande tools kunnen wel een platformcatalog-item aanmaken, config opslaan, valideren, smoke import draaien en activeren, maar ze kunnen nog niet zelfstandig browseronderzoek doen, credentials ophalen, nieuwe adapters implementeren of de “needs_implementation”-status omzetten in een werkende integratie.

Dit maakt de huidige flow behulpzaam, maar nog niet echt agent-first. Voor jouw doel is dat gat te groot: de agent moet niet alleen een onboarding-assistent zijn, maar de operator die het hele outcome bereikt. Daarom kiezen we voor een aanpak waarbij de agent bestaande primitives hergebruikt waar mogelijk, maar ook nieuwe primitives krijgt voor browser-analyse, implementation handoff naar code, verificatie en completion. We lenen daarbij de staged zichtbaarheid van een multi-agent workflow, zonder van de gebruiker te vragen om zelf tussen losse systemen te schakelen.

YAGNI blijft wel belangrijk: we bouwen geen generiek “one-click scrape the internet”-platform. We ontwerpen een recruitment-specifieke workflow met duidelijke pauzemomenten wanneer externe input nodig is, zoals credentials, CAPTCHA of juridische goedkeuring.

---

## Belangrijke beslissingen

| Beslissing | Keuze | Reden |
|------------|-------|-------|
| Hoofdingang | Chat is de primaire interface | Sluit aan op “agent first” en maakt onboarding een outcome in plaats van een formulierproces |
| Doelscope | Elk recruitmentplatform dat de gebruiker noemt | De workflow mag niet beperkt blijven tot vooraf ondersteunde boards |
| Autonomie | Agent mag ook nieuwe adapter-code en registry-wijzigingen maken | Anders blijft `needs_implementation` een dood spoor |
| Auth-scope | Zowel publieke als login-protected platforms | Recruitmentsites vereisen vaak sessies, accounts of gated content |
| Credentials | Agent vraagt credentials in chat wanneer nodig | Houdt de flow menselijk, direct en taakgericht |
| Retry-gedrag | Agent blijft nieuwe strategieen proberen tot succes of externe blokkade | Past bij outcome-driven gedrag zonder onbeheersbare infinite loops |
| Success-criterium | Eerste scrape succesvol plus platform ingepland | Zorgt dat “klaar” een operationeel resultaat is |
| UX-model | Staged visibility: research, feasibility, implementation, validation, activation, monitoring | Leent het beste deel van specialist-workflows zonder extra gebruikerscomplexiteit |

---

## Agent-native gaps die we moeten sluiten

| Gebied | Huidige status | Gewenste richting |
|--------|----------------|-------------------|
| Action parity | Chat kan catalog/config/validate/test/activate, maar niet het volledige implementation-pad | Agent moet alles kunnen wat de operator via UI en codebase kan bereiken |
| Browser reconnaissance | Niet aanwezig als onboarding-primitief | Agent moet sites kunnen inspecteren, flows volgen en scraping-shape bepalen |
| Credentials flow | Config kan refs opslaan, maar chat-flow voor credential intake ontbreekt | Agent vraagt gericht om credentials en hervat daarna automatisch |
| Unsupported platforms | Runbook stopt nu bij `needs_implementation` | `needs_implementation` wordt een tussenstatus, geen eindstatus |
| Adapter extensie | Vereist handmatige code- en registry-wijzigingen | Agent moet adapters kunnen toevoegen of aanpassen als onderdeel van de workflow |
| Verification | Smoke import bestaat, maar geen expliciet end-to-end “first successful scrape + scheduled” completion model | Workflow eindigt pas na bewezen eerste runs en scheduling |
| Progress model | Onboardingstatus bestaat, maar is te smal voor self-extending agent loops | Status moet ook research, implementation en blocked-on-input kunnen tonen |
| Testing philosophy | Vooral config/test-import focus | Outcome-tests moeten bewijzen dat agent een nieuw platform echt kan toevoegen en laten draaien |

---

## Resolved Questions

- **Wie voert dit uit?** AI-agents zijn first-class operators binnen deze flow.
- **Mag de agent activeren zonder handmatige finale approval?** Ja, agent-first autonomie is gewenst.
- **Mag de agent ook code implementeren?** Ja, inclusief adapter-code, registry-wijzigingen, tests en werkende activatie.
- **Welke sites vallen binnen scope?** Arbitrary recruitment sites die de gebruiker in chat noemt.
- **Publiek of authenticated?** Beide; de agent vraagt credentials als dat nodig is.
- **Hoe lang blijft de agent proberen?** Doorlopend over meerdere strategieen, totdat succes is bereikt of externe input nodig is.
- **Wanneer is het resultaat geslaagd?** Wanneer de eerste scrapes succesvol zijn uitgevoerd en vervolgruns zijn ingepland.

---

## Open vragen

Geen open vragen op brainstormniveau. De planfase moet wel de exacte capability map, credential-handling, progress states, retry-governance en teststrategie uitschrijven.

---

## Volgende stap

`/prompts:workflows-plan` — werk deze brainstorm uit tot een concreet implementatieplan voor een agent-native platform-onboarding workflow met staged visibility en volledige parity tussen chat, onboardingstatus en scraper-implementatie.
