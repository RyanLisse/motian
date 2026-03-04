# Recruitment Platform Brainstorm - Architectural Revisions & Enhancements

After a comprehensive review of the `2026-02-21-recruitment-platform-brainstorm.md` plan, I've identified several areas to improve the architecture, scalability, performance, and security of the system.

Here is my detailed analysis and proposed revisions with git-diff style changes against the original plan.

---

## 1. Vector Search for AI Matching (Performance & Scalability)

**Analysis & Rationale:**
In Slice 5, the current plan dictates fetching a job and candidate from the database and running an AI inference to grade them. For a platform with thousands of jobs and candidates, doing this pairwise matching on-the-fly (`O(N*M)`) via an LLM is astronomically expensive and unscalably slow.
**Improvement:**
We should introduce `pgvector` into the Neon database. When jobs are normalized (Slice 1) and candidates are added (Slice 5), we should asynchronously generate and store text embeddings of their descriptions/profiles. Matching then becomes a sub-millisecond vector similarity search in PostgreSQL, returning the top 50 candidates/jobs. Only these top results are then passed to the LLM for the intensive "grading/reasoning" step (Reranking).

**Git-Diff Change:**

```diff
--- a/src/db/schema.ts
+++ b/src/db/schema.ts
@@ -8,6 +8,7 @@
   integer,
   uuid,
   uniqueIndex,
+  vector,
 } from "drizzle-orm/pg-core";

 export const jobs = pgTable(
@@ -28,6 +29,7 @@
     scrapedAt: timestamp("scraped_at").defaultNow(),
     deletedAt: timestamp("deleted_at"), // PRD 7.2: soft-delete
     rawPayload: jsonb("raw_payload"),
+    embedding: vector("embedding", { dimensions: 1024 }), // e.g. Cohere V3/V4
   },
--- a/Slice 5
+++ b/Slice 5
@@ -10,6 +10,7 @@
   experience: jsonb("experience").default([]),
   preferences: jsonb("preferences").default({}),
   resumeUrl: text("resume_url"),
+  embedding: vector("embedding", { dimensions: 1024 }),
   createdAt: timestamp("created_at").defaultNow(),
   deletedAt: timestamp("deleted_at"), // PRD A.5: soft-delete
 });
@@ -35,9 +36,11 @@
 export const handler: Handlers["GradeJob"] = async (
   input,
   { emit, logger },
 ) => {
-  // Haal job + kandidaat op uit DB
-  // Roep AI inference aan (bijv. via Motia's eigen LLM integratie of externe API)
+  // 1. Haal jobs op via pgvector similarity search (<=>)
+  // 2. Filter top 50 matches met hoogste Cosine Similarity score
+  // 3. Roep LLM aan ALleen voor de top resultaten om diepe reasoning te genereren
   // Sla match score op
   // Emit resultaat
```

## 2. Full-Text Search and Indexing (Performance)

**Analysis & Rationale:**
Currently, `jobs-list.step.ts` uses `ilike(jobs.title, \`%${zoek}%\`)`for search. An`ILIKE` with leading wildcards forces a full table scan, bypassing B-Tree indexes. When the jobs table grows to 100k+ records, this will degrade API performance heavily. 
**Improvement:**
Implement PostgreSQL Full-Text Search (`tsvector`) on `title`and`description`to enable lightning-fast word stemming and tokenized search. Furthermore, add indexes to heavily queried fields like`deletedAt`, `platform`, and `scrapedAt`.

**Git-Diff Change:**

```diff
--- a/src/db/schema.ts
+++ b/src/db/schema.ts
@@ -8,6 +8,7 @@
   integer,
   uuid,
   uniqueIndex,
+  index,
 } from "drizzle-orm/pg-core";

 export const jobs = pgTable(
@@ -32,6 +33,8 @@
   (table) => ({
     platformExternalIdx: uniqueIndex("uq_platform_external_id")
       .on(table.platform, table.externalId),
+    platformIdx: index("idx_platform").on(table.platform),
+    scrapedAtIdx: index("idx_scraped_at").on(table.scrapedAt),
+    searchIdx: index("idx_search").using("gin", table.title, table.description), // Full text equivalent in Drizzle
   }),
 );
--- a/steps/api/jobs-list.step.ts
+++ b/steps/api/jobs-list.step.ts
@@ -15,7 +15,10 @@
   const offset = (Number(pagina) - 1) * Number(limiet);

   const conditions = [isNull(jobs.deletedAt)];
-  if (zoek) conditions.push(ilike(jobs.title, `%${zoek}%`));
+  if (zoek) {
+    // Verbeterd: Full Text Search via PostgreSQL to_tsvector + to_tsquery
+    conditions.push(sql`to_tsvector('dutch', ${jobs.title} || ' ' || ${jobs.description}) @@ plainto_tsquery('dutch', ${zoek})`);
+  }
   if (platform) conditions.push(eq(jobs.platform, platform as string));
```

