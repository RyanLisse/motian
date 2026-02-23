"use client";

import {
  Briefcase,
  GalleryVerticalEnd,
  LayoutDashboard,
  MessageSquare,
  Settings,
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
      title: "Opdrachten",
      url: "/opdrachten",
      icon: Briefcase,
    },
    {
      title: "Professionals",
      url: "/professionals",
      icon: Users,
      items: [
        {
          title: "Talent Pool",
          url: "/professionals",
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
          title: "CV Beheer",
          url: "/matching?tab=cv",
        },
      ],
    },
    {
      title: "Berichten",
      url: "/messages",
      icon: MessageSquare,
    },
    {
      title: "Instellingen",
      url: "/settings",
      icon: Settings,
      items: [
        {
          title: "Scraper",
          url: "/scraper",
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
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
