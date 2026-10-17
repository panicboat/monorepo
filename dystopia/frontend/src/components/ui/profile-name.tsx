import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ProfileSummaryView } from "@/modules/profile/types";
import { LockMark } from "./lock-mark";

interface ProfileNameProps {
  profile: ProfileSummaryView | null;
  link?: boolean;
  className?: string;
}

export function profileDisplayName(profile: ProfileSummaryView | null): string {
  if (!profile) return "削除したプロフィール";
  return profile.displayName || (profile.username ? `@${profile.username}` : "削除したプロフィール");
}

export function ProfileName({ profile, link = false, className }: ProfileNameProps) {
  if (!profile) {
    return <span className={cn("truncate font-bold text-text-primary", className)}>{profileDisplayName(null)}</span>;
  }

  const name = profileDisplayName(profile);
  const label = (
    <>
      <span className="truncate">{name}</span>
      {profile.isPrivate && <LockMark label="鍵付き" className="text-[0.85em] text-text-secondary" />}
    </>
  );
  const classes = cn("inline-flex min-w-0 items-center gap-1 font-bold text-text-primary", className);

  if (link && profile.username) {
    return (
      <Link href={`/u/${encodeURIComponent(profile.username)}`} className={cn(classes, "hover:underline")}>
        {label}
      </Link>
    );
  }
  return <span className={classes}>{label}</span>;
}
