import type { ProfileSummaryView } from "@/modules/profile/types";

export interface ScheduleView {
  profileId: string;
  workDate: string;
  startTime: string;
  endTime: string;
}

export interface ScheduleSearchResultView {
  schedule: ScheduleView;
  profile: ProfileSummaryView;
  prefecture: string;
  area: string;
  note: string;
}

export interface ScheduleAnnouncement {
  announce: boolean;
  announceTime: string;
  announceNote: string;
}
