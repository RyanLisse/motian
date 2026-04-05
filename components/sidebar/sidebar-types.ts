/**
 * Shared types and constants for the opdrachten sidebar components.
 */
import type { useRouter } from "next/navigation";
import type { getProvinceAnchor } from "@/src/lib/opdrachten-filters";

export interface SidebarJob {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  platform: string;
  workArrangement: string | null;
  contractType: string | null;
  applicationDeadline?: Date | string | null;
  pipelineCount?: number;
  hasPipeline?: boolean;
}

export interface SearchResponse {
  jobs: SidebarJob[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export type SearchResponsePayload = {
  jobs?: unknown;
  total?: unknown;
  page?: unknown;
  perPage?: unknown;
  totalPages?: unknown;
};

export interface OpdrachtenSidebarProps {
  jobs: SidebarJob[];
  totalCount: number;
  platforms: string[];
  endClients: string[];
  categories: string[];
  skillOptions: FilterOption[];
  skillEmptyText?: string;
}

export type SearchQueryKeyPayload = {
  q: string;
  platforms: string[];
  endClient: string;
  vaardigheid: string;
  status: string;
  provincie: string;
  regios: string[];
  vakgebieden: string[];
  urenPerWeek: string;
  urenPerWeekMin: string;
  urenPerWeekMax: string;
  straalKm: string;
  contractType: string;
  tariefMin: string;
  tariefMax: string;
  sort: string;
  page: number;
  limit: number;
  onlyShortlist: boolean;
};

export type FilterOption = {
  value: string;
  label: string;
};

export type FilterOverrideValue = string | string[];

export const CONTRACT_TYPES = [
  { value: "freelance", label: "Freelance" },
  { value: "interim", label: "Interim" },
  { value: "vast", label: "Vast" },
  { value: "opdracht", label: "Opdracht" },
];

export const DARK_FILTER_PANEL_CLASS =
  "rounded-[24px] border border-white/10 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur";
export const DARK_FILTER_CONTROL_CLASS =
  "h-12 rounded-[20px] border-white/10 bg-white/[0.035] px-4 text-[15px] font-normal text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-white/35 focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-0";
export const DARK_FILTER_TRIGGER_CLASS =
  "h-12 rounded-[20px] border-white/10 bg-white/[0.035] px-4 text-left text-[15px] font-normal text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] data-[placeholder]:text-white/35";
export const DARK_FILTER_MENU_CLASS = "border-white/10 bg-[#101113] text-white";
export const DARK_FILTER_SECTION_LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45";
export const DARK_FILTER_SECTION_VALUE_CLASS = "text-sm text-white/55";

export type SearchJobsParams = {
  q: string;
  platforms: string[];
  endClient: string;
  vaardigheid: string;
  status: string;
  provincie: string;
  regios: string[];
  vakgebieden: string[];
  urenPerWeek: string;
  urenPerWeekMin: string;
  urenPerWeekMax: string;
  straalKm: string;
  contractType: string;
  tariefMin: string;
  tariefMax: string;
  sort: string;
  page: number;
  limit: number;
  onlyShortlist: boolean;
};

export type ProvinceAnchor = ReturnType<typeof getProvinceAnchor>;

export type PushParamsFn = (overrides: Record<string, FilterOverrideValue>) => void;

export type RouterInstance = ReturnType<typeof useRouter>;
