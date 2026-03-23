"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { PlatformCatalogEntry } from "@/src/schemas/platform-catalog";
import { PlatformConfigForm } from "./platform-config-form";

export function PlatformOnboardingDrawer({ entry }: { entry: PlatformCatalogEntry }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
          {entry.config ? "Beheer onboarding" : "Configureer platform"}
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{entry.displayName}</SheetTitle>
          <SheetDescription>
            {entry.description ||
              "Configureer, valideer en test dit platform via dezelfde workflow als de agent tools."}
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-4 pb-6">
          <PlatformConfigForm entry={entry} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
