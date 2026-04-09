import { Calendar, Clock, Code2, MapPin, Monitor, Phone, Star, Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { interviews } from "@/src/db/schema";
import { InterviewFeedbackEditor } from "./interview-feedback-editor";

export const statusColors: Record<string, string> = {
  scheduled: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  completed: "bg-primary/10 text-primary border-primary/20",
  cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
};

export const statusLabels: Record<string, string> = {
  scheduled: "Gepland",
  completed: "Afgerond",
  cancelled: "Geannuleerd",
};

const typeIcons: Record<string, typeof Phone> = {
  phone: Phone,
  video: Video,
  onsite: MapPin,
  technical: Code2,
};

const typeColors: Record<string, string> = {
  phone: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  video: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  onsite: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  technical: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
};

interface InterviewCardProps {
  interview: typeof interviews.$inferSelect;
  candidateName: string | null;
  jobTitle: string | null;
  jobCompany: string | null;
}

export function InterviewCard({
  interview,
  candidateName,
  jobTitle,
  jobCompany,
}: InterviewCardProps) {
  const TypeIcon = typeIcons[interview.type] ?? Monitor;

  return (
    <div
      key={interview.id}
      className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-foreground truncate">
              {candidateName ?? "Onbekend"}
            </span>
            <span className="text-xs text-muted-foreground">→</span>
            <span className="text-sm text-muted-foreground truncate">{jobTitle ?? "Onbekend"}</span>
          </div>
          {jobCompany && <p className="text-xs text-muted-foreground">{jobCompany}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={`text-xs ${statusColors[interview.status] ?? ""}`}>
            {statusLabels[interview.status] ?? interview.status}
          </Badge>
          <Badge variant="outline" className={`text-xs ${typeColors[interview.type] ?? ""}`}>
            <TypeIcon className="h-3 w-3 mr-1" />
            {interview.type}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Date(interview.scheduledAt).toLocaleDateString("nl-NL", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}{" "}
          {new Date(interview.scheduledAt).toLocaleTimeString("nl-NL", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {interview.duration ?? 60} min
        </span>
        <span>{interview.interviewer}</span>
        {interview.rating && (
          <span className="flex items-center gap-0.5">
            <Star className="h-3 w-3 text-yellow-500" />
            {interview.rating}/5
          </span>
        )}
      </div>
      {interview.feedback && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{interview.feedback}</p>
      )}
      <div className="mt-3">
        <InterviewFeedbackEditor
          interviewId={interview.id}
          initialFeedback={interview.feedback}
          initialRating={interview.rating}
        />
      </div>
    </div>
  );
}
