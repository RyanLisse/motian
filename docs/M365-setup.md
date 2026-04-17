# Microsoft 365 setup (ADR-005 Stage 2)

Dit document beschrijft wat STAR IT moet opleveren om `MAIL_PROVIDER=m365` veilig te activeren.

## Vereiste Azure AD app-registratie

1. Maak een app-registratie in de STAR tenant.
2. Voeg **Application permissions** toe:
   - `Mail.Read`
   - `Mail.Send`
   - `Sites.Selected`
   - `offline_access`
3. Geef admin consent voor alle bovenstaande scopes.
4. Maak een client secret met rotatiebeleid (max 90 dagen aanbevolen).

## Vereiste configuratie (environment)

```
MAIL_PROVIDER=m365
M365_TENANT_ID=<tenant-id>
M365_CLIENT_ID=<app-client-id>
M365_CLIENT_SECRET=<client-secret>
M365_WEBHOOK_CLIENT_STATE=<shared-random-secret>
```

## Webhooks en subscriptions

- Configureer een publiek HTTPS endpoint voor Graph notifications.
- Configureer ook een `lifecycleNotificationUrl` endpoint.
- Subscriptions op `/users/{mailbox}/messages` moeten elke 3 dagen vernieuwd worden.
- `clientState` moet exact matchen met `M365_WEBHOOK_CLIENT_STATE`.

## Burn-in plan (switch-over)

1. **Dag 0-2 (shadow mode):**
   - Houd huidige provider actief.
   - Laat `Microsoft365Provider` mee-draaien met mocked/gespiegelde events in testtenant.
2. **Dag 3-5 (canary mailboxes):**
   - Zet `MAIL_PROVIDER=m365` voor 1-2 mailboxen.
   - Controleer subscription renewal, attachment fetches, en sendMail latency.
3. **Dag 6-7 (volledige overgang):**
   - Verhoog naar alle mailboxen.
   - Monitor webhook volume, 4xx/5xx responsen en delivery delay.
4. **Rollback:**
   - Zet `MAIL_PROVIDER=agentmail` terug.
   - Recreate subscriptions nadat incident is opgelost.

## Teststrategie

- Unit tests gebruiken een mocked Graph client.
- Integratietests draaien alleen wanneer `M365_TENANT_ID` is gezet.
