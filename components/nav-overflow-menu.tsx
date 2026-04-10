"use client";

import { ChevronDown, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  isAnyNavItemActive,
  isNavItemActive,
  MEER_NAV_ITEMS,
} from "@/components/navigation-config";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface OverflowNavMenuProps {
  variant?: "sidebar" | "mobile";
  className?: string;
}

export function OverflowNavMenu({ variant = "sidebar", className }: OverflowNavMenuProps) {
  const pathname = usePathname();
  const { isMobile } = useSidebar();
  const isActive = isAnyNavItemActive(pathname, MEER_NAV_ITEMS);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "sidebar" ? (
          <SidebarMenuButton isActive={isActive} tooltip="Meer" className={className}>
            <MoreHorizontal className="h-4 w-4" />
            <span>Meer</span>
            <ChevronDown className="ml-auto size-4 opacity-60 group-data-[collapsible=icon]:hidden" />
          </SidebarMenuButton>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-11 rounded-2xl border border-border bg-background/95 px-3 shadow-sm",
              isActive && "border-primary/40 bg-primary/10 text-primary",
              className,
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
            <span>Meer</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={variant === "sidebar" && !isMobile ? "start" : "end"}
        side={variant === "sidebar" && !isMobile ? "right" : "bottom"}
        sideOffset={8}
        className="w-56 rounded-xl"
      >
        <DropdownMenuLabel>Meer</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {MEER_NAV_ITEMS.map((item) => {
          const itemActive = isNavItemActive(pathname, item);
          const Icon = item.icon;

          return (
            <DropdownMenuItem
              key={item.title}
              asChild
              className={itemActive ? "bg-accent text-accent-foreground font-medium" : undefined}
            >
              <Link href={item.url} aria-current={itemActive ? "page" : undefined}>
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
