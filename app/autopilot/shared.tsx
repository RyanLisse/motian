import { Activity, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge variant="outline" className="border-green-500 text-green-700">
          <CheckCircle2 className="h-3 w-3" />
          Voltooid
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3" />
          Mislukt
        </Badge>
      );
    case "running":
      return (
        <Badge variant="secondary">
          <Activity className="h-3 w-3" />
          Actief
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}
