"use client";

import { useState } from "react";
import { Loader2, Users, UserMinus } from "lucide-react";
import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import { useToast } from "@/components/ui/Toast";

interface Follower {
  id: string;
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
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

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

  const handleRemove = async (guestId: string) => {
    if (removingIds.has(guestId)) return;

    // Confirm before removing
    if (!confirm("このフォロワーを削除しますか？")) return;

    setRemovingIds((prev) => new Set([...prev, guestId]));

    try {
      const res = await fetch(`/api/cast/followers/${guestId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to remove follower");
      }

      // Optimistically update the list
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
        title: "削除しました",
        description: "フォロワーを削除しました",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to remove follower:", error);
      toast({
        title: "エラー",
        description: "フォロワーの削除に失敗しました",
        variant: "destructive",
      });
    } finally {
      setRemovingIds((prev) => {
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
    <div className="min-h-screen bg-surface-secondary pb-24">
      {/* Header */}
      <div className="bg-surface border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-role-cast" />
          <div>
            <h1 className="text-lg font-bold text-text-primary">フォロワー</h1>
            <p className="text-sm text-text-muted">
              {data?.total || 0} 人のフォロワー
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
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
                {/* Avatar */}
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-surface-secondary">
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
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary truncate">
                    {follower.guestName || "Guest"}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatDate(follower.followedAt)} からフォロー中
                  </p>
                </div>

                {/* Actions */}
                <button
                  onClick={() => handleRemove(follower.guestId)}
                  disabled={removingIds.has(follower.guestId)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-secondary hover:text-error disabled:opacity-50"
                  title="フォロワーを削除"
                >
                  {removingIds.has(follower.guestId) ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <UserMinus className="h-5 w-5" />
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
