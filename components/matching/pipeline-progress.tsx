import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "pending" | "active" | "complete" | "error";

export interface PipelineStep {
  id: string;
  label: string;
  detail?: string;
  status: StepStatus;
}

interface PipelineProgressProps {
  steps: PipelineStep[];
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "complete":
      return <Check className="h-4 w-4 text-green-600" />;
    case "active":
      return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    case "error":
      return <Circle className="h-4 w-4 text-destructive fill-destructive" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40" />;
  }
}

export function PipelineProgress({ steps }: PipelineProgressProps) {
  return (
    <div className="flex flex-col gap-0">
      {steps.map((step, i) => (
        <div key={step.id} className="flex items-start gap-3">
          {/* Vertical line + icon */}
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                step.status === "complete" && "border-green-600 bg-green-50",
                step.status === "active" && "border-primary bg-primary/5",
                step.status === "error" && "border-destructive bg-destructive/10",
                step.status === "pending" && "border-border bg-muted/30",
              )}
            >
              <StepIcon status={step.status} />
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "w-px h-5 transition-colors duration-300",
                  step.status === "complete" ? "bg-green-300" : "bg-border",
                )}
              />
            )}
          </div>

          {/* Label + detail */}
          <div className="pt-1 min-w-0">
            <p
              className={cn(
                "text-sm font-medium leading-tight transition-colors duration-300",
                step.status === "complete" && "text-foreground",
                step.status === "active" && "text-foreground",
                step.status === "error" && "text-destructive",
                step.status === "pending" && "text-muted-foreground/60",
              )}
            >
              {step.label}
            </p>
            {step.detail && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{step.detail}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
