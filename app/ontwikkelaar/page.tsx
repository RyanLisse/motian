import { Code, ExternalLink, FileJson, Plug, Rss } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SURFACES = [
  {
    title: "API Documentatie",
    href: "/api-docs",
    icon: FileJson,
    description:
      "Interactieve OpenAPI documentatie met Scalar UI. Bekijk en test alle endpoints.",
    tone: "text-blue-600 dark:text-blue-400",
    external: true,
  },
  {
    title: "XML Feed",
    href: "/api/salesforce-feed",
    icon: Rss,
    description:
      "Salesforce-compatible XML export voor vacatures, kandidaten en sollicitaties.",
    tone: "text-emerald-600 dark:text-emerald-400",
    external: true,
  },
  {
    title: "MCP Server",
    href: "#mcp",
    icon: Plug,
    description:
      "Model Context Protocol server met 42 tools. Verbind via IDE, CLI of HTTP.",
    tone: "text-violet-600 dark:text-violet-400",
    external: false,
  },
  {
    title: "OpenAPI Spec",
    href: "/api/openapi",
    icon: Code,
    description:
      "Ruwe OpenAPI 3.1 JSON specificatie voor automatisering en codegeneratie.",
    tone: "text-amber-600 dark:text-amber-400",
    external: true,
  },
] as const;

const MCP_METHODS = [
  { label: "Stdio", command: "pnpm mcp" },
  { label: "HTTP", command: "POST /api/mcp" },
  { label: "CLI", command: "pnpm cli" },
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

          <Card className="border-border bg-card">
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
      </div>
    </div>
  );
}
