import { Code, ExternalLink, FileJson, Plug, Rss } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SURFACES = [
  {
    title: "API Documentatie",
    href: "/api-docs",
    icon: FileJson,
    description: "Interactieve OpenAPI documentatie met Scalar UI. Bekijk en test alle endpoints.",
    tone: "text-blue-600 dark:text-blue-400",
    external: true,
  },
  {
    title: "XML Feed",
    href: "#xml-feed",
    icon: Rss,
    description: "Salesforce-compatible XML export voor vacatures, kandidaten en sollicitaties.",
    tone: "text-emerald-600 dark:text-emerald-400",
    external: false,
  },
  {
    title: "MCP Server",
    href: "#mcp",
    icon: Plug,
    description: "Model Context Protocol server met 42 tools. Verbind via IDE, CLI of HTTP.",
    tone: "text-violet-600 dark:text-violet-400",
    external: false,
  },
  {
    title: "OpenAPI Spec",
    href: "/api/openapi",
    icon: Code,
    description: "Ruwe OpenAPI 3.1 JSON specificatie voor automatisering en codegeneratie.",
    tone: "text-amber-600 dark:text-amber-400",
    external: true,
  },
] as const;

const MCP_METHODS = [
  { label: "Stdio", command: "pnpm mcp" },
  { label: "HTTP", command: "POST /api/mcp" },
  { label: "CLI", command: "pnpm cli" },
] as const;

const FEED_EXAMPLES = [
  {
    label: "Alle vacatures",
    url: "/api/salesforce-feed?entity=jobs",
    description: "Actieve vacatures met titel, tarief, locatie, bedrijf en status",
  },
  {
    label: "Alle kandidaten",
    url: "/api/salesforce-feed?entity=candidates",
    description: "Kandidaten met naam, vaardigheden, locatie, uurtarief en beschikbaarheid",
  },
  {
    label: "Alle sollicitaties",
    url: "/api/salesforce-feed?entity=applications",
    description: "Sollicitaties met kandidaat, vacature, fase en bron",
  },
  {
    label: "Recente wijzigingen",
    url: "/api/salesforce-feed?entity=jobs&updatedSince=2026-03-01T00:00:00Z",
    description: "Vacatures gewijzigd sinds 1 maart 2026",
  },
] as const;

const JOB_FIELDS = [
  ["Id", "UUID"],
  ["Name", "Functietitel"],
  ["Platform__c", "Bron (striive, flextender, etc.)"],
  ["ExternalUrl__c", "Link naar origineel"],
  ["Company__c", "Opdrachtgever"],
  ["EndClient__c", "Eindklant"],
  ["Location__c", "Locatie"],
  ["Province__c", "Provincie"],
  ["RateMin__c / RateMax__c", "Uurtarief (EUR)"],
  ["ContractType__c", "freelance / interim / vast"],
  ["WorkArrangement__c", "remote / hybride / op_locatie"],
  ["Status__c", "open / closed / archived"],
  ["ApplicationDeadline__c", "Sluitingsdatum"],
] as const;

const CANDIDATE_FIELDS = [
  ["Id", "UUID"],
  ["Name", "Volledige naam"],
  ["Email__c / Phone__c", "Contactgegevens"],
  ["Role__c", "Gewenste functie"],
  ["Skills__c", "Vaardigheden (puntkomma-gescheiden)"],
  ["Location__c / Province__c", "Locatie"],
  ["HourlyRate__c", "Uurtarief (EUR)"],
  ["Availability__c", "Beschikbaarheid"],
  ["Status__c", "Matching status"],
  ["LinkedInUrl__c", "LinkedIn profiel"],
  ["Source__c", "Herkomst (cv-upload, handmatig, etc.)"],
] as const;

