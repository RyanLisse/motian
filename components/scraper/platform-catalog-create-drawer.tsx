"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, startTransition, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

const ADAPTER_HELP = "Gebruik http_html_list_detail, browser_bootstrap_http_harvest of api_json.";

export function PlatformCatalogCreateDrawer() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [adapterKind, setAdapterKind] = useState("http_html_list_detail");
  const [authMode, setAuthMode] = useState("none");
  const [defaultBaseUrl, setDefaultBaseUrl] = useState("");
  const [docsUrl, setDocsUrl] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(setter: (value: string) => void) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setResult("");
      setter(event.target.value);
    };
  }

  async function handleCreate() {
    setSubmitting(true);
    setResult("");

    try {
      const response = await fetch("/api/platforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          displayName: displayName || undefined,
          adapterKind,
          authMode,
          defaultBaseUrl: defaultBaseUrl || undefined,
          docsUrl: docsUrl || undefined,
          description: description || undefined,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Platform toevoegen mislukt");
      }

      setResult("Platformcatalogus opgeslagen. Configureer daarna de runtimeconfiguratie.");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">Nieuw platform</Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Nieuw platform</SheetTitle>
          <SheetDescription>
            Voeg een ondersteund platform toe aan de catalogus of leg een nieuw board vast voor
            onboarding en triage.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 overflow-y-auto px-4 pb-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground" htmlFor="platform-catalog-slug">
              Slug
            </label>
            <Input id="platform-catalog-slug" value={slug} onChange={updateField(setSlug)} />
          </div>

          <div className="space-y-1">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="platform-catalog-display-name"
            >
              Weergavenaam
            </label>
            <Input
              id="platform-catalog-display-name"
              value={displayName}
              onChange={updateField(setDisplayName)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="platform-catalog-adapter-kind"
              >
                Adaptertype
              </label>
              <Input
                id="platform-catalog-adapter-kind"
                value={adapterKind}
                onChange={updateField(setAdapterKind)}
              />
              <p className="text-xs text-muted-foreground">{ADAPTER_HELP}</p>
            </div>

            <div className="space-y-1">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="platform-catalog-auth-mode"
              >
                Authenticatiemodus
              </label>
              <Input
                id="platform-catalog-auth-mode"
                value={authMode}
                onChange={updateField(setAuthMode)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="platform-catalog-default-base-url"
            >
              Standaard basis-URL
            </label>
            <Input
              id="platform-catalog-default-base-url"
              value={defaultBaseUrl}
              onChange={updateField(setDefaultBaseUrl)}
            />
          </div>

          <div className="space-y-1">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="platform-catalog-docs-url"
            >
              Documentatie / bron URL
            </label>
            <Input
              id="platform-catalog-docs-url"
              value={docsUrl}
              onChange={updateField(setDocsUrl)}
            />
          </div>

          <div className="space-y-1">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="platform-catalog-description"
            >
              Omschrijving
            </label>
            <Textarea
              id="platform-catalog-description"
              rows={5}
              value={description}
              onChange={updateField(setDescription)}
            />
          </div>

          {result ? (
            <p className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
              {result}
            </p>
          ) : null}

          <Button onClick={handleCreate} disabled={submitting || slug.trim().length === 0}>
            {submitting ? "Opslaan..." : "Platform toevoegen"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
