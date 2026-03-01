"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, Users, Ban } from "lucide-react";
import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import { useToast } from "@/components/ui/Toast";

interface Follower {
  guestId: string;
  guestName: string;
  guestImageUrl: string;
  followedAt: string;
}

interface FollowersResponse {
  followers: Follower[];
  total: number;
  hasMore: boolean;
}

export default function FollowersPage() {
  const { toast } = useToast();
  const token = getAuthToken();
  const [blockingIds, setBlockingIds] = useState<Set<string>>(new Set());

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<FollowersResponse>(
    token ? "/api/cast/followers" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const handleBlock = async (guestId: string) => {
    if (blockingIds.has(guestId)) return;

    setBlockingIds((prev) => new Set([...prev, guestId]));

    try {
      const res = await fetch("/api/cast/blocks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blockedId: guestId,
          blockedType: "guest",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to block user");
      }

      mutate(
        (current) => {
          if (!current) return current;
          return {
            ...current,
            followers: current.followers.filter((f) => f.guestId !== guestId),
            total: current.total - 1,
          };
        },
        { revalidate: false }
      );

      toast({
        title: "ブロックしました",
        description: "ユーザーをブロックしました",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to block user:", error);
      toast({
        title: "エラー",
        description: "ブロックに失敗しました",
        variant: "destructive",
      });
    } finally {
      setBlockingIds((prev) => {
        const next = new Set(prev);
        next.delete(guestId);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-role-cast" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-text-secondary">データの取得に失敗しました</p>
      </div>
    );
  }

  const followers = data?.followers || [];

  return (
    <div className="pb-24 bg-surface-secondary min-h-screen">
      <div className="px-4 py-6 space-y-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">フォロワー</h1>
          <p className="text-text-secondary text-sm">
            {data?.total || 0} 人のフォロワー
          </p>
        </div>

        {followers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-text-muted mb-4" />
            <p className="text-text-secondary font-medium">フォロワーはいません</p>
            <p className="text-sm text-text-muted mt-1">
              タイムラインを投稿してフォロワーを増やしましょう。
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {followers.map((follower) => (
              <div
                key={follower.guestId}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <Link
                  href={`/cast/guests/${follower.guestId}`}
                  className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-surface-secondary hover:ring-2 hover:ring-role-cast/30 transition-all"
                >
                  {follower.guestImageUrl ? (
                    <img
                      src={follower.guestImageUrl}
                      alt={follower.guestName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-text-muted">
                      <Users className="h-6 w-6" />
                    </div>
                  )}
                </Link>

                <Link
                  href={`/cast/guests/${follower.guestId}`}
                  className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
                >
                  <p className="font-medium text-text-primary truncate">
                    {follower.guestName || "Guest"}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatDate(follower.followedAt)} からフォロー中
                  </p>
                </Link>

                <button
                  onClick={() => handleBlock(follower.guestId)}
                  disabled={blockingIds.has(follower.guestId)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-secondary hover:text-error disabled:opacity-50"
                  title="ブロック"
                >
                  {blockingIds.has(follower.guestId) ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Ban className="h-5 w-5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(dateString: string): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
