# Project Ownership Transfer Checklist

> This English checklist and `project-ownership-transfer-checklist.nl.md` should stay functionally equivalent. If one changes, update the other in the same edit.

## 1. Transfer Metadata

- [ ] Transfer date recorded
- [ ] Current technical owner recorded
- [ ] Incoming technical owner recorded
- [ ] Supporting stakeholder or fallback operator recorded
- [ ] Scope confirmed as full project ownership transfer

## 2. Preparation

- [ ] Review `docs/architecture.md`, `docs/slo-and-observability.md`, `docs/autopilot-usage.md`, `docs/autopilot-configuration.md`, `docs/runbooks/platform-onboarding.md`, and `docs/deployment-verification-summary.md`
- [ ] Confirm the new owner has the latest version of this guide and checklist
- [ ] Review the current provider inventory in `.env.example`
- [ ] Confirm repo metadata for Vercel project ownership from `.vercel/project.json`
- [ ] Record current open risks and priority beads:
  - [ ] `motian-n38` Modal scraping stub
  - [ ] `motian-scy` scoring is still too rule-based
  - [ ] `motian-o5g` pagination gap
  - [ ] `motian-uml` per-platform cron expression issue
- [ ] Record any additional transfer-specific risks outside the repo if needed

## 3. Access Migration

- [ ] New owner has admin or equivalent access to GitHub
- [ ] New owner has admin or equivalent access to Vercel project `motian`
- [ ] New owner has the required Neon project access
- [ ] New owner has the required Trigger.dev project access
- [ ] New owner has the required Sentry access
- [ ] New owner has the required PostHog access
- [ ] New owner has AI-provider billing and usage visibility for OpenAI, Google AI, and xAI
- [ ] New owner has access to Browserbase if authenticated scraping depends on it
- [ ] New owner has access to Modal if Vercel-safe scraping depends on it
- [ ] New owner has access to Firecrawl if public scraping depends on it
- [ ] New owner has access to LiveKit if the voice surface is active
- [ ] New owner has access to Slack integrations if notifications are enabled
- [ ] Domain or billing ownership reviewed where applicable

## 4. Secrets and Security

- [ ] Source of truth for secrets has been documented outside the repo if needed
- [ ] New owner knows how `.env.local` is populated for local development
- [ ] New owner knows which values come from `vercel env pull .env.local`
- [ ] New owner knows that Trigger.dev syncs selected env vars from `trigger.config.ts`
- [ ] No secrets were copied into repo documentation during transfer
- [ ] High-risk secrets selected for rotation have been listed
- [ ] Secret rotation has been completed or explicitly scheduled
- [ ] Previous owner access removal plan has been recorded

## 5. Operational Validation

- [ ] New owner can run `pnpm lint`
- [ ] New owner can run `pnpm test`
- [ ] New owner can run `pnpm exec tsc --noEmit`
- [ ] New owner can run `pnpm build`
- [ ] New owner can run `pnpm harness:smoke`
- [ ] New owner can identify production, preview, and rollback paths in Vercel
- [ ] New owner can inspect Trigger.dev runs and schedules
- [ ] New owner can verify `/api/gezondheid`
- [ ] New owner can verify at least one core recruiter flow
  - [ ] `/vacatures`
  - [ ] `/kandidaten`
  - [ ] one of `/chat` or `/scraper`
- [ ] New owner has reviewed scraper/platform onboarding and failure triage
- [ ] New owner understands the optional Typesense search path and PostgreSQL fallback behavior

## 6. Knowledge Transfer Session

- [ ] Architecture walkthrough completed
- [ ] Deployment and rollback walkthrough completed
- [ ] Database, retention, and GDPR responsibilities reviewed
- [ ] Scraper and platform-onboarding risks reviewed
- [ ] Monitoring and incident response expectations reviewed
- [ ] AI-provider cost and usage surfaces reviewed
- [ ] Canonical route and language conventions reviewed
  - [ ] Dutch UI strings
  - [ ] English code variables
  - [ ] preferred user-facing routes `/vacatures` and `/kandidaten`
  - [ ] Dutch API paths such as `/api/gezondheid`
- [ ] Current roadmap and top open priorities reviewed

## 7. First-Week Stabilization

- [ ] Seven-day stabilization window has an owner
- [ ] New owner will monitor Vercel, Trigger.dev, and Sentry during the first week
- [ ] New owner will validate at least one deployment or rollback-safe operational change
- [ ] New owner will confirm ongoing scraper health during the first week
- [ ] New owner will confirm that the previous owner is no longer required for normal operations

## 8. Final Sign-Off

- [ ] New owner confirms access is sufficient
- [ ] New owner confirms they can operate the system without the previous owner
- [ ] Previous owner access has been removed or a removal date is scheduled
- [ ] Secret rotation status is recorded
- [ ] Final sign-off date is recorded
- [ ] Final responsible person is recorded
