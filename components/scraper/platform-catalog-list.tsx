import { PlatformBadge } from "@/components/scraper/platform-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlatformCatalogEntry } from "@/src/schemas/platform-catalog";
import { PlatformCatalogCreateDrawer } from "./platform-catalog-create-drawer";
import { PlatformOnboardingDrawer } from "./platform-onboarding-drawer";

export function PlatformCatalogList({ entries }: { entries: PlatformCatalogEntry[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="border-dashed border-border bg-card lg:col-span-2">
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">Nieuw platform</CardTitle>
              <p className="text-sm text-muted-foreground">
                Voeg een ondersteund platform toe aan de catalogus of leg een nieuw publiek board
                vast voor onboarding en triage.
              </p>
            </div>
            <PlatformCatalogCreateDrawer />
          </div>
        </CardHeader>
      </Card>

      {entries.map((entry) => (
        <Card key={entry.slug} className="border-border bg-card">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <PlatformBadge platform={entry.slug} />
                  <CardTitle className="text-base">{entry.displayName}</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">{entry.description}</p>
              </div>
              <PlatformOnboardingDrawer entry={entry} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Adapter: {entry.adapterKind}</p>
            <p>Auth: {entry.authMode}</p>
            <p>
              Status:{" "}
              <span className="font-medium text-foreground">
                {entry.latestRun?.status ?? (entry.config ? "geconfigureerd" : "nog niet gestart")}
              </span>
              {entry.latestRun?.blockerKind ? ` · blocker: ${entry.latestRun.blockerKind}` : ""}
            </p>
            <p>Config: {entry.config ? entry.config.baseUrl : "Nog geen runtime configuratie"}</p>
            {entry.docsUrl?.startsWith("http") ? (
              <p>
                <a
                  href={entry.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  Documentatie openen
                </a>
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