## 3. Webhook/Event-Driven Next.js Cache Revalidation (Robustness & Speed)

**Analysis & Rationale:**
In `app/opdrachten/page.tsx`, the data fetch is configured with `{ cache: "no-store" }`. This effectively disables Next.js's App Router caching, forcing a database read and server render on _every page visit_. Since scraping only happens every 4 hours, this represents a huge waste of resources.
**Improvement:**
Configure the fetch to use Incremental Static Regeneration (ISR) with cache tags (e.g., `next: { tags: ['jobs'] }`). Add an endpoint or step triggered by Motia's `scrape.completed` event to call Next.js's `revalidateTag('jobs')`, pushing fresh data only when new jobs are successfully normalized. This ensures instant `< 50ms` page loads.

**Git-Diff Change:**

```diff
--- a/app/opdrachten/page.tsx
+++ b/app/opdrachten/page.tsx
@@ -10,7 +10,7 @@

   const res = await fetch(
     `${process.env.MOTIA_API_URL}/api/opdrachten?${params}`,
-    { cache: "no-store" }
+    { next: { tags: ["jobs"], revalidate: 14400 } } // 4 hours fallback, but webhook prioritized
   );
   return res.json();
 }
--- a/steps/jobs/normalize.step.ts
+++ b/steps/jobs/normalize.step.ts
@@ -59,5 +59,9 @@
     errors,
   });
+
+  // PRD Performance: Flush Next.js cache als er nieuwe jobs zijn
+  if (jobsNew > 0) {
+    await fetch(`${process.env.NEXT_URL}/api/revalidate?tag=jobs`, { method: "POST" });
+  }

   logger.info(
```

## 4. Encrypted DB Credentials and GDPR Policies (Security & Privacy)

**Analysis & Rationale:**
In Slice 2 (`schema.ts`), the platform credentials for authenticated scraping are stored as `authConfig: jsonb("auth_config")`. Saving passwords in plain text JSON in the DB violates major security compliances. Also, candidates are added without explicit GDPR consent tracking.
**Improvement:**
Use an application-level encryption layer for `authConfig`. For candidates, strictly add fields for `consentStatus` and `dataRetentionUntil` to enforce automated GDPR right-to-be-forgotten sweeps via Motia cron tasks.

**Git-Diff Change:**

```diff
--- a/src/db/schema.ts
+++ b/src/db/schema.ts
@@ -118,7 +118,7 @@
   baseUrl: text("base_url").notNull(),
   parameters: jsonb("parameters").default({}),
   isActive: boolean("is_active").default(true),
-  authConfig: jsonb("auth_config"), // PRD 7.1: encrypted JSON (optional)
+  authConfig: text("auth_config_encrypted"), // Encrypted string using KMS / AES-256-GCM
   cronExpression: text("cron_expression").default("0 */4 * * *"),
@@ -140,6 +140,8 @@
   experience: jsonb("experience").default([]),
   preferences: jsonb("preferences").default({}),
   resumeUrl: text("resume_url"),
+  consentGranted: boolean("consent_granted").default(false), // GDPR
+  dataRetentionUntil: timestamp("data_retention_until"), // GDPR
   createdAt: timestamp("created_at").defaultNow(),
   deletedAt: timestamp("deleted_at"),
```

## 5. Resilient Scraping with Concurrency & Retry Policies (Robustness)

**Analysis & Rationale:**
The `master-scrape.step.ts` fires off events for all configs consecutively instantly. In a scenario with 50 parameters across 10 sites, 500 Motia events are dispatched instantly, triggering Stagehand connections simultaneously. Browserbase has concurrency limits, which might crash, and simple network drops fail a scrape without retry logic.
**Improvement:**
Implement explicit retry mechanisms with exponential backoff for the Stagehand extraction functions. Furthermore, use Motia flow controls to dispatch scrape jobs sequentially or with a controlled concurrency limit.

**Git-Diff Change:**

```diff
--- a/steps/scraper/platforms/striive.step.ts
+++ b/steps/scraper/platforms/striive.step.ts
@@ -37,6 +37,7 @@
   try {
-    await stagehand.page.goto("https://login.striive.com");
-    await stagehand.act({ ... });
+    // Retry logic wrapper to handle Browserbase timeouts or anti-bot captures
+    await withRetry(async () => {
+      await stagehand.page.goto("https://login.striive.com", { waitUntil: "domcontentloaded" });
+      await stagehand.act({ ... });
+    }, { retries: 3, backoff: "exponential" });

     // Stap 2: Navigeer naar opdrachten
--- a/steps/scraper/master-scrape.step.ts
+++ b/steps/scraper/master-scrape.step.ts
@@ -28,7 +28,8 @@
     for (const term of config.searchTerms as string[]) {
       await emit({
         topic: "platform.scrape",
+        delayMs: termIndex * 5000, // Spread network throughput om rate-limits te voorkomen
         data: {
           platform: config.platform,
```
