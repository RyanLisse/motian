# ESCO staging & rollback validatie — runbook

Runbook voor staging-validatie en rollback van ESCO-first skill scoring.

## 1. Pre-deploy (staging) validatie

### 1.1 Configuratie

- [ ] `USE_ESCO_SCORING` staat in staging (bijv. `true` of `1`).
- [ ] `ESCO_CRITICAL_REVIEW_THRESHOLD` optioneel (default 0.7).
- [ ] ESCO-dataset geïmporteerd: `esco_skills` en `skill_aliases` gevuld (bijv. `pnpm run scripts/import-esco-skills.ts` of ingestelde job).

### 1.2 Staging-checks

| Check | Commando / actie | Verwachting |
|-------|------------------|-------------|
| Observability endpoint | `GET /api/esco/observability` | 200, body met `mapping` en `reviewQueue`. |
| Skills voor filter | `GET /api/esco/skills` | 200, array van `{ uri, labelNl, labelEn }`. |
| Rollout snapshot artefact | `pnpm metrics:esco-rollout` | Schrijft `docs/metrics/esco-rollout-snapshot-latest.json` met modelverdeling, fallback-count, backlog en p50/p95 snapshots. |
| p95 regressiecheck | `pnpm metrics:esco-rollout:compare docs/metrics/esco-rollout-snapshot-YYYY-MM-DD.json` | Exit code `0` als gedeelde scenario's niet meer dan 15% verslechteren op `p95`. |
| Kandidaten met ESCO-filter | Open `/professionals?vaardigheid=<uri>` | Pagina laadt, alleen kandidaten met die skill. |
| Opdrachten met ESCO-filter | Open `/opdrachten?vaardigheid=<uri>` | Lijst laadt, alleen opdrachten met die canonieke skill. |
| Auto-match met ESCO | Trigger auto-match (job → kandidaten of omgekeerd). | Match-records hebben `model: "esco-hybrid-v1"` en `reasoning` gevuld. |
| Guardrail zichtbaar | Indien lage confidence: reasoning bevat fallback-tekst. | Geen crash; legacy skill score gebruikt. |

### 1.3 Queries (optioneel, direct op DB)

```sql
-- Aantal mappings en review-queue
SELECT
  (SELECT count(*) FROM skill_mappings) AS total_mappings,
  (SELECT count(*) FROM skill_mappings WHERE sent_to_review = true AND (review_status IS NULL OR review_status = 'pending')) AS review_pending;

-- Aantal kandidaten/opdrachten met ≥1 canonical skill
SELECT
  (SELECT count(DISTINCT candidate_id) FROM candidate_skills) AS candidates_with_esco,
  (SELECT count(DISTINCT job_id) FROM job_skills) AS jobs_with_esco;
```

## 2. Rollback (uitschakelen ESCO-first scoring)

### 2.1 Alleen configuratie (geen code-deploy)

1. Zet **`USE_ESCO_SCORING`** uit:
   - `USE_ESCO_SCORING=false` of verwijder de variabele.
2. Herstart de app (of wacht op volgende cold start) zodat env opnieuw wordt geladen.
3. Controle: voer opnieuw een auto-match uit; match moet `model: "rule-based-v1"` of `"hybrid-v1"` hebben (geen `esco-hybrid-v1`).

### 2.2 Geen code changes nodig

- Rollback is **alleen via config**; er is geen code-change of feature-flag in de applicatielaag nodig.
- Bestaande data (`candidate_skills`, `job_skills`, `skill_mappings`) blijft staan; kan later weer gebruikt worden door opnieuw `USE_ESCO_SCORING=true` te zetten.

## 3. Post-release KPI-checks (4–6 weken)

- **Precision@3**: vergelijk top-3 matches vóór en na ESCO-cutover (baseline vs esco-hybrid-v1).
- **Snapshot artifact**: sla `docs/metrics/esco-rollout-snapshot-latest.json` op als gedateerde baseline/post-cutover artefact (`esco-rollout-snapshot-YYYY-MM-DD.json`) voor vergelijking.
- **Latency diff**: run `pnpm metrics:esco-rollout:compare <baseline>` tegen het laatste artefact en bewaar de output bij de release-notes.
- **Guardrail-fallback rate**: log/metric `esco.guardrail_fallback` of reasoning met fallback-tekst; streef naar dalend percentage in de eerste weken.
- **Review queue**: mediane doorlooptijd van `skill_mappings` met `sent_to_review = true` tot afhandeling.
- **Observability**: `GET /api/esco/observability` gebruiken voor mapping-stats en review-backlog in dashboards.

## 4. Contact / escalatie

- Eigenaar rollback: team dat deployment en config beheert.
- Bij onverwacht gedrag na rollback: controleer of geen andere env (bijv. `ESCO_SCORING_ENABLED`) ESCO opnieuw inschakelt; zo ja, uitzetten of documenteren.
