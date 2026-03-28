import { Search } from "lucide-react";
import { DataRefreshListener } from "@/components/data-refresh-listener";

export default function OpdrachtenPage() {
  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <DataRefreshListener events={["job:created", "job:updated", "job:deleted"]} />
      <div className="text-center max-w-sm px-6">
        <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto mb-5">
          <Search className="h-7 w-7 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-2">Start je zoektocht</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Selecteer een vacature uit de lijst om de details te bekijken
        </p>
      </div>
    </div>
  );
}
