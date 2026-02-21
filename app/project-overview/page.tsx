"use client"

import {
  LayoutDashboard,
  Briefcase,
  Users,
  Zap,
  Eye,
  Calendar,
  MessageSquare,
  DatabaseZap,
  Settings,
  FileUp,
  Command,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Circle,
  Layers,
  Database,
  Palette,
  Server,
  Globe,
  Shield,
  GitBranch,
  Box,
  type LucideIcon,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Color constants
// ---------------------------------------------------------------------------
const ACCENT = "#10a37f"
const BG_DARK = "#0d0d0d"
const BG_ALT = "#141414"
const CARD_BG = "#1e1e1e"
const CARD_BORDER = "#2d2d2d"
const TEXT = "#ececec"
const MUTED = "#8e8e8e"

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({
  children,
  alt = false,
  id,
}: {
  children: React.ReactNode
  alt?: boolean
  id?: string
}) {
  return (
    <section
      id={id}
      style={{ backgroundColor: alt ? BG_ALT : BG_DARK }}
      className="w-full px-6 py-20 md:px-12 lg:px-24"
    >
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  )
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-12 text-center">
      <h2
        className="text-3xl font-bold tracking-tight md:text-4xl"
        style={{ color: TEXT }}
      >
        {title}
      </h2>
      {subtitle && (
        <p className="mx-auto mt-3 max-w-2xl text-base" style={{ color: MUTED }}>
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small reusable card
// ---------------------------------------------------------------------------
function ModuleCard({
  icon: Icon,
  title,
  description,
  stat,
  accent = false,
}: {
  icon: LucideIcon
  title: string
  description: string
  stat?: string
  accent?: boolean
}) {
  return (
    <div
      className="relative flex flex-col gap-3 rounded-xl border p-5 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
      style={{
        backgroundColor: CARD_BG,
        borderColor: accent ? ACCENT : CARD_BORDER,
        boxShadow: accent
          ? `0 0 24px ${ACCENT}22`
          : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `${ACCENT}18`,
          }}
        >
          <Icon size={20} style={{ color: ACCENT }} />
        </div>
        <h3
          className="text-sm font-semibold leading-tight"
          style={{ color: TEXT }}
        >
          {title}
        </h3>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
        {description}
      </p>
      {stat && (
        <span
          className="mt-auto text-xs font-medium"
          style={{ color: ACCENT }}
        >
          {stat}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Architecture flow node
// ---------------------------------------------------------------------------
function FlowNode({
  icon: Icon,
  label,
  sub,
}: {
  icon: LucideIcon
  label: string
  sub: string
}) {
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl border px-6 py-5 text-center"
      style={{
        backgroundColor: CARD_BG,
        borderColor: CARD_BORDER,
        minWidth: 140,
      }}
    >
      <Icon size={24} style={{ color: ACCENT }} />
      <span className="text-sm font-semibold" style={{ color: TEXT }}>
        {label}
      </span>
      <span className="text-[11px]" style={{ color: MUTED }}>
        {sub}
      </span>
    </div>
  )
}

function FlowArrow() {
  return (
    <div className="flex items-center px-1">
      <ArrowRight size={20} style={{ color: ACCENT }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Feature card with status
// ---------------------------------------------------------------------------
function FeatureCard({
  icon: Icon,
  title,
  description,
  status,
}: {
  icon: LucideIcon
  title: string
  description: string
  status: "live" | "dev"
}) {
  return (
    <div
      className="group relative flex flex-col gap-3 rounded-xl border p-5 transition-all duration-200 hover:scale-[1.01] hover:shadow-md"
      style={{
        backgroundColor: CARD_BG,
        borderColor: CARD_BORDER,
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${ACCENT}18` }}
        >
          <Icon size={20} style={{ color: ACCENT }} />
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{
            backgroundColor:
              status === "live" ? `${ACCENT}22` : "#facc1522",
            color: status === "live" ? ACCENT : "#facc15",
          }}
        >
          {status === "live" ? (
            <CheckCircle2 size={10} />
          ) : (
            <Circle size={10} />
          )}
          {status === "live" ? "Live" : "In ontwikkeling"}
        </span>
      </div>
      <h3 className="text-sm font-semibold" style={{ color: TEXT }}>
        {title}
      </h3>
      <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
        {description}
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tech badge
// ---------------------------------------------------------------------------
function TechBadge({ label, sub }: { label: string; sub: string }) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 rounded-xl border px-5 py-4 text-center transition-all duration-200 hover:scale-[1.03]"
      style={{
        backgroundColor: CARD_BG,
        borderColor: CARD_BORDER,
      }}
    >
      <span className="text-sm font-semibold" style={{ color: TEXT }}>
        {label}
      </span>
      <span className="text-[11px]" style={{ color: MUTED }}>
        {sub}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Entity card for data model
// ---------------------------------------------------------------------------
function EntityCard({
  name,
  count,
  fields,
}: {
  name: string
  count: number
  fields: string[]
}) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        backgroundColor: CARD_BG,
        borderColor: CARD_BORDER,
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: TEXT }}>
          {name}
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `${ACCENT}22`, color: ACCENT }}
        >
          {count} records
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {fields.map((f) => (
          <span
            key={f}
            className="rounded-md px-2 py-0.5 text-[10px]"
            style={{
              backgroundColor: `${ACCENT}10`,
              color: MUTED,
              border: `1px solid ${CARD_BORDER}`,
            }}
          >
            {f}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Color swatch
// ---------------------------------------------------------------------------
function Swatch({ hex, label }: { hex: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="h-16 w-16 rounded-xl border"
        style={{
          backgroundColor: hex,
          borderColor: CARD_BORDER,
        }}
      />
      <span className="text-xs font-medium" style={{ color: TEXT }}>
        {label}
      </span>
      <span className="text-[10px] font-mono" style={{ color: MUTED }}>
        {hex}
      </span>
    </div>
  )
}

// ===========================================================================
// PAGE
// ===========================================================================
export default function ProjectOverviewPage() {
  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: BG_DARK }}>
      {/* ----------------------------------------------------------------- */}
      {/* HERO */}
      {/* ----------------------------------------------------------------- */}
      <Section>
        <div className="flex flex-col items-center gap-6 py-12 text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium"
            style={{
              borderColor: ACCENT,
              color: ACCENT,
              backgroundColor: `${ACCENT}12`,
            }}
          >
            <Sparkles size={14} />
            Platform Overzicht
          </div>

          <h1
            className="text-5xl font-extrabold tracking-tight md:text-7xl"
            style={{
              background: `linear-gradient(135deg, ${ACCENT} 0%, #2dd4bf 50%, ${ACCENT} 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Motian
          </h1>

          <p
            className="text-lg font-medium md:text-xl"
            style={{ color: TEXT }}
          >
            AI-Gedreven Recruitment Platform
          </p>

          <p
            className="mx-auto max-w-2xl text-sm leading-relaxed md:text-base"
            style={{ color: MUTED }}
          >
            Een volledig geintegreerd platform voor het beheren van kandidaten,
            opdrachten, interviews en het matchen van talent met behulp van AI.
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {[
              { label: "12 Modules", icon: Layers },
              { label: "AI Matching", icon: Zap },
              { label: "10 Kandidaten", icon: Users },
              { label: "6 Opdrachten", icon: Briefcase },
            ].map((item) => (
              <div
                key={item.label}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium"
                style={{
                  borderColor: CARD_BORDER,
                  color: TEXT,
                  backgroundColor: CARD_BG,
                }}
              >
                <item.icon size={14} style={{ color: ACCENT }} />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* ARCHITECTURE FLOW */}
      {/* ----------------------------------------------------------------- */}
      <Section alt id="architectuur">
        <SectionTitle
          title="Platform Architectuur"
          subtitle="Dataflow van intake tot plaatsing — elk blok is een actieve module in het platform."
        />

        {/* Row 1: Intake flow */}
        <div className="mb-8">
          <p
            className="mb-4 text-center text-xs font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Intake & Verwerking
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <FlowNode icon={DatabaseZap} label="Scraper" sub="Browserbase" />
            <FlowArrow />
            <FlowNode icon={Briefcase} label="Opdrachten" sub="6 actief" />
            <FlowArrow />
            <FlowNode icon={Sparkles} label="AI Grading" sub="Scoring" />
          </div>
        </div>

        {/* Row 2: Candidate flow */}
        <div className="mb-8">
          <p
            className="mb-4 text-center text-xs font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Kandidaat & Matching
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <FlowNode icon={FileUp} label="CV Upload" sub="Drag & drop" />
            <FlowArrow />
            <FlowNode icon={Users} label="Talent Pool" sub="10 professionals" />
            <FlowArrow />
            <FlowNode icon={Zap} label="AI Matching" sub="Gewogen scores" />
            <FlowArrow />
            <FlowNode icon={Eye} label="Explainer" sub="Visueel inzicht" />
          </div>
        </div>

        {/* Row 3: Process flow */}
        <div>
          <p
            className="mb-4 text-center text-xs font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Proces & Communicatie
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <FlowNode icon={GitBranch} label="Pipeline" sub="5 fases kanban" />
            <FlowArrow />
            <FlowNode icon={Calendar} label="Gesprekken" sub="6 gepland" />
            <FlowArrow />
            <FlowNode icon={MessageSquare} label="Berichten" sub="Templates" />
            <FlowArrow />
            <FlowNode icon={LayoutDashboard} label="Dashboard" sub="KPIs live" />
          </div>
        </div>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* FEATURE GRID */}
      {/* ----------------------------------------------------------------- */}
      <Section id="features">
        <SectionTitle
          title="Alle Features"
          subtitle="Overzicht van alle modules met hun huidige status."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <FeatureCard
            icon={LayoutDashboard}
            title="Dashboard (Overzicht)"
            description="KPIs, grafieken, platform status en real-time statistieken in een vogelvlucht."
            status="live"
          />
          <FeatureCard
            icon={Briefcase}
            title="Opdrachten"
            description="Opdracht beheer met scraping integratie. Bekijk, filter en beheer alle vacatures."
            status="live"
          />
          <FeatureCard
            icon={Users}
            title="Talent Pool"
            description="10 kandidaten met zoeken, filteren, bulk acties en gedetailleerde profielen."
            status="live"
          />
          <FeatureCard
            icon={GitBranch}
            title="Pipeline"
            description="Kanban drag-and-drop bord met 5 fases: nieuw, screening, interview, aanbieding, geplaatst."
            status="live"
          />
          <FeatureCard
            icon={Zap}
            title="AI Matching"
            description="Gewogen scoring engine met knock-out criteria, risicoprofiel en aanbevelingen."
            status="live"
          />
          <FeatureCard
            icon={Eye}
            title="Visual Explainer"
            description="Stap-voor-stap matching visualisatie die het AI-besluitproces transparant maakt."
            status="live"
          />
          <FeatureCard
            icon={Sparkles}
            title="AI Grading"
            description="Automatische beoordeling van kandidaten op basis van CV-kwaliteit, vaardigheden en relevantie."
            status="live"
          />
          <FeatureCard
            icon={Calendar}
            title="Gesprekken"
            description="Interview planning, feedback formulieren en gestructureerde beoordelingen."
            status="live"
          />
          <FeatureCard
            icon={MessageSquare}
            title="Berichten"
            description="Templates, AI-gegenereerde tekst, berichtplanning en communicatiegeschiedenis."
            status="live"
          />
          <FeatureCard
            icon={DatabaseZap}
            title="Scraper"
            description="Browserbase integratie voor het automatisch scrapen van vacatureplatforms."
            status="live"
          />
          <FeatureCard
            icon={Command}
            title="AI Chat (Cmd+K)"
            description="Contextbewuste AI-assistent die vragen beantwoordt over kandidaten en opdrachten."
            status="dev"
          />
          <FeatureCard
            icon={Settings}
            title="Instellingen"
            description="Team configuratie, notificatie voorkeuren en API-instellingen."
            status="live"
          />
        </div>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* TECH STACK */}
      {/* ----------------------------------------------------------------- */}
      <Section alt id="tech">
        <SectionTitle
          title="Technologie Stack"
          subtitle="Gebouwd op moderne, productieklare technologie."
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleCard
            icon={Globe}
            title="Frontend"
            description="Next.js 16, React 19, TypeScript, Tailwind CSS 4, Shadcn/UI"
            stat="App Router + RSC"
          />
          <ModuleCard
            icon={Server}
            title="Backend & Data"
            description="Drizzle ORM, Neon PostgreSQL (serverless), Vercel AI SDK"
            stat="Edge-ready"
          />
          <ModuleCard
            icon={Sparkles}
            title="AI & LLM"
            description="Anthropic Claude via @ai-sdk/anthropic, gewogen scoring algoritmes"
            stat="Claude Sonnet"
          />
          <ModuleCard
            icon={Box}
            title="UI Componenten"
            description="Shadcn/UI, Radix primitives, Recharts, @dnd-kit voor drag-and-drop"
            stat="40+ componenten"
          />
          <ModuleCard
            icon={DatabaseZap}
            title="Scraping"
            description="Browserbase Stagehand voor headless browser automatisering"
            stat="Multi-platform"
          />
          <ModuleCard
            icon={Shield}
            title="DX & Kwaliteit"
            description="Biome linter, Vitest tests, TypeScript strict mode, pnpm"
            stat="Zero-config"
          />
        </div>

        <div className="mt-10">
          <p
            className="mb-4 text-center text-xs font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Kernpakketten
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { label: "Next.js 16", sub: "Framework" },
              { label: "React 19", sub: "UI Library" },
              { label: "TypeScript", sub: "Taal" },
              { label: "Drizzle ORM", sub: "Database" },
              { label: "Neon", sub: "PostgreSQL" },
              { label: "Shadcn/UI", sub: "Componenten" },
              { label: "Tailwind 4", sub: "Styling" },
              { label: "Recharts", sub: "Grafieken" },
              { label: "Vercel AI SDK", sub: "AI" },
              { label: "Claude", sub: "LLM" },
              { label: "@dnd-kit", sub: "Drag & Drop" },
              { label: "Browserbase", sub: "Scraping" },
            ].map((t) => (
              <TechBadge key={t.label} label={t.label} sub={t.sub} />
            ))}
          </div>
        </div>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* DATA MODEL */}
      {/* ----------------------------------------------------------------- */}
      <Section id="data">
        <SectionTitle
          title="Data Model"
          subtitle="Kernentiteiten en hun relaties binnen het platform."
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <EntityCard
            name="Kandidaten"
            count={10}
            fields={[
              "naam",
              "email",
              "rol",
              "score",
              "vaardigheden",
              "ervaring",
              "status",
              "locatie",
              "bron",
            ]}
          />
          <EntityCard
            name="Opdrachten"
            count={6}
            fields={[
              "titel",
              "afdeling",
              "locatie",
              "type",
              "status",
              "platform",
              "vaardigheden",
            ]}
          />
          <EntityCard
            name="Gesprekken"
            count={6}
            fields={[
              "kandidaat",
              "rol",
              "datum",
              "type",
              "status",
              "interviewer",
              "feedback",
            ]}
          />
          <EntityCard
            name="Berichten"
            count={6}
            fields={[
              "kandidaat",
              "onderwerp",
              "kanaal",
              "status",
              "sjabloon",
              "gepland",
            ]}
          />
        </div>

        {/* Relationships */}
        <div className="mt-10">
          <p
            className="mb-4 text-center text-xs font-semibold uppercase tracking-widest"
            style={{ color: MUTED }}
          >
            Entiteit Relaties
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              "Kandidaat",
              "solliciteert op",
              "Opdracht",
              "leidt tot",
              "Gesprek",
              "resulteert in",
              "Bericht",
            ].map((item, i) =>
              i % 2 === 0 ? (
                <span
                  key={i}
                  className="rounded-lg border px-4 py-2 text-xs font-semibold"
                  style={{
                    backgroundColor: CARD_BG,
                    borderColor: ACCENT,
                    color: TEXT,
                  }}
                >
                  {item}
                </span>
              ) : (
                <span
                  key={i}
                  className="flex items-center gap-1 text-[11px]"
                  style={{ color: MUTED }}
                >
                  <ArrowRight size={14} style={{ color: ACCENT }} />
                  {item}
                </span>
              )
            )}
          </div>
        </div>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* COLOR PALETTE */}
      {/* ----------------------------------------------------------------- */}
      <Section alt id="kleuren">
        <SectionTitle
          title="Kleurenpalet"
          subtitle="ChatGPT-geinspireerd donker thema met groene accenten."
        />

        <div className="flex flex-wrap justify-center gap-8">
          <Swatch hex="#0d0d0d" label="Achtergrond" />
          <Swatch hex="#141414" label="Sectie Alt" />
          <Swatch hex="#1e1e1e" label="Cards" />
          <Swatch hex="#2d2d2d" label="Borders" />
          <Swatch hex="#10a37f" label="Accent" />
          <Swatch hex="#ececec" label="Tekst" />
          <Swatch hex="#8e8e8e" label="Muted" />
          <Swatch hex="#2dd4bf" label="Gradient" />
        </div>
      </Section>

      {/* ----------------------------------------------------------------- */}
      {/* FOOTER */}
      {/* ----------------------------------------------------------------- */}
      <Section>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-sm font-medium" style={{ color: MUTED }}>
            Gebouwd door{" "}
            <span style={{ color: ACCENT }}>Motian</span> met Next.js,
            Claude AI & Shadcn/UI
          </p>
          <p className="text-xs" style={{ color: `${MUTED}88` }}>
            2025 — AI-gedreven recruitment, gevisualiseerd.
          </p>
        </div>
      </Section>
    </div>
  )
}
