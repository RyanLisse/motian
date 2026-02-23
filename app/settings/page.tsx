import { Settings } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export default function SettingsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Instellingen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Platformconfiguratie en gebruikersinstellingen
          </p>
        </div>

        <EmptyState
          icon={<Settings className="h-8 w-8 opacity-40" />}
          title="Binnenkort beschikbaar"
          subtitle="Instellingen worden hier binnenkort toegevoegd"
        />
      </div>
    </div>
  );
}
