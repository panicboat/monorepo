import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfileName } from "@/components/ui/profile-name";
import { industryIcon } from "@/modules/profile/lib/constants";
import { FollowButton } from "@/modules/social/components/FollowButton";
import { formatScheduleDay } from "@/modules/schedule/lib/dates";
import type { ScheduleSearchResultView } from "@/modules/schedule/types";

export function ScheduleSearchCard({ result }: { result: ScheduleSearchResultView }) {
  const { schedule, profile, prefecture, note } = result;
  const href = `/u/${encodeURIComponent(profile.username)}`;
  const icon = industryIcon(profile.industry);
  const endsNextDay = schedule.endTime <= schedule.startTime;

  return (
    <div className="border-b border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar src={profile.avatarUrl || undefined} fallback={profile.displayName.slice(0, 1) || "?"} size="md" href={href} />
        <Link href={href} className="min-w-0 flex-1">
          <p className="flex">
            <ProfileName profile={profile} />
          </p>
          <p className="truncate text-sm text-text-secondary">@{profile.username}</p>
        </Link>
        <span className="flex shrink-0 items-center gap-1 text-sm text-text-secondary">
          {icon && (
            <span role="img" aria-label={profile.industry} title={profile.industry}>
              {icon}
            </span>
          )}
          {prefecture && <span>{prefecture}</span>}
        </span>
      </div>
      <div className="mt-2 rounded-xl border border-border bg-surface p-3">
        <p className="text-lg font-bold tabular-nums text-text-primary">
          {schedule.startTime}〜{schedule.endTime}
          {endsNextDay && <span className="ml-1 text-sm font-normal text-text-secondary">翌日</span>}
        </p>
        <p className="text-xs text-text-secondary">{formatScheduleDay(schedule.workDate)}</p>
      </div>
      {note && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-primary">{note}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <FollowButton targetProfileId={profile.profileId} />
        <Button asChild variant="secondary" size="sm">
          <Link href={href}>プロフィール →</Link>
        </Button>
      </div>
    </div>
  );
}
