import { SettingsForm } from "@/components/settings-form";
import { getAllSettings } from "@/src/services/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getAllSettings();

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[800px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Instellingen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Platformconfiguratie en gebruikersinstellingen
          </p>
        </div>

        <SettingsForm initial={settings} />
      </div>
    </div>
  );
}
