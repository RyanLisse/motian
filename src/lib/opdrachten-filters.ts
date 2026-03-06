export const DEFAULT_OPDRACHTEN_LIMIT = 50;
export const MAX_OPDRACHTEN_LIMIT = 100;
export const OPDRACHTEN_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export const OPDRACHTEN_STATUS_OPTIONS = ["open", "closed", "all"] as const;

export type OpdrachtenStatus = (typeof OPDRACHTEN_STATUS_OPTIONS)[number];

export function normalizeOpdrachtenStatus(value: string | null | undefined): OpdrachtenStatus {
  switch (value) {
    case "closed":
    case "all":
      return value;
    default:
      return "open";
  }
}
