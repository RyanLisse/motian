# LinkedIn-style skills migratie & backfill runbook

Runbook voor de overstap van ESCO-first skills naar een eenvoudiger
LinkedIn-style skillsmodel met canonical labels/slugs.

## Doel

Deze rollout vervangt ESCO niet in één stap, maar introduceert een nieuwe
canonical skill-laag naast de bestaande tabellen:

- `skills`
- `candidate_skills_v2`
- `job_skills_v2`

De applicatie leest daarna skills via recruiter-vriendelijke labels en slugs,
met exact-match scoring en consistente tags/badges in de UI.

---

## 1. Pre-flight checklist

### 1.1 Code en build

- [ ] Branch bevat de nieuwe schema-definities in `packages/db/src/schema.ts`.
- [ ] Migratiebestand `drizzle/0023_linkedin_skills_v2.sql` staat klaar.
- [ ] Backfill script `scripts/backfill-skills-v2.ts` staat klaar.
- [ ] `pnpm lint` is groen.
- [ ] `pnpm exec tsc --noEmit` is groen.
- [ ] `pnpm test` is groen.
- [ ] `pnpm build` is groen.

### 1.2 Deployment en rollback-afspraak

- [ ] Er is een rollback-owner aangewezen.
- [ ] Je weet hoe je de vorige deployment kunt restoren.
- [ ] Je hebt een onderhoudsvenster of rustige deploy-periode gekozen.

### 1.3 Database veiligheid

- [ ] Maak vóór rollout een verse database backup/snapshot.
- [ ] Controleer dat er geen lopende handmatige migraties openstaan.
- [ ] Controleer dat je write-toegang hebt voor schema + data backfill.

---

## 2. Deploymentvolgorde

### Stap 1 — deploy de code en additive migratie

1. Deploy de code met de nieuwe skill-laag.
2. Voer de migratie uit:

```bash
pnpm db:push
```

Als je de SQL handmatig wilt draaien:

```bash
psql "$DATABASE_URL" -f drizzle/0023_linkedin_skills_v2.sql
```

### Verwachting

Nieuwe tabellen bestaan, maar oude ESCO-tabellen blijven nog intact.

---

## 3. Backfill uitvoeren

### Stap 2 — vul canonical skills vanuit bestaande ESCO-data

Voer het backfill script uit:

```bash
pnpm tsx scripts/backfill-skills-v2.ts
```

### Verwachting

Het script logt JSON met ongeveer deze shape:

```json
{
  "candidateCount": 123,
  "jobCount": 456,
  "skillCount": 78
}
```

### Wat het script doet

- leest bestaande `candidate_skills` + `esco_skills`
- leest bestaande `job_skills` + `esco_skills`
- maakt canonical `skills` records op basis van label/slug
- vult `candidate_skills_v2`
- vult `job_skills_v2`
- laat bestaande ESCO-tabellen ongemoeid

---

## 4. Verificatie na migratie

### 4.1 SQL-checks

```sql
SELECT count(*) AS skills_count FROM skills;
SELECT count(*) AS candidate_skills_v2_count FROM candidate_skills_v2;
SELECT count(*) AS job_skills_v2_count FROM job_skills_v2;
```

Controleer ook unieke canonical labels/slugs:

```sql
SELECT slug, count(*)
FROM skills
GROUP BY slug
HAVING count(*) > 1;
```

Verwachte uitkomst: **0 rijen**.

Controleer de verdeling van must/nice op vacatures:

```sql
SELECT importance, count(*)
FROM job_skills_v2
GROUP BY importance
ORDER BY importance;
```

### 4.2 Spot-check query

```sql
SELECT s.slug, s.name, csv2.source, csv2.raw_label
FROM candidate_skills_v2 csv2
JOIN skills s ON s.id = csv2.skill_id
LIMIT 20;
```

