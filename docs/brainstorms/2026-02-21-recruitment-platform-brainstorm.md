---
date: 2026-02-21
topic: recruitment-platform-motia
updated: 2026-02-21
---

# Recruitment Platform — Motia.dev + Drizzle + Neon + Stagehand

## Volledig Gecorrigeerd Implementatieplan (7 Slices)

**Taal:** Alle UI, logs, en berichten in het **Nederlands**
**Stack:** Motia.dev (Steps framework) + Next.js 16 (App Router) + Drizzle ORM + Neon (PostgreSQL) + Stagehand (browser scraping) + Firecrawl (public scraping) + Zod + Vitest
**UI:** shadcn/ui + OpenAI Apps SDK UI design tokens — ChatGPT-achtige interface (donker thema, minimalistisch, monochroom icons)
**Kwaliteit:** Ultracite (zero-config linting/formatting) + Qlty CLI (quality gates + git hooks) + Storybook + Agentation (visuele feedback)
**Architectuur:** Agent-Native (harness engineering) — elke actie die een gebruiker kan doen, kan een agent ook doen
**Aanpak:** Vertical Slices + TDD + pnpm

> **BELANGRIJK:** Dit plan is gecorrigeerd op basis van de **echte Motia API** (februari 2026).
> Motia gebruikt: `emit()`, `type: 'cron'`/`'event'`/`'api'`, `subscribes`, `emits`, en `flows`.

> **EERSTE PLATFORM:** Striive.com (niet Indeed) — authenticated scraping via Stagehand/Browserbase.
> Striive is onderdeel van HeadFirst Group, het grootste freelance platform in NL met 30.000+ professionals.

---

## Architectuurprincipes: Agent-Native + Harness Engineering

Gebaseerd op [OpenAI's Harness Engineering](https://openai.com/index/harness-engineering/) en [Agent-Native Architecture](https://every.to/chain-of-thought/agent-native-architectures-how-to-build-apps-after-the-end-of-code):

### Agent-Native Principes

| Principe           | Betekenis                                      | Implementatie                                        |
| ------------------ | ---------------------------------------------- | ---------------------------------------------------- |
| **Pariteit**       | Alles wat een gebruiker kan, kan een agent ook | Elke UI-actie heeft een corresponderend API endpoint |
| **Atomaire tools** | Kleine, single-purpose acties                  | Motia steps = atomair per definitie                  |
| **Composability**  | Tools combineren tot onvoorziene workflows     | Event-driven: steps koppelen via emit/subscribes     |
| **Agent = app**    | De AI bepaalt welke tools te gebruiken         | API-first design: alle functionaliteit via REST      |
| **Observability**  | Agents en mensen zien dezelfde logs/state      | Motia Workbench + traceId op elke stap               |

### Harness Engineering (OpenAI Codex model)

Het "harness" is de omgeving die agents succesvol maakt:

- **Mensen schrijven geen code** — agents doen dat
- **Mensen bouwen de omgeving**: CI, kwaliteitspoorten, prompts, tooling
- **Kwaliteitspoorten** voorkomt slechte code: Ultracite (lint) → Qlty (check) → Vitest (test) → pas dan commit
- **Gemiddelde output**: 3.5 PRs per engineer per dag (OpenAI's resultaat)

### Ryan Carson's 3-Stappen Workflow

1. **PRD → Tasklist** — AI genereert gestructureerde taken uit het PRD
2. **Iteratief bouwen** — elke taak = 1 Motia step, getest voor de volgende begint
3. **Autonome loops** — meerdere agents parallel, CI integreert output

---

## Voorbereiding (eenmalig — 20 min)

### Stap 1: pnpm installeren

```bash
npm install -g pnpm
```

### Stap 2: Accounts aanmaken

1. https://neon.tech — New Project → kopieer `DATABASE_URL`
2. https://firecrawl.dev — Dashboard → kopieer API key (voor publieke scrapers later)
3. https://browserbase.com — Sign up → kopieer `BROWSERBASE_API_KEY` + `BROWSERBASE_PROJECT_ID`

### Stap 3: Motia project aanmaken

```bash
npx motia@latest create recruitment-platform --template starter-typescript
cd recruitment-platform
```

### Stap 4: Dependencies installeren

```bash
pnpm install

# Core
pnpm add drizzle-orm pg zod @browserbasehq/stagehand

# Next.js 16 + UI
pnpm add next@latest react@latest react-dom@latest
pnpm add tailwindcss@latest @tailwindcss/postcss postcss
pnpm add @openai/apps-sdk-ui                   # ChatGPT design tokens + componenten

# shadcn/ui initialiseren (interactief — kies New York style, Zinc palette)
npx shadcn-ui@latest init

# Scraping (later voor public platforms)
pnpm add firecrawl-js

# Dev tooling
pnpm add -D drizzle-kit vitest @types/pg tsx @types/react @types/react-dom

# Storybook + Agentation (visuele feedback)
pnpm add -D storybook @storybook/react-vite agentation
```

### Stap 5: Kwaliteitstooling installeren

**Ultracite** (zero-config linting + formatting + AI agent rules):

```bash
npx ultracite@latest init --agents claude
```

> Dit genereert automatisch linting regels + CLAUDE.md regels zodat AI-gegenereerde code aan dezelfde standaarden voldoet.

**Qlty CLI** (kwaliteitspoorten + git hooks):

```bash
curl https://qlty.sh | sh
qlty init
qlty githooks install
```

> Dit installeert:
>
> - **Pre-commit hook**: `qlty fmt` (auto-formatting)
> - **Pre-push hook**: `qlty check` (linting validatie)
>   Werkt voor zowel menselijke als AI commits.

### Stap 6: `.env` aanmaken (in project root)

```env
# Database
DATABASE_URL=postgres://user:pass@host.neon.tech/dbname?sslmode=require

# Scraping - Browserbase (voor Striive + andere authenticated platforms)
BROWSERBASE_API_KEY=bb-XXXXXXXXXXXXXXXXXXXXXXXX
BROWSERBASE_PROJECT_ID=proj-XXXXXXXXXXXXXXXX

# Scraping - Firecrawl (voor public platforms later)
FIRECRAWL_API_KEY=fc-XXXXXXXXXXXXXXXXXXXXXXXX

# Motia API (voor Next.js Server Components)
MOTIA_API_URL=http://localhost:3000

# Next.js URL (voor cache revalidatie vanuit Motia steps)
NEXT_URL=http://localhost:3001

# Encryptie (voor authConfig in DB — genereer met: openssl rand -base64 32)
ENCRYPTION_KEY=jouw_encryptie_sleutel_hier

# Platform credentials (NOOIT in code, alleen in .env)
STRIIVE_USERNAME=jouw_email@voorbeeld.nl
STRIIVE_PASSWORD=jouw_wachtwoord_hier
```

> **BEVEILIGINGSNOTA:** Platformcredentials staan ALLEEN in `.env` (gitignored).
> In productie: gebruik een secrets vault (bijv. Neon's encrypted columns of external vault).

### Stap 7: Mappenstructuur

```
steps/                              # Motia ontdekt *.step.ts hier automatisch
├── scraper/
│   ├── master-scrape.step.ts       # Cron: elke 4 uur
│   └── platforms/
│       ├── striive.step.ts         # Event: scrape Striive (EERSTE PLATFORM)
│       ├── indeed.step.ts          # Event: scrape Indeed (public, later)
│       └── linkedin.step.ts        # Event: scrape LinkedIn (auth, later)
├── jobs/
│   ├── normalize.step.ts           # Event: normalize + dedup
│   ├── record-scrape-result.step.ts # Event: scrape metrics opslaan
│   └── grade.step.ts               # Event: AI grading (Slice 5)
├── api/
│   ├── jobs-list.step.ts           # API: GET /api/opdrachten
│   ├── jobs-detail.step.ts         # API: GET /api/opdrachten/:id
│   ├── scraper-configs.step.ts     # API: GET /api/scraper-configuraties
│   ├── trigger-scrape.step.ts      # API: POST /api/scrape/starten
│   └── scrape-history.step.ts      # API: GET /api/scrape-resultaten
└── pipeline/
    └── stage-change.step.ts        # Event: sollicitatie fase wijziging
app/                                # Next.js 16 App Router (UI)
├── layout.tsx                      # Root layout + AppsSDKUIProvider + ThemeProvider
├── globals.css                     # ChatGPT design tokens + Tailwind + shadcn vars
├── page.tsx                        # Dashboard homepage
├── opdrachten/
│   ├── page.tsx                    # Opdrachten zoeken + lijst
│   └── [id]/
│       └── page.tsx                # Opdracht detail
├── scraper/
│   ├── page.tsx                    # Scraper dashboard (configs + history)
│   └── components/
│       ├── scraper-config-card.tsx  # Per-platform kaart met status + toggle
│       └── scrape-history-table.tsx # Recente runs tabel
├── kandidaten/
│   └── page.tsx                    # Kandidaten beheer (Slice 5)
└── components/
    ├── ui/                         # shadcn/ui componenten (auto-gegenereerd)
    ├── sidebar.tsx                  # ChatGPT-stijl sidebar navigatie
    ├── search-command.tsx           # ⌘K zoek dialog
    ├── platform-badge.tsx           # Platform indicator (Striive, Indeed, etc.)
    ├── job-card.tsx                 # Opdracht kaart component
    ├── status-indicator.tsx         # Scrape status (success/partial/failed)
    └── theme-provider.tsx           # Dark/light mode toggle
src/
├── db/
│   ├── index.ts                    # Drizzle connection
│   └── schema.ts                   # PostgreSQL tabellen
├── schemas/
│   └── job.ts                      # Zod unified schema
└── lib/
    └── helpers.ts                  # Gedeelde utilities
tests/
├── job-schema.test.ts              # Unit tests
├── striive-adapter.test.ts         # Contract test Striive
├── normalize.test.ts               # Normalize + dedup tests
├── fixtures/                       # HTML snapshots voor offline scraper tests
│   ├── striive/
│   │   ├── page1.html              # Opgeslagen Striive HTML (voor fixture tests)
│   │   └── page2.html
│   └── indeed/
│       └── search-results.html
└── striive-extract-fixture.test.ts # Test extractie tegen opgeslagen HTML (geen internet nodig)
.storybook/                         # Storybook configuratie
stories/                            # Component stories
.qlty/
└── qlty.toml                       # Qlty configuratie (auto-gegenereerd)
biome.json                          # Ultracite/Biome config (auto-gegenereerd)
drizzle.config.ts                   # Drizzle Kit config
components.json                     # shadcn/ui config (auto-gegenereerd)
```

> **Let op:** Motia ontdekt automatisch alle bestanden die eindigen op `.step.ts` in het project.
> Je hoeft steps NIET te registreren — gewoon het bestand aanmaken is genoeg.

### Stap 8: CLAUDE.md kwaliteitsregels (agent-native)

Ultracite genereert dit automatisch, maar voeg ook toe:

```markdown
# Kwaliteitsregels voor AI Agents

## Voor elke commit

- ALTIJD `qlty fmt` draaien voor auto-formatting
- ALTIJD `qlty check --fix --level=low` draaien voor linting
- ALTIJD `pnpm test` draaien voor unit tests

## Taal

- Alle UI labels, foutmeldingen, en logs in het NEDERLANDS
- Variabelen en code in het Engels (internationale standaard)
- API endpoints in het Nederlands: `/api/opdrachten`, `/api/scrape-resultaten`

## Agent-Native

- Elke UI-actie MOET een corresponderende API step hebben
- Geen functionaliteit die ALLEEN via UI bereikbaar is
```

---

## Slice 1: Striive Scraper (Authenticated) → DB opslaan

**Doel:** Elke 4 uur Striive opdrachten ophalen via Stagehand (browser login) → normaliseren → opslaan met deduplicatie → zichtbaar in Motia Workbench.

> **Waarom Striive eerst?** Striive.com is het grootste freelance platform in NL (HeadFirst Group, 30.000+ professionals). Het vereist authenticatie, dus we beginnen meteen met de moeilijkste variant — als dit werkt, zijn public platforms (Indeed) triviaal.

### 1.0 Striive Data Model (reverse-engineered)

Het onderstaande schema is gebaseerd op reverse-engineering van het Striive supplier dashboard (`supplier.striive.com/dashboard/opdrachten`). Dit is de primaire entiteit die we scrapen:

| Veld | Striive Label | Type | Voorbeeld |
|------|--------------|------|-----------|
| `title` | Functietitel | string | "Junior Projectleider" |
| `company` | Opdrachtgever | string | "Belastingdienst Non-ICT" |
| `contractLabel` | Contractlabel (broker) | string | "Between" |
| `location` | Locatie | string | "Utrecht - Utrecht" |
| `rateMax` | Wat is het uurtarief? | number | 84.50 |
| `positionsAvailable` | Aantal posities | number | 1 |
| `startDate` | Startdatum | date | "19 februari 2026" |
| `endDate` | Einddatum | date | "31 december 2026" |
| `applicationDeadline` | Reageren kan t/m | date | "24 februari 2026" |
| `workArrangement` | Thuiswerken | string | "Hybride" |
| `allowsSubcontracting` | Doorleenconstructie | boolean | Ja/Nee |
| `externalId` | Referentiecode | string | "BTBDN000695" |
| `clientReferenceCode` | Ref. opdrachtgever | string | "SRQ187726" |

**Ongestructureerde tekst (geëxtraheerd als structured arrays):**

| Categorie | Striive Sectie | Schema | Gebruik |
|-----------|---------------|--------|---------|
| **Eisen** | Harde knockout criteria | `[{description, isKnockout: true}]` | Filtering |
| **Wensen** | Scoring criteria | `[{description, evaluationCriteria}]` | AI grading |
| **Competenties** | Soft skills | `string[]` | Matching |
| **Voorwaarden** | Juridisch/compliance | `string[]` | Compliance check |

> **Authenticatie:** Striive vereist inloggen via `login.striive.com` (supplier account).
> Het dashboard op `supplier.striive.com/dashboard/opdrachten` ondersteunt native paginering en filtering.
> **Andere entiteiten:** Professionals en Biedingen zijn gekoppeld aan ons supplier account — scrapen we alleen als we Striive application state willen synchroniseren met ons platform.

### 1.1 Database Schema (Drizzle + Neon)

**`drizzle.config.ts`** (project root)

```ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    connectionString: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

**`src/db/schema.ts`**

```ts
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  uuid,
  uniqueIndex,
  index,
  boolean,
  real,
} from "drizzle-orm/pg-core";

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // === Identificatie ===
    platform: text("platform").notNull(),       // "striive", "indeed", "linkedin"
    externalId: text("external_id").notNull(),   // Striive: referentiecode (bijv. "BTBDN000695")
    externalUrl: text("external_url"),            // Volledige URL naar opdracht detail pagina
    clientReferenceCode: text("client_reference_code"), // Striive: referentiecode opdrachtgever (bijv. "SRQ187726")

    // === Kern informatie ===
    title: text("title").notNull(),              // "Junior Projectleider", "Data Scientist"
    company: text("company"),                     // Opdrachtgever: "Belastingdienst", "Rabobank"
    contractLabel: text("contract_label"),         // Broker/tussenpersoon: "Between", "Striive"
    location: text("location"),                   // "Utrecht - Utrecht", "Den Haag - Zuid-Holland"
    province: text("province"),                   // Geëxtraheerd uit location of apart veld
    description: text("description"),

    // === Tarieven & Posities ===
    rateMin: integer("rate_min"),                 // Minimum uurtarief (cents of hele euros)
    rateMax: integer("rate_max"),                 // Striive: "Wat is het uurtarief?" (max)
    currency: text("currency").default("EUR"),
    positionsAvailable: integer("positions_available").default(1), // Striive: "Aantal posities"

    // === Data & Deadlines ===
    startDate: timestamp("start_date"),           // Striive: "Startdatum"
    endDate: timestamp("end_date"),               // Striive: "Einddatum"
    applicationDeadline: timestamp("application_deadline"), // Striive: "Reageren kan t/m"
    postedAt: timestamp("posted_at"),

    // === Werkcondities ===
    contractType: text("contract_type"),           // "freelance", "interim", "vast", "opdracht"
    workArrangement: text("work_arrangement"),     // Striive: "Hybride", "Op locatie", "Remote"
    allowsSubcontracting: boolean("allows_subcontracting"), // Striive: "Doorleenconstructie toegestaan"

    // === Gestructureerde Eisen (Striive-specifiek, universeel bruikbaar) ===
    requirements: jsonb("requirements").default([]),     // [{description, isKnockout}] — harde eisen
    wishes: jsonb("wishes").default([]),                  // [{description, evaluationCriteria}] — wensen
    competences: jsonb("competences").default([]),        // ["Resultaatgerichtheid", "Flexibiliteit"] — soft skills
    conditions: jsonb("conditions").default([]),          // ["WKA", "G-rekening", "SNA-certificering"] — juridisch

    // === Metadata ===
    scrapedAt: timestamp("scraped_at").defaultNow(),
    deletedAt: timestamp("deleted_at"),           // PRD 7.2: soft-delete
    rawPayload: jsonb("raw_payload"),             // Volledige onbewerkte scrape data
    embedding: text("embedding"),                 // pgvector: vector(1024) in productie
  },
  (table) => ({
    platformExternalIdx: uniqueIndex("uq_platform_external_id") // PRD 7.2: composite dedup
      .on(table.platform, table.externalId),
    // Query indexes
    titleBtreeIdx: index("idx_jobs_title_btree").on(table.title),
    platformIdx: index("idx_jobs_platform").on(table.platform),
    scrapedAtIdx: index("idx_jobs_scraped_at").on(table.scrapedAt),
    deletedAtIdx: index("idx_jobs_deleted_at").on(table.deletedAt),
    deadlineIdx: index("idx_jobs_deadline").on(table.applicationDeadline), // Filteren op deadline
    platformUrlIdx: uniqueIndex("uq_platform_external_url").on(table.platform, table.externalUrl),
  }),
);
```

> **PRD + Striive Compliance Notes:**
>
> - Schema is gebaseerd op **echte Striive dashboard data** (reverse-engineered februari 2026)
> - Striive velden: `clientReferenceCode`, `contractLabel`, `applicationDeadline`, `startDate`, `endDate`, `positionsAvailable`, `workArrangement`, `allowsSubcontracting`
> - Gestructureerde eisen: `requirements` (knockout eisen), `wishes` (wensen), `competences` (soft skills), `conditions` (juridisch/compliance)
> - Composite unique `(platform, externalId)` per PRD 7.2
> - `deletedAt` for soft-delete per PRD A.5 (auditability)
> - `embedding` placeholder voor pgvector twee-fase matching (Slice 5)

**`src/db/index.ts`**

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  max: 10,                    // Neon free tier: max 10 connections
  idleTimeoutMillis: 30_000,  // Sluit idle connections na 30s
  connectionTimeoutMillis: 5_000, // Timeout bij verbinden
});

export const db = drizzle(pool);
export * from "./schema";
```

