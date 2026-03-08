import { Database, GitCompareArrows, Layers3, SkipForward } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const EXPLANATIONS = [
  {
    title: "Overlap tussen bronnen",
    description:
      "Dit zijn losse vacatures uit meerdere platforms die waarschijnlijk over dezelfde opdracht gaan. Ze blijven aparte records totdat een rijkere matchinglaag dit expliciet samenbrengt.",
    icon: Layers3,
  },
  {
    title: "Bijgewerkt (zelfde bron)",
    description:
      "De scraper vond een listing opnieuw op hetzelfde platform. In plaats van een nieuwe vacature aan te maken, werken we de bestaande vacature bij.",
    icon: GitCompareArrows,
  },
  {
    title: "Nieuw toegevoegd",
    description:
      "Een vacature was nog niet bekend op basis van platform + externe id en is daarom als nieuwe opdracht opgeslagen.",
    icon: Database,
  },
  {
    title: "Overgeslagen",
    description:
      "Een item is wel gezien, maar niet opgeslagen. Meestal komt dat door onvolledige brondata, validatieproblemen of een fout tijdens verwerking.",
    icon: SkipForward,
  },
];

export function ScrapeMetricsExplainer() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base">Hoe lees je deze cijfers?</CardTitle>
        <p className="text-sm text-muted-foreground">
          De databronnen-UX maakt onderscheid tussen overlap tussen platforms en updates binnen één
          bron, zodat operations snel ziet wat echt nieuw is en wat alleen opnieuw binnenkomt.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {EXPLANATIONS.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full border border-border bg-background p-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="text-xs leading-5 text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
