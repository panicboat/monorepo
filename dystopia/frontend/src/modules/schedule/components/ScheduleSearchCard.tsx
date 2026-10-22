import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfileName } from "@/components/ui/profile-name";
import { FollowButton } from "@/modules/social/components/FollowButton";
import { ScheduleSummary } from "./ScheduleSummary";
import type { ScheduleSearchResultView } from "@/modules/schedule/types";
import { formatLocation } from "@/modules/profile/lib/constants";

export function ScheduleSearchCard({ result }: { result: ScheduleSearchResultView }) {
  const { schedule, profile, prefecture, area, note } = result;
  const href = `/u/${encodeURIComponent(profile.username)}?tab=schedule`;

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
        {prefecture && <span className="shrink-0 text-sm text-text-secondary">{formatLocation(prefecture, area)}</span>}
      </div>
      {note && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-text-primary">{note}</p>}
      <ScheduleSummary
        workDate={schedule.workDate}
        startTime={schedule.startTime}
        endTime={schedule.endTime}
        industry={profile.industry}
        href={href}
      />
      <div className="mt-3 flex justify-end gap-2">
        <FollowButton targetProfileId={profile.profileId} />
        <Button asChild variant="secondary" size="sm">
          <Link href={href}>プロフィール →</Link>
        </Button>
      </div>
    </div>
  );
}
