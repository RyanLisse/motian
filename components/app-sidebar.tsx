"use client";

import { GalleryVerticalEnd, Search } from "lucide-react";
import type * as React from "react";

import { NavMain } from "@/components/nav-main";
import { OverflowNavMenu } from "@/components/nav-overflow-menu";
import { NavUser } from "@/components/nav-user";
import { PRIMARY_NAV_ITEMS } from "@/components/navigation-config";
import { SidebarCvDropZone } from "@/components/sidebar-cv-drop-zone";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const teams = [
  {
    name: "Motian",
    logo: GalleryVerticalEnd,
  },
];

const navGroups = [
  {
    label: "Werving",
    items: PRIMARY_NAV_ITEMS,
  },
] as const;

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain groups={[...navGroups]} />
        <SidebarGroup className="pt-0">
          <SidebarMenu>
            <SidebarMenuItem>
              <OverflowNavMenu variant="sidebar" />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
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
