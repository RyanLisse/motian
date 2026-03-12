// Journey types for autopilot browser audit
export type AutopilotSurface = "/chat" | "/matching" | "/opdrachten" | "/opdrachten/[id]";

export type JourneyKind = "interactive" | "redirect" | "page-load";

export interface JourneySpec {
  id: string;
  surface: AutopilotSurface;
  kind: JourneyKind;
  description: string;
  /** For redirect journeys: where should the redirect land? */
  expectedRedirectTarget?: string;
  /** Timeout for the journey execution */
  timeoutMs: number;
}
