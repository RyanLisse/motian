export interface BreadcrumbSegment {
  label: string;
  href: string;
}

const ROUTE_LABELS: Record<string, string> = {
  overzicht: "Overzicht",
  vacatures: "Vacatures",
  kandidaten: "Kandidaten",
  pipeline: "Pipeline",
  interviews: "Interviews",
  messages: "Berichten",
  matching: "Matching",
  agents: "Agents",
  autopilot: "Autopilot",
  scraper: "Databronnen",
  chat: "AI Assistent",
  settings: "Instellingen",
  runs: "Runs",
};

export function buildBreadcrumbs(
  pathname: string,
  dynamicLabels?: Record<string, string>,
): BreadcrumbSegment[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: BreadcrumbSegment[] = [];

  let currentPath = "";
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const label = dynamicLabels?.[segment] ?? ROUTE_LABELS[segment] ?? segment;
    crumbs.push({ label, href: currentPath });
  }

  return crumbs;
}
