"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Search, UserCircle2 } from "lucide-react";

const navItems = [
  { href: "/overzicht", label: "Overzicht" },
  { href: "/opdrachten", label: "Opdrachten" },
  { href: "/professionals", label: "Professionals" },
  { href: "/opleidingen", label: "Opleidingen" },
  { href: "/solutions", label: "Solutions" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#2d2d2d] bg-[#0d0d0d]">
      <div className="flex h-14 items-center px-4 md:px-6 lg:px-8 w-full">
        {/* Logo / Brand */}
        <Link href="/" className="mr-8 flex items-center space-x-2.5 shrink-0">
          <div className="h-8 w-8 bg-[#10a37f] rounded-lg flex items-center justify-center font-bold text-white text-sm">
            M
          </div>
          <span className="font-semibold text-[15px] tracking-tight text-[#ececec] hidden sm:inline-block">
            Motian
          </span>
        </Link>

        {/* Navigation Links */}
        <nav className="flex items-center space-x-1 text-sm font-medium flex-1 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive =
              pathname.startsWith(item.href) ||
              (item.href === "/opdrachten" && pathname === "/opdrachten");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-2 rounded-md transition-colors whitespace-nowrap relative",
                  isActive
                    ? "text-[#ececec] font-semibold"
                    : "text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2a2a2a]"
                )}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-[#10a37f] rounded-t-sm" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right side icons */}
        <div className="flex items-center space-x-3 shrink-0">
          <button className="text-[#8e8e8e] hover:text-[#ececec] p-2 rounded-md hover:bg-[#2a2a2a] transition-colors">
            <Search className="h-4.5 w-4.5" />
          </button>
          <div className="h-8 w-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-[#8e8e8e]">
            <UserCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>
    </header>
  );
}
