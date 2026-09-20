"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import type { ScheduleView } from "@/modules/schedule/types";

interface ListSchedulesResponse {
  schedules: ScheduleView[];
}

export function useSchedules(accountId: string | null, fromDate: string, toDate: string) {
  const key = accountId
    ? `/api/schedule/list?accountId=${encodeURIComponent(accountId)}&fromDate=${fromDate}&toDate=${toDate}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<ListSchedulesResponse>(key, fetcher);

  return {
    schedules: data?.schedules || [],
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
}
