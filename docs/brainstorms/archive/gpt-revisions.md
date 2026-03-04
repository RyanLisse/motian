I’m going to (1) stress-test the plan as written for failure modes + scaling pain, (2) propose a tighter architecture that survives flaky scraping and growing data, and (3) show **git-diff style patches** against your original plan doc.

## High-impact revisions (the “make it bulletproof” pack)

- **Introduce `ScrapeRun` + queue + idempotency + locking** (prevents duplicate runs, thundering herds, and “cron ate my DB” moments)
- **Make ingestion an upsert + versioned change tracking** (your current `onConflictDoNothing()` never refreshes changed jobs)
- **Harden scraping**: session reuse, pagination/scroll loops, artifact capture, dead-letter queue, jittered backoff
- **Search/perf upgrades**: full-text + trigram indexes, remove soft-delete/unique foot-guns, add canonical URL strategy
- **Observability/ops**: structured events, run-level status, alerts, and a replayable “scrape fixture” testing lane
- **AI matching that scales**: embeddings + `pgvector`, model/versioning, human review loop

Below: each change has **rationale + impact + diff**.

---

# 1) Add `ScrapeRun` + queue + idempotency + locking (reliability + cost control)

### What’s wrong today

- `MasterScrape` emits events directly; if configs grow or a run overlaps, you can **double-scrape**, waste Browserbase sessions, and hammer Neon with inserts.
- No single source of truth for a “run” (you record metrics, but not a durable orchestration entity).
- No concurrency guard per platform/config, so one flaky platform can cascade.

### Better architecture

Create a **queue-backed run orchestration**:

- `scrape_runs` (one per trigger)
- `scrape_tasks` (one per platform/searchTerm/page)
- Lock per `configId` so only one task per platform runs at a time.
- **Idempotency key**: e.g. `configId + term + hourBucket` to avoid duplicates.

### Impact

- **Reliability**: prevents overlapping runs + reduces partial states.
- **Performance**: controlled concurrency, fewer redundant DB writes.
- **Cost**: fewer Stagehand logins and fewer Browserbase sessions.

### Diff (plan doc patch)

```diff
diff --git a/2026-02-21-recruitment-platform-brainstorm.md b/2026-02-21-recruitment-platform-brainstorm.md
index 0000000..1111111 100644
--- a/2026-02-21-recruitment-platform-brainstorm.md
+++ b/2026-02-21-recruitment-platform-brainstorm.md
@@ -1,6 +1,6 @@
 # Recruitment Platform — Motia.dev + Drizzle + Neon + Stagehand
@@
-## Slice 1: Striive Scraper (Authenticated) → DB opslaan
+## Slice 1: Striive Scraper (Authenticated) → Queue → DB opslaan

@@
-### 1.1 Database Schema (Drizzle + Neon)
+### 1.1 Database Schema (Drizzle + Neon) + Run Orchestration

@@
 export const scrapeResults = pgTable("scrape_results", {
   // PRD 7.1: ScrapeResult entity
@@
 }));
+
+// NEW: durable orchestration
+export const scrapeRuns = pgTable("scrape_runs", {
+  id: uuid("id").primaryKey().defaultRandom(),
+  trigger: text("trigger").notNull(), // cron | manual | api
+  requestedAt: timestamp("requested_at").defaultNow(),
+  status: text("status").notNull().default("queued"), // queued | running | success | partial | failed
+  startedAt: timestamp("started_at"),
+  finishedAt: timestamp("finished_at"),
+  traceId: text("trace_id"),
+});
+
+export const scrapeTasks = pgTable("scrape_tasks", {
+  id: uuid("id").primaryKey().defaultRandom(),
+  runId: uuid("run_id").references(() => scrapeRuns.id, { onDelete: "cascade" }),
+  configId: uuid("config_id").references(() => scraperConfigs.id, { onDelete: "set null" }),
+  platform: text("platform").notNull(),
+  url: text("url").notNull(),
+  idempotencyKey: text("idempotency_key").notNull(),
+  status: text("status").notNull().default("queued"), // queued | running | success | failed
+  attempts: integer("attempts").notNull().default(0),
+  lockedAt: timestamp("locked_at"),
+  lastError: text("last_error"),
+  createdAt: timestamp("created_at").defaultNow(),
+}, (t) => ({
+  uqIdempotency: uniqueIndex("uq_scrape_tasks_idempotency").on(t.idempotencyKey),
+  runIdx: index("idx_scrape_tasks_run").on(t.runId),
+  platformIdx: index("idx_scrape_tasks_platform").on(t.platform),
+}));

@@
-**`steps/scraper/master-scrape.step.ts`** — Cron Step
+**`steps/scraper/master-scrape.step.ts`** — Cron Step (enqueue tasks)

@@
-export const config: CronConfig = {
+export const config: CronConfig = {
   type: "cron",
   name: "MasterScrape",
@@
-  emits: ["platform.scrape"],
+  emits: ["scrape.run.requested"],
   flows: ["recruitment-scraper"],
 };

-export const handler: Handlers["MasterScrape"] = async ({ emit, logger }) => {
+export const handler: Handlers["MasterScrape"] = async ({ emit, logger, traceId }) => {
   logger.info("Master scrape gestart");
-  await emit({ topic: "platform.scrape", data: { platform: "striive", url: "https://striive.com/nl/opdrachten" }});
+  await emit({ topic: "scrape.run.requested", data: { trigger: "cron", traceId }});
   logger.info("Scrape run request geemit");
 };
+
+// NEW steps:
+// - steps/scraper/run-create.step.ts       (create scrape_runs row)
+// - steps/scraper/task-enqueue.step.ts     (expand configs/searchTerms into scrape_tasks)
+// - steps/scraper/task-dispatch.step.ts    (claim+lock next task and emit platform.scrape with taskId/runId)
```