> **Performance Note:** Neon free tier heeft max ~10 concurrent connections. Zonder pool config
> maakt elke request een nieuwe connectie, wat bij hoge load Neon overbelast.
> In productie: overweeg `@neondatabase/serverless` voor HTTP-based pooling.

**Migratie draaien:**

```bash
pnpm dlx drizzle-kit generate
pnpm dlx drizzle-kit push
```

### 1.2 Unified Zod Schema (gebaseerd op echte Striive data)

**`src/schemas/job.ts`**

```ts
import { z } from "zod";

// Gestructureerde eis (Striive "Eisen" met knockout vlag)
const requirementSchema = z.object({
  description: z.string(),
  isKnockout: z.boolean().default(false), // true = harde eis (knockout criterium)
});

// Gestructureerde wens (Striive "Wensen" met evaluatie criteria)
const wishSchema = z.object({
  description: z.string(),
  evaluationCriteria: z.string().optional(), // "De mate waarin..."
});

export const unifiedJobSchema = z.object({
  // === Identificatie ===
  externalId: z.string().min(1),        // Striive: referentiecode (bijv. "BTBDN000695")
  externalUrl: z.string().url(),
  clientReferenceCode: z.string().optional(), // Striive: referentiecode opdrachtgever

  // === Kern ===
  title: z.string().min(1, "Titel is verplicht"),
  company: z.string().optional(),        // Opdrachtgever (eindklant)
  contractLabel: z.string().optional(),  // Broker/tussenpersoon (bijv. "Between")
  location: z.string().optional(),       // "Utrecht - Utrecht"
  province: z.string().optional(),       // Geëxtraheerd uit location
  description: z.string().min(10),

  // === Tarieven & Posities ===
  rateMin: z.number().positive().optional(),
  rateMax: z.number().positive().optional(),  // Striive: "Wat is het uurtarief?"
  currency: z.string().default("EUR"),
  positionsAvailable: z.number().int().positive().default(1), // Striive: "Aantal posities"

  // === Data & Deadlines ===
  startDate: z.coerce.date().optional(),           // Striive: "Startdatum"
  endDate: z.coerce.date().optional(),             // Striive: "Einddatum"
  applicationDeadline: z.coerce.date().optional(), // Striive: "Reageren kan t/m"
  postedAt: z.coerce.date().optional(),

  // === Werkcondities ===
  contractType: z.enum(["freelance", "interim", "vast", "opdracht"]).optional(),
  workArrangement: z.enum(["remote", "hybride", "op_locatie"]).optional(), // Striive: "Thuiswerken"
  allowsSubcontracting: z.boolean().optional(), // Striive: "Doorleenconstructie toegestaan"

  // === Gestructureerde Eisen ===
  requirements: z.array(z.union([z.string(), requirementSchema])).default([]),
  wishes: z.array(z.union([z.string(), wishSchema])).default([]),
  competences: z.array(z.string()).default([]),   // "Resultaatgerichtheid", "Flexibiliteit"
  conditions: z.array(z.string()).default([]),    // "WKA", "G-rekening", "SNA-certificering"
});

export type UnifiedJob = z.infer<typeof unifiedJobSchema>;

// Helper: extract province uit "City - Province" format
export function extractProvince(location: string): string | undefined {
  const parts = location.split(" - ");
  return parts.length > 1 ? parts[1].trim() : undefined;
}
```

> **Design Decision:** `requirements` accepteert zowel `string[]` (simpele platforms zoals Indeed)
> als `{description, isKnockout}[]` (gestructureerde platforms zoals Striive). Dit maakt het schema
> universeel bruikbaar voor alle platformen zonder platform-specifieke schema's.

### 1.3 TDD Tests

