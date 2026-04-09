"use client";

import "@mcp-b/global";

import { useWebMCP } from "@mcp-b/react-webmcp";
import { usePathname, useRouter } from "next/navigation";
import { z } from "zod";

const motianRoutes = {
  overzicht: "/overzicht",
  vacatures: "/vacatures",
  kandidaten: "/kandidaten",
  matching: "/matching",
  pipeline: "/pipeline",
  chat: "/chat",
  ontwikkelaar: "/ontwikkelaar",
} as const;

const routeKeys = [
  "overzicht",
  "vacatures",
  "kandidaten",
  "matching",
  "pipeline",
  "chat",
  "ontwikkelaar",
] as const;

type MotianRouteKey = (typeof routeKeys)[number];

function summarizeVisiblePageText() {
  if (typeof document === "undefined") {
    return "";
  }

  const source = document.body?.innerText ?? "";
  return source.replace(/\s+/g, " ").trim().slice(0, 4000);
}

export function MotianWebMcpProvider() {
  const router = useRouter();
  const pathname = usePathname();

  useWebMCP(
    {
      name: "motian_get_current_page_context",
      description:
        "Geeft de huidige Motian route, documenttitel en een korte samenvatting van zichtbare paginatekst terug.",
      outputSchema: {
        route: z.string(),
        title: z.string(),
        summary: z.string(),
        availableRoutes: z.array(z.string()),
      },
      handler: async () => ({
        route: pathname,
        title: document.title,
        summary: summarizeVisiblePageText(),
        availableRoutes: Object.values(motianRoutes),
      }),
    },
    [pathname],
  );

  useWebMCP(
    {
      name: "motian_navigate",
      description:
        "Navigeer binnen Motian naar een hoofdsectie zoals overzicht, vacatures, kandidaten, matching, pipeline, chat of ontwikkelaar.",
      inputSchema: {
        page: z.enum(routeKeys).describe("Doelpagina binnen Motian"),
      },
      outputSchema: {
        route: z.string(),
        success: z.boolean(),
      },
      handler: async ({ page }: { page: MotianRouteKey }) => {
        const route = motianRoutes[page];
        router.push(route);
        return { route, success: true };
      },
    },
    [router],
  );

  useWebMCP(
    {
      name: "motian_refresh_route",
      description: "Ververs de huidige Motian pagina zodat serverdata opnieuw wordt geladen.",
      outputSchema: {
        route: z.string(),
        refreshed: z.boolean(),
      },
      handler: async () => {
        router.refresh();
        return { route: pathname, refreshed: true };
      },
    },
    [pathname, router],
  );

  return null;
}
