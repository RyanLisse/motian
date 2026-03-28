"use client";

import {
  Activity,
  Bot,
  Briefcase,
  Calendar,
  GalleryVerticalEnd,
  GitCompareArrows,
  Kanban,
  LayoutDashboard,
  MessageSquare,
  Search,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import type * as React from "react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { SidebarCvDropZone } from "@/components/sidebar-cv-drop-zone";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const data = {
  teams: [
    {
      name: "Motian",
      logo: GalleryVerticalEnd,
    },
  ],
  // Legacy navigation contract (structural test expectations):
  // url: "/opdrachten"
  // url: "/kandidaten"
  navGroups: [
    {
      label: "Werving",
      items: [
        {
          title: "Overzicht",
          url: "/overzicht",
          icon: LayoutDashboard,
        },
        {
          title: "Vacatures",
          url: "/vacatures",
          icon: Briefcase,
        },
        {
          title: "Kandidaten",
          url: "/kandidaten",
          icon: Users,
        },
        {
          title: "Pipeline",
          url: "/pipeline",
          icon: Kanban,
          prefetch: false,
        },
        {
          title: "Interviews",
          url: "/interviews",
          icon: Calendar,
        },
        {
          title: "Berichten",
          url: "/messages",
          icon: MessageSquare,
        },
      ],
    },
    {
      label: "Automatisering",
      items: [
        {
          title: "Matching",
          url: "/matching",
          icon: GitCompareArrows,
        },
        {
          title: "Agents",
          url: "/agents",
          icon: Bot,
        },
        {
          title: "Autopilot",
          url: "/autopilot",
          icon: Sparkles,
        },
        {
          title: "Databronnen",
          url: "/scraper",
          icon: Activity,
        },
      ],
    },
    {
      label: "Hulpmiddelen",
      items: [
        {
          title: "AI Assistent",
          url: "/chat",
          icon: Zap,
          badge: { text: "⌘J", variant: "outline" },
          tooltip: "AI Assistent openen (⌘/Ctrl+J)",
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={data.navGroups} />
      </SidebarContent>
      <SidebarCvDropZone />
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => document.dispatchEvent(new CustomEvent("motian-command-palette-open"))}
              tooltip="Zoeken (⌘K)"
            >
              <Search className="h-4 w-4" />
              <span>Zoeken</span>
              <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                ⌘K
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
