---
date: 2026-03-06
topic: kandidaten-matching-flow
---

# Kandidaten Matching Flow

## What We're Building
We willen één duidelijke kandidaat-gedreven flow voor intake, matching en koppeling. De primaire werkplek wordt een centrale matching-inbox waarin kandidaten het leidende object zijn. Recruiters starten vanuit een CV-upload of handmatige invoer, waarna het systeem direct een kandidaatprofiel opbouwt met expliciete hard skills, soft skills en scores per skillcluster.

Na intake toont het systeem meteen de top 5 best passende opdrachten, inclusief een duidelijke aanbeveling voor de beste match. De recruiter kan vervolgens handmatig koppelen of via een snelle auto-koppelactie direct de nummer 1 match bevestigen. De kandidaat komt altijd in de talentpool terecht. Zodra een match wordt gekoppeld, verschijnt de kandidaat ook direct in de pipeline.

## Why This Approach
We hebben drie richtingen verkend: een centrale matching-inbox, matching in het bestaande kandidatenoverzicht, en een split tussen triage en detail. De centrale inbox met kandidaten als hoofdeenheid sluit het best aan op de gewenste hoofdflow: eerst kandidaat opbouwen, dan opdrachten beoordelen, dan koppelen.

Deze richting houdt de flow eenvoudig genoeg voor recruiters. Intake, profielverrijking en matchbeoordeling voelen als één proces, terwijl de matching-inbox ook later bruikbaar blijft als vaste werkplek. Zo vermijden we dat matching verspreid blijft over losse pagina's zonder één duidelijke bron van actie.

## Key Decisions
- Primaire werkplek is de centrale matching-inbox: matching wordt geen losse bijfunctie op vacature- of profielpagina's, maar een vaste recruiterflow.
- De inbox is kandidaat-gedreven: recruiters bekijken per kandidaat de aanbevolen opdrachten, niet andersom.
- Een kandidaat bestaat direct na intake: matching is een vervolgstap, niet een voorwaarde om de kandidaat op te slaan.
- De intakeflow verrijkt direct het profiel: CV-upload of handmatige invoer moet meteen leiden tot profielopbouw met hard skills, soft skills en scores.
- Het systeem toont direct de top 5 matches: recruiters hoeven niet eerst apart naar een ander scherm om de eerste matches te zien.
- Het systeem geeft één expliciete aanbeveling: de beste match wordt uitgelicht als aanbevolen optie.
- Er is een auto-koppelactie voor alleen de nummer 1 match: dit versnelt de workflow zonder meerdere pipeline-items automatisch aan te maken.
- Recruiters kunnen ook handmatig kiezen uit de top 5: automatische aanbeveling vervangt menselijke controle niet.
- De kandidaat komt altijd in de pool: talentpool blijft de bron van waarheid voor alle kandidaten.
- Koppelen betekent direct naar de pipeline: zodra een recruiter bevestigt, wordt de kandidaat niet alleen gelinkt maar ook operationeel in de pipeline geplaatst.
- Kandidaten blijven zichtbaar in de inbox: de inbox is een blijvende werkplek en geen eenmalige afwerkbak.
- De statusindeling van de inbox is: `Open`, `In behandeling`, `Gekoppeld`, `Geen match`.
- `In behandeling` betekent dat matching loopt of heeft gelopen en de kandidaat wacht op recruiterbeoordeling.
- Bij geen goede match krijgt de kandidaat expliciet de status `Geen match`: dit voorkomt stille uitval.
- Bij `Geen match` moet handmatige opdrachtselectie mogelijk zijn: recruiters moeten alsnog kunnen koppelen buiten de automatische top 5 om.
- De flow is hybride: top 5 matches worden direct getoond in de intakeflow en blijven later terug te vinden in de matching-inbox.

## Resolved Questions
- Hoofdroute: centrale matching-inbox in plaats van kandidaat- of vacaturedetail als primaire plek.
- Leidend object: kandidaat in plaats van matchvoorstel of opdracht.
- Moment waarop een kandidaat “binnen” is: direct na intake.
- Belangrijkste recruiteractie in de inbox: koppelen, niet afwijzen/snoozen of uitgebreide opvolgacties.
- Effect van koppelen: direct doorzetten naar de pipeline.
- Gedrag bij geen goede match: kandidaat blijft zichtbaar met expliciete status en handmatige escape hatch.
- Levensduur in inbox: kandidaat blijft zichtbaar, ook na eerdere acties.
- Inboxstatussen: `Open`, `In behandeling`, `Gekoppeld`, `Geen match`.
- Betekenis van `In behandeling`: matching wacht op recruiterbeoordeling.
- Gedrag van aanbeveling: recruiter kan handmatig bevestigen of één topmatch auto-koppelen.
- Plaats van eerste matchreview: direct in intake én later opnieuw in de inbox.

## Next Steps
→ `/prompts:workflows-plan` voor de uitwerking van schermen, systeemgedrag, API-routes en gefaseerde implementatie.
