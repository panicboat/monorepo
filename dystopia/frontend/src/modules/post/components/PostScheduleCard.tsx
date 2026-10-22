import type { PostScheduleView } from "@/modules/post/lib/post-view";
import type { ProfileSummaryView } from "@/modules/profile/types";
import { ScheduleSummary } from "@/modules/schedule/components/ScheduleSummary";

export interface PostScheduleCardProps {
  schedule: PostScheduleView;
  author: ProfileSummaryView | null;
}

export function PostScheduleCard({ schedule, author }: PostScheduleCardProps) {
  return (
    <ScheduleSummary
      workDate={schedule.workDate}
      startTime={schedule.startTime}
      endTime={schedule.endTime}
      industry={author?.industry ?? ""}
      href={author?.username ? `/u/${encodeURIComponent(author.username)}?tab=schedule` : undefined}
    />
  );
}
