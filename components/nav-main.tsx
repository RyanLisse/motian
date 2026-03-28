"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface NavItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: { text: string; variant: string };
  prefetch?: boolean;
  tooltip?: string;
  matchPaths?: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function NavMain({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.label}>
          <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
          <SidebarMenu>
            {group.items.map((item) => {
              const isActive =
                pathname === item.url ||
                pathname.startsWith(`${item.url}/`) ||
                item.matchPaths?.some(
                  (matchPath) => pathname === matchPath || pathname.startsWith(`${matchPath}/`),
                ) ||
                false;

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.tooltip ?? item.title}
                    isActive={isActive}
                  >
                    <Link href={item.url} prefetch={item.prefetch}>
                      {item.icon && <item.icon />}
                      <span>{item.title}</span>
                      {item.badge && (
                        <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">
                          {item.badge.text}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  );
}