```sql
SELECT s.slug, s.name, jsv2.importance, jsv2.source, jsv2.raw_label
FROM job_skills_v2 jsv2
JOIN skills s ON s.id = jsv2.skill_id
LIMIT 20;
```

### 4.3 Product checks

- [ ] `/vaardigheden` laadt en toont leesbare skill labels.
- [ ] `/kandidaten?vaardigheid=<slug>` filtert op canonical skill slug.
- [ ] `/vacatures?vaardigheid=<slug>` filtert op canonical skill slug.
- [ ] Candidate/job details tonen nog canonical skills in API/AI/MCP surfaces.
- [ ] `/api/vaardigheden?q=react` geeft canonical recruiter-friendly skills terug.
- [ ] `/api/esco/skills` blijft werken als legacy alias.
- [ ] `/api/visualisatie/graph` laadt zonder skill-relatie fouten.

### 4.4 Matching/scoring checks

Controleer een paar matches handmatig:

- [ ] reasoning gebruikt recruiter-taal zoals `3 van 5 vereiste skills matchen`
- [ ] `model` blijft `esco-rule-v1` op canonical skill path
- [ ] er zijn geen ESCO guardrail fallback logs meer nodig voor deze flow

---

## 5. Operationele observability

Tijdens de eerste uren na rollout:

- monitor app logs op query- of join-fouten rond:
  - `skills`
  - `candidate_skills_v2`
  - `job_skills_v2`
- monitor `/vaardigheden`, kandidatenfilters en vacaturefilters
- monitor matching output op onverwachte score-dalingen

Aanbevolen extra query:

```sql
SELECT s.slug, s.name, count(*) AS usage_count
FROM skills s
LEFT JOIN candidate_skills_v2 csv2 ON csv2.skill_id = s.id
GROUP BY s.id, s.slug, s.name
ORDER BY usage_count DESC
LIMIT 50;
```

---

## 6. Rollback

### Scenario A — deploy terug, schema laten staan

Dit is de veiligste rollback.

1. Rol terug naar de vorige app deployment.
2. Laat de nieuwe v2-tabellen staan.
3. Oude ESCO-tabellen blijven beschikbaar, dus de oude code blijft werken.

### Scenario B — backfill mislukte deels

1. Fix de oorzaak.
2. Herstart alleen het backfill script:

```bash
pnpm tsx scripts/backfill-skills-v2.ts
```

Omdat het script `onConflictDoNothing` / idempotente writes gebruikt, is
herhalen veilig.

### Scenario C — expliciet v2-data opschonen

Alleen doen als je de rollout echt volledig moet intrekken.

```sql
TRUNCATE TABLE candidate_skills_v2 RESTART IDENTITY CASCADE;
TRUNCATE TABLE job_skills_v2 RESTART IDENTITY CASCADE;
TRUNCATE TABLE skills RESTART IDENTITY CASCADE;
```

> Dit is destructief voor de nieuwe canonical laag. Doe dit alleen als rollback
> owner en backup bevestigd zijn.

---

## 7. Post-rollout vervolg

Na een stabiele periode kun je fase 2 van cleanup plannen:

- ESCO reads verwijderen uit app/services
- MCP/AI surfaces hernoemen van `esco` naar `skills`
- oude tabellen pas daarna droppen:
  - `esco_skills`
  - `skill_aliases`
  - `candidate_skills`
  - `job_skills`
  - `skill_mappings`

Dat verdient een aparte migratie en aparte validatie-run.

---

## 8. Snelle operator-samenvatting

```bash
# 1. schema toevoegen
pnpm db:push

# 2. canonical skills backfillen
pnpm tsx scripts/backfill-skills-v2.ts

# 3. checks
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
```

Belangrijkste smoke checks:

- `/vaardigheden`
- `/kandidaten?vaardigheid=<slug>`
- `/vacatures?vaardigheid=<slug>`
- `/api/vaardigheden`
- `/api/esco/skills`
- `/api/visualisatie/graph`
