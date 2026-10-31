"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import type { ScheduleView } from "@/modules/schedule/types";

interface ListSchedulesResponse {
  schedules: ScheduleView[];
  hiddenByLock?: boolean;
}

export function useSchedules(profileId: string | null, fromDate: string, toDate: string) {
  const key = profileId
    ? `/api/schedule/list?profileId=${encodeURIComponent(profileId)}&fromDate=${fromDate}&toDate=${toDate}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<ListSchedulesResponse>(key, fetcher);

  return {
    schedules: data?.schedules || [],
    hiddenByLock: !!data?.hiddenByLock,
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
}
