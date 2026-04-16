import type { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type DependencyList, type MutableRefObject, useEffect } from "react";
import type { FilterOverrideValue } from "@/components/sidebar/sidebar-types";
import { pushOpdrachtenParams } from "./sidebar-utils";

type RouterInstance = ReturnType<typeof useRouter>;
type SearchParamsInstance = ReturnType<typeof useSearchParams>;
type PathnameInstance = ReturnType<typeof usePathname>;

type PushContext = {
  searchParams: SearchParamsInstance;
  router: RouterInstance;
  pathname: PathnameInstance;
  startTransition: (scope: () => void) => void;
  selfPushRef: MutableRefObject<boolean>;
  setLocalPage: (page: number) => void;
};

/**
 * Pushes debounced filter overrides to the URL when `shouldPush` is true.
 * Resets `localPage` to 1 in lockstep with the `pagina=1` URL push so the
 * TanStack Query key never holds a stale page number. Sets `selfPushRef`
 * so the URL→local sync effect skips this push.
 */
export function useDebouncedFilterPush(
  shouldPush: boolean,
  buildOverrides: () => Record<string, FilterOverrideValue>,
  deps: DependencyList,
  ctx: PushContext,
): void {
  useEffect(() => {
    if (!shouldPush) return;
    ctx.setLocalPage(1);
    ctx.selfPushRef.current = true;
    ctx.startTransition(() => {
      pushOpdrachtenParams(ctx.searchParams, ctx.router, ctx.pathname, {
        ...buildOverrides(),
        pagina: "1",
      });
    });
    // biome-ignore lint/correctness/useExhaustiveDependencies: caller-provided deps
  }, deps);
}