---

# 2) Change ingestion from “insert-only” to **upsert + revive soft-deleted** + optional versioning

### What’s wrong today

Your `NormalizeJobs` does:

- `onConflictDoNothing()` so if a job changes (title/rate/description), you **never update it**.
- Soft delete + `externalUrl.unique()` can become a trap: job disappears then reappears -> unique constraint may block reinsertion or keep stale data.

### Better approach

- Use `onConflictDoUpdate` with target `(platform, externalId)`.
- Update mutable fields + set `deletedAt = null` when seen again.
- Optionally keep `job_versions` for historical diffing (super useful for recruiters).

### Impact

- **Data correctness**: always reflects latest listing.
- **UX**: users trust the platform more when the detail page matches reality.
- **Auditability** (if versioning): see what changed, when.

### Diff

```diff
diff --git a/2026-02-21-recruitment-platform-brainstorm.md b/2026-02-21-recruitment-platform-brainstorm.md
index 1111111..2222222 100644
--- a/2026-02-21-recruitment-platform-brainstorm.md
+++ b/2026-02-21-recruitment-platform-brainstorm.md
@@
 export const jobs = pgTable(
   "jobs",
   {
@@
-    externalUrl: text("external_url").unique(),
+    externalUrl: text("external_url"),
@@
     deletedAt: timestamp("deleted_at"), // soft-delete
@@
   (table) => ({
     platformExternalIdx: uniqueIndex("uq_platform_external_id").on(table.platform, table.externalId),
+    // Optional: prevent duplicate URLs per platform (URL formats differ across platforms)
+    platformUrlIdx: uniqueIndex("uq_platform_external_url").on(table.platform, table.externalUrl),
@@
   }),
 );

@@
-      const result = await db
-        .insert(jobs)
-        .values(batch.map((item) => ({ ...item.parsed, platform: input.platform, rawPayload: item.raw })))
-        .onConflictDoNothing()
-        .returning({ id: jobs.id });
+      const result = await db
+        .insert(jobs)
+        .values(batch.map((item) => ({ ...item.parsed, platform: input.platform, rawPayload: item.raw })))
+        .onConflictDoUpdate({
+          target: [jobs.platform, jobs.externalId],
+          set: {
+            title: sql`excluded.title`,
+            company: sql`excluded.company`,
+            location: sql`excluded.location`,
+            province: sql`excluded.province`,
+            rateMin: sql`excluded.rate_min`,
+            rateMax: sql`excluded.rate_max`,
+            currency: sql`excluded.currency`,
+            description: sql`excluded.description`,
+            requirements: sql`excluded.requirements`,
+            contractType: sql`excluded.contract_type`,
+            postedAt: sql`excluded.posted_at`,
+            scrapedAt: sql`now()`,
+            deletedAt: sql`null`,
+            rawPayload: sql`excluded.raw_payload`,
+          },
+        })
+        .returning({ id: jobs.id });
```

