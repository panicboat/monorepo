import Link from "next/link";
import type { PostScheduleView } from "@/modules/post/lib/post-view";
import { industryIcon } from "@/modules/profile/lib/constants";
import type { ProfileSummaryView } from "@/modules/profile/types";
import { formatScheduleDay } from "@/modules/schedule/lib/dates";

export interface PostScheduleCardProps {
  schedule: PostScheduleView;
  author: ProfileSummaryView | null;
}

const FRAME = "mt-2 block rounded-xl border border-border bg-surface p-3";

export function PostScheduleCard({ schedule, author }: PostScheduleCardProps) {
  const industry = author?.industry ?? "";
  const icon = industryIcon(industry);
  const line = `${formatScheduleDay(schedule.workDate)} ${schedule.startTime}〜${schedule.endTime}`;
  const content = (
    <>
      <span className="block text-xs font-bold tracking-wide text-text-secondary">出勤</span>
      <span className="mt-1 flex items-center gap-1 text-sm text-text-primary">
        {icon && (
          <span role="img" aria-label={industry} title={industry}>
            {icon}
          </span>
        )}
        <span>{line}</span>
      </span>
    </>
  );

  return author?.username ? (
    <Link href={`/u/${encodeURIComponent(author.username)}`} className={`${FRAME} hover:border-accent/60`}>
      {content}
    </Link>
  ) : (
    <div className={FRAME}>{content}</div>
  );
}
