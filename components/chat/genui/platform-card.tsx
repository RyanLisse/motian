"use client";

import { type FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { submitPlatformCredentials } from "./credential-submit";
import { onboardingStepLabels, platformStatusLabels } from "./genui-utils";

// ─── Type Guards ──────────────────────────────────────────────

type CredentialField = { name: string; label: string; type: "text" | "password" };

type OnboardStartedOutput = {
  success: true;
  platform: string;
  displayName: string;
  activated: boolean;
  testImport?: {
    status: string;
    jobsFound: number;
    sampleListings?: Array<{ title: string; company?: string; location?: string }>;
  };
  validation?: { ok: boolean; message: string };
  scrapingStrategy?: Record<string, unknown>;
  nextSteps?: string[];
};

type CredentialsNeededOutput = {
  status: "credentials_needed";
  platform: string;
  displayName: string;
  authMode: string;
  fields: CredentialField[];
};

type ExistsOutput = {
  status: "exists";
  platform: string;
  displayName: string;
  isActive: boolean;
  message: string;
};

type ErrorOutput = {
  success: false;
  step: string;
  error: string;
  suggestion?: string;
};

type OnboardingStatusOutput = {
  catalog: { slug: string; displayName: string };
  config?: {
    isActive: boolean;
    cronExpression?: string;
    lastRunAt?: string;
    lastRunStatus?: string;
  };
  latestRun?: { status: string; currentStep: string; blockerKind?: string };
};

type PlatformListOutput = Array<{
  slug: string;
  displayName: string;
  config?: { isActive: boolean; lastRunAt?: string };
  latestRun?: { status: string };
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isCredentialsNeeded(o: unknown): o is CredentialsNeededOutput {
  return isRecord(o) && o.status === "credentials_needed";
}

function isExists(o: unknown): o is ExistsOutput {
  return isRecord(o) && o.status === "exists";
}

function isOnboardSuccess(o: unknown): o is OnboardStartedOutput {
  return isRecord(o) && o.success === true && "platform" in o;
}

function isError(o: unknown): o is ErrorOutput {
  return isRecord(o) && o.success === false && "error" in o;
}

function isOnboardingStatus(o: unknown): o is OnboardingStatusOutput {
  return isRecord(o) && "catalog" in o;
}

function isPlatformList(o: unknown): o is PlatformListOutput {
  return Array.isArray(o) && (o.length === 0 || (o[0] !== undefined && "slug" in o[0]));
}

// ─── Sub-Components ──────────────────────────────────────────

function StepperBar({ currentStep, failed }: { currentStep: string; failed?: boolean }) {
  const steps = Object.entries(onboardingStepLabels);
  const currentIndex = steps.findIndex(([key]) => key === currentStep);

  return (
    <div className="flex items-center gap-1 text-xs">
      {steps.map(([key, label], i) => {
        const isActive = i === currentIndex;
        const isDone = i < currentIndex;
        const isFailed = isActive && failed;
        return (
          <div key={key} className="flex items-center gap-1">
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-medium ${
                isFailed
                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                  : isDone
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : isActive
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-muted text-muted-foreground"
              }`}
            >
              {isDone ? "\u2713" : i + 1}
            </div>
            <span className={isActive ? "font-medium" : "text-muted-foreground"}>{label}</span>
            {i < steps.length - 1 && <span className="text-muted-foreground">{"\u2192"}</span>}
          </div>
        );
      })}
    </div>
  );
}

function CredentialForm({ platform, fields }: { platform: string; fields: CredentialField[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitPlatformCredentials({
        platform,
        values,
      });
      setDone(true);
      // Clear credentials from memory
      setValues({});
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Opslaan mislukt. Probeer opnieuw.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
        Inloggegevens opgeslagen. De onboarding wordt hervat.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {fields.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} className="text-sm font-medium">
            {field.label}
          </label>
          <Input
            id={field.name}
            type={field.type}
            autoComplete="off"
            value={values[field.name] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
            required
          />
        </div>
      ))}
      <Button type="submit" size="sm" disabled={submitting}>
        {submitting ? "Verbinden..." : "Verbinden"}
      </Button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </form>
  );
}

function SampleListings({
  listings,
}: {
  listings: Array<{ title: string; company?: string; location?: string }>;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Voorbeeldvacatures:</p>
      {listings.map((l) => (
        <div key={`${l.title}-${l.company ?? ""}`} className="rounded border px-2 py-1 text-xs">
          <span className="font-medium">{l.title}</span>
          {l.company && <span className="text-muted-foreground"> — {l.company}</span>}
          {l.location && <span className="text-muted-foreground"> ({l.location})</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────

export function PlatformCard({ output }: { output: unknown }) {
  // Credentials needed
  if (isCredentialsNeeded(output)) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Inloggegevens vereist — {output.displayName}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Dit platform vereist authenticatie ({output.authMode}). Vul je gegevens in via het
            formulier hieronder.
          </p>
          <CredentialForm platform={output.platform} fields={output.fields} />
        </CardContent>
      </Card>
    );
  }

  // Platform already exists
  if (isExists(output)) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{output.displayName}</CardTitle>
            <Badge variant={output.isActive ? "default" : "secondary"}>
              {output.isActive ? "Actief" : "Inactief"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">{output.message}</p>
        </CardContent>
      </Card>
    );
  }

  // Successful onboarding
  if (isOnboardSuccess(output)) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{output.displayName}</CardTitle>
            <Badge variant={output.activated ? "default" : "secondary"}>
              {output.activated ? "Actief" : "Niet geactiveerd"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <StepperBar currentStep={output.activated ? "complete" : "activate"} />
          {output.testImport?.sampleListings && output.testImport.sampleListings.length > 0 && (
            <SampleListings listings={output.testImport.sampleListings} />
          )}
          {output.testImport && (
            <p className="text-xs text-muted-foreground">
              {output.testImport.jobsFound} vacatures gevonden bij test-import
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Error
  if (isError(output)) {
    return (
      <Card className="border-red-200 dark:border-red-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-red-700 dark:text-red-400">
            Onboarding mislukt
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <StepperBar currentStep={output.step} failed />
          <p className="text-xs text-red-600 dark:text-red-400">{output.error}</p>
          {output.suggestion && (
            <p className="text-xs text-muted-foreground">{output.suggestion}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Onboarding status
  if (isOnboardingStatus(output)) {
    const status = output.latestRun?.status ?? "draft";
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">{output.catalog.displayName}</CardTitle>
            <Badge
              variant={
                output.config?.isActive
                  ? "default"
                  : status === "failed" || status === "implementation_failed"
                    ? "destructive"
                    : status === "cancelled"
                      ? "outline"
                      : "secondary"
              }
            >
              {platformStatusLabels[status] ?? status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {output.latestRun && (
            <StepperBar
              currentStep={output.latestRun.currentStep}
              failed={status === "failed" || status === "implementation_failed"}
            />
          )}
          {output.config?.lastRunAt && (
            <p className="text-xs text-muted-foreground">
              Laatste scrape: {new Date(output.config.lastRunAt).toLocaleString("nl-NL")}
            </p>
          )}
          {output.latestRun?.blockerKind && (
            <p className="text-xs text-red-600">Blokkade: {output.latestRun.blockerKind}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Platform list
  if (isPlatformList(output)) {
    if (output.length === 0) {
      return (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Geen platformen gevonden</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Er zijn nog geen platformen ingericht voor deze omgeving.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-2">
        {output.slice(0, 8).map((p) => (
          <Card key={p.slug} className="p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">{p.displayName}</span>
              <div
                className={`h-2 w-2 rounded-full ${
                  p.config?.isActive
                    ? "bg-green-500"
                    : p.latestRun?.status === "failed"
                      ? "bg-red-500"
                      : "bg-gray-300"
                }`}
              />
            </div>
            {p.config?.lastRunAt && (
              <p className="text-[10px] text-muted-foreground">
                {new Date(p.config.lastRunAt).toLocaleDateString("nl-NL")}
              </p>
            )}
          </Card>
        ))}
      </div>
    );
  }

  // Fallback: render nothing (let the chat handle it as text)
  return null;
}
