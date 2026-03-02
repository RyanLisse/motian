import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Motian — Architecture Visual Explainer",
  description: "Interactive architecture diagram for the Motian AI recruitment platform",
};

const COLORS = {
  bg: "#0a0a0f",
  card: "#12121a",
  cardBorder: "#1e1e2e",
  accent: "#6366f1",
  accentGlow: "rgba(99, 102, 241, 0.15)",
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
  cyan: "#06b6d4",
  pink: "#ec4899",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  textDim: "#64748b",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 48 }}>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: COLORS.text,
          marginBottom: 20,
          paddingBottom: 8,
          borderBottom: `2px solid ${COLORS.accent}`,
          display: "inline-block",
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function Card({
  title,
  color,
  items,
  badge,
}: {
  title: string;
  color: string;
  items: string[];
  badge?: string;
}) {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.cardBorder}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 10,
        padding: "16px 20px",
        minWidth: 220,
        flex: "1 1 220px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{title}</span>
        {badge && (
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 20,
              background: `${color}22`,
              color,
              fontWeight: 600,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {items.map((item) => (
          <li
            key={item}
            style={{
              fontSize: 12,
              color: COLORS.textMuted,
              padding: "3px 0",
              lineHeight: 1.5,
            }}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 4px",
        minWidth: 40,
      }}
    >
      <span style={{ fontSize: 10, color: COLORS.textDim, marginBottom: 2 }}>{label}</span>
      <span style={{ fontSize: 20, color: COLORS.accent }}>→</span>
    </div>
  );
}

function FlowBox({ label, sublabel, color }: { label: string; sublabel: string; color: string }) {
  return (
    <div
      style={{
        background: `${color}11`,
        border: `1px solid ${color}44`,
        borderRadius: 8,
        padding: "12px 16px",
        textAlign: "center",
        minWidth: 120,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color }}>{label}</div>
      <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 4 }}>{sublabel}</div>
    </div>
  );
}

