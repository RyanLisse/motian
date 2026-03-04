"use client";

import { useEffect, useState } from "react";

import { DurationChart } from "@/components/scraper/duration-chart";
import { JobsTimelineChart } from "@/components/scraper/jobs-timeline-chart";
import { SuccessRateChart } from "@/components/scraper/success-rate-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type TimeSeriesPoint = {
  date: string;
  platform: string;
  jobsFound: number;
  jobsNew: number;
  duplicates: number;
  successCount: number;
  failedCount: number;
  totalRuns: number;
  avgDurationMs: number;
};

type RangePreset = 7 | 14 | 30 | 90;

const RANGE_PRESETS: RangePreset[] = [7, 14, 30, 90];

export function AnalyticsCharts() {
  const [selectedRange, setSelectedRange] = useState<RangePreset>(30);
  const [data, setData] = useState<TimeSeriesPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    const startDate = new Date(Date.now() - selectedRange * 86_400_000).toISOString().slice(0, 10);
    const endDate = new Date().toISOString().slice(0, 10);
    const groupBy = selectedRange >= 60 ? "week" : "day";

    async function loadAnalytics() {
      setLoading(true);

      try {
        const searchParams = new URLSearchParams({
          startDate,
          endDate,
          groupBy,
        });

        const response = await fetch(`/api/scraper-analyse?${searchParams.toString()}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Kan scraper analyse niet ophalen");
        }

        const payload = (await response.json()) as { data?: TimeSeriesPoint[] };
        setData(Array.isArray(payload.data) ? payload.data : []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Fout bij ophalen scraper analyse", error);
        setData([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadAnalytics();

    return () => {
      controller.abort();
    };
  }, [selectedRange]);

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>Scraper analyse</CardTitle>
          <div className="flex flex-wrap gap-2">
            {RANGE_PRESETS.map((range) => (
              <Button
                key={range}
                type="button"
                variant={selectedRange === range ? "default" : "outline"}
                onClick={() => setSelectedRange(range)}
              >
                {range}d
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="vacatures" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="vacatures">Vacatures</TabsTrigger>
            <TabsTrigger value="slagingspercentage">Slagingspercentage</TabsTrigger>
            <TabsTrigger value="duur">Duur</TabsTrigger>
          </TabsList>

          <TabsContent value="vacatures">
            {loading ? (
              <Skeleton className="h-[300px] w-full rounded-xl" />
            ) : (
              <JobsTimelineChart data={data} />
            )}
          </TabsContent>

          <TabsContent value="slagingspercentage">
            {loading ? (
              <Skeleton className="h-[300px] w-full rounded-xl" />
            ) : (
              <SuccessRateChart data={data} />
            )}
          </TabsContent>

          <TabsContent value="duur">
            {loading ? (
              <Skeleton className="h-[300px] w-full rounded-xl" />
            ) : (
              <DurationChart data={data} />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
