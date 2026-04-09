import {
  Bot,
  Briefcase,
  Calendar,
  Database,
  FileJson,
  GitCompareArrows,
  Kanban,
  LayoutDashboard,
  type LucideIcon,
  MessageCircle,
  MessageSquare,
  Plug,
  Rocket,
  Rss,
  Settings,
  Tags,
  Users,
  Wrench,
} from "lucide-react";

export interface NavigationItem {
  title: string;
  url: string;
  icon: LucideIcon;
  badge?: { text: string; variant: string };
  keywords?: string[];
  matchPaths?: string[];
  prefetch?: boolean;
  tooltip?: string;
}

export interface CommandPalettePage {
  label: string;
  href: string;
  icon: LucideIcon;
  group: string;
  keywords?: string[];
}

export const PRIMARY_NAV_ITEMS = [
  {
    title: "Overzicht",
    url: "/overzicht",
    icon: LayoutDashboard,
    keywords: ["dashboard", "home", "start"],
  },
  {
    title: "Vacatures",
    url: "/vacatures",
    icon: Briefcase,
    keywords: ["jobs", "opdrachten", "werk"],
    matchPaths: ["/opdrachten"],
  },
  {
    title: "Kandidaten",
    url: "/kandidaten",
    icon: Users,
    keywords: ["talent", "cv", "sollicitant"],
  },
  {
    title: "Pipeline",
    url: "/pipeline",
    icon: Kanban,
    keywords: ["kanban", "status", "fase"],
    prefetch: false,
  },
  {
    title: "Chat",
    url: "/chat",
    icon: MessageCircle,
    keywords: ["chat", "ai", "assistent", "vraag", "hulp"],
  },
] as const satisfies readonly NavigationItem[];

export const MEER_NAV_ITEMS = [
  {
    title: "Interviews",
    url: "/interviews",
    icon: Calendar,
    keywords: ["gesprekken", "agenda", "planning"],
  },
  {
    title: "Berichten",
    url: "/messages",
    icon: MessageSquare,
    keywords: ["communicatie", "email", "sms"],
  },
  {
    title: "Matching",
    url: "/matching",
    icon: GitCompareArrows,
    keywords: ["koppelen", "score"],
  },
  {
    title: "Agents",
    url: "/agents",
    icon: Bot,
    keywords: ["agent", "workflow", "automatisering"],
  },
  {
    title: "Autopilot",
    url: "/autopilot",
    icon: Rocket,
    keywords: ["autopilot", "runs", "bewaking"],
  },
  {
    title: "Databronnen",
    url: "/scraper",
    icon: Database,
    keywords: ["scraper", "bron", "import"],
  },
] as const satisfies readonly NavigationItem[];

function toCommandPalettePage(group: string, item: NavigationItem): CommandPalettePage {
  return {
    label: item.title,
    href: item.url,
    icon: item.icon,
    group,
    keywords: item.keywords,
  };
}

const COMMAND_PALETTE_UTILITY_PAGES = [
  {
    label: "Automatisering",
    href: "/automatisering",
    icon: Wrench,
    group: "Hulpmiddelen",
    keywords: ["operaties", "tools", "automatisch"],
  },
  {
    label: "Vaardigheden",
    href: "/vaardigheden",
    icon: Tags,
    group: "Hulpmiddelen",
    keywords: ["skills", "esco", "taxonomie"],
  },
  {
    label: "Instellingen",
    href: "/settings",
    icon: Settings,
    group: "Hulpmiddelen",
    keywords: ["config", "profiel"],
  },
  {
    label: "API Documentatie",
    href: "/api-docs",
    icon: FileJson,
    group: "Ontwikkelaar",
    keywords: ["api", "docs", "openapi", "swagger", "endpoints"],
  },
  {
    label: "XML Feed",
    href: "/api/salesforce-feed",
    icon: Rss,
    group: "Ontwikkelaar",
    keywords: ["xml", "feed", "salesforce", "export"],
  },
  {
    label: "MCP Server",
    href: "/ontwikkelaar",
    icon: Plug,
    group: "Ontwikkelaar",
    keywords: ["mcp", "protocol", "tools", "integratie", "ide"],
  },
  {
    label: "OpenAPI Spec",
    href: "/api/openapi",
    icon: FileJson,
    group: "Ontwikkelaar",
    keywords: ["openapi", "json", "spec", "schema"],
  },
] as const satisfies readonly CommandPalettePage[];

export const COMMAND_PALETTE_PAGES = [
  ...PRIMARY_NAV_ITEMS.map((item) => toCommandPalettePage("Werving", item)),
  ...MEER_NAV_ITEMS.map((item) => toCommandPalettePage("Meer", item)),
  ...COMMAND_PALETTE_UTILITY_PAGES,
] as const satisfies readonly CommandPalettePage[];

export function isNavItemActive(
  pathname: string,
  item: Pick<NavigationItem, "url" | "matchPaths">,
) {
  return (
    pathname === item.url ||
    pathname.startsWith(`${item.url}/`) ||
    item.matchPaths?.some(
      (matchPath) => pathname === matchPath || pathname.startsWith(`${matchPath}/`),
    ) ||
    false
  );
}

export function isAnyNavItemActive(
  pathname: string,
  items: readonly Pick<NavigationItem, "url" | "matchPaths">[],
) {
  return items.some((item) => isNavItemActive(pathname, item));
}
