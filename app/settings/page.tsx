import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllSettings } from "@/src/services/settings";

export const revalidate = 300;

function SettingsSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[800px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  );
}

async function SettingsContent() {
  const settings = await getAllSettings();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[800px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <PageHeader
          title="Instellingen"
          description="Platformconfiguratie en gebruikersinstellingen"
          breadcrumbs={[
            { label: "Overzicht", href: "/overzicht" },
            { label: "Instellingen", href: "/settings" },
          ]}
        />

        <SettingsForm initial={settings} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}
