# Microsoft 365 / Teams setup voor HITL Adaptive Cards

Deze runbook dekt de minimale Teams/Bot Framework-configuratie voor ADR-005 Stage 3.

## Vereiste resources

- Azure Bot resource (Azure AI Bot Service)
- Entra App Registration gekoppeld aan de bot
- Teams app manifest met bot-scope voor team channels

## Benodigde secrets

Zet deze variabelen in de runtime-omgeving:

- `TEAMS_APP_ID`
- `TEAMS_APP_PASSWORD`
- `TEAMS_APP_TENANT_ID` (verplicht bij single-tenant)
- `TEAMS_REVIEW_WEBHOOK_URL` (fallback webhook voor card posting)

## Messaging endpoint

Stel in de Azure Bot resource de endpoint in op:

- `https://<jouw-domein>/api/webhooks/teams-adaptive-card`

## Teams app manifest

Minimaal:

- `bots[].botId = <TEAMS_APP_ID>`
- `bots[].scopes` bevat `team`
- `validDomains` bevat het productie-domein

Upload het manifest als custom app via Teams Admin Center of Developer Portal.

## Functionele validatie

1. Plaats een testcard via `TeamsReviewChannel.postAdaptiveCard`.
2. Klik op **Goedkeuren** of **Afwijzen** in Teams.
3. Controleer dat `POST /api/webhooks/teams-adaptive-card` een 200 teruggeeft.
4. Controleer dat de matchstatus wijzigt en `reviewedBy` het formaat `aad:<id>` bevat.
5. Controleer dat e-mailreview-link fallback ongewijzigd werkt.