**`tests/job-schema.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { unifiedJobSchema, extractProvince } from "../src/schemas/job";

describe("Unified Job Schema", () => {
  it("should accept a valid Striive opdracht (all fields)", () => {
    const striiveJob = {
      title: "Junior Projectleider",
      company: "Belastingdienst Non-ICT",
      contractLabel: "Between",
      location: "Utrecht - Utrecht",
      province: "Utrecht",
      description: "Kandidaat heeft minimaal 1 jaar werkervaring in de rol van junior Projectleider...",
      externalId: "BTBDN000695",
      externalUrl: "https://supplier.striive.com/dashboard/opdrachten/BTBDN000695",
      clientReferenceCode: "SRQ187726",
      rateMax: 84.50,
      positionsAvailable: 1,
      startDate: "2026-02-19",
      endDate: "2026-12-31",
      applicationDeadline: "2026-02-24",
      workArrangement: "hybride",
      allowsSubcontracting: false,
      requirements: [
        { description: "Minimaal 1 jaar werkervaring als junior Projectleider", isKnockout: true },
        { description: "Ervaring bij overheidsorganisaties", isKnockout: false },
      ],
      wishes: [
        { description: "Ervaring met Agile/Scrum methodieken", evaluationCriteria: "De mate waarin de kandidaat..." },
      ],
      competences: ["Resultaatgerichtheid", "Flexibiliteit", "Plannen en organiseren"],
      conditions: ["WKA", "G-rekening", "SNA-certificering"],
    };

    const result = unifiedJobSchema.safeParse(striiveJob);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.positionsAvailable).toBe(1);
      expect(result.data.workArrangement).toBe("hybride");
      expect(result.data.requirements).toHaveLength(2);
      expect(result.data.competences).toContain("Flexibiliteit");
    }
  });

  it("should accept a simple Indeed job (string requirements)", () => {
    const valid = {
      title: "Senior Frontend Developer",
      company: "TechCorp",
      location: "Amsterdam",
      description: "We zoeken een ervaren developer met React kennis.",
      externalId: "job-12345",
      externalUrl: "https://nl.indeed.com/viewjob?jk=abc123",
      requirements: ["React", "TypeScript"], // Simpele string array (Indeed)
    };
    expect(unifiedJobSchema.safeParse(valid).success).toBe(true);
  });

  it("should reject job without title", () => {
    const invalid = { title: "", externalId: "123", description: "kort" };
    expect(unifiedJobSchema.safeParse(invalid).success).toBe(false);
  });

  it("should reject job without description (min 10 chars)", () => {
    const invalid = {
      title: "Dev",
      externalId: "123",
      externalUrl: "https://example.com/job/123",
      description: "kort",
    };
    expect(unifiedJobSchema.safeParse(invalid).success).toBe(false);
  });

  it("should default requirements, wishes, competences to empty arrays", () => {
    const job = {
      title: "Backend Dev",
      externalId: "456",
      externalUrl: "https://example.com/job/456",
      description: "Een mooie baan voor een backend developer.",
    };
    const result = unifiedJobSchema.parse(job);
    expect(result.requirements).toEqual([]);
    expect(result.wishes).toEqual([]);
    expect(result.competences).toEqual([]);
    expect(result.conditions).toEqual([]);
  });

  it("should coerce date strings to Date objects", () => {
    const job = {
      title: "PM",
      externalId: "789",
      externalUrl: "https://example.com/job/789",
      description: "Project management opdracht bij grote organisatie.",
      startDate: "2026-03-01",
      applicationDeadline: "2026-02-28",
    };
    const result = unifiedJobSchema.parse(job);
    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.applicationDeadline).toBeInstanceOf(Date);
  });
});

describe("extractProvince", () => {
  it("should extract province from 'City - Province' format", () => {
    expect(extractProvince("Utrecht - Utrecht")).toBe("Utrecht");
    expect(extractProvince("Den Haag - Zuid-Holland")).toBe("Zuid-Holland");
  });

  it("should return undefined for city-only format", () => {
    expect(extractProvince("Amsterdam")).toBeUndefined();
  });
});
```

**Voeg toe aan `package.json` scripts:**

```json
"test": "vitest run",
"test:watch": "vitest"
```

```bash
pnpm test
```

### 1.4 Motia Steps (GECORRIGEERDE API)

**`steps/scraper/master-scrape.step.ts`** — Cron Step

```ts
import { CronConfig, Handlers } from "motia";

export const config: CronConfig = {
  type: "cron",
  name: "MasterScrape",
  description: "Elke 4 uur alle actieve platformen scrapen",
  cron: "0 */4 * * *",
  emits: ["platform.scrape"],
  flows: ["recruitment-scraper"],
};

export const handler: Handlers["MasterScrape"] = async ({ emit, logger }) => {
  logger.info("Master scrape gestart");

  // Slice 1: Striive als eerste platform
  await emit({
    topic: "platform.scrape",
    data: {
      platform: "striive",
      url: "https://striive.com/nl/opdrachten",
    },
  });

  logger.info("Striive scrape opdracht geemit");
};
```

**`steps/scraper/platforms/striive.step.ts`** — Event Step (Authenticated via Stagehand)

```ts
import { EventConfig, Handlers } from "motia";
import { z } from "zod";
import { Stagehand } from "@browserbasehq/stagehand";

export const config: EventConfig = {
  type: "event",
  name: "ScrapeStriive",
  description: "Scrapt Striive opdrachten via Stagehand (ingelogd)",
  subscribes: ["platform.scrape"],
  emits: ["jobs.normalize"],
  input: z.object({
    platform: z.string(),
    url: z.string().url(),
  }),
  flows: ["recruitment-scraper"],
};

export const handler: Handlers["ScrapeStriive"] = async (
  input,
  { emit, logger },
) => {
  if (input.platform !== "striive") return;

  logger.info(`Striive scrapen: ${input.url}`);

  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    enableCaching: true, // Hergebruik sessies → 50-70% kostenbesparing
  });

  await stagehand.init();

  const MAX_RETRIES = 2;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    try {
      // Stap 1: Inloggen op Striive
      await stagehand.page.goto("https://login.striive.com");
      await stagehand.act({
        action: "Vul het e-mailadres in en klik op volgende",
        variables: { email: process.env.STRIIVE_USERNAME! },
      });
      await stagehand.act({
        action: "Vul het wachtwoord in en klik op inloggen",
        variables: { password: process.env.STRIIVE_PASSWORD! },
      });

    // Stap 2: Navigeer naar opdrachten
    await stagehand.page.goto(input.url);
    await stagehand.page.waitForSelector('[data-testid="job-list"], .opdrachten-lijst, main', {
      timeout: 15_000,
    }); // Wacht op content — NIET waitForTimeout (brittle)

    // Stap 3: Paginated extraction met echte Striive veldnamen
    // Gebaseerd op reverse-engineering van supplier.striive.com/dashboard/opdrachten
    const MAX_PAGES = 5; // Config-driven in productie via scraperConfigs.parameters.maxPages
    const allListings: any[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const result = await stagehand.extract({
        instruction: `Extraheer alle zichtbare opdrachten van deze Striive pagina.
          Per opdracht extraheer:
          - title: de functietitel/rol
          - company: de opdrachtgever (eindklant, bijv. "Belastingdienst")
          - contractLabel: het contractlabel/broker (bijv. "Between")
          - location: stad en provincie (bijv. "Utrecht - Utrecht")
          - description: de volledige omschrijving
          - rateMax: het maximale uurtarief (getal)
          - positionsAvailable: aantal posities (getal)
          - startDate: startdatum (YYYY-MM-DD)
          - endDate: einddatum (YYYY-MM-DD)
          - applicationDeadline: "reageren kan t/m" datum (YYYY-MM-DD)
          - workArrangement: thuiswerken beleid ("hybride", "op_locatie", of "remote")
          - allowsSubcontracting: doorleenconstructie toegestaan (ja/nee → true/false)
          - externalId: de referentiecode (bijv. "BTBDN000695")
          - clientReferenceCode: referentiecode opdrachtgever (bijv. "SRQ187726")
          - externalUrl: de volledige URL naar de opdracht
          - requirements: lijst van harde eisen (knockout criteria) — extraheer als [{description, isKnockout: true}]
          - wishes: lijst van wensen — extraheer als [{description, evaluationCriteria}]
          - competences: lijst van competenties/soft skills (bijv. "Flexibiliteit")
          - conditions: lijst van voorwaarden (bijv. "WKA", "G-rekening", "SNA-certificering")`,
        schema: z.object({
          opdrachten: z.array(
            z.object({
              title: z.string(),
              company: z.string().optional(),
              contractLabel: z.string().optional(),
              location: z.string().optional(),
              description: z.string(),
              rateMax: z.number().optional(),
              positionsAvailable: z.number().optional(),
              startDate: z.string().optional(),
              endDate: z.string().optional(),
              applicationDeadline: z.string().optional(),
              workArrangement: z.string().optional(),
              allowsSubcontracting: z.boolean().optional(),
              externalId: z.string(),
              clientReferenceCode: z.string().optional(),
              externalUrl: z.string(),
              requirements: z.array(z.object({
                description: z.string(),
                isKnockout: z.boolean().default(true),
              })).optional(),
              wishes: z.array(z.object({
                description: z.string(),
                evaluationCriteria: z.string().optional(),
              })).optional(),
              competences: z.array(z.string()).optional(),
              conditions: z.array(z.string()).optional(),
            }),
          ),
        }),
      });

      allListings.push(...(result.opdrachten ?? []));

      // Probeer volgende pagina — stop als er geen "Volgende" knop is
      const hasNext = await stagehand.page.locator('a:has-text("Volgende"), button:has-text("Volgende"), [aria-label="Volgende"]')
        .isVisible()
        .catch(() => false);
      if (!hasNext) break;
      await stagehand.act({ action: "Klik op de volgende pagina knop" });
      await stagehand.page.waitForSelector('[data-testid="job-list"], .opdrachten-lijst, main', {
        timeout: 10_000,
      });
    }

    const listings = allListings;
    logger.info(`Striive: ${listings.length} opdrachten gevonden (${Math.min(MAX_PAGES, listings.length > 0 ? MAX_PAGES : 1)} pagina's)`);

    // Verrijk listings met province extractie
    const enriched = listings.map((l: any) => ({
      ...l,
      province: l.province ?? (l.location?.includes(" - ") ? l.location.split(" - ")[1]?.trim() : undefined),
    }));

    await emit({
      topic: "jobs.normalize",
      data: { platform: "striive", listings: enriched },
    });
      break; // Succes → uit retry loop

    } catch (err) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        logger.error(`Striive scrape definitief mislukt na ${MAX_RETRIES + 1} pogingen: ${err}`);
        // ALTIJD emit zodat ScrapeResult wordt vastgelegd (pipeline reliability)
        await emit({
          topic: "jobs.normalize",
          data: { platform: "striive", listings: [] },
        });
      } else {
        // Exponential backoff met jitter (voorkomt thundering herd bij Browserbase rate limits)
        const base = 1200 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 500);
        const delay = base + jitter;
        logger.warn(`Striive scrape poging ${attempt} mislukt, retry in ${delay}ms: ${err}`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  } // end retry loop

  await stagehand.close();
};
```

> **Striive login flow:**
>
> - Login gaat via `login.striive.com` (onderdeel van HeadFirst Group/Select HR)
> - Dashboard URL: `supplier.striive.com/dashboard/opdrachten` (native paginering + filtering)
> - Stagehand's `act()` methode gebruikt AI om de juiste formulier-elementen te vinden
> - Credentials komen uit `.env` — NOOIT hardcoded in de step
> - Extractie schema is gebaseerd op echte Striive veldnamen (zie Sectie 1.0)

**`steps/jobs/normalize.step.ts`** — Event Step (normalize + dedup + metrics)

```ts
import { EventConfig, Handlers } from "motia";
import { z } from "zod";
import { db } from "../../src/db";
import { jobs } from "../../src/db/schema";
import { sql } from "drizzle-orm";
import { unifiedJobSchema } from "../../src/schemas/job";

export const config: EventConfig = {
  type: "event",
  name: "NormalizeJobs",
  description:
    "Normaliseert en slaat jobs op met deduplicatie, emits scrape result metrics",
  subscribes: ["jobs.normalize"],
  emits: ["scrape.completed"], // PRD 4.2: track every ingestion run
  input: z.object({
    platform: z.string(),
    listings: z.array(z.any()),
  }),
  flows: ["recruitment-scraper"],
};