export default function OntwikkelaarPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
        <PageHeader
          title="Ontwikkelaar"
          description="API documentatie, feeds en integratie-opties voor externe systemen."
          breadcrumbs={[
            { label: "Overzicht", href: "/overzicht" },
            { label: "Ontwikkelaar", href: "/ontwikkelaar" },
          ]}
        />

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border bg-card">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-border text-xs text-muted-foreground">
                  Integratie &amp; API
                </Badge>
                <Badge variant="outline" className="border-border text-xs text-muted-foreground">
                  Externe systemen
                </Badge>
              </div>
              <CardTitle className="text-base">Beschikbare interfaces</CardTitle>
              <p className="text-sm text-muted-foreground">
                Alle technische ingangen tot het platform: interactieve docs, feeds, specs en het
                MCP-protocol voor AI-tooling.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {SURFACES.map((surface) => {
                const Icon = surface.icon;

                if (surface.external) {
                  return (
                    <a
                      key={surface.title}
                      href={surface.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group rounded-xl border border-border bg-background/50 p-4 transition-colors hover:border-primary/40 hover:bg-accent/50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${surface.tone}`} />
                            <span className="text-sm font-semibold text-foreground">
                              {surface.title}
                            </span>
                          </div>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {surface.description}
                          </p>
                        </div>
                        <ExternalLink className="mt-1 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                      </div>
                    </a>
                  );
                }

                return (
                  <a
                    key={surface.title}
                    href={surface.href}
                    className="group rounded-xl border border-border bg-background/50 p-4 transition-colors hover:border-primary/40 hover:bg-accent/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${surface.tone}`} />
                          <span className="text-sm font-semibold text-foreground">
                            {surface.title}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">
                          {surface.description}
                        </p>
                      </div>
                    </div>
                  </a>
                );
              })}
            </CardContent>
          </Card>

          <Card id="mcp" className="border-border bg-card">
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">MCP Verbinden</CardTitle>
              <p className="text-sm text-muted-foreground">
                Drie manieren om het Model Context Protocol te gebruiken. Kies de methode die past
                bij je workflow.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              {MCP_METHODS.map((method) => (
                <div
                  key={method.label}
                  className="rounded-lg border border-border/70 bg-muted/20 p-3"
                >
                  <span className="font-medium text-foreground">{method.label}</span>
                  <code className="ml-2 rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                    {method.command}
                  </code>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card id="xml-feed" className="border-border bg-card">
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-border text-xs text-muted-foreground">
                Salesforce-compatible
              </Badge>
              <Badge variant="outline" className="border-border text-xs text-muted-foreground">
                XML export
              </Badge>
            </div>
            <CardTitle className="text-base">
              XML Feed — Vacatures, Kandidaten &amp; Sollicitaties
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Read-only XML export in Salesforce sObject formaat. Gebruik voor CRM-integratie,
              rapportages of externe dashboards. Geen authenticatie nodig vanuit de app.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Snelle links</h4>
              <div className="grid gap-2 sm:grid-cols-2">
                {FEED_EXAMPLES.map((example) => (
                  <a
                    key={example.label}
                    href={example.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group rounded-lg border border-border/70 bg-muted/20 p-3 transition-colors hover:border-primary/40 hover:bg-accent/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{example.label}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-foreground" />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{example.description}</p>
                  </a>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Query parameters</h4>
              <div className="overflow-x-auto rounded-lg border border-border/70">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/70 bg-muted/30">
                      <th className="px-3 py-2 text-left font-medium text-foreground">Parameter</th>
                      <th className="px-3 py-2 text-left font-medium text-foreground">Waarden</th>
                      <th className="px-3 py-2 text-left font-medium text-foreground">Standaard</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b border-border/30">
                      <td className="px-3 py-2">
                        <code className="rounded bg-muted px-1 font-mono text-xs">entity</code>
                      </td>
                      <td className="px-3 py-2">jobs, candidates, applications</td>
                      <td className="px-3 py-2">applications</td>
                    </tr>
                    <tr className="border-b border-border/30">
                      <td className="px-3 py-2">
                        <code className="rounded bg-muted px-1 font-mono text-xs">id</code>
                      </td>
                      <td className="px-3 py-2">UUID van een specifiek record</td>
                      <td className="px-3 py-2">—</td>
                    </tr>
                    <tr className="border-b border-border/30">
                      <td className="px-3 py-2">
                        <code className="rounded bg-muted px-1 font-mono text-xs">status</code>
                      </td>
                      <td className="px-3 py-2">
                        open, closed, archived (jobs) of fase (applications)
                      </td>
                      <td className="px-3 py-2">—</td>
                    </tr>
                    <tr className="border-b border-border/30">
                      <td className="px-3 py-2">
                        <code className="rounded bg-muted px-1 font-mono text-xs">
                          updatedSince
                        </code>
                      </td>
                      <td className="px-3 py-2">ISO 8601 datum</td>
                      <td className="px-3 py-2">—</td>
                    </tr>
                    <tr className="border-b border-border/30">
                      <td className="px-3 py-2">
                        <code className="rounded bg-muted px-1 font-mono text-xs">limit</code>
                      </td>
                      <td className="px-3 py-2">Aantal records (1-1000)</td>
                      <td className="px-3 py-2">50</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2">
                        <code className="rounded bg-muted px-1 font-mono text-xs">offset</code>
                      </td>
                      <td className="px-3 py-2">Paginering offset</td>
                      <td className="px-3 py-2">0</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Vacature velden (Job__c)</h4>
                <div className="space-y-1">
                  {JOB_FIELDS.map(([field, desc]) => (
                    <div key={field} className="flex items-start gap-2 text-xs">
                      <code className="mt-0.5 shrink-0 rounded bg-muted px-1 font-mono text-foreground">
                        {field}
                      </code>
                      <span className="text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">
                  Kandidaat velden (Candidate__c)
                </h4>
                <div className="space-y-1">
                  {CANDIDATE_FIELDS.map(([field, desc]) => (
                    <div key={field} className="flex items-start gap-2 text-xs">
                      <code className="mt-0.5 shrink-0 rounded bg-muted px-1 font-mono text-foreground">
                        {field}
                      </code>
                      <span className="text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
