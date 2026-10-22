export interface ScheduleView {
  profileId: string;
  workDate: string;
  startTime: string;
  endTime: string;
}

export interface ScheduleAnnouncement {
  announce: boolean;
  announceTime: string;
  announceNote: string;
}
