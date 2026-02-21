"use client"

import * as React from "react"
import {
  Briefcase,
  Calendar,
  DatabaseZap,
  FileUp,
  GalleryVerticalEnd,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Sparkles,
  Users,
  Zap,
  Eye,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

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
      title: "AI Grading",
      url: "/ai-grading",
      icon: Sparkles,
      badge: {
        text: "AI",
        variant: "blue" as const,
      },
      isActive: true,
    },
    {
      title: "Opdrachten",
      url: "/opdrachten",
      icon: Briefcase,
      items: [
        {
          title: "Alle opdrachten",
          url: "/opdrachten",
        },
        {
          title: "Nieuw",
          url: "/opdrachten?platform=striive",
        },
        {
          title: "Opdrachtoverheid",
          url: "/opdrachten?platform=opdrachtoverheid",
        },
        {
          title: "Flextender",
          url: "/opdrachten?platform=flextender",
        },
      ],
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
      ],
    },
    {
      title: "Matching",
      url: "/matching",
      icon: Zap,
    },
    {
      title: "CV Beheer",
      url: "/cv",
      icon: FileUp,
    },
    {
      title: "Visual Explainer",
      url: "/visual-explainer",
      icon: Eye,
    },
    {
      title: "Gesprekken",
      url: "/interviews",
      icon: Calendar,
      badge: {
        text: "3",
        variant: "default" as const,
      },
    },
    {
      title: "Berichten",
      url: "/messages",
      icon: MessageSquare,
    },
    {
      title: "Scraper",
      url: "/scraper",
      icon: DatabaseZap,
    },
    {
      title: "Instellingen",
      url: "/settings",
      icon: Settings,
    },
  ],
}

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
  )
}
