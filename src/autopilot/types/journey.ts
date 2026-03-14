// Journey types for autopilot browser audit
export type AutopilotSurface =
  | "/chat"
  | "/matching"
  | "/vacatures"
  | "/vacatures/[id]"
  | "/kandidaten"
  | "/dashboard";

export type JourneyKind = "interactive" | "redirect" | "page-load";

export interface InteractionStep {
  /** Action to perform */
  action: "click" | "type" | "wait-for-selector" | "wait-for-text";
  /** CSS selector for click/type targets */
  selector?: string;
  /** Text to type (for "type" action) */
  text?: string;
  /** Text to wait for (for "wait-for-text" action) */
  waitForText?: string;
  /** Timeout for this specific step */
  timeoutMs?: number;
  /** Description of what this step does */
  description?: string;
}

export interface JourneySpec {
  id: string;
  surface: AutopilotSurface;
  kind: JourneyKind;
  description: string;
  /** For redirect journeys: where should the redirect land? */
  expectedRedirectTarget?: string;
  /** Timeout for the journey execution */
  timeoutMs: number;
  /** Steps to execute for interactive journeys */
  interactions?: InteractionStep[];
  /** CSS selectors that must be visible after page load for the journey to pass */
  expectedSelectors?: string[];
}
