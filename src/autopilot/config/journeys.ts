import type { JourneySpec } from "../types/journey";

export const MVP_JOURNEYS: JourneySpec[] = [
  {
    id: "chat-page-load",
    surface: "/chat",
    kind: "interactive",
    description: "Load chat page and verify it renders with input ready",
    timeoutMs: 30_000,
  },
  {
    id: "matching-redirect",
    surface: "/matching",
    kind: "redirect",
    description: "Verify /matching redirects to the correct destination",
    expectedRedirectTarget: "/professionals",
    timeoutMs: 10_000,
  },
  {
    id: "opdrachten-list",
    surface: "/opdrachten",
    kind: "page-load",
    description: "Load opdrachten list page and verify table/empty-state renders",
    timeoutMs: 30_000,
  },
];
