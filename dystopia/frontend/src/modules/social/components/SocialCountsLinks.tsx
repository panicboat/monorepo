"use client";

import Link from "next/link";
import { useSocialCounts } from "@/modules/social/hooks";

interface SocialCountsLinksProps {
  accountId?: string;
  username: string;
}

export function SocialCountsLinks({ accountId, username }: SocialCountsLinksProps) {
  const { followingCount, followersCount } = useSocialCounts(accountId);
  const base = `/u/${encodeURIComponent(username)}`;

  return (
    <div className="flex gap-4 px-4 pt-3 text-sm text-text-secondary">
      <Link href={`${base}/following`} className="hover:underline">
        <strong className="text-text-primary">{followingCount}</strong> フォロー中
      </Link>
      <Link href={`${base}/followers`} className="hover:underline">
        <strong className="text-text-primary">{followersCount}</strong> フォロワー
      </Link>
    </div>
  );
}
