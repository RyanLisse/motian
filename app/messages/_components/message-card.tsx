import { ArrowDownLeft, ArrowUpRight, Globe, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { messages } from "@/src/db/schema";

export const channelColors: Record<string, string> = {
  email: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  phone: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  platform: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

export const channelIcons: Record<string, typeof Mail> = {
  email: Mail,
  phone: Phone,
  platform: Globe,
};

export const channelLabels: Record<string, string> = {
  email: "E-mail",
  phone: "Telefoon",
  platform: "Platform",
};

export const directionLabels: Record<string, string> = {
  inbound: "Inkomend",
  outbound: "Uitgaand",
};

interface MessageCardProps {
  message: typeof messages.$inferSelect;
  candidateName: string | null;
  jobTitle: string | null;
}

export function MessageCard({ message, candidateName, jobTitle }: MessageCardProps) {
  const ChannelIcon = channelIcons[message.channel] ?? Mail;
  const isInbound = message.direction === "inbound";

  return (
    <div
      key={message.id}
      className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isInbound ? (
              <ArrowDownLeft className="h-4 w-4 text-blue-500 shrink-0" />
            ) : (
              <ArrowUpRight className="h-4 w-4 text-primary shrink-0" />
            )}
            <span className="text-sm font-semibold text-foreground truncate">
              {message.subject ??
                message.body.substring(0, 80) + (message.body.length > 80 ? "..." : "")}
            </span>
          </div>
          <p className="text-xs text-muted-foreground ml-6">
            {candidateName ?? "Onbekend"} {jobTitle ? `\u00b7 ${jobTitle}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={`text-xs ${channelColors[message.channel] ?? ""}`}>
            <ChannelIcon className="h-3 w-3 mr-1" />
            {channelLabels[message.channel] ?? message.channel}
          </Badge>
        </div>
      </div>
      {message.subject && (
        <p className="mt-2 text-xs text-muted-foreground ml-6 line-clamp-2">
          {message.body.substring(0, 120)}
          {message.body.length > 120 ? "..." : ""}
        </p>
      )}
      <div className="mt-2 text-xs text-muted-foreground ml-6">
        {message.sentAt &&
          new Date(message.sentAt).toLocaleDateString("nl-NL", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
      </div>
    </div>
  );
}
