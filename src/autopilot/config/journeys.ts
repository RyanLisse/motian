import type { JourneySpec } from "../types/journey";

/** Core MVP journeys — always run */
export const MVP_JOURNEYS: JourneySpec[] = [
  {
    id: "chat-page-load",
    surface: "/chat",
    kind: "interactive",
    description: "Load chat page and verify it renders with input ready",
    timeoutMs: 30_000,
    expectedSelectors: ["textarea, input[type='text'], [contenteditable]"],
  },
  {
    id: "matching-redirect",
    surface: "/matching",
    kind: "redirect",
    description: "Verify /matching redirects to the correct destination",
    expectedRedirectTarget: "/kandidaten",
    timeoutMs: 10_000,
  },
  {
    id: "vacatures-list",
    surface: "/vacatures",
    kind: "page-load",
    description: "Load vacatures list page and verify table/empty-state renders",
    timeoutMs: 30_000,
  },
];

/** Extended journeys — Phase 2 additions */
export const EXTENDED_JOURNEYS: JourneySpec[] = [
  {
    id: "chat-send-message",
    surface: "/chat",
    kind: "interactive",
    description: "Open chat, type a message, and verify AI responds",
    timeoutMs: 60_000,
    interactions: [
      {
        action: "wait-for-selector",
        selector: "textarea, input[type='text'], [contenteditable]",
        description: "Wait for chat input to be ready",
        timeoutMs: 10_000,
      },
      {
        action: "type",
        selector: "textarea, input[type='text'], [contenteditable]",
        text: "Hallo, kun je me helpen met vacatures zoeken?",
        description: "Type a test message in Dutch",
      },
      {
        action: "click",
        selector:
          "button[type='submit'], button[aria-label*='send'], button[aria-label*='verzend']",
        description: "Click send button",
        timeoutMs: 5_000,
      },
      {
        action: "wait-for-selector",
        selector: "[data-role='assistant'], .assistant-message, [class*='assistant']",
        description: "Wait for AI response to appear",
        timeoutMs: 45_000,
      },
    ],
  },
  {
    id: "kandidaten-list",
    surface: "/kandidaten",
    kind: "page-load",
    description: "Load kandidaten/talent pool page and verify it renders",
    timeoutMs: 30_000,
  },
  {
    id: "dashboard-load",
    surface: "/dashboard",
    kind: "page-load",
    description: "Load dashboard page and verify KPI cards or empty state renders",
    timeoutMs: 30_000,
  },
];

/** All journeys combined */
export const ALL_JOURNEYS: JourneySpec[] = [...MVP_JOURNEYS, ...EXTENDED_JOURNEYS];
