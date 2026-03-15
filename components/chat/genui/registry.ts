import { type ComponentType, lazy } from "react";

type GenUIEntry = {
  component: React.LazyExoticComponent<ComponentType<{ output: unknown }>>;
  label: string;
};

export const GENUI_REGISTRY: Record<string, GenUIEntry> = {
  // Existing detail cards
  getOpdrachtDetail: {
    component: lazy(() =>
      import("./opdracht-card").then((m) => ({ default: m.OpdrachtGenUICard })),
    ),
    label: "Opdracht",
  },
  getKandidaatDetail: {
    component: lazy(() =>
      import("./kandidaat-card").then((m) => ({ default: m.KandidaatGenUICard })),
    ),
    label: "Kandidaat",
  },
  getMatchDetail: {
    component: lazy(() => import("./match-card").then((m) => ({ default: m.MatchGenUICard }))),
    label: "Match",
  },
  // New search result lists
  queryOpdrachten: {
    component: lazy(() => import("./opdracht-list").then((m) => ({ default: m.OpdrachtListCard }))),
    label: "Opdrachten",
  },
  zoekKandidaten: {
    component: lazy(() =>
      import("./kandidaat-list").then((m) => ({ default: m.KandidaatListCard })),
    ),
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
    component: lazy(() => import("./action-card").then((m) => ({ default: m.MatchCreatedCard }))),
    label: "Match aangemaakt",
  },
  keurMatchGoed: {
    component: lazy(() => import("./action-card").then((m) => ({ default: m.MatchApprovedCard }))),
    label: "Match goedgekeurd",
  },
  wijsMatchAf: {
    component: lazy(() => import("./action-card").then((m) => ({ default: m.MatchRejectedCard }))),
    label: "Match afgewezen",
  },
  updateSollicitatieFase: {
    component: lazy(() => import("./action-card").then((m) => ({ default: m.StageUpdateCard }))),
    label: "Fase bijgewerkt",
  },
  planInterview: {
    component: lazy(() =>
      import("./action-card").then((m) => ({
        default: m.InterviewPlannedCard,
      })),
    ),
    label: "Interview gepland",
  },
  stuurBericht: {
    component: lazy(() => import("./action-card").then((m) => ({ default: m.MessageSentCard }))),
    label: "Bericht verstuurd",
  },
};
