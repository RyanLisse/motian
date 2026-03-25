import type { A2UIEnvelope } from "@/src/schemas/a2ui";
import type { GenUIEntry } from "./registry";
import { GENUI_REGISTRY } from "./registry";

/**
 * Maps A2UI component identifiers to GENUI_REGISTRY keys.
 * External agents use A2UI names; this bridges to existing components.
 */
const A2UI_COMPONENT_MAP: Record<string, string> = {
  "candidate-card": "getKandidaatDetail",
  "candidate-list": "zoekKandidaten",
  "job-card": "getOpdrachtDetail",
  "job-list": "queryOpdrachten",
  "match-card": "getMatchDetail",
  "match-list": "zoekMatches",
  "application-list": "zoekSollicitaties",
  "interview-list": "zoekInterviews",
  "insight-chart": "analyseData",
  "pipeline-funnel": "getSollicitatieStats",
  "cv-intake": "cvIntakeResultaat",
  "comparison-table": "voerStructuredMatchUit",
  canvas: "renderCanvas",
};

type ResolvedA2UI = {
  entry: GenUIEntry | null;
  props: Record<string, unknown>;
  actions: A2UIEnvelope["actions"];
};

/**
 * Resolve an A2UI envelope to an existing GENUI_REGISTRY entry.
 * Lookup chain: A2UI_COMPONENT_MAP → direct GENUI_REGISTRY key → null (fallback).
 */
export function resolveA2UIComponent(envelope: A2UIEnvelope): ResolvedA2UI {
  const mappedKey = A2UI_COMPONENT_MAP[envelope.component];
  const entry =
    (mappedKey ? GENUI_REGISTRY[mappedKey] : null) ?? GENUI_REGISTRY[envelope.component] ?? null;

  return {
    entry,
    props: envelope.props,
    actions: envelope.actions,
  };
}