export const handler: Handlers["NormalizeJobs"] = async (
  input,
  { emit, logger },
) => {
  const startTime = Date.now();
  let jobsNew = 0;
  let duplicates = 0;
  const errors: string[] = [];

  // Stap 1: Valideer alle listings (snel, geen DB calls)
  const validItems: Array<{ parsed: any; raw: any }> = [];
  for (const raw of input.listings) {
    const parsed = unifiedJobSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push(`Validation: ${parsed.error.message}`);
    } else {
      validItems.push({ parsed: parsed.data, raw });
    }
  }

  // Stap 2: Batch insert (25-50x sneller dan per-row loop)
  if (validItems.length > 0) {
    const BATCH_SIZE = 50; // Neon max ~65k params, 50 rows is veilig
    for (let i = 0; i < validItems.length; i += BATCH_SIZE) {
      const batch = validItems.slice(i, i + BATCH_SIZE);
      try {
        const result = await db
          .insert(jobs)
          .values(
            batch.map((item) => ({
              ...item.parsed,
              platform: input.platform,
              rawPayload: item.raw,
            })),
          )
          .onConflictDoUpdate({
            target: [jobs.platform, jobs.externalId],
            set: {
              // Kern
              title: sql`excluded.title`,
              company: sql`excluded.company`,
              contractLabel: sql`excluded.contract_label`,
              location: sql`excluded.location`,
              province: sql`excluded.province`,
              description: sql`excluded.description`,
              clientReferenceCode: sql`excluded.client_reference_code`,
              // Tarieven & Posities
              rateMin: sql`excluded.rate_min`,
              rateMax: sql`excluded.rate_max`,
              currency: sql`excluded.currency`,
              positionsAvailable: sql`excluded.positions_available`,
              // Data & Deadlines
              startDate: sql`excluded.start_date`,
              endDate: sql`excluded.end_date`,
              applicationDeadline: sql`excluded.application_deadline`,
              postedAt: sql`excluded.posted_at`,
              // Werkcondities
              contractType: sql`excluded.contract_type`,
              workArrangement: sql`excluded.work_arrangement`,
              allowsSubcontracting: sql`excluded.allows_subcontracting`,
              // Gestructureerde eisen
              requirements: sql`excluded.requirements`,
              wishes: sql`excluded.wishes`,
              competences: sql`excluded.competences`,
              conditions: sql`excluded.conditions`,
              // Metadata
              scrapedAt: sql`now()`,
              deletedAt: sql`null`, // Revive soft-deleted jobs als ze weer gezien worden
              rawPayload: sql`excluded.raw_payload`,
            },
          })
          .returning({ id: jobs.id });

        // Alle returned rows zijn succesvol (nieuw of updated)
        jobsNew += result.length;
        duplicates += batch.length - result.length;
      } catch (err) {
        errors.push(`DB batch ${i}-${i + batch.length}: ${String(err)}`);
      }
    }
  }

  const durationMs = Date.now() - startTime;
  const status =
    errors.length === 0 ? "success" : jobsNew > 0 ? "partial" : "failed"; // PRD 4.2: success/partial/failed

  // PRD 4.2: emit metrics for ScrapeResult recording
  await emit({
    topic: "scrape.completed",
    data: {
      platform: input.platform,
      jobsFound: input.listings.length,
      jobsNew,
      duplicates,
      durationMs,
      status,
      errors,
    },
  });

  logger.info(
    `Normalize klaar: ${jobsNew} nieuw, ${duplicates} dupes, ${errors.length} fouten (${durationMs}ms)`,
  );
};
```

> **PRD Compliance Notes:**
>
> - Now emits `scrape.completed` with full metrics per PRD 4.2 & 7.1
> - Tracks `jobsNew` vs `duplicates` separately (PRD requires both)
> - Uses batch `insert().values([...]).onConflictDoUpdate().returning()` — upsert: update bestaande + revive soft-deleted + 25-50x sneller
> - Computes `durationMs` for ScrapeResult
> - Status tri-state: `success` / `partial` / `failed` per PRD 4.2
> - **ALTIJD** emit metrics, ook bij lege listings — pipeline reliability principe

### 1.5 Testen & Verifiëren

```bash
# Kwaliteitscheck VOOR starten (agent-native workflow)
qlty fmt && qlty check --fix --level=low

# Unit tests
pnpm test

# Start Motia dev server
pnpm dev
```

1. Open **Motia Workbench** (URL in terminal output, meestal `http://localhost:3000`)
2. Je ziet flow `recruitment-scraper` met 3 steps verbonden: MasterScrape → ScrapeStriive → NormalizeJobs
3. Klik op `MasterScrape` → **Handmatig triggeren**
4. Bekijk logs in Workbench → zie Striive login + scrape + normalize
5. Check Neon dashboard → `jobs` tabel → opdrachten van Striive!

**Kwaliteitspipeline (draait automatisch via git hooks):**

```bash
qlty fmt              # Pre-commit: auto-formatting
qlty check            # Pre-push: linting + kwaliteit
pnpm test             # Vitest unit tests
```

---

## Slice 2: Scraper Dashboard + Config in DB

**Doel:** Admin kan scraper configs beheren via API + zien in een dashboard.

### 2.1 Nieuwe tabel: `scraper_configs`

**Toevoegen aan `src/db/schema.ts`:**

```ts
import { boolean } from "drizzle-orm/pg-core";

export const scraperConfigs = pgTable("scraper_configs", {
  id: uuid("id").primaryKey().defaultRandom(),
  platform: text("platform").notNull().unique(), // PRD 7.1: ScraperConfig.platform
  baseUrl: text("base_url").notNull(), // PRD 7.1: ScraperConfig.baseUrl
  parameters: jsonb("parameters").default({}), // PRD 7.1: JSON (selectors, search terms, etc.)
  isActive: boolean("is_active").default(true), // PRD 7.1: active/paused flag
  authConfig: text("auth_config_encrypted"), // Encrypted via AES-256-GCM — NOOIT plaintext credentials in DB
  cronExpression: text("cron_expression").default("0 */4 * * *"), // PRD 4.2: schedule policy
  lastRunAt: timestamp("last_run_at"), // PRD 7.1: ScraperConfig.lastRunAt
  lastRunStatus: text("last_run_status"), // PRD 7.1: ScraperConfig.lastRunStatus
  createdAt: timestamp("created_at").defaultNow(),
});

export const scrapeResults = pgTable("scrape_results", {
  // PRD 7.1: ScrapeResult entity
  id: uuid("id").primaryKey().defaultRandom(),
  configId: uuid("config_id").references(() => scraperConfigs.id, {
    onDelete: "set null",          // FIX: was RESTRICT maar configId is nullable → SET NULL is logischer
  }),
  platform: text("platform").notNull(),
  runAt: timestamp("run_at").defaultNow(), // PRD 7.1: ScrapeResult.runAt
  durationMs: integer("duration_ms"), // PRD 7.1: ScrapeResult.durationMs
  jobsFound: integer("jobs_found").default(0), // PRD 7.1
  jobsNew: integer("jobs_new").default(0), // PRD 7.1: specifically "new" not "saved"
  duplicates: integer("duplicates").default(0), // PRD 7.1: separate from validation errors
  status: text("status").default("success"), // PRD 7.1: success / partial / failed
  errors: jsonb("errors").default([]), // PRD 7.1: JSON array, not single text
}, (table) => ({
  runAtIdx: index("idx_scrape_results_run_at").on(table.runAt),        // Dashboard queries
  platformIdx: index("idx_scrape_results_platform").on(table.platform),
}));
```

> **PRD Compliance Notes:**
>
> - Renamed `scrapeHistory` → `scrapeResults` to match PRD entity name `ScrapeResult`
> - Added `configId` FK with `onDelete: 'restrict'` per PRD 7.2 delete guards
> - Added `durationMs` per PRD 7.1
> - Split metrics: `jobsNew` (new inserts) vs `duplicates` (dedup skips) — PRD tracks these separately
> - `errors` is JSON array, not single text field — PRD 7.1 says "errors (JSON array)"
> - `status` enum: success/partial/failed per PRD 4.2
> - `authConfig` added for encrypted credentials per PRD 4.2 + A.3
> - `parameters` replaces `searchTerms` — more flexible, matches PRD 7.1 "parameters (JSON)"

### 2.2 API Steps

**`steps/api/scraper-configs.step.ts`** — GET /api/scraper-configuraties

```ts
import { ApiRouteConfig, Handlers } from "motia";
import { db } from "../../src/db";
import { scraperConfigs } from "../../src/db/schema";

export const config: ApiRouteConfig = {
  type: "api",
  name: "LijstScraperConfiguraties",
  path: "/api/scraper-configuraties",
  method: "GET",
  emits: [],
  flows: ["recruitment-admin"],
};

export const handler: Handlers["LijstScraperConfiguraties"] = async (
  req,
  { logger },
) => {
  const configuraties = await db.select().from(scraperConfigs);
  return { status: 200, body: { configuraties } };
};
```

**`steps/api/trigger-scrape.step.ts`** — POST /api/scrape/starten

```ts
import { ApiRouteConfig, Handlers } from "motia";
import { z } from "zod";

export const config: ApiRouteConfig = {
  type: "api",
  name: "StartScrape",
  path: "/api/scrape/starten",
  method: "POST",
  emits: ["platform.scrape"],
  bodySchema: z.object({
    platform: z.string(),
    url: z.string().url(),
  }),
  flows: ["recruitment-admin"],
};

export const handler: Handlers["StartScrape"] = async (req, { emit }) => {
  await emit({
    topic: "platform.scrape",
    data: { platform: req.body.platform, url: req.body.url },
  });

  return {
    status: 200,
    body: { bericht: `Scrape gestart voor ${req.body.platform}` },
  };
};
```

### 2.3 Master Scrape updaten (configs uit DB laden)

Update `master-scrape.step.ts` handler:

```ts
export const handler: Handlers["MasterScrape"] = async ({ emit, logger }) => {
  const configs = await db
    .select()
    .from(scraperConfigs)
    .where(eq(scraperConfigs.isActive, true));

  for (const cfg of configs) {
    const params = cfg.parameters as Record<string, any> ?? {};
    const searchTerms = (params.searchTerms as string[]) ?? ["developer"];

    for (const term of searchTerms) {
      await emit({
        topic: "platform.scrape",
        data: {
          platform: cfg.platform,
          url: `${cfg.baseUrl}?q=${encodeURIComponent(term)}&l=Nederland`,
        },
      });
    }
  }

  logger.info(`${configs.length} platformen gequeued`);
};
```

### 2.4 Record Scrape Results Step (NEW — PRD 4.2 compliance)

**`steps/jobs/record-scrape-result.step.ts`**

```ts
import { EventConfig, Handlers } from "motia";
import { z } from "zod";
import { db } from "../../src/db";
import { scrapeResults, scraperConfigs } from "../../src/db/schema";
import { eq } from "drizzle-orm";

export const config: EventConfig = {
  type: "event",
  name: "RecordScrapeResult",
  description: "Slaat scrape resultaten op in scrape_results tabel (PRD 4.2)",
  subscribes: ["scrape.completed"],
  emits: [],
  input: z.object({
    platform: z.string(),
    jobsFound: z.number(),
    jobsNew: z.number(),
    duplicates: z.number(),
    durationMs: z.number(),
    status: z.enum(["success", "partial", "failed"]),
    errors: z.array(z.string()),
  }),
  flows: ["recruitment-scraper"],
};

export const handler: Handlers["RecordScrapeResult"] = async (
  input,
  { logger },
) => {
  // Find config ID for this platform
  const configs = await db
    .select({ id: scraperConfigs.id })
    .from(scraperConfigs)
    .where(eq(scraperConfigs.platform, input.platform))
    .limit(1);

  // Record scrape result (PRD 7.1: ScrapeResult entity)
  await db.insert(scrapeResults).values({
    configId: configs[0]?.id ?? null,
    platform: input.platform,
    durationMs: input.durationMs,
    jobsFound: input.jobsFound,
    jobsNew: input.jobsNew,
    duplicates: input.duplicates,
    status: input.status,
    errors: input.errors,
  });

  // Update ScraperConfig last run info (PRD 7.1)
  if (configs[0]) {
    await db
      .update(scraperConfigs)
      .set({ lastRunAt: new Date(), lastRunStatus: input.status })
      .where(eq(scraperConfigs.id, configs[0].id));
  }

  logger.info(
    `ScrapeResult opgeslagen: ${input.platform} → ${input.status} (${input.jobsNew} nieuw)`,
  );
};
```

