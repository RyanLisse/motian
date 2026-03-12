"use client";

import { useRouter } from "next/navigation";
import type * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

interface OpdrachtenDetailSheetProps {
  title: string;
  description?: string;
  listHref: string;
  children: React.ReactNode;
}

export function OpdrachtenDetailSheet({
  title,
  description,
  listHref,
  children,
}: OpdrachtenDetailSheetProps) {
  const router = useRouter();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open onOpenChange={(open) => !open && router.push(listHref)}>
        <SheetContent side="right" className="w-full max-w-none gap-0 p-0 sm:max-w-2xl">
          <SheetHeader className="border-b border-border bg-background px-4 py-4 pr-12">
            <SheetTitle className="line-clamp-2 text-left text-base">{title}</SheetTitle>
            {description ? (
              <SheetDescription className="text-left">{description}</SheetDescription>
            ) : null}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <section className="hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background md:flex">
      {children}
    </section>
  );
}