---

# 3) Scraping hardening: pagination/scroll, session reuse, artifacts, DLQ, jittered backoff

### What’s wrong today

- Striive extraction is “all visible jobs on the page” and stops. No pagination, no scroll strategy.
- Retry uses fixed sleep; no jitter and no per-error classification.
- If extraction fails, you emit empty listings (good for pipeline continuity), but you lose the **forensics**: no HTML snapshot, no screenshot, no extracted JSON dump.

### Better approach

- Add config-driven extraction strategy:
  - `maxPages`, `scrollMode`, `detailPageMode`

- Store scrape artifacts:
  - `scrape_artifacts` table: `html`, `screenshotUrl`, `extractedJson`, `selectorHints`

- Add dead-letter queue:
  - failed tasks beyond retries go to `scrape_task_failures` with reason + last artifacts

- Add exponential backoff with jitter + time budget per task.

### Impact

- **Reliability**: fewer silent partials.
- **Debug speed**: reproduce failures locally using saved artifacts.
- **Performance**: session reuse avoids login every run.

### Diff

```diff
diff --git a/2026-02-21-recruitment-platform-brainstorm.md b/2026-02-21-recruitment-platform-brainstorm.md
index 2222222..3333333 100644
--- a/2026-02-21-recruitment-platform-brainstorm.md
+++ b/2026-02-21-recruitment-platform-brainstorm.md
@@
 export const scraperConfigs = pgTable("scraper_configs", {
@@
-  parameters: jsonb("parameters").default({}), // selectors, search terms, etc.
+  parameters: jsonb("parameters").default({}), // selectors, search terms, paging strategy, etc.
@@
 });
+
+// NEW: forensic artifacts + DLQ
+export const scrapeArtifacts = pgTable("scrape_artifacts", {
+  id: uuid("id").primaryKey().defaultRandom(),
+  taskId: uuid("task_id").references(() => scrapeTasks.id, { onDelete: "cascade" }),
+  capturedAt: timestamp("captured_at").defaultNow(),
+  html: text("html"),
+  extractedJson: jsonb("extracted_json"),
+  screenshotUrl: text("screenshot_url"),
+});
+
+export const scrapeTaskFailures = pgTable("scrape_task_failures", {
+  id: uuid("id").primaryKey().defaultRandom(),
+  taskId: uuid("task_id").references(() => scrapeTasks.id, { onDelete: "cascade" }),
+  reason: text("reason").notNull(),
+  lastError: text("last_error"),
+  createdAt: timestamp("created_at").defaultNow(),
+});

@@
 **`steps/scraper/platforms/striive.step.ts`**
@@
-  const MAX_RETRIES = 2;
+  const MAX_RETRIES = 3;
+  const MAX_PAGES = Number((input.parameters?.maxPages ?? 3));
@@
-  while (attempt <= MAX_RETRIES) {
+  while (attempt <= MAX_RETRIES) {
     try {
@@
-    // Stap 3: Extraheer opdrachten
-    const result = await stagehand.extract({ instruction: "...", schema: z.object({ opdrachten: z.array(...) }) });
+    // Stap 3: Paginated/scroll extraction loop (robuster dan "zichtbaar op 1 pagina")
+    const all: any[] = [];
+    for (let page = 1; page <= MAX_PAGES; page++) {
+      const result = await stagehand.extract({ instruction: "... (pagina/scroll aware) ...", schema: z.object({ opdrachten: z.array(...) }) });
+      all.push(...(result.opdrachten ?? []));
+      const hasNext = await stagehand.page.locator('button:has-text("Volgende")').isVisible().catch(() => false);
+      if (!hasNext) break;
+      await stagehand.page.click('button:has-text("Volgende")');
+      await stagehand.page.waitForLoadState("networkidle");
+    }
@@
-    const listings = result.opdrachten || [];
+    const listings = all;
@@
-      } else {
-        logger.warn(`Striive scrape poging ${attempt} mislukt, retry in 5s: ${err}`);
-        await new Promise((r) => setTimeout(r, 5_000));
-      }
+      } else {
+        const base = 1200 * Math.pow(2, attempt);
+        const jitter = Math.floor(Math.random() * 500);
+        const delay = base + jitter;
+        logger.warn(`Striive scrape poging ${attempt} mislukt, retry in ${delay}ms: ${err}`);
+        await new Promise((r) => setTimeout(r, delay));
+      }
     }
   }
```

