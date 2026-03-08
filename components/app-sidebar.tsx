"use client";

import {
  Activity,
  Briefcase,
  Calendar,
  GalleryVerticalEnd,
  Kanban,
  LayoutDashboard,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import type * as React from "react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

const data = {
  user: {
    name: "Ryan",
    email: "ryan@motian.nl",
    avatar: "/avatars/ryan.jpg",
  },
  teams: [
    {
      name: "Motian",
      logo: GalleryVerticalEnd,
      plan: "Pro",
    },
  ],
  navMain: [
    {
      title: "Overzicht",
      url: "/overzicht",
      icon: LayoutDashboard,
      isActive: true,
    },
    {
      title: "Vacatures",
      url: "/opdrachten",
      icon: Briefcase,
    },
    {
      title: "Kandidaten",
      url: "/professionals",
      icon: Users,
    },
    {
      title: "Pipeline",
      url: "/pipeline",
      icon: Kanban,
    },
    {
      title: "Interviews",
      url: "/interviews",
      icon: Calendar,
    },
    {
      title: "Aanbevelingen",
      url: "/matching",
      icon: Sparkles,
      items: [
        {
          title: "Kandidaataanbevelingen",
          url: "/matching",
        },
        {
          title: "AI Grading",
          url: "/matching?tab=grading",
        },
        {
          title: "CV Analyse",
          url: "/matching?tab=cv",
        },
      ],
    },
    {
      title: "Databronnen",
      url: "/scraper",
      icon: Activity,
    },
    {
      title: "AI Assistent",
      url: "/chat",
      icon: Zap,
      badge: { text: "⌘J", variant: "outline" },
      tooltip: "AI Assistent openen (⌘/Ctrl+J)",
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
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
