"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PlatformCatalogEntry = {
  slug: string;
  displayName: string;
  adapterKind: string;
  authMode: string;
  description: string;
  defaultBaseUrl: string | null;
  configSchema: Record<string, unknown>;
  authSchema: Record<string, unknown>;
  config: {
    id: string;
    baseUrl: string;
    isActive: boolean;
    cronExpression: string | null;
    parameters: unknown;
  } | null;
  latestRun: {
    status: string;
    blockerKind: string | null;
  } | null;
};

function readSchemaKeys(schema: Record<string, unknown> | undefined): string[] {
  if (!schema || typeof schema !== "object") return [];
  const properties =
    schema.properties && typeof schema.properties === "object"
      ? (schema.properties as Record<string, unknown>)
      : null;
  return properties ? Object.keys(properties) : [];
}

function parseJsonObject(value: string, fieldName: string): Record<string, unknown> {
  if (!value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${fieldName} moet een JSON-object zijn.`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.message.includes("moet een JSON-object")) {
      throw error;
    }

    throw new Error(`${fieldName} bevat ongeldige JSON. Controleer de opmaak en probeer opnieuw.`);
  }
}

export function PlatformConfigForm({ entry }: { entry: PlatformCatalogEntry }) {
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState(entry.config?.baseUrl ?? entry.defaultBaseUrl ?? "");
  const [cronExpression, setCronExpression] = useState(
    entry.config?.cronExpression ?? "0 0 */4 * * *",
  );
  const [isActive, setIsActive] = useState(entry.config?.isActive ?? false);
  const [parameters, setParameters] = useState(
    JSON.stringify(entry.config?.parameters ?? {}, null, 2),
  );
  const [authConfig, setAuthConfig] = useState("{}");
  const [result, setResult] = useState<string>("");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const configKeys = readSchemaKeys(entry.configSchema);
  const authKeys = readSchemaKeys(entry.authSchema);

  async function callApi(action: "save" | "validate" | "test-import" | "activate") {
    setLoadingAction(action);
    setResult("");
    try {
      if (action === "save") {
        const response = await fetch("/api/scraper-configuraties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            platform: entry.slug,
            baseUrl,
            cronExpression,
            isActive,
            parameters: parseJsonObject(parameters, "Parameters JSON"),
            authConfig: parseJsonObject(authConfig, "Auth JSON"),
          }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Opslaan mislukt");
        }
        setResult("Configuratie opgeslagen.");
      }

      if (action === "validate") {
        const response = await fetch(`/api/platforms/${entry.slug}/validate`, {
          method: "POST",
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Validatie mislukt");
        }
        setResult(`Validatie: ${payload.data.message}`);
      }

      if (action === "test-import") {
        const response = await fetch(`/api/platforms/${entry.slug}/test-import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 3 }),
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Smoke import mislukt");
        }
        setResult(
          `Smoke import: ${payload.data.status} (${payload.data.jobsFound} listings)` +
            (payload.data.blockerKind ? ` · blocker: ${payload.data.blockerKind}` : ""),
        );
      }

      if (action === "activate") {
        const response = await fetch(`/api/platforms/${entry.slug}/activate`, {
          method: "POST",
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Activeren mislukt");
        }
        setResult("Platform geactiveerd.");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Platform slug</p>
        <p className="text-sm text-muted-foreground">{entry.slug}</p>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Base URL</p>
        <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Cron expressie</p>
        <Input value={cronExpression} onChange={(event) => setCronExpression(event.target.value)} />
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border/70 p-3">
        <Checkbox checked={isActive} onCheckedChange={(checked) => setIsActive(Boolean(checked))} />
        <div>
          <p className="text-sm font-medium text-foreground">Actief na opslaan</p>
          <p className="text-xs text-muted-foreground">
            Laat recruiters en agents dit platform meenemen in reguliere runs.
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Parameters JSON</p>
        {configKeys.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Verwachte sleutels: {configKeys.join(", ")}
          </p>
        )}
        <Textarea
          value={parameters}
          onChange={(event) => setParameters(event.target.value)}
          rows={8}
        />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Auth JSON</p>
        {authKeys.length > 0 && (
          <p className="text-xs text-muted-foreground">Verwachte sleutels: {authKeys.join(", ")}</p>
        )}
        <Textarea
          value={authConfig}
          onChange={(event) => setAuthConfig(event.target.value)}
          rows={4}
        />
      </div>

      {entry.latestRun && (
        <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
          Laatste onboarding status:{" "}
          <span className="font-medium text-foreground">{entry.latestRun.status}</span>
          {entry.latestRun.blockerKind ? ` · blocker: ${entry.latestRun.blockerKind}` : ""}
        </div>
      )}

      {result && (
        <p
          aria-live="polite"
          className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground"
        >
          {result}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => callApi("save")} disabled={loadingAction !== null}>
          {loadingAction === "save" ? "Opslaan..." : "Opslaan"}
        </Button>
        <Button
          variant="outline"
          onClick={() => callApi("validate")}
          disabled={loadingAction !== null}
        >
          {loadingAction === "validate" ? "Valideren..." : "Valideer"}
        </Button>
        <Button
          variant="outline"
          onClick={() => callApi("test-import")}
          disabled={loadingAction !== null}
        >
          {loadingAction === "test-import" ? "Testen..." : "Test import"}
        </Button>
        <Button
          variant="secondary"
          onClick={() => callApi("activate")}
          disabled={loadingAction !== null}
        >
          {loadingAction === "activate" ? "Activeren..." : "Activeer"}
        </Button>
      </div>
    </div>
  );
}
