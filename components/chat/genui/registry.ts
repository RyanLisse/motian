import { type ComponentType, lazy } from "react";
import {
  InterviewPlannedCard,
  MatchApprovedCard,
  MatchCreatedCard,
  MatchRejectedCard,
  MessageSentCard,
  StageUpdateCard,
} from "./action-card";
import { KandidaatGenUICard } from "./kandidaat-card";
import { KandidaatListCard } from "./kandidaat-list";
import { OpdrachtGenUICard } from "./opdracht-card";
import { OpdrachtListCard } from "./opdracht-list";

export type GenUIEntry = {
  component:
    | ComponentType<{ output: unknown }>
    | React.LazyExoticComponent<ComponentType<{ output: unknown }>>;
  label: string;
};

export const GENUI_REGISTRY: Record<string, GenUIEntry> = {
  // Existing detail cards
  getOpdrachtDetail: {
    component: OpdrachtGenUICard,
    label: "Opdracht",
  },
  getKandidaatDetail: {
    component: KandidaatGenUICard,
    label: "Kandidaat",
  },
  getMatchDetail: {
    component: lazy(() => import("./match-card").then((m) => ({ default: m.MatchGenUICard }))),
    label: "Match",
  },
  // New search result lists
  queryOpdrachten: {
    component: OpdrachtListCard,
    label: "Opdrachten",
  },
  zoekKandidaten: {
    component: KandidaatListCard,
    label: "Kandidaten",
  },
  zoekMatches: {
    component: lazy(() => import("./match-list").then((m) => ({ default: m.MatchListCard }))),
    label: "Matches",
  },
  zoekSollicitaties: {
    component: lazy(() =>
      import("./sollicitatie-list").then((m) => ({
        default: m.SollicitatieListCard,
      })),
    ),
    label: "Sollicitaties",
  },
  zoekInterviews: {
    component: lazy(() =>
      import("./interview-list").then((m) => ({ default: m.InterviewListCard })),
    ),
    label: "Interviews",
  },
  genereerInterviewPrep: {
    component: lazy(() =>
      import("./interview-prep-card").then((m) => ({ default: m.InterviewPrepCard })),
    ),
    label: "Interviewprep",
  },
  // Analytics
  analyseData: {
    component: lazy(() => import("./insight-chart").then((m) => ({ default: m.InsightChart }))),
    label: "Analyse",
  },
  getSollicitatieStats: {
    component: lazy(() => import("./pipeline-funnel").then((m) => ({ default: m.PipelineFunnel }))),
    label: "Pipeline",
  },
  // Action cards
  maakMatchAan: {
    component: MatchCreatedCard,
    label: "Match aangemaakt",
  },
  keurMatchGoed: {
    component: MatchApprovedCard,
    label: "Match goedgekeurd",
  },
  wijsMatchAf: {
    component: MatchRejectedCard,
    label: "Match afgewezen",
  },
  updateSollicitatieFase: {
    component: StageUpdateCard,
    label: "Fase bijgewerkt",
  },
  planInterview: {
    component: InterviewPlannedCard,
    label: "Interview gepland",
  },
  stuurBericht: {
    component: MessageSentCard,
    label: "Bericht verstuurd",
  },
  renderCanvas: {
    component: lazy(() => import("./canvas-embed").then((m) => ({ default: m.CanvasEmbed }))),
    label: "Canvas",
  },
  cvIntakeResultaat: {
    component: lazy(() => import("./cv-intake-card").then((m) => ({ default: m.CvIntakeCard }))),
    label: "CV-intake",
  },
  voerStructuredMatchUit: {
    component: lazy(() =>
      import("./comparison-table").then((m) => ({ default: m.ComparisonTable })),
    ),
    label: "Vergelijking",
  },
  // Platform onboarding
  platformAutoSetup: {
    component: lazy(() => import("./platform-card").then((m) => ({ default: m.PlatformCard }))),
    label: "Platform onboarding",
  },
  platformOnboardingStatus: {
    component: lazy(() => import("./platform-card").then((m) => ({ default: m.PlatformCard }))),
    label: "Platformstatus",
  },
  platformsList: {
    component: lazy(() => import("./platform-card").then((m) => ({ default: m.PlatformCard }))),
    label: "Platformen",
  },
  platformReanalyze: {
    component: lazy(() => import("./platform-card").then((m) => ({ default: m.PlatformCard }))),
    label: "Platform heranalyse",
  },
  platformCompleteOnboarding: {
    component: lazy(() => import("./platform-card").then((m) => ({ default: m.PlatformCard }))),
    label: "Platform voltooid",
  },
};
