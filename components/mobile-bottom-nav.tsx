"use client";

import { Briefcase, Kanban, LayoutDashboard, MessageCircle, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const MOBILE_NAV_ITEMS = [
  { href: "/overzicht", label: "Overzicht", icon: LayoutDashboard },
  { href: "/vacatures", label: "Vacatures", icon: Briefcase },
  { href: "/kandidaten", label: "Kandidaten", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/chat", label: "Chat", icon: MessageCircle },
] as const;

function isItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname();

  if (pathname.startsWith("/chat")) {
    return null;
  }

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
    >
      <ul className="grid grid-cols-5 gap-1 px-2 pt-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = isItemActive(pathname, item.href);
          const Icon = item.icon;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center rounded-xl px-1 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="mb-0.5 h-4 w-4" />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
