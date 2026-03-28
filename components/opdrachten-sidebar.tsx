"use client";

/**
 * Standaard filter-UI voor lijstpagina's.
 * Dit ontwerp (zoekbalk, dropdowns Platform/Eindopdrachtgever/Vaardigheid/Provincie/Regio/Vakgebied,
 * uren per week, straal, sortering, resultaat-telling en paginatie) is de referentie voor alle
 * filterpagina's. Gebruik deze component of hetzelfde visuele patroon op andere lijstpagina's.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_OPDRACHTEN_LIMIT,
  OPDRACHTEN_PAGE_SIZE_OPTIONS,
} from "@/src/lib/opdrachten-filters";
import { CompactSidebarFilters } from "./sidebar/compact-sidebar-filters";
import { OverviewFilterPanel } from "./sidebar/overview-filter-panel";
import { SidebarJobList } from "./sidebar/sidebar-job-list";
import { SidebarPagination } from "./sidebar/sidebar-pagination";
import { SidebarResultsHeader } from "./sidebar/sidebar-results-header";
import { SidebarSearchBar } from "./sidebar/sidebar-search-bar";
import { SidebarSortControls } from "./sidebar/sidebar-sort-controls";
import type { OpdrachtenSidebarProps } from "./sidebar/sidebar-types";
import { useSidebarFilters } from "./sidebar/use-sidebar-filters";

export type { OpdrachtenSidebarProps } from "./sidebar/sidebar-types";

export function OpdrachtenSidebar({
  jobs: initialJobs,
  totalCount: initialTotal,
  platforms,
  endClients,
  categories,
  skillOptions,
  skillEmptyText = "Geen vaardigheden gevonden.",
}: OpdrachtenSidebarProps) {
  const {
    isOverviewPage,
    activeId,
    platform,
    endClient,
    vaardigheid,
    status,
    provincie,
    regios,
    vakgebieden,
    contractType,
    sort,
    sortOptions,
    provinceAnchor,
    regionOptions,
    categoryOptions,
    inputValue,
    setInputValue,
    hoursMinInput,
    hoursMaxInput,
    radiusKmInput,
    rateMinInput,
    setRateMinInput,
    rateMaxInput,
    setRateMaxInput,
    mobileFiltersOpen,
    setMobileFiltersOpen,
    displayJobs,
    displayTotal,
    displayPerPage,
    totalPages,
    pageParam,
    searchErrorMessage,
    isFetching,
    shortlistCount,
    urgentDeadlineCount,
    activeFilterCount,
    buildDetailHref,
    pushParams,
    handleFilterChange,
    handleToggleRegio,
    handleToggleVakgebied,
    handleHoursRangeChange,
    handleRadiusChange,
    handleProvinceChange,
    resetFilters,
  } = useSidebarFilters({ initialJobs, initialTotal, categories });

  if (!isOverviewPage) {
    return (
      <aside className="flex h-full w-full flex-col overflow-hidden bg-[#050506] text-white">
        <SidebarSearchBar
          value={inputValue}
          onChange={setInputValue}
          isFetching={isFetching}
          variant="compact"
        />

        <CompactSidebarFilters
          platform={platform}
          platforms={platforms}
          endClient={endClient}
          endClients={endClients}
          vaardigheid={vaardigheid}
          skillOptions={skillOptions}
          skillEmptyText={skillEmptyText}
          status={status}
          provincie={provincie}
          regios={regios}
          regionOptions={regionOptions}
          vakgebieden={vakgebieden}
          categoryOptions={categoryOptions}
          hoursMinInput={hoursMinInput}
          hoursMaxInput={hoursMaxInput}
          radiusKmInput={radiusKmInput}
          provinceAnchor={provinceAnchor}
          sort={sort}
          sortOptions={sortOptions}
          onFilterChange={handleFilterChange}
          onProvinceChange={handleProvinceChange}
          onToggleRegio={handleToggleRegio}
          onToggleVakgebied={handleToggleVakgebied}
          onHoursRangeChange={handleHoursRangeChange}
          onRadiusChange={handleRadiusChange}
        />

        <SidebarResultsHeader
          displayTotal={displayTotal}
          shortlistCount={shortlistCount}
          urgentDeadlineCount={urgentDeadlineCount}
          displayPerPage={displayPerPage}
          pageParam={pageParam}
          totalPages={totalPages}
          pushParams={pushParams}
          variant="compact"
        />

        {searchErrorMessage ? (
          <div className="px-4 py-3 text-sm text-red-300">{searchErrorMessage}</div>
        ) : null}

        <SidebarJobList
          jobs={displayJobs}
          activeId={activeId}
          buildDetailHref={buildDetailHref}
          variant="compact"
        />

        <SidebarPagination
          pageParam={pageParam}
          totalPages={totalPages}
          isFetching={isFetching}
          pushParams={pushParams}
          variant="compact"
        />
      </aside>
    );
  }

  return (
    <aside className="h-full min-w-0 w-full bg-sidebar/25">
      <div className="grid h-full min-h-0 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
        <OverviewFilterPanel
          inputValue={inputValue}
          onInputChange={setInputValue}
          isFetching={isFetching}
          mobileFiltersOpen={mobileFiltersOpen}
          onToggleMobileFilters={() => setMobileFiltersOpen((open) => !open)}
          activeFilterCount={activeFilterCount}
          displayTotal={displayTotal}
          platform={platform}
          platforms={platforms}
          endClient={endClient}
          endClients={endClients}
          vaardigheid={vaardigheid}
          skillOptions={skillOptions}
          skillEmptyText={skillEmptyText}
          status={status}
          provincie={provincie}
          regios={regios}
          regionOptions={regionOptions}
          vakgebieden={vakgebieden}
          categoryOptions={categoryOptions}
          hoursMinInput={hoursMinInput}
          hoursMaxInput={hoursMaxInput}
          radiusKmInput={radiusKmInput}
          rateMinInput={rateMinInput}
          rateMaxInput={rateMaxInput}
          provinceAnchor={provinceAnchor}
          contractType={contractType}
          onFilterChange={handleFilterChange}
          onProvinceChange={handleProvinceChange}
          onToggleRegio={handleToggleRegio}
          onToggleVakgebied={handleToggleVakgebied}
          onHoursRangeChange={handleHoursRangeChange}
          onRadiusChange={handleRadiusChange}
          onRateMinChange={setRateMinInput}
          onRateMaxChange={setRateMaxInput}
          onResetFilters={resetFilters}
        />

        <div className="flex h-full min-h-0 min-w-0 flex-col px-3 py-2 sm:px-4 sm:py-4 md:px-5 md:py-5 lg:px-6 overflow-hidden">
          <div className="mb-2 flex flex-col gap-2 border-b border-border/70 pb-2 sm:mb-4 sm:gap-3 sm:pb-4">
            <SidebarResultsHeader
              displayTotal={displayTotal}
              shortlistCount={shortlistCount}
              urgentDeadlineCount={urgentDeadlineCount}
              displayPerPage={displayPerPage}
              pageParam={pageParam}
              totalPages={totalPages}
              pushParams={pushParams}
              variant="overview"
            />
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="hidden text-xs text-muted-foreground sm:inline sm:text-sm">
                  Per pagina:
                </span>
                <Select
                  value={String(displayPerPage)}
                  onValueChange={(v) =>
                    pushParams({
                      limit: v === String(DEFAULT_OPDRACHTEN_LIMIT) ? "" : v,
                      pagina: "1",
                    })
                  }
                >
                  <SelectTrigger className="data-[size=default]:h-9 w-full rounded-md border-border bg-background text-xs font-semibold text-foreground sm:w-[110px] sm:rounded-full sm:data-[size=default]:h-10 sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {OPDRACHTEN_PAGE_SIZE_OPTIONS.map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <SidebarSortControls
                sort={sort}
                sortOptions={sortOptions}
                onSortChange={(value) => handleFilterChange("sort", value)}
                variant="overview"
              />
            </div>
          </div>

          {searchErrorMessage ? (
            <p className="mb-3 text-sm text-destructive">{searchErrorMessage}</p>
          ) : null}

          <SidebarJobList
            jobs={displayJobs}
            activeId={activeId}
            buildDetailHref={buildDetailHref}
            variant="overview"
          />

          <SidebarPagination
            pageParam={pageParam}
            totalPages={totalPages}
            isFetching={isFetching}
            pushParams={pushParams}
            variant="overview"
          />
        </div>
      </div>
    </aside>
  );
}
