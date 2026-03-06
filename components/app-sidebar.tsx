"use client";

import {
  Activity,
  Briefcase,
  GalleryVerticalEnd,
  LayoutDashboard,
  MessageSquare,
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
      url: "/kandidaten",
      icon: Users,
      items: [
        {
          title: "Talent Pool",
          url: "/kandidaten",
        },
        {
          title: "Pipeline",
          url: "/pipeline",
        },
        {
          title: "Interviews",
          url: "/interviews",
        },
      ],
    },
    {
      title: "Matching",
      url: "/matching",
      icon: Zap,
      items: [
        {
          title: "AI Matching",
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
      title: "Scraper Analytics",
      url: "/scraper",
      icon: Activity,
    },
    {
      title: "Chat",
      url: "/chat",
      icon: MessageSquare,
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
