"use client";

import { Building2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { buildOpdrachtenFilterHref } from "@/src/lib/opdrachten-filter-url";

type OpdrachtDetailEndClientFilterProps = {
  endClients: string[];
  currentEndClient?: string | null;
};

export function OpdrachtDetailEndClientFilter({
  endClients,
  currentEndClient,
}: OpdrachtDetailEndClientFilterProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedEndClient = searchParams.get("endClient")?.trim() ?? "";
  const normalizedCurrentEndClient = currentEndClient?.trim() ?? "";
  const options = useMemo(() => {
    const uniqueClients = new Set(
      endClients.map((client) => client.trim()).filter((client) => client.length > 0),
    );

    if (normalizedCurrentEndClient) {
      uniqueClients.add(normalizedCurrentEndClient);
    }

    return [...uniqueClients].sort((left, right) => left.localeCompare(right, "nl"));
  }, [endClients, normalizedCurrentEndClient]);

  const currentHref = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const handleEndClientChange = (value: string) => {
    const nextHref = buildOpdrachtenFilterHref(pathname, searchParams, {
      endClient: value,
      pagina: "1",
    });

    if (nextHref !== currentHref) {
      router.push(nextHref);
    }
  };

  const filteredListHref = useMemo(
    () =>
      buildOpdrachtenFilterHref("/vacatures", searchParams, {
        endClient: selectedEndClient,
        pagina: "1",
      }),
    [searchParams, selectedEndClient],
  );
  const canApplyCurrentEndClient =
    normalizedCurrentEndClient.length > 0 && normalizedCurrentEndClient !== selectedEndClient;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Eindopdrachtgever</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Filter de zijlijst en je teruglink direct op één eindopdrachtgever zonder deze vacature
            te verlaten.
          </p>
        </div>
        {canApplyCurrentEndClient ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-border"
            onClick={() => handleEndClientChange(normalizedCurrentEndClient)}
          >
            Gebruik {normalizedCurrentEndClient}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <SearchableCombobox
          value={selectedEndClient}
          options={options}
          onValueChange={handleEndClientChange}
          placeholder="Alle eindopdrachtgevers"
          searchPlaceholder="Zoek eindopdrachtgever..."
          emptyText="Geen eindopdrachtgevers gevonden."
          clearLabel="Alle eindopdrachtgevers"
          buttonClassName="h-11 rounded-lg border-border bg-background text-left text-sm"
          ariaLabel="Filter op eindopdrachtgever"
        />

        {selectedEndClient ? (
          <Button asChild size="sm" className="w-full lg:w-auto">
            <Link href={filteredListHref}>
              Open gefilterde lijst
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {selectedEndClient
          ? `De zijlijst en teruglink tonen nu vacatures voor ${selectedEndClient}.`
          : normalizedCurrentEndClient
            ? `Tip: kies ${normalizedCurrentEndClient} om vergelijkbare vacatures van dezelfde eindopdrachtgever snel terug te vinden.`
            : "Kies een eindopdrachtgever om snel vergelijkbare vacatures in context te bekijken."}
      </p>
    </section>
  );
}
