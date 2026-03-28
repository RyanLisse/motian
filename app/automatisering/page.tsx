import { Activity, Bot, ChevronRight, Database, Sparkles } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SURFACES = [
  {
    title: "Agents",
    href: "/agents",
    icon: Bot,
    description: "Bekijk autonome runs, activiteit en operationele gezondheid.",
    tone: "text-blue-600 dark:text-blue-400",
  },
  {
    title: "Autopilot",
    href: "/autopilot",
    icon: Activity,
    description: "Volg nachtelijke checks en zie welke journeys aandacht vragen.",
    tone: "text-amber-600 dark:text-amber-400",
  },
  {
    title: "Databronnen",
    href: "/scraper",
    icon: Database,
    description: "Beheer scraping, overlap en brongezondheid vanuit één overzicht.",
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  {
    title: "AI Assistent",
    href: "/chat",
    icon: Sparkles,
    description: "Open de assistent voor snelle vragen, analyses en CV-workflows.",
    tone: "text-violet-600 dark:text-violet-400",
  },
] as const;

export default function AutomatiseringPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
        <PageHeader
          title="Automatisering"
          description="Alles wat de recruiterflow versnelt, maar niet elke dag als hoofdwerkruimte nodig is."
          breadcrumbs={[
            { label: "Overzicht", href: "/overzicht" },
            { label: "Automatisering", href: "/automatisering" },
          ]}
        >
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/chat">
              Open AI Assistent
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </PageHeader>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border bg-card">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-border text-xs text-muted-foreground">
                  Operationeel startpunt
                </Badge>
                <Badge variant="outline" className="border-border text-xs text-muted-foreground">
                  Minder vaak, wel belangrijk
                </Badge>
              </div>
              <CardTitle className="text-base">Wat hoort hier</CardTitle>
              <p className="text-sm text-muted-foreground">
                Deze ruimte bundelt de tooling die recruiters en operators niet de hele dag nodig
                hebben, maar wel snel moeten kunnen vinden wanneer het werk daarom vraagt.
              </p>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {SURFACES.map((surface) => {
                const Icon = surface.icon;

                return (
                  <Link
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
                      <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="space-y-3">
              <CardTitle className="text-base">Snelle regels</CardTitle>
              <p className="text-sm text-muted-foreground">
                Gebruik deze hub als springplank. Voor snelle acties blijft de command palette
                beschikbaar, en chat blijft een overlay voor contextuele hulp.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                Agents, Autopilot en Databronnen zijn bewust samengebracht in één zone.
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                Instellingen blijft een utility-pagina en hoort niet in deze hub.
              </div>
              <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                Matching blijft als compatibiliteitsroute bestaan, maar wordt niet meer
                gepresenteerd als primaire bestemming.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