---

# 4) Fix search + indexing + soft-delete uniqueness (performance + correctness)

### What’s wrong today

- Only indexes `title` btree; search uses `ilike(title, %zoek%)`, which gets slow with growth.
- `externalUrl` unique + soft-delete can create resurrection issues (and URLs aren’t always stable).
- No full-text search across description/requirements.

### Better approach

- Add `pg_trgm` + trigram GIN for fuzzy title search.
- Add `tsvector` index for full-text over title+description.
- Make URL uniqueness platform-scoped or partial, not global.
- Add “canonical URL” normalization in adapters.

### Impact

- **Snappy UI** at 50k+ rows.
- Better recall for search (typos, partials).
- Fewer constraint edge cases.

### Diff

````diff
diff --git a/2026-02-21-recruitment-platform-brainstorm.md b/2026-02-21-recruitment-platform-brainstorm.md
index 3333333..4444444 100644
--- a/2026-02-21-recruitment-platform-brainstorm.md
+++ b/2026-02-21-recruitment-platform-brainstorm.md
@@
 ### 1.1 Database Schema (Drizzle + Neon)
+> NEW: enable Postgres extensions in Neon:
+> - pg_trgm (fast fuzzy search)
+> - (optional later) pgvector (embeddings)
+
+```sql
+create extension if not exists pg_trgm;
+```
@@
 export const jobs = pgTable(
@@
   (table) => ({
@@
-    titleSearchIdx: index("idx_jobs_title").on(table.title),
+    // Keep btree for sorts, add trigram index for ilike/typo search (via migration)
+    titleBtreeIdx: index("idx_jobs_title_btree").on(table.title),
     platformIdx: index("idx_jobs_platform").on(table.platform),
@@
   }),
 );
+
+// Migration note (SQL) for trigram + full text:
+// create index idx_jobs_title_trgm on jobs using gin (title gin_trgm_ops);
+// create index idx_jobs_fts on jobs using gin (to_tsvector('dutch', coalesce(title,'') || ' ' || coalesce(description,'')));
````

---

# 5) Observability: run-level status, alerts, and “replayable adapter tests”

### What’s wrong today

You have decent logging + metrics emission, but:

- No run summary state machine (queued/running/success/partial/failed).
- No alerting policy (e.g., “Striive failed 3 times”).
- Contract tests exist, but scraper tests still depend on live websites.

### Better approach

- Update `scrape_runs` status as tasks execute.
- Add “health” endpoint `/api/gezondheid` and per-platform error budget.
- Add **fixture-based tests**: store HTML snapshots in `tests/fixtures/striive/*.html` and run extraction logic against them.

### Impact

- **Operator confidence**: you can answer “is the pipeline healthy?” in one glance.
- **Faster dev**: tests don’t rely on the internet.
- **Lower risk**: changes to selectors don’t break production silently.

### Diff

```diff
diff --git a/2026-02-21-recruitment-platform-brainstorm.md b/2026-02-21-recruitment-platform-brainstorm.md
index 4444444..5555555 100644
--- a/2026-02-21-recruitment-platform-brainstorm.md
+++ b/2026-02-21-recruitment-platform-brainstorm.md
@@
 tests/
 ├── job-schema.test.ts
 ├── striive-adapter.test.ts
 ├── normalize.test.ts
+├── fixtures/
+│   └── striive/
+│       ├── page1.html
+│       └── page2.html
+└── striive-extract-from-fixture.test.ts

@@
 ## Slice 2: Scraper Dashboard + Config in DB
+### NEW: Health + Alerts
+- `steps/api/gezondheid.step.ts` — GET /api/gezondheid (overall + per-platform)
+- Alert policy (MVP): if `failed` 3x in last 24h → show banner in dashboard + mark config as "needs attention"
```