### 2.5 Cache Revalidation Step (Event-driven Next.js invalidatie)

**`steps/jobs/revalidate-cache.step.ts`** — Triggered na succesvolle scrape

```ts
import { EventConfig, Handlers } from "motia";
import { z } from "zod";

export const config: EventConfig = {
  type: "event",
  name: "RevalidateCache",
  description: "Invalideert Next.js cache tags na nieuwe jobs (event-driven ISR)",
  subscribes: ["scrape.completed"],
  emits: [],
  input: z.object({
    jobsNew: z.number(),
    platform: z.string(),
  }),
  flows: ["recruitment-scraper"],
};

export const handler: Handlers["RevalidateCache"] = async (input, { logger }) => {
  if (input.jobsNew === 0) return; // Geen nieuwe jobs → geen invalidatie nodig

  try {
    // Invalideer alle Next.js cache tags die job data tonen
    const tags = ["jobs", "scrape-results", "scraper-configs"];
    await Promise.all(
      tags.map((tag) =>
        fetch(`${process.env.NEXT_URL}/api/revalidate?tag=${tag}`, { method: "POST" })
      ),
    );
    logger.info(`Cache gerevalideerd: ${tags.join(", ")} (${input.jobsNew} nieuwe jobs van ${input.platform})`);
  } catch (err) {
    logger.warn(`Cache revalidatie mislukt (niet-kritisch): ${err}`);
    // Fire-and-forget: cache revalidatie mag nooit de pipeline blokkeren
  }
};
```

> **Next.js API route nodig:** `app/api/revalidate/route.ts` met `revalidateTag()` call.
> Voeg `NEXT_URL=http://localhost:3001` toe aan `.env`.

### 2.6 PATCH Scraper Config (Agent-Native: toggle actief/inactief)

**`steps/api/scraper-config-update.step.ts`** — PATCH /api/scraper-configuraties/:id

```ts
import { ApiRouteConfig, Handlers } from "motia";
import { z } from "zod";
import { db } from "../../src/db";
import { scraperConfigs } from "../../src/db/schema";
import { eq } from "drizzle-orm";

export const config: ApiRouteConfig = {
  type: "api",
  name: "UpdateScraperConfig",
  path: "/api/scraper-configuraties/:id",
  method: "PATCH",
  emits: [],
  bodySchema: z.object({
    isActive: z.boolean().optional(),
    cronExpression: z.string().optional(),
    parameters: z.record(z.any()).optional(),
  }),
  flows: ["recruitment-admin"],
};

export const handler: Handlers["UpdateScraperConfig"] = async (req, { logger }) => {
  const updated = await db
    .update(scraperConfigs)
    .set(req.body)
    .where(eq(scraperConfigs.id, req.params.id))
    .returning();

  if (!updated.length) return { status: 404, body: { fout: "Config niet gevonden" } };
  return { status: 200, body: { configuratie: updated[0] } };
};
```

> **Agent-Native fix:** De Switch in het scraper dashboard was niet gekoppeld aan een API.
> Nu kan zowel een mens (via UI) als een agent (via PATCH) een scraper aan/uitzetten.

### 2.7 Health Endpoint (Observability)

**`steps/api/gezondheid.step.ts`** — GET /api/gezondheid

```ts
import { ApiRouteConfig, Handlers } from "motia";
import { db } from "../../src/db";
import { scraperConfigs, scrapeResults } from "../../src/db/schema";
import { sql, desc, eq } from "drizzle-orm";

export const config: ApiRouteConfig = {
  type: "api",
  name: "Gezondheid",
  path: "/api/gezondheid",
  method: "GET",
  emits: [],
  flows: ["recruitment-admin"],
};

export const handler: Handlers["Gezondheid"] = async (_, { logger }) => {
  // Overzicht per platform: laatste run, failure rate afgelopen 24u
  const platforms = await db
    .select({
      platform: scraperConfigs.platform,
      isActive: scraperConfigs.isActive,
      lastRunAt: scraperConfigs.lastRunAt,
      lastRunStatus: scraperConfigs.lastRunStatus,
    })
    .from(scraperConfigs);

  const recentFailures = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(scrapeResults)
    .where(sql`status = 'failed' AND run_at > now() - interval '24 hours'`);

  return {
    status: 200,
    body: {
      status: recentFailures[0].count > 3 ? "waarschuwing" : "gezond",
      platformen: platforms,
      fallenAfgelopen24u: recentFailures[0].count,
      timestamp: new Date().toISOString(),
    },
  };
};
```

### 2.9 Scrape History API (for dashboard)

**`steps/api/scrape-history.step.ts`** — GET /api/scrape-resultaten

```ts
import { ApiRouteConfig, Handlers } from "motia";
import { db } from "../../src/db";
import { scrapeResults } from "../../src/db/schema";
import { desc } from "drizzle-orm";

export const config: ApiRouteConfig = {
  type: "api",
  name: "ListScrapeResults",
  path: "/api/scrape-resultaten",
  method: "GET",
  emits: [],
  flows: ["recruitment-admin"],
};

export const handler: Handlers["ListScrapeResults"] = async (
  req,
  { logger },
) => {
  const results = await db
    .select()
    .from(scrapeResults)
    .orderBy(desc(scrapeResults.runAt))
    .limit(50);
  return { status: 200, body: { results } };
};
```

---

## Slice 3: Indeed + LinkedIn (extra platformen)

**Doel:** Public scraper (Indeed via Firecrawl) + authenticated scraper (LinkedIn via Stagehand). Bewijst dat het adapter-patroon werkt met meerdere platformen.

### 3.1 Indeed Step (Public — Firecrawl)

**`steps/scraper/platforms/indeed.step.ts`**

```ts
import { EventConfig, Handlers } from "motia";
import { z } from "zod";
import Firecrawl from "firecrawl-js";

// NIET op module scope — env vars zijn mogelijk nog niet geladen bij import
// const firecrawl = new Firecrawl(...) ← FOUT

export const config: EventConfig = {
  type: "event",
  name: "ScrapeIndeed",
  description: "Scrapt Indeed opdrachten via Firecrawl (publiek, geen login)",
  subscribes: ["platform.scrape"],
  emits: ["jobs.normalize"],
  input: z.object({
    platform: z.string(),
    url: z.string().url(),
  }),
  flows: ["recruitment-scraper"],
};

export const handler: Handlers["ScrapeIndeed"] = async (
  input,
  { emit, logger },
) => {
  if (input.platform !== "indeed") return;

  logger.info(`Indeed scrapen: ${input.url}`);

  // Firecrawl client BINNEN handler (niet module scope — env vars laden)
  const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY! });

  const MAX_RETRIES = 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await firecrawl.scrapeUrl(input.url, {
    formats: ["json"],
    onlyMainContent: true,
    extract: {
      prompt:
        "Extraheer alle vacatures. Per vacature: titel, bedrijf, locatie, beschrijving, uniek ID, volledige URL, en vereisten als array.",
      schema: {
        type: "object",
        properties: {
          opdrachten: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                company: { type: "string" },
                location: { type: "string" },
                description: { type: "string" },
                externalId: { type: "string" },
                externalUrl: { type: "string" },
                requirements: { type: "array", items: { type: "string" } },
              },
              required: ["title", "externalId", "externalUrl", "description"],
            },
          },
        },
      },
    },
  });

      const listings = result?.extract?.opdrachten || [];
      logger.info(`Indeed: ${listings.length} opdrachten gevonden`);

      await emit({
        topic: "jobs.normalize",
        data: { platform: "indeed", listings },
      });
      return; // Succes → klaar
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const base = 1200 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 500);
        logger.warn(`Indeed scrape poging ${attempt + 1} mislukt, retry in ${base + jitter}ms: ${err}`);
        await new Promise((r) => setTimeout(r, base + jitter));
      }
    }
  }

  // Alle retries mislukt — ALTIJD emit (pipeline reliability)
  logger.error(`Indeed scrape definitief mislukt: ${lastError}`);
  await emit({
    topic: "jobs.normalize",
    data: { platform: "indeed", listings: [] },
  });
};
```

### 3.2 LinkedIn Step (Authenticated — Stagehand)

**`steps/scraper/platforms/linkedin.step.ts`**

```ts
import { EventConfig, Handlers } from "motia";
import { z } from "zod";
import { Stagehand } from "@browserbasehq/stagehand";

export const config: EventConfig = {
  type: "event",
  name: "ScrapeLinkedIn",
  description: "Scrapt LinkedIn vacatures via Stagehand (ingelogd)",
  subscribes: ["platform.scrape"],
  emits: ["jobs.normalize"],
  input: z.object({ platform: z.string(), url: z.string().url() }),
  flows: ["recruitment-scraper"],
};

export const handler: Handlers["ScrapeLinkedIn"] = async (
  input,
  { emit, logger },
) => {
  if (input.platform !== "linkedin") return;

  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
  });

  await stagehand.init();

  try {
    await stagehand.page.goto(input.url);

    const result = await stagehand.extract({
      instruction:
        "Extraheer alle vacatures. Per vacature: titel, bedrijf, locatie, beschrijving, uniek ID, en volledige URL.",
      schema: z.object({
        opdrachten: z.array(
          z.object({
            title: z.string(),
            company: z.string(),
            location: z.string(),
            description: z.string(),
            externalId: z.string(),
            externalUrl: z.string(),
          }),
        ),
      }),
    });

    await emit({
      topic: "jobs.normalize",
      data: { platform: "linkedin", listings: result.opdrachten },
    });

    logger.info(`LinkedIn: ${result.opdrachten.length} opdrachten gevonden`);
  } finally {
    await stagehand.close();
  }
};
```

> **LinkedIn vereist authenticatie.** Configureer een persistent browser session in Browserbase dashboard.
> Voeg `LINKEDIN_USERNAME` en `LINKEDIN_PASSWORD` toe aan `.env` indien nodig.

---

## Slice 4: Next.js 16 UI — ChatGPT-stijl Interface

**Doel:** Volledige Nederlandstalige UI met Next.js 16 App Router + shadcn/ui + OpenAI Apps SDK UI design tokens. Visueel identiek aan ChatGPT: donker thema, minimalistisch, monochroom icons, subtiele hover states.

### 4.0 UI Design System: ChatGPT-achtig

