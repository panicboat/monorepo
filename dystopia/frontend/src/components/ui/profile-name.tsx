import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ProfileSummaryView } from "@/modules/profile/types";
import { LockMark } from "./lock-mark";

export const MISSING_USER = "（無効なユーザー）";
export const MISSING_CAST = "（無効なキャスト）";
export const MISSING_GUEST = "（無効なゲスト）";

interface ProfileNameProps {
  profile: ProfileSummaryView | null;
  link?: boolean;
  className?: string;
  missing?: string;
}

export function profileDisplayName(profile: ProfileSummaryView | null, missing: string = MISSING_USER): string {
  if (!profile) return missing;
  return profile.displayName || (profile.username ? `@${profile.username}` : missing);
}

export function profileInitial(profile: ProfileSummaryView | null, missing: string = MISSING_USER): string {
  if (!profile) return "?";
  const name = profileDisplayName(profile, missing);
  return name === missing ? "?" : name.replace("@", "").slice(0, 1) || "?";
}

export function ProfileName({ profile, link = false, className, missing = MISSING_USER }: ProfileNameProps) {
  if (!profile) {
    return <span className={cn("truncate font-bold text-text-primary", className)}>{missing}</span>;
  }

  const name = profileDisplayName(profile, missing);
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