---

# 6) AI Matching that doesn’t melt: embeddings + `pgvector`, model/versioning, human review loop

### What’s wrong today

Slice 5 is placeholder-level (score=85), and even when implemented:

- Pure LLM grading per job/candidate is expensive and slow at scale.
- No `modelVersion`, no prompt/version control, no review workflow.

### Better approach

Two-stage matching:

1. **Retrieve**: embeddings similarity to shortlist jobs (fast)
2. **Re-rank**: LLM grading on shortlist only (cheap-ish)
   Store:

- `embedding` vectors for jobs + candidates
- `model`, `promptVersion`, `gradedAt`, `confidence`
  Add UI:
- “approve/reject” match, “why” reasoning, feedback loop.

### Impact

- **Performance**: milliseconds for shortlist, seconds for final grading (vs minutes).
- **Cost**: LLM calls reduced by 10–100×.
- **Trust**: explainability + review.

### Diff

```diff
diff --git a/2026-02-21-recruitment-platform-brainstorm.md b/2026-02-21-recruitment-platform-brainstorm.md
index 5555555..6666666 100644
--- a/2026-02-21-recruitment-platform-brainstorm.md
+++ b/2026-02-21-recruitment-platform-brainstorm.md
@@
 ## Slice 5: AI Grading + Matching
@@
 ### 5.1 Nieuwe tabellen
@@
 export const jobMatches = pgTable("job_matches", {
@@
-  matchScore: integer("match_score"), // 0-100
-  reasoning: text("reasoning"),
+  matchScore: integer("match_score"), // 0-100
+  reasoning: text("reasoning"),
+  model: text("model"),               // e.g. gpt-5, o4-mini, etc.
+  promptVersion: text("prompt_version"),
+  confidence: integer("confidence"),  // 0-100
   gradedAt: timestamp("graded_at").defaultNow(),
 });
+
+// NEW: embeddings (requires pgvector extension)
+// create extension if not exists vector;
+export const jobEmbeddings = pgTable("job_embeddings", {
+  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }),
+  embedding: text("embedding").notNull(), // store as vector in real impl; doc-level placeholder
+  createdAt: timestamp("created_at").defaultNow(),
+});
+
+export const candidateEmbeddings = pgTable("candidate_embeddings", {
+  candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "cascade" }),
+  embedding: text("embedding").notNull(),
+  createdAt: timestamp("created_at").defaultNow(),
+});
@@
 ### 5.2 AI Grading Step
+NEW pipeline:
+- `jobs.embed` (create/update job embeddings on ingest)
+- `candidates.embed` (create/update candidate embeddings on edit/import)
+- `matches.retrieve` (vector similarity shortlist)
+- `jobs.grade` (LLM rerank shortlist + explainability)
+- `matches.review` (human-in-the-loop approve/reject + feedback)
```

---

## Quick “plan consistency” fixes you should apply

These are smaller, but they prevent future confusion:

1. The doc has a mismatch around `configId onDelete` (“restrict” mentioned, but code shows `set null`). Make the narrative match the code or vice versa.
2. Standardize endpoint naming: you have both `/api/scrape-results` and `/api/scrape-resultaten` mentioned; pick one (you said Dutch endpoints are required).
3. In UI, `Switch checked={config.isActive}` is rendered but not wired to an API action. Agent-native parity says every UI action must have an API step; add `PATCH /api/scraper-configuraties/:id` for toggling.

---

## If you want one “most compelling feature” to add

Add a **Scrape Sandbox** page:

- paste a URL or select config
- run scrape once
- show extracted JSON, raw HTML snapshot, and a “promote to adapter rules” button
  This makes onboarding new platforms dramatically faster and turns the system into a platform, not a one-off scraper.

If you want, I can produce a single consolidated **updated plan doc** (same style as yours) with these changes already integrated end-to-end.