**Designfilosofie** (gebaseerd op [OpenAI Apps SDK UI](https://openai.github.io/apps-sdk-ui/)):

| Principe | Implementatie |
|----------|--------------|
| **Donker-eerst** | `#212121` achtergrond, `#2f2f2f` cards, `#424242` borders |
| **Minimaal kleurgebruik** | Monochroom UI, accent alleen op primaire acties (`#3A10E5` → OpenAI paars) |
| **Systeem fonts** | SF Pro / Roboto / system-ui — geen custom fonts |
| **Subtiele hiërarchie** | heading-md (1.25rem/600) → text-sm (0.875rem/400) |
| **Monochrome icons** | Outlined, consistent stroke, nooit filled |
| **Ruimte** | Veel whitespace, geen edge-to-edge tekst, consistent padding |

**Kleur tokens** (CSS variabelen in `globals.css`):

```css
:root {
  /* ChatGPT Light Theme */
  --background: #ffffff;
  --foreground: #0d0d0d;
  --card: #f7f7f8;
  --card-foreground: #0d0d0d;
  --border: #ededed;
  --input: #ededed;
  --primary: #3A10E5;          /* OpenAI paars */
  --primary-foreground: #ffffff;
  --secondary: #f7f7f8;
  --secondary-foreground: #0d0d0d;
  --muted: #ececec;
  --muted-foreground: #6e6e80;
  --accent: #f7f7f8;
  --destructive: #ef4444;
  --ring: #3A10E5;
  --radius: 0.75rem;           /* ChatGPT border-radius */

  /* Scraper status kleuren */
  --status-success: #10b981;
  --status-partial: #f59e0b;
  --status-failed: #ef4444;
}

.dark {
  /* ChatGPT Dark Theme (standaard) */
  --background: #212121;
  --foreground: #ececec;
  --card: #2f2f2f;
  --card-foreground: #ececec;
  --border: #424242;
  --input: #393939;
  --primary: #7c6aef;          /* Lichter paars voor dark mode */
  --primary-foreground: #ffffff;
  --secondary: #2f2f2f;
  --secondary-foreground: #ececec;
  --muted: #393939;
  --muted-foreground: #b4b4b4;
  --accent: #393939;
}
```

**Typography schaal** (OpenAI Apps SDK UI tokens):

| Gebruik | Grootte | Gewicht | Tracking |
|---------|---------|---------|----------|
| Pagina titel | heading-xl (2rem) | 600 | -0.02em |
| Sectie titel | heading-md (1.25rem) | 600 | -0.01em |
| Card titel | heading-sm (1.125rem) | 600 | -0.01em |
| Body tekst | text-md (1rem) | 400 | -0.01em |
| Meta/label | text-sm (0.875rem) | 400 | -0.01em |
| Badge/tag | text-xs (0.75rem) | 400 | 0em |

**shadcn/ui componenten** (installeer naar behoefte):

```bash
# Basis componenten
npx shadcn-ui@latest add button card input badge table dialog
npx shadcn-ui@latest add command sheet separator skeleton
npx shadcn-ui@latest add dropdown-menu toggle tooltip avatar
npx shadcn-ui@latest add tabs switch scroll-area
```

**OpenAI Apps SDK UI componenten** (beschikbaar via `@openai/apps-sdk-ui`):

| Component | Gebruik in ons project |
|-----------|----------------------|
| `Button` | Primaire acties (Scrape starten, Opslaan) |
| `Badge` | Platform labels (Striive, Indeed) |
| `Avatar` / `AvatarGroup` | Kandidaat profielen |
| `Modal` | Bevestigingsdialogen |
| `Tooltip` | Hover info op status icons |
| `Switch` | Scraper actief/inactief toggle |
| `Select` | Platform filter dropdown |
| `Input` | Zoekvelden |
| `CodeBlock` | Raw payload viewer |
| `Alert` | Foutmeldingen en waarschuwingen |
| `EmptyMessage` | Lege states ("Geen opdrachten gevonden") |
| `Indicator` | Status dots (success/partial/failed) |
| `Markdown` | Opdracht beschrijving rendering |
| `Menu` | Sidebar navigatie items |

> **Strategie:** Gebruik shadcn/ui als basis (volledige controle over code), mix met OpenAI Apps SDK UI componenten voor ChatGPT-authentieke elementen (Badge, Indicator, CodeBlock). De ChatGPT design tokens komen via CSS variabelen in `globals.css`.

### 4.0b Next.js 16 Setup

**`app/layout.tsx`** — Root layout met dark theme

```tsx
import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Sidebar } from "@/components/sidebar";
import "@/globals.css";

export const metadata: Metadata = {
  title: "Recruitment Platform",
  description: "AI-gestuurde recruitment operations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider defaultTheme="dark" attribute="class">
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto bg-background">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

**`app/components/sidebar.tsx`** — ChatGPT-stijl sidebar

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navigatie = [
  { label: "Dashboard", href: "/", icon: "LayoutDashboard" },
  { label: "Opdrachten", href: "/opdrachten", icon: "Briefcase" },
  { label: "Scraper", href: "/scraper", icon: "Bot" },
  { label: "Kandidaten", href: "/kandidaten", icon: "Users" },
  { label: "Matches", href: "/matches", icon: "Sparkles" },
  { label: "Sollicitaties", href: "/sollicitaties", icon: "FileText" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-secondary flex flex-col">
      <div className="p-4 border-b border-border">
        <h1 className="text-heading-sm font-semibold">Recruitment</h1>
        <p className="text-text-xs text-muted-foreground">Operations Platform</p>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {navigatie.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-text-sm transition-colors",
              pathname === item.href
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

### 4.1 Opdrachten Lijst API

**`steps/api/jobs-list.step.ts`** — GET /api/opdrachten

```ts
import { ApiRouteConfig, Handlers } from "motia";
import { db, jobs } from "../../src/db";
import { ilike, desc, and, eq, isNull, sql } from "drizzle-orm";

export const config: ApiRouteConfig = {
  type: "api",
  name: "ZoekOpdrachten",
  path: "/api/opdrachten",
  method: "GET",
  emits: [],
  flows: ["recruitment-api"],
};

export const handler: Handlers["ZoekOpdrachten"] = async (req, { logger }) => {
  const { zoek, platform, pagina = "1", limiet = "20" } = req.query;
  const offset = (Number(pagina) - 1) * Number(limiet);

  const conditions = [isNull(jobs.deletedAt)]; // Soft-delete filter
  if (zoek) {
    // Full-text search met Nederlandse stemming (vereist: tsvector index op jobs)
    // Fallback naar ilike als pg_trgm/tsvector niet beschikbaar is
    conditions.push(
      sql`to_tsvector('dutch', coalesce(${jobs.title},'') || ' ' || coalesce(${jobs.description},'')) @@ plainto_tsquery('dutch', ${zoek})`
    );
  }
  if (platform) conditions.push(eq(jobs.platform, platform as string));

  const [resultaten, [{ total }]] = await Promise.all([
    db
      .select()
      .from(jobs)
      .where(and(...conditions))
      .orderBy(desc(jobs.scrapedAt))
      .limit(Number(limiet))
      .offset(offset),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(jobs)
      .where(and(...conditions)),
  ]);

  return {
    status: 200,
    body: {
      opdrachten: resultaten,
      pagina: Number(pagina),
      totaal: total,
      totaalPaginas: Math.ceil(total / Number(limiet)),
    },
  };
};
```

**`steps/api/jobs-detail.step.ts`** — GET /api/opdrachten/:id

```ts
import { ApiRouteConfig, Handlers } from "motia";
import { db, jobs } from "../../src/db";
import { eq, isNull, and } from "drizzle-orm";

export const config: ApiRouteConfig = {
  type: "api",
  name: "BekijkOpdracht",
  path: "/api/opdrachten/:id",
  method: "GET",
  emits: [],
  flows: ["recruitment-api"],
};

export const handler: Handlers["BekijkOpdracht"] = async (req, { logger }) => {
  const resultaat = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, req.params.id), isNull(jobs.deletedAt)));
  if (!resultaat.length)
    return { status: 404, body: { fout: "Opdracht niet gevonden" } };
  return { status: 200, body: { opdracht: resultaat[0] } };
};
```

### 4.2 Opdrachten Pagina (Next.js Server Component)

**`app/opdrachten/page.tsx`**

```tsx
import { Suspense } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// MOTIA_API_URL = de Motia server URL (bijv. http://localhost:3000 in dev)
// Definieer in .env: MOTIA_API_URL=http://localhost:3000
// Alternatief (sneller, -20-100ms): direct DB access via server-side import
async function getOpdrachten(zoek?: string, platform?: string) {
  const params = new URLSearchParams();
  if (zoek) params.set("zoek", zoek);
  if (platform) params.set("platform", platform);

  const res = await fetch(
    `${process.env.MOTIA_API_URL}/api/opdrachten?${params}`,
    { next: { tags: ["jobs"], revalidate: 14400 } } // Cache tags + 4h fallback; webhook revalideert bij nieuwe jobs
  );
  return res.json();
}

