"use client";

import {
  Activity,
  Bot,
  Briefcase,
  Calendar,
  GitCompareArrows,
  Kanban,
  LayoutDashboard,
  type LucideIcon,
  MessageSquare,
  Settings,
  Sparkles,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

interface PageEntry {
  label: string;
  href: string;
  icon: LucideIcon;
  group: string;
  keywords?: string[];
}

const PAGES: PageEntry[] = [
  {
    label: "Overzicht",
    href: "/overzicht",
    icon: LayoutDashboard,
    group: "Werving",
    keywords: ["dashboard", "home", "start"],
  },
  {
    label: "Vacatures",
    href: "/vacatures",
    icon: Briefcase,
    group: "Werving",
    keywords: ["jobs", "opdrachten", "werk"],
  },
  {
    label: "Kandidaten",
    href: "/kandidaten",
    icon: Users,
    group: "Werving",
    keywords: ["talent", "cv", "sollicitant"],
  },
  {
    label: "Pipeline",
    href: "/pipeline",
    icon: Kanban,
    group: "Werving",
    keywords: ["kanban", "status", "fase"],
  },
  {
    label: "Interviews",
    href: "/interviews",
    icon: Calendar,
    group: "Werving",
    keywords: ["gesprekken", "agenda", "planning"],
  },
  {
    label: "Berichten",
    href: "/messages",
    icon: MessageSquare,
    group: "Werving",
    keywords: ["communicatie", "email", "sms"],
  },
  {
    label: "Automatisering",
    href: "/automatisering",
    icon: Wrench,
    group: "Platform",
    keywords: ["operaties", "tools", "automatisch"],
  },
  {
    label: "Agents",
    href: "/agents",
    icon: Bot,
    group: "Operaties",
    keywords: ["bot", "automatisch", "ai"],
  },
  {
    label: "Autopilot",
    href: "/autopilot",
    icon: Sparkles,
    group: "Operaties",
    keywords: ["auto", "zelfstandig"],
  },
  {
    label: "Databronnen",
    href: "/scraper",
    icon: Activity,
    group: "Operaties",
    keywords: ["scraper", "bron", "import"],
  },
  {
    label: "Matching",
    href: "/matching",
    icon: GitCompareArrows,
    group: "Hulpmiddelen",
    keywords: ["koppelen", "score"],
  },
  {
    label: "AI Assistent",
    href: "/chat",
    icon: Zap,
    group: "Hulpmiddelen",
    keywords: ["chat", "ai", "vraag", "hulp"],
  },
  {
    label: "Instellingen",
    href: "/settings",
    icon: Settings,
    group: "Hulpmiddelen",
    keywords: ["config", "profiel"],
  },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }

    function onCustomOpen() {
      setOpen(true);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("motian-command-palette-open", onCustomOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("motian-command-palette-open", onCustomOpen);
    };
  }, []);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  const grouped = PAGES.reduce(
    (acc, page) => {
      if (!acc[page.group]) {
        acc[page.group] = [];
      }
      acc[page.group].push(page);
      return acc;
    },
    {} as Record<string, PageEntry[]>,
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Zoek pagina's, kandidaten, vacatures..." />
      <CommandList>
        <CommandEmpty>Geen resultaten gevonden.</CommandEmpty>
        {Object.entries(grouped).map(([group, pages]) => (
          <CommandGroup key={group} heading={group}>
            {pages.map((page) => (
              <CommandItem
                key={page.href}
                value={[page.label, ...(page.keywords ?? [])].join(" ")}
                onSelect={() => navigate(page.href)}
              >
                <page.icon className="mr-2 h-4 w-4" />
                {page.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Acties">
          <CommandItem
            value="ai assistent openen chat"
            onSelect={() => {
              setOpen(false);
              window.dispatchEvent(new Event("motian-chat-open"));
            }}
          >
            <Zap className="mr-2 h-4 w-4" />
            AI Assistent openen
            <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              ⌘J
            </kbd>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
