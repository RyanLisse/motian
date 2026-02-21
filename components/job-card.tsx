import Link from "next/link";
import { MapPin, Building2, Clock, Calendar, Euro } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface JobCardProps {
  job: {
    id: string;
    title: string;
    company: string | null;
    location: string | null;
    platform: string;
    contractType: string | null;
    workArrangement: string | null;
    rateMin: number | null;
    rateMax: number | null;
    applicationDeadline: Date | null;
    postedAt: Date | null;
  };
}

const arrangementLabels: Record<string, string> = {
  hybride: "Hybride",
  op_locatie: "Op locatie",
  remote: "Remote",
};

export function JobCard({ job }: JobCardProps) {
  return (
    <Link href={`/opdrachten/${job.id}`}>
      <Card className="bg-card border-border hover:border-primary/40 transition-colors cursor-pointer">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base font-semibold text-foreground line-clamp-2 leading-snug">
              {job.title}
            </CardTitle>
            <Badge
              variant="outline"
              className="shrink-0 text-xs capitalize border-border text-muted-foreground"
            >
              {job.platform}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            {job.company && (
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {job.company}
              </span>
            )}
            {job.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {job.location}
              </span>
            )}
            {(job.rateMin || job.rateMax) && (
              <span className="flex items-center gap-1.5">
                <Euro className="h-3.5 w-3.5" />
                {job.rateMin && job.rateMax
                  ? `${job.rateMin} - ${job.rateMax}/uur`
                  : job.rateMax
                    ? `max ${job.rateMax}/uur`
                    : `min ${job.rateMin}/uur`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {job.workArrangement && (
              <Badge
                variant="outline"
                className={
                  job.workArrangement === "remote"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs"
                    : "text-xs border-border text-muted-foreground"
                }
              >
                {arrangementLabels[job.workArrangement] ?? job.workArrangement}
              </Badge>
            )}
            {job.contractType && (
              <Badge
                variant="outline"
                className="text-xs border-border text-muted-foreground capitalize"
              >
                {job.contractType}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            {job.applicationDeadline && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Sluit{" "}
                {new Date(job.applicationDeadline).toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
            {job.postedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(job.postedAt).toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
