"use client";

import { Loader2, Save } from "lucide-react";
import { useCallback, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { SettingsPayload } from "@/src/schemas/settings";

type Props = { initial: SettingsPayload };

export function SettingsForm({ initial }: Props) {
  const [values, setValues] = useState<SettingsPayload>(initial);
  const [saved, setSaved] = useState<SettingsPayload>(initial);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const hasChanges = JSON.stringify(values) !== JSON.stringify(saved);

  const toggle = useCallback(
    (key: keyof SettingsPayload) => setValues((prev) => ({ ...prev, [key]: !prev[key] })),
    [],
  );

  const setNumber = useCallback(
    (key: keyof SettingsPayload, value: string) =>
      setValues((prev) => ({ ...prev, [key]: value === "" ? 0 : Number(value) })),
    [],
  );

  const handleSave = () => {
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        const res = await fetch("/api/instellingen", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }

        const { data } = await res.json();
        setSaved(data);
        setValues(data);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Onbekende fout");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Matching */}
      <Card>
        <CardHeader>
          <CardTitle>Matching</CardTitle>
          <CardDescription>
            Configureer de matchinglogica en automatische verrijking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Minimale match-score drempel</p>
              <p className="text-xs text-muted-foreground">
                Matches onder deze score worden niet getoond (0-100)
              </p>
            </div>
            <Input
              type="number"
              min={0}
              max={100}
              className="w-20 text-right"
              value={values.minimumScoreThreshold}
              onChange={(e) => setNumber("minimumScoreThreshold", e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Automatische verrijking</p>
              <p className="text-xs text-muted-foreground">
                Verrijk kandidaatprofielen automatisch met AI
              </p>
            </div>
            <Switch
              checked={values.autoEnrichmentEnabled}
              onCheckedChange={() => toggle("autoEnrichmentEnabled")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Gegevensbeheer */}
      <Card>
        <CardHeader>
          <CardTitle>Gegevensbeheer</CardTitle>
          <CardDescription>AVG-bewaartermijn en automatisch opschonen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">AVG-bewaartermijn (dagen)</p>
              <p className="text-xs text-muted-foreground">
                Aantal dagen voordat gegevens verlopen (30-3650)
              </p>
            </div>
            <Input
              type="number"
              min={30}
              max={3650}
              className="w-24 text-right"
              value={values.gdprRetentionDays}
              onChange={(e) => setNumber("gdprRetentionDays", e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Automatisch opschonen</p>
              <p className="text-xs text-muted-foreground">
                Verwijder verlopen gegevens automatisch
              </p>
            </div>
            <Switch
              checked={values.autoCleanupEnabled}
              onCheckedChange={() => toggle("autoCleanupEnabled")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Meldingen */}
      <Card>
        <CardHeader>
          <CardTitle>Meldingen</CardTitle>
          <CardDescription>Notificatie-instellingen voor het platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Slack-notificaties</p>
              <p className="text-xs text-muted-foreground">Ontvang meldingen via Slack</p>
            </div>
            <Switch
              checked={values.slackNotificationsEnabled}
              onCheckedChange={() => toggle("slackNotificationsEnabled")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Melding bij scrape-fouten</p>
              <p className="text-xs text-muted-foreground">
                Stuur een melding wanneer een scraper faalt
              </p>
            </div>
            <Switch
              checked={values.notifyOnScrapeErrors}
              onCheckedChange={() => toggle("notifyOnScrapeErrors")}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save bar */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={!hasChanges || isPending}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Opslaan
        </Button>
        {success && <span className="text-sm text-green-600">Instellingen opgeslagen</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </div>
  );
}
