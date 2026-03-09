import { ArrowUpRight, ExternalLink, Layers3 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ListingOverlapGroup } from "@/src/services/scraper-dashboard";
import { PlatformBadge } from "./platform-badge";

function strategyLabel(strategy: ListingOverlapGroup["strategy"]) {
  switch (strategy) {
    case "client_reference_title":
      return "Hoge zekerheid";
    case "title_organization_province":
      return "Titel + organisatie + provincie";
    case "title_organization_location":
      return "Titel + organisatie + locatie";
    case "title_organization_deadline":
      return "Titel + organisatie + deadline";
    case "title_organization_start_date":
      return "Titel + organisatie + startdatum";
    default:
      return "Overlap-indicatie";
  }
}

function sharedValueSummary(group: ListingOverlapGroup) {
  const values = Object.values(group.sharedValues).filter((value) => value.length > 0);
  return values.join(" · ");
}

export function CrossPlatformListings({ groups }: { groups: ListingOverlapGroup[] }) {
  return (
    <Card className="bg-card border-border min-w-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Layers3 className="h-4 w-4 text-muted-foreground" />
          Platform-overlap tussen bronnen
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Deze groepen laten zien waar meerdere bronnen waarschijnlijk dezelfde opdracht tonen. Per
          groep zie je welke velden overeenkomen, plus directe links naar de interne opdracht en de
          externe bron.
        </p>
      </CardHeader>
      <CardContent className="min-w-0">
        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-6 py-8 text-sm text-muted-foreground">
            Nog geen cross-platform overlap gevonden.
          </div>
        ) : (
          <div className="max-h-[640px] min-w-0 overflow-y-auto pr-4">
            <div className="min-w-0 space-y-4">
              {groups.map((group) => (
                <div
                  key={group.groupId}
                  className="min-w-0 rounded-xl border border-border bg-muted/20 p-4"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="min-w-0 break-words text-sm font-semibold text-foreground">
                        {group.title}
                      </h3>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        {strategyLabel(group.strategy)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        {group.platforms.length} platforms
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Match op: {group.criteria.join(" · ")}
                    </p>
                    {sharedValueSummary(group) && (
                      <p className="text-xs text-muted-foreground">
                        Gedeelde waarden: {sharedValueSummary(group)}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    {group.listings.map((listing) => (
                      <div
                        key={listing.id}
                        className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/70 bg-background/80 px-3 py-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <PlatformBadge platform={listing.platform} className="text-[10px]" />
                            {listing.location && (
                              <span className="text-xs text-muted-foreground">
                                {listing.location}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-sm font-medium text-foreground">
                            {listing.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {listing.endClient || listing.company || "Organisatie onbekend"}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs">
                          <Link
                            href={`/opdrachten/${listing.id}`}
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                          >
                            Open opdracht
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                          {listing.externalUrl && (
                            <Link
                              href={listing.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                            >
                              Externe bron
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
