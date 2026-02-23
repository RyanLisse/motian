"use client";

import { Briefcase, Menu, RefreshCw, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/opdrachten",
    label: "Opdrachten",
    icon: Briefcase,
    disabled: false,
  },
  {
    href: "/scraper",
    label: "Scraper",
    icon: RefreshCw,
    disabled: false,
  },
  {
    href: "#",
    label: "Kandidaten",
    icon: Users,
    disabled: true,
  },
];

function NavContent({ pathname }: { pathname: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <Link href="/" className="text-2xl font-bold text-primary">
          motian
        </Link>
        <p className="text-xs text-muted-foreground mt-1">Recruitment Platform</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href) && !item.disabled;
          return (
            <Link
              key={item.label}
              href={item.disabled ? "#" : item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : item.disabled
                    ? "text-muted-foreground/50 cursor-not-allowed"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
              onClick={(e) => item.disabled && e.preventDefault()}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
              {item.disabled && (
                <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/50">
                  Binnenkort
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground">Motia.dev + Next.js</p>
      </div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile trigger */}
      <div className="fixed top-4 left-4 z-50 md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="bg-sidebar">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar">
            <SheetTitle className="sr-only">Navigatie</SheetTitle>
            <NavContent pathname={pathname} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:w-64 bg-sidebar border-r border-border">
        <NavContent pathname={pathname} />
      </aside>
    </>
  );
}
