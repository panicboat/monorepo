import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ProfileName, profileInitial } from "@/components/ui/profile-name";
import { cn } from "@/lib/utils";
import type { ProfileSummaryView } from "@/modules/profile/types";

interface EntryCardProps {
  profile: ProfileSummaryView | null;
  meta: ReactNode;
  unread?: boolean;
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}

export function EntryCard({ profile, meta, unread = false, href, onClick, children }: EntryCardProps) {
  const profileHref = profile?.username ? `/u/${encodeURIComponent(profile.username)}` : undefined;
  const cardClass = cn(
    "mt-2 block w-full rounded-xl border bg-surface p-3 text-left",
    unread ? "border-accent" : "border-border",
    (href || onClick) && "hover:border-accent/60"
  );

  return (
    <article className="border-b border-border px-4 py-3">
      <div className="flex gap-3">
        <Avatar src={profile?.avatarUrl || undefined} fallback={profileInitial(profile)} href={profileHref} />
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1 text-sm">
            <ProfileName profile={profile} link className="text-sm" />
            {meta && <span className="shrink-0 text-text-secondary">· {meta}</span>}
            {unread && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="未読" />}
          </p>
          {href ? (
            <Link href={href} className={cardClass}>
              {children}
            </Link>
          ) : onClick ? (
            <button type="button" onClick={onClick} className={cardClass}>
              {children}
            </button>
          ) : (
            <div className={cardClass}>{children}</div>
          )}
        </div>
      </div>
    </article>
  );
}