function StatBox({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div style={{ textAlign: "center", flex: "1 1 100px" }}>
      <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function VisualExplainerPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
        padding: "40px 24px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <header style={{ textAlign: "center", marginBottom: 56 }}>
          <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: -1, marginBottom: 8 }}>
            <span style={{ color: COLORS.accent }}>Motian</span> Architecture
          </h1>
          <p style={{ fontSize: 16, color: COLORS.textMuted, maxWidth: 600, margin: "0 auto" }}>
            AI-Assisted Recruitment Operations Platform — Next.js 16 · React 19 · Neon PostgreSQL ·
            pgvector · Trigger.dev · Multi-model AI
          </p>
        </header>

        {/* Stats */}
        <div
          style={{
            display: "flex",
            gap: 24,
            justifyContent: "center",
            marginBottom: 48,
            flexWrap: "wrap",
          }}
        >
          <StatBox value="~25K" label="Lines of Code" color={COLORS.accent} />
          <StatBox value="10" label="DB Tables" color={COLORS.cyan} />
          <StatBox value="37" label="API Routes" color={COLORS.green} />
          <StatBox value="45" label="AI Tools" color={COLORS.pink} />
          <StatBox value="8" label="Scheduled Tasks" color={COLORS.amber} />
          <StatBox value="3" label="AI Models" color={COLORS.red} />
        </div>

        {/* Data Pipeline */}
        <Section title="Data Pipeline">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              overflowX: "auto",
              padding: "16px 0",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <FlowBox
              label="Scrapers"
              sublabel="Striive · Flextender · Overheid"
              color={COLORS.cyan}
            />
            <FlowArrow label="fetch" />
            <FlowBox label="Normalize" sublabel="Zod validation" color={COLORS.amber} />
            <FlowArrow label="clean" />
            <FlowBox label="Enrich" sublabel="Gemini 3 Flash" color={COLORS.green} />
            <FlowArrow label="embed" />
            <FlowBox label="Embed" sublabel="GPT-5 Nano 512d" color={COLORS.pink} />
            <FlowArrow label="store" />
            <FlowBox label="PostgreSQL" sublabel="pgvector + FTS" color={COLORS.accent} />
          </div>
          <p style={{ fontSize: 12, color: COLORS.textDim, textAlign: "center", marginTop: 12 }}>
            Circuit breaker (5 failures) · Auth validation on Striive · Health check auto-reset
            after 72h · Hourly embeddings backfill guarantee
          </p>
        </Section>

        {/* 3-Layer Matching */}
        <Section title="3-Layer Matching Engine">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Card
              title="Layer 1: Quick Score"
              color={COLORS.cyan}
              badge="~2s"
              items={[
                "60% rule-based (skills 45%, location 20%, rate 20%, role 15%)",
                "40% vector similarity (pgvector cosine, 512d)",
                "Filter: MIN_SCORE=40, TOP_N=3",
                "Shared pipeline: autoMatch(source, targets, direction)",
              ]}
            />
            <Card
              title="Layer 2: Structured Match"
              color={COLORS.green}
              badge="~8s"
              items={[
                "Gemini 3 Flash — Mariënne methodology",
                "KNOCKOUT: Hard requirements → pass/fail",
                "GUNNING: Scored criteria → 1-5 stars",
                "PROCESS: Conditions → pass/fail",
                "Output: overallScore, recommendation, riskProfile",
              ]}
            />
            <Card
              title="Layer 3: Judge Verdict"
              color={COLORS.amber}
              badge="~3s"
              items={[
                "Grok 4 — Independent AI review",
                "Own score + motivation",
                "Flags discrepancies with primary",
                "Prevents single-model bias",
                "Non-blocking (non-fatal on failure)",
              ]}
            />
          </div>
        </Section>

        {/* Trigger.dev Tasks */}
        <Section title="Trigger.dev Scheduled Tasks (8)">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Card
              title="scrape-pipeline"
              color={COLORS.cyan}
              badge="Every 4h"
              items={[
                "Orchestrate all scraper runs",
                "Circuit breaker + per-platform cron",
                "Parallel execution",
              ]}
            />
            <Card
              title="embeddings-batch"
              color={COLORS.pink}
              badge="Hourly"
              items={[
                "Backfill missing embeddings",
                "Jobs + candidates without vectors",
                "50 per batch",
              ]}
            />
            <Card
              title="vacancy-expiry"
              color={COLORS.amber}
              badge="Daily 3AM"
              items={[
                "Soft-delete expired jobs",
                "Past applicationDeadline",
                "Keeps data for audit",
              ]}
            />
            <Card
              title="data-retention"
              color={COLORS.red}
              badge="Daily 2AM"
              items={["GDPR auto-erasure", "Expired dataRetentionUntil", "Audit trail preserved"]}
            />
            <Card
              title="scraper-health"
              color={COLORS.green}
              badge="Daily 6AM"
              items={[
                "Auto-reset circuit breakers",
                "72h clean window check",
                "Alert on stuck scrapers",
              ]}
            />
            <Card
              title="candidate-dedup"
              color={COLORS.accent}
              badge="Weekly Sun"
              items={[
                "Detect duplicate candidates",
                "Email + name/role matching",
                "Flags for manual review",
              ]}
            />
            <Card
              title="match-staleness"
              color={COLORS.textDim}
              badge="Weekly Mon"
              items={["Archive pending matches >30d", "Reduces UI noise", "Sets status=rejected"]}
            />
            <Card
              title="slack-notification"
              color={COLORS.cyan}
              badge="On-demand"
              items={["5x retry with backoff", "Fire-and-forget delivery", "Match + scrape alerts"]}
            />
          </div>
        </Section>

        {/* Database Schema */}
        <Section title="Database Schema (10 Tables)">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Card
              title="jobs"
              color={COLORS.accent}
              items={[
                "512d pgvector embeddings",
                "FTS indexes (Dutch)",
                "Soft-delete",
                "9 platform scrapers",
              ]}
            />
            <Card
              title="candidates"
              color={COLORS.green}
              items={[
                "512d embeddings",
                "Structured skills/education",
                "GDPR consent + retention",
                "Resume raw text",
              ]}
            />
            <Card
              title="job_matches"
              color={COLORS.pink}
              items={[
                "Score 0-100 + confidence",
                "Criteria breakdown (JSONB)",
                "Risk profile",
                "Judge verdict stored",
              ]}
            />
            <Card
              title="chat_sessions"
              color={COLORS.cyan}
              badge="NEW"
              items={[
                "Session-based memory",
                "Last 50 messages per session",
                "Context snapshot (route, entity)",
              ]}
            />
            <Card
              title="applications"
              color={COLORS.amber}
              items={[
                "6-stage pipeline",
                "new → screening → interview",
                "→ offer → hired/rejected",
              ]}
            />
            <Card
              title="gdpr_audit_log"
              color={COLORS.red}
              items={[
                "Export, erase, scrub actions",
                "Subject + actor tracking",
                "Immutable audit trail",
              ]}
            />
          </div>
        </Section>

        {/* AI Models */}
        <Section title="AI Models">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Card
              title="Gemini 3 Flash"
              color={COLORS.green}
              badge="Google"
              items={[
                "CV parsing (structured extraction)",
                "Job description enrichment",
                "Structured matching (Mariënne)",
                "Requirement extraction",
              ]}
            />
            <Card
              title="GPT-5 Nano"
              color={COLORS.pink}
              badge="OpenAI"
              items={[
                "512d text embeddings",
                "AI chat agent (45 tools)",
                "Conversation memory",
                "Context-aware prompts",
              ]}
            />
            <Card
              title="Grok 4"
              color={COLORS.amber}
              badge="xAI"
              items={[
                "Independent judge verdict",
                "Match quality validation",
                "Discrepancy detection",
                "Red flag identification",
              ]}
            />
          </div>
        </Section>

        {/* Security & Rate Limiting */}
        <Section title="Security & Rate Limiting">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Card
              title="CORS"
              color={COLORS.green}
              items={[
                "Environment-based origin whitelist",
                "No wildcard in production",
                "Vary: Origin header",
                "ALLOWED_ORIGINS env var",
              ]}
            />
            <Card
              title="Rate Limiting"
              color={COLORS.amber}
              items={[
                "Chat: 20/min per IP",
                "CV upload: 10/min",
                "Matching: 10/min",
                "GDPR delete: 5/min",
                "Scrape: 5/5min",
              ]}
            />
            <Card
              title="Validation"
              color={COLORS.accent}
              items={[
                "All inputs: Zod typed schemas",
                "No z.any() — fully typed",
                "Bearer token on internal routes",
                "Encryption at rest (scraper auth)",
              ]}
            />
            <Card
              title="GDPR Compliance"
              color={COLORS.red}
              items={[
                "Data export (full candidate)",
                "Erasure (hard delete + audit)",
                "Contact scrubbing",
                "Auto-retention cleanup (daily)",
              ]}
            />
          </div>
        </Section>

        {/* Tech Stack */}
        <Section title="Tech Stack">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 12,
            }}
          >
            {[
              { label: "Framework", value: "Next.js 16 (App Router)" },
              { label: "UI", value: "React 19 + Tailwind v4 + Radix" },
              { label: "Database", value: "Neon PostgreSQL + pgvector" },
              { label: "ORM", value: "Drizzle ORM" },
              { label: "Background Jobs", value: "Trigger.dev v4" },
              { label: "File Storage", value: "Vercel Blob" },
              { label: "Validation", value: "Zod" },
              { label: "Linting", value: "Biome (not ESLint)" },
              { label: "Testing", value: "Vitest + Playwright" },
              { label: "Monitoring", value: "Sentry + PostHog" },
              { label: "Deployment", value: "Vercel" },
              { label: "Extension", value: "WXT (Chrome/Firefox)" },
            ].map(({ label, value }) => (
              <div
                key={label}
                style={{
                  background: COLORS.card,
                  border: `1px solid ${COLORS.cardBorder}`,
                  borderRadius: 8,
                  padding: "10px 14px",
                }}
              >
                <div style={{ fontSize: 10, color: COLORS.textDim, textTransform: "uppercase" }}>
                  {label}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, marginTop: 4 }}>
                  {value}
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Footer */}
        <footer
          style={{
            textAlign: "center",
            padding: "32px 0",
            borderTop: `1px solid ${COLORS.cardBorder}`,
            color: COLORS.textDim,
            fontSize: 12,
          }}
        >
          Motian — AI-Assisted Recruitment Operations Platform · {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