export default async function OpdrachtenPagina({
  searchParams,
}: {
  searchParams: { zoek?: string; platform?: string };
}) {
  const { opdrachten } = await getOpdrachten(searchParams.zoek, searchParams.platform);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Opdrachten</h1>
        <p className="text-muted-foreground text-sm">
          {opdrachten.length} opdrachten gevonden
        </p>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Zoek opdrachten..."
          defaultValue={searchParams.zoek}
          className="max-w-sm bg-secondary border-border"
        />
      </div>

      <div className="grid gap-4">
        {opdrachten.map((job: any) => (
          <Card key={job.id} className="bg-card border-border hover:border-primary/30 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">{job.title}</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {job.platform}
                </Badge>
              </div>
              <div className="flex gap-2 text-sm text-muted-foreground">
                {job.company && <span>{job.company}</span>}
                {job.location && <span>• {job.location}</span>}
                {job.rateMax && (
                  <span>
                    • €{job.rateMin ?? "?"}-{job.rateMax}/uur
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {job.description}
              </p>
              {job.requirements?.length > 0 && (
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {job.requirements.slice(0, 5).map((req: string) => (
                    <Badge key={req} variant="secondary" className="text-xs">
                      {req}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

### 4.3 Scraper Dashboard Pagina

**`app/scraper/page.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

async function getConfigs() {
  const res = await fetch(`${process.env.MOTIA_API_URL}/api/scraper-configuraties`, {
    next: { tags: ["scraper-configs"], revalidate: 3600 }, // Cache tag + 1h fallback
  });
  return res.json();
}

async function getHistory() {
  const res = await fetch(`${process.env.MOTIA_API_URL}/api/scrape-resultaten`, {
    next: { tags: ["scrape-results"], revalidate: 300 }, // Cache tag + 5min fallback
  });
  return res.json();
}

export default async function ScraperDashboard() {
  const [{ configuraties }, { results }] = await Promise.all([
    getConfigs(),
    getHistory(),
  ]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scraper Dashboard</h1>
          <p className="text-muted-foreground text-sm">Beheer en monitor alle platformen</p>
        </div>
        <Button>Alles Scrapen</Button>
      </div>

      {/* Platform Kaarten */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {configuraties?.map((config: any) => (
          <Card key={config.id} className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold capitalize">
                  {config.platform}
                </CardTitle>
                <Switch checked={config.isActive} />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Laatste run</span>
                <span>{config.lastRunAt ? new Date(config.lastRunAt).toLocaleString("nl-NL") : "Nooit"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  variant={config.lastRunStatus === "success" ? "default" : "destructive"}
                  className="text-xs"
                >
                  {config.lastRunStatus ?? "Onbekend"}
                </Badge>
              </div>
              <Button variant="outline" size="sm" className="w-full mt-2">
                Nu Scrapen
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Scrape Geschiedenis Tabel */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Recente Runs</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="text-left p-3 text-muted-foreground font-medium">Platform</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Tijd</th>
                <th className="text-right p-3 text-muted-foreground font-medium">Nieuw</th>
                <th className="text-right p-3 text-muted-foreground font-medium">Dupes</th>
                <th className="text-right p-3 text-muted-foreground font-medium">Duur</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {results?.map((r: any) => (
                <tr key={r.id} className="border-t border-border hover:bg-accent/30">
                  <td className="p-3 capitalize">{r.platform}</td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(r.runAt).toLocaleString("nl-NL")}
                  </td>
                  <td className="p-3 text-right">{r.jobsNew}</td>
                  <td className="p-3 text-right text-muted-foreground">{r.duplicates}</td>
                  <td className="p-3 text-right text-muted-foreground">{r.durationMs}ms</td>
                  <td className="p-3">
                    <Badge
                      variant={r.status === "success" ? "default" : r.status === "partial" ? "outline" : "destructive"}
                      className="text-xs"
                    >
                      {r.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

### 4.4 Storybook + Agentation Setup

**Initialiseer Storybook:**

```bash
npx storybook@latest init
```

**Voeg Agentation toolbar toe** (visuele feedback voor AI agents):

```bash
npx agentation init
```

> **Agentation** plaatst een toolbar in de rechteronderhoek waarmee je elementen kunt aanklikken en annoteren.
> De output bevat CSS selectors + posities zodat AI agents exact weten welke code je bedoelt.
> Met **MCP integratie** hoef je niet eens te kopiëren — annoteer en praat direct met je agent.

**Agent-Native principe:** Storybook + Agentation + OpenAI Apps SDK UI zorgen dat zowel mensen als agents visuele feedback kunnen geven op UI componenten — met dezelfde design language als ChatGPT.

### 4.5 Nederlandstalige API Overzicht (Agent-Native: elke UI-actie = API)

| Endpoint                          | Methode | Beschrijving                                          |
| --------------------------------- | ------- | ----------------------------------------------------- |
| `/api/opdrachten`                 | GET     | Zoek opdrachten (query: `zoek`, `platform`, `pagina`) |
| `/api/opdrachten/:id`             | GET     | Bekijk specifieke opdracht                            |
| `/api/scraper-configuraties`      | GET     | Lijst scraper instellingen                            |
| `/api/scraper-configuraties/:id`  | PATCH   | Scraper aan/uitzetten, config wijzigen                |
| `/api/scrape/starten`             | POST    | Handmatig scrape triggeren                            |
| `/api/scrape-resultaten`          | GET     | Scrape geschiedenis                                   |
| `/api/gezondheid`                 | GET     | Health check: platform status + failure rate          |
| `/api/kandidaten`                 | GET/POST| Kandidaten beheren (Slice 5)                          |
| `/api/matches`                    | GET     | AI match resultaten (Slice 5)                         |
| `/api/matches/:id`                | PATCH   | Match goedkeuren/afwijzen (human-in-the-loop)         |
| `/api/sollicitaties`              | GET/POST| Sollicitaties beheren (Slice 6)                       |
| `/api/revalidate`                 | POST    | Cache invalidatie (intern, door Motia steps)          |

---

## Slice 5: AI Grading + Matching

**Doel:** AI beoordeelt vacatures op basis van profiel en geeft match-score.

### 5.1 Nieuwe tabellen

```ts
export const candidates = pgTable("candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  skills: jsonb("skills").default([]),
  experience: jsonb("experience").default([]),
  preferences: jsonb("preferences").default({}),
  resumeUrl: text("resume_url"),
  embedding: text("embedding"),       // pgvector: vector(1024) in productie — twee-fase matching
  consentGranted: boolean("consent_granted").default(false), // GDPR: expliciete toestemming
  dataRetentionUntil: timestamp("data_retention_until"),     // GDPR: automatische opschoning
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"), // PRD A.5: soft-delete
});

export const jobMatches = pgTable("job_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "restrict" }), // PRD 7.2
  candidateId: uuid("candidate_id").references(() => candidates.id, {
    onDelete: "restrict",
  }),
  matchScore: integer("match_score"), // 0-100
  confidence: integer("confidence"),  // 0-100: model zekerheid
  reasoning: text("reasoning"), // PRD 4.5: explainable AI outputs
  model: text("model"),              // bijv. "gpt-4o", "claude-sonnet-4-6" — traceerbaarheid
  promptVersion: text("prompt_version"), // versie van de grading prompt
  status: text("status").default("pending"), // pending | approved | rejected (human-in-the-loop)
  gradedAt: timestamp("graded_at").defaultNow(),
});
```

> **PRD Compliance Notes:**
>
> - `onDelete: 'restrict'` on FKs per PRD 7.2 delete guards
> - `deletedAt` for soft-delete per PRD A.5
> - `reasoning` for explainable AI per PRD 4.5 & PRD 10

### 5.2 Twee-Fase AI Matching Pipeline

De matching werkt in twee fases (GPT + Gemini convergeerden hier):

```
Fase 1: RETRIEVE (snel, goedkoop)
  → Genereer embedding van kandidaat profiel
  → pgvector cosine similarity search tegen job embeddings
  → Top 50 matches in <50ms

Fase 2: RERANK (diep, duur — alleen top resultaten)
  → Stuur top 50 jobs + kandidaat naar LLM
  → LLM geeft score (0-100), confidence, en reasoning
  → Sla op in job_matches met model + promptVersion
```

**Benodigde Motia Steps:**

| Step | Event | Beschrijving |
|------|-------|-------------|
| `EmbedJobs` | `subscribes: ["scrape.completed"]` | Genereer embeddings voor nieuwe/gewijzigde jobs |
| `EmbedCandidate` | `subscribes: ["candidate.updated"]` | Genereer embedding bij kandidaat aanmaak/wijziging |
| `RetrieveMatches` | `subscribes: ["matches.retrieve"]` | pgvector similarity search → top 50 |
| `GradeJob` | `subscribes: ["jobs.grade"]` | LLM reranking op shortlist |
| `ReviewMatch` | API: `PATCH /api/matches/:id` | Human-in-the-loop goedkeuring/afwijzing |

**`steps/jobs/grade.step.ts`** (Fase 2: LLM Reranking)

```ts
import { EventConfig, Handlers } from "motia";
import { z } from "zod";

export const config: EventConfig = {
  type: "event",
  name: "GradeJob",
  description: "AI gradeert shortlisted jobs voor kandidaat (fase 2: LLM rerank)",
  subscribes: ["jobs.grade"],
  emits: ["jobs.graded"],
  input: z.object({
    jobId: z.string(),
    candidateId: z.string(),
  }),
  flows: ["recruitment-matching"],
};

export const handler: Handlers["GradeJob"] = async (
  input,
  { emit, logger },
) => {
  // 1. Haal job + kandidaat op uit DB (incl. skills, experience, preferences)
  // 2. Bouw grading prompt met gestructureerde context
  // 3. Roep LLM aan voor diepe reasoning + score
  // 4. Sla op in job_matches met model, promptVersion, confidence
  // 5. Emit resultaat voor notificatie/dashboard

  logger.info(
    `Job ${input.jobId} gegraded voor kandidaat ${input.candidateId}`,
  );

  await emit({
    topic: "jobs.graded",
    data: {
      jobId: input.jobId,
      candidateId: input.candidateId,
      score: 85,
      confidence: 92,
      model: "claude-sonnet-4-6",
      promptVersion: "v1.0",
    },
  });
};
```

> **PostgreSQL Extensies (eenmalig via Neon dashboard):**
> ```sql
> CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- Fuzzy zoeken
> CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector voor embeddings
> ```
>
> **Migratie voor full-text + trigram indexes:**
> ```sql
> -- Trigram index voor fuzzy/typo zoeken
> CREATE INDEX idx_jobs_title_trgm ON jobs USING gin (title gin_trgm_ops);
> -- Full-text search met Nederlandse stemming
> CREATE INDEX idx_jobs_fts ON jobs USING gin (
>   to_tsvector('dutch', coalesce(title,'') || ' ' || coalesce(description,''))
> );
> ```

---

## Belangrijke Motia API Referentie

### Config Types (importeer uit 'motia')

| Type             | Gebruik            | Trigger                           |
| ---------------- | ------------------ | --------------------------------- |
| `CronConfig`     | Scheduled taken    | `cron: '0 */4 * * *'`             |
| `EventConfig`    | Event-driven steps | `subscribes: ['topic']`           |
| `ApiRouteConfig` | HTTP endpoints     | `path: '/api/...', method: 'GET'` |

### Handler Signatures

```ts
// Cron — geen input, alleen context
export const handler: Handlers['StepName'] = async ({ emit, logger, state, traceId }) => { }

// Event — input + context
export const handler: Handlers['StepName'] = async (input, { emit, logger, state, traceId }) => { }

// API — request + context (return response)
export const handler: Handlers['StepName'] = async (req, { emit, logger, state, traceId }) => {
  return { status: 200, body: { ... } };
}
```

### Context Object (beschikbaar in alle handlers)

| Property                           | Beschrijving                     |
| ---------------------------------- | -------------------------------- |
| `emit({ topic, data })`            | Stuur event naar andere steps    |
| `logger.info/warn/error()`         | Gestructureerde logging          |
| `state.set(namespace, key, value)` | Key-value state store            |
| `state.get(namespace, key)`        | State ophalen                    |
| `traceId`                          | Unieke trace ID voor dit request |
| `streams`                          | Server-Sent Events streaming     |

### Bestandsnaming

- TypeScript: `kebab-case.step.ts` (bijv. `master-scrape.step.ts`)
- Python: `snake_case_step.py`
- Motia ontdekt automatisch alle `*.step.ts` bestanden

---

---

## Architectuur Beslissingen (Review Ronde 1 + Multi-Model Blend)

De volgende beslissingen zijn genomen na architectuur-review, performance-review, en multi-model blending (GPT Pro + Gemini Deep Think).

### Resilience & Reliability

| Beslissing | Rationale | Bron |
|-----------|-----------|------|
| **Exponential backoff met jitter** | Voorkomt thundering herd bij Browserbase rate limits. `1200 * 2^attempt + random(500)ms` | GPT + Gemini |
| **Altijd emit**, ook bij lege resultaten | Pipeline moet volledig traceerbaar zijn. Geen "stille" failures. | Review R1 |
| **Batch inserts** i.p.v. per-row loop | 25-50x sneller. Neon param limit ~65k, batch van 50 rows is veilig. | Review R1 |
| **Firecrawl client BINNEN handler** | Module-scope instantiatie leest `process.env` bij import → mogelijk `undefined`. | Review R1 |
| **Paginated extraction** in Striive | Niet alleen "zichtbare items" maar MAX_PAGES loop met "Volgende" detectie. | GPT |
| **Upsert i.p.v. insert-only** | `onConflictDoUpdate` houdt job data actueel + revive soft-deleted jobs. | GPT |

### Database & Performance

| Beslissing | Rationale | Bron |
|-----------|-----------|------|
| **Connection pool** (max: 10, idle: 30s) | Neon free tier limiet. | Review R1 |
| **B-tree + trigram + tsvector indexes** | B-tree voor sorts, `pg_trgm` voor fuzzy, `tsvector('dutch',...)` voor full-text. | GPT + Gemini |
| **pgvector embeddings** op jobs + candidates | Twee-fase matching: vector retrieve → LLM rerank. 10-100x goedkoper. | GPT + Gemini |
| **Platform-scoped URL uniqueness** | URLs zijn platform-specifiek; global unique is te restrictief. | GPT |
| **configId FK: SET NULL** i.p.v. RESTRICT | configId is nullable (scrapes zonder config). | Review R1 |
| **`z.coerce.date()`** voor postedAt | Scrapers geven strings, DB verwacht Date. | Review R1 |

### Security & Privacy

| Beslissing | Rationale | Bron |
|-----------|-----------|------|
| **Encrypted authConfig** (AES-256-GCM) | Plaintext credentials in DB = security violation. `text("auth_config_encrypted")`. | Gemini |
| **GDPR velden** op candidates | `consentGranted` + `dataRetentionUntil` — wettelijk verplicht voor NL recruitment. | Gemini |
| **Credentials alleen in .env** | Nooit in code, docs, of DB in plaintext. Placeholder waarden in docs. | Review R1 |

### Event Architecture & Caching

| Beslissing | Rationale | Bron |
|-----------|-----------|------|
| **Event-driven cache revalidatie** | Next.js cache tags (`jobs`, `scrape-results`) + `revalidateTag()` na scrape.completed. | Gemini |
| **ISR met 4h fallback** | `next: { tags: ["jobs"], revalidate: 14400 }` — instant bij webhook, max 4h stale. | Gemini |
| **Platform filter in handler** | Motia fan-out is goedkoop; elke step filtert zelf. | Review R1 |

### AI Matching

| Beslissing | Rationale | Bron |
|-----------|-----------|------|
| **Twee-fase matching** (retrieve + rerank) | Pairwise LLM matching is O(N*M) en onbetaalbaar. Vector shortlist + LLM rerank = schaalbaar. | GPT + Gemini |
| **Model + promptVersion tracking** | Traceerbaarheid en reproduceerbaarheid van AI outputs. | GPT |
| **Human-in-the-loop review** | `status: pending/approved/rejected` op matches — recruiters valideren AI suggesties. | GPT |

### Toekomstige Verbeteringen (niet in MVP)

- **ScrapeRun orchestratie** — Durable run entity met idempotency keys en locking (GPT plan)
- **Scrape artifacts** — HTML snapshots + extracted JSON voor debugging (GPT plan)
- **Dead-letter queue** — Permanente failures apart opslaan (GPT plan)
- **Scrape Sandbox UI** — Plak URL, test extractie, promoveer naar adapter (GPT plan)
- **GDPR opschoning cron** — Automatische verwijdering na `dataRetentionUntil` (Gemini plan)
- **API authenticatie** — Bearer token of session-based auth
- **Rate limiting** — Max requests per IP
- **Distributed lock** op cron — voorkomen overlappende runs
- **Neon serverless driver** — `@neondatabase/serverless` voor HTTP-pooling
- **Direct DB access** vanuit Server Components (bypass Motia API voor leesoperaties)

---

## Slice 6: Application & Pipeline Tracking (PRD 4.7)

**Doel:** Volledige sollicitatie-lifecycle van kandidaat → interview → plaatsing.

### 6.1 Nieuwe tabellen

```ts
export const applications = pgTable("applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id").references(() => candidates.id, {
    onDelete: "restrict",
  }),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "restrict" }),
  stage: text("stage").notNull().default("applied"), // applied, screening, interview, offer, placed, rejected
  notes: text("notes"),
  appliedAt: timestamp("applied_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const interviews = pgTable("interviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  applicationId: uuid("application_id").references(() => applications.id, {
    onDelete: "restrict",
  }),
  scheduledAt: timestamp("scheduled_at"),
  feedback: text("feedback"),
  score: integer("score"),
  status: text("status").default("scheduled"), // scheduled, completed, cancelled
  createdAt: timestamp("created_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  candidateId: uuid("candidate_id").references(() => candidates.id, {
    onDelete: "restrict",
  }),
  applicationId: uuid("application_id").references(() => applications.id),
  direction: text("direction").notNull(), // inbound, outbound
  channel: text("channel").notNull(), // email, phone, platform
  content: text("content"),
  sentAt: timestamp("sent_at").defaultNow(),
});
```

### 6.2 Pipeline Steps

- `steps/api/applications.step.ts` — CRUD for applications
- `steps/api/interviews.step.ts` — CRUD for interviews
- `steps/pipeline/stage-change.step.ts` — Event step for stage transitions with audit logging

---

## Slice 7: Kwaliteitsharnas (Harness Engineering)

**Doel:** Het "harnas" dat agents succesvol maakt — kwaliteitspoorten en visuele feedback.

### 7.1 Kwaliteitspipeline (automatisch via git hooks)

```
Code geschreven (door mens of agent)
  ↓
Pre-commit hook: qlty fmt (auto-formatting)
  ↓
Pre-push hook: qlty check (60+ linter regels)
  ↓
CI: pnpm test (Vitest unit + contract tests)
  ↓
CI: qlty check --all (volledige codebase scan)
  ↓
Merge naar main
```

### 7.2 CLAUDE.md Kwaliteitsregels

```markdown
# Kwaliteitsregels (gegenereerd door ultracite + handmatig)

## Verplicht voor elke wijziging

- Draai `qlty fmt` voor auto-formatting
- Draai `qlty check --fix --level=low` voor linting
- Draai `pnpm test` voor unit tests
- Schrijf contract test voor elke nieuwe adapter (PRD A.8)

## Taal

- UI labels, foutmeldingen, API response velden: NEDERLANDS
- Code variabelen, functies, imports: ENGELS
- API paden: Nederlands (/api/opdrachten, /api/scrape-resultaten)

## Agent-Native

- Elke UI-actie MOET een corresponderende API step hebben
- Gebruik Agentation toolbar voor visuele feedback op componenten
- Storybook story verplicht voor elk UI component
```

### 7.4 Agentation Self-Driving Design Critique

```bash
# Agent opent browser, scrollt door je pagina, en annoteert design problemen
npx agentation critique http://localhost:3000
```

> De agent geeft visuele feedback via de Agentation toolbar — dezelfde tool die menselijke designers gebruiken.
> Dit is **agent-native pariteit**: de agent en de mens gebruiken exact hetzelfde feedback-instrument.

---

## PRD Compliance Checklist

| PRD Requirement                                         | Slice   | Status                                                             |
| ------------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| **4.1** Pluggable adapters                              | 1, 3    | Event steps per platform (Striive, Indeed, LinkedIn)               |
| **4.1** Public + authenticated modes                    | 1, 3    | Stagehand (auth: Striive, LinkedIn) + Firecrawl (public: Indeed)   |
| **4.1** Mandatory normalization layer                   | 1       | NormalizeJobs step + Zod schema                                    |
| **4.1** Dedup on (platform, externalId)                 | 1       | Composite uniqueIndex + onConflictDoUpdate (upsert + revive)       |
| **4.1** Persist raw payload                             | 1       | `rawPayload` JSONB column                                          |
| **4.1** Track ingestion metrics                         | 2       | scrape.completed → RecordScrapeResult                              |
| **4.2** ScraperConfig entity                            | 2       | Alle PRD 7.1 velden aanwezig incl. authConfig                      |
| **4.2** ScrapeResult entity                             | 2       | Alle PRD 7.1 velden (configId FK, durationMs, status, errors JSON) |
| **4.2** Manual + scheduled triggers                     | 1, 2    | CronConfig + POST /api/scrape/starten                              |
| **4.3** Job Discovery                                   | 4       | GET /api/opdrachten met zoek + filters                             |
| **4.4** Candidate Management                            | 5       | candidates tabel met soft-delete + GDPR velden + embedding         |
| **4.5** AI Evaluation                                   | 5       | Twee-fase: pgvector retrieve → LLM rerank met reasoning            |
| **4.6** Matching                                        | 5       | jobMatches met score, confidence, model, promptVersion, review     |
| **4.7** Application & Pipeline                          | 6       | applications, interviews, messages                                 |
| **4.8** Operator Dashboard                              | 2, 4    | Next.js 16 + shadcn/ui + ChatGPT design tokens                    |
| **7.1** Job entity: currency                            | 1       | Toegevoegd (default: EUR)                                          |
| **7.1** Job entity: postedAt                            | 1       | In Zod schema + DB                                                 |
| **7.2** Composite unique (platform, externalId)         | 1       | uniqueIndex op composite                                           |
| **7.2** Soft-delete (deletedAt)                         | 1, 5, 6 | Alle hoofdentiteiten                                               |
| **7.2** FK met ON DELETE RESTRICT                       | 2, 5, 6 | Alle foreign keys                                                  |
| **8** Extensibility: nieuw platform = zero core changes | Alle    | Nieuw step bestand + config rij                                    |
| **8** Reliability: geïsoleerde platform failures        | 1       | Elke platform step filtert onafhankelijk + exp. backoff + jitter  |
| **8** Reliability: pipeline altijd traceerbaar          | 1       | ALTIJD emit scrape.completed, ook bij failures/lege resultaten    |
| **8** Performance: batch upserts                        | 1       | Batch van 50 rows met onConflictDoUpdate (25-50x sneller)         |
| **8** Performance: DB indexes                           | 1, 2    | B-tree + trigram + tsvector + pgvector indexes                    |
| **8** Performance: connection pooling                   | 1       | Pool max:10, idle:30s, timeout:5s voor Neon                       |
| **8** Observability: traceId + structured logs          | Alle    | Motia ingebouwd traceId + logger                                   |
| **8** Security: credentials encrypted                   | 1, 2    | .env (dev) + AES-256-GCM encrypted authConfig in DB (prod)        |
| **8** Security: geen echte credentials in docs          | Alle    | .env voorbeeld gebruikt placeholders, niet echte wachtwoorden     |
| **8** Search: full-text + fuzzy                         | 4       | tsvector('dutch',...) + pg_trgm indexes op jobs tabel             |
| **8** Caching: event-driven ISR                         | 2       | Cache tags + revalidateTag() na scrape.completed                  |
| **A.5** JSONB voor rawPayload, requirements, errors     | 1, 2    | Alle JSONB kolommen aanwezig                                       |
| **A.8** TDD met unit + contract + fixture tests         | 1+      | Vitest + Qlty + HTML fixture tests voor scrapers                  |
| **NEW** Agent-Native pariteit                           | Alle    | Elke UI-actie = API endpoint (incl. PATCH config, PATCH match)    |
| **NEW** Harness Engineering                             | 7       | Ultracite + Qlty + git hooks + CLAUDE.md                           |
| **NEW** Visuele feedback                                | 4, 7    | Storybook + Agentation toolbar                                     |
| **NEW** Nederlandstalige UI                             | Alle    | API paden, responses, logs in NL                                   |
| **NEW** ChatGPT-stijl UI                                | 4       | Next.js 16 + shadcn/ui + OpenAI Apps SDK UI tokens                |
| **NEW** Upsert + soft-delete revival                    | 1       | onConflictDoUpdate met deletedAt: null bij hernieuwde scrape      |
| **NEW** Twee-fase AI matching                           | 5       | pgvector retrieve → LLM rerank (10-100x goedkoper)               |
| **NEW** Model/prompt traceerbaarheid                    | 5       | model, promptVersion, confidence op jobMatches                    |
| **NEW** Human-in-the-loop matching                      | 5       | status: pending/approved/rejected + PATCH /api/matches/:id        |
| **NEW** GDPR compliance                                 | 5       | consentGranted + dataRetentionUntil op candidates                 |
| **NEW** Encrypted authConfig                            | 2       | AES-256-GCM i.p.v. plaintext JSONB                               |
| **NEW** Health endpoint                                 | 2       | GET /api/gezondheid — platform status + failure rate              |
| **NEW** Paginated scraping                              | 1       | MAX_PAGES loop met "Volgende" knop detectie                       |
| **NEW** Exponential backoff met jitter                  | 1, 3    | 1200 * 2^attempt + random(500)ms op alle scrapers                 |

---

## Volgende Stappen

| #   | Slice                     | Beschrijving                                    | Eerste Platform  |
| --- | ------------------------- | ----------------------------------------------- | ---------------- |
| 1   | **Striive Scraper**       | Authenticated scraping → normalize → dedup → DB | Striive.com      |
| 2   | **Dashboard + Config**    | ScraperConfig + ScrapeResult + admin API        | —                |
| 3   | **Extra Platformen**      | Indeed (public) + LinkedIn (auth)               | Indeed, LinkedIn |
| 4   | **Next.js 16 UI**         | ChatGPT-stijl UI + shadcn + Storybook            | —                |
| 5   | **AI Matching**           | Kandidaten + AI grading + match scores          | —                |
| 6   | **Sollicitatie Pipeline** | Applications, interviews, messages              | —                |
| 7   | **Kwaliteitsharnas**      | Ultracite + Qlty + Agentation design critique   | —                |

→ Zeg **"implementeer Slice 1"** om alle bestanden daadwerkelijk aan te maken.
→ Zeg **"implementeer alles"** om alle 7 slices te bouwen met parallelle agents.

---

## Bronnen

- [Motia Docs](https://www.motia.dev/docs)
- [OpenAI Harness Engineering](https://openai.com/index/harness-engineering/)
- [Agent-Native Architecture](https://every.to/chain-of-thought/agent-native-architectures-how-to-build-apps-after-the-end-of-code)
- [Ryan Carson's 3-Step AI Workflow](https://www.lennysnewsletter.com/p/a-3-step-ai-coding-workflow-for-solo)
- [Qlty CLI Docs](https://docs.qlty.sh/cli/quickstart)
- [Qlty + AI Agents](https://docs.qlty.sh/cli/coding-with-ai-agents)
- [Qlty Git Hooks](https://docs.qlty.sh/cli/git-hooks)
- [Ultracite](https://github.com/haydenbleasel/ultracite)
- [OpenAI Apps SDK UI](https://openai.github.io/apps-sdk-ui/) — ChatGPT design tokens + componenten
- [OpenAI Apps SDK UI (GitHub)](https://github.com/openai/apps-sdk-ui) — AGENTS.md + broncode
- [shadcn/ui](https://ui.shadcn.com/) — Copy-paste React componenten met Tailwind
- [Agentation](https://github.com/benjitaylor/agentation)
- [Storybook](https://storybook.js.org/)
- [Striive.com](https://striive.com/nl/opdrachten)
