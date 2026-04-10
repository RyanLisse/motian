"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavItemActive, PRIMARY_NAV_ITEMS } from "@/components/navigation-config";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Hoofdnavigatie"
      className="fixed inset-x-0 bottom-0 z-40 min-h-[calc(var(--mobile-bottom-nav-height)+env(safe-area-inset-bottom))] border-t border-border/80 bg-background/95 pb-[max(0.25rem,env(safe-area-inset-bottom))] backdrop-blur supports-backdrop-filter:bg-background/80 md:hidden"
    >
      <ul className="grid min-h-[var(--mobile-bottom-nav-height)] grid-cols-5 gap-1 px-2 pt-1.5">
        {PRIMARY_NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item);
          const Icon = item.icon;

          return (
            <li key={item.url}>
              <Link
                href={item.url}
                className={cn(
                  "flex min-h-11 flex-col items-center justify-center rounded-2xl px-1 py-1 text-[11px] font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="mb-0.5 h-4 w-4" />
                <span className="truncate">{item.title}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
