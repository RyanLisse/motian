"use client";

import { Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { COMMAND_PALETTE_PAGES } from "@/components/navigation-config";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

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

  const grouped = COMMAND_PALETTE_PAGES.reduce(
    (acc, page) => {
      if (!acc[page.group]) {
        acc[page.group] = [];
      }
      acc[page.group].push(page);
      return acc;
    },
    {} as Record<string, (typeof COMMAND_PALETTE_PAGES)[number][]>,
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
