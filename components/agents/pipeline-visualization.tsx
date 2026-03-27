"use client";

import {
  ArrowRight,
  type Bot,
  Calendar,
  CheckCircle2,
  FileText,
  Mail,
  Phone,
  Search,
  Users,
  Zap,
} from "lucide-react";

// ---------- Types ----------

interface PipelineStep {
  id: string;
  label: string;
  dutchLabel: string;
  icon: typeof Bot;
  agent: string;
  color: string;
}

// ---------- Constants ----------

const PIPELINE_STEPS: PipelineStep[] = [
  {
    id: "cv_drop",
    label: "CV Drop",
    dutchLabel: "CV Upload",
    icon: FileText,
    agent: "intake",
    color: "bg-blue-500",
  },
  {
    id: "parse_enrich",
    label: "Parse & Enrich",
    dutchLabel: "Verwerken & Verrijken",
    icon: Users,
    agent: "intake",
    color: "bg-blue-500",
  },
  {
    id: "match",
    label: "Semantic Match",
    dutchLabel: "Semantisch Matchen",
    icon: Zap,
    agent: "matcher",
    color: "bg-purple-500",
  },
  {
    id: "screen",
    label: "AI Screening",
    dutchLabel: "AI Screening",
    icon: Phone,
    agent: "screener",
    color: "bg-amber-500",
  },
  {
    id: "schedule",
    label: "Book Interview",
    dutchLabel: "Interview Inplannen",
    icon: Calendar,
    agent: "scheduler",
    color: "bg-green-500",
  },
  {
    id: "notify",
    label: "Notify",
    dutchLabel: "Notificeren",
    icon: Mail,
    agent: "communicator",
    color: "bg-pink-500",
  },
  {
    id: "done",
    label: "Human Decision",
    dutchLabel: "Menselijke Beslissing",
    icon: CheckCircle2,
    agent: "recruiter",
    color: "bg-emerald-500",
  },
];

// ---------- Component ----------

interface PipelineVisualizationProps {
  /** Optional: highlight the active step */
  activeStep?: string;
  /** Optional: stats per step */
  stepCounts?: Record<string, number>;
}

export function PipelineVisualization({ activeStep, stepCounts }: PipelineVisualizationProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Agent Pipeline</h3>

      {/* Horizontal pipeline */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {PIPELINE_STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = activeStep === step.id;
          const count = stepCounts?.[step.id];

          return (
            <div key={step.id} className="flex items-center">
              {/* Step node */}
              <div
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-2.5 transition-all ${
                  isActive
                    ? `${step.color} border-transparent text-white shadow-lg shadow-${step.color}/20`
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="whitespace-nowrap text-[10px] font-medium leading-tight">
                  {step.dutchLabel}
                </span>
                <span className="text-[9px] opacity-70">{step.agent}</span>
                {count != null && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isActive ? "bg-white/20" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </div>

              {/* Arrow between steps */}
              {index < PIPELINE_STEPS.length - 1 && (
                <ArrowRight className="mx-1 h-4 w-4 flex-shrink-0 text-gray-300" />
              )}
            </div>
          );
        })}
      </div>

      {/* Sourcing Agent — shown separately as a loop */}
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-cyan-300 bg-cyan-50/50 px-3 py-2">
        <Search className="h-4 w-4 text-cyan-600" />
        <div className="flex-1">
          <span className="text-xs font-medium text-cyan-700">Sourcing Agent</span>
          <span className="ml-2 text-[10px] text-cyan-500">
            Proactief kandidaten zoeken voor ondervoorziene vacatures (nachtelijk)
          </span>
        </div>
        {stepCounts?.sourcing != null && (
          <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-700">
            {stepCounts.sourcing}
          </span>
        )}
      </div>
    </div>
  );
}
