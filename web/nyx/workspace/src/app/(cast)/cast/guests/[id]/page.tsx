"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users, Ban, ArrowLeft, Check } from "lucide-react";
import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import { useToast } from "@/components/ui/Toast";

interface GuestDetail {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string;
  tagline: string;
  bio: string;
  isFollowing: boolean;
  followedAt: string;
  isBlocked: boolean;
}

export default function GuestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const token = getAuthToken();
  const [isBlocking, setIsBlocking] = useState(false);
  const [isUnblocking, setIsUnblocking] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<GuestDetail>(
    token ? `/api/cast/guests/${id}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const handleBlock = async () => {
    if (isBlocking || !data) return;

    setIsBlocking(true);

    try {
      const res = await fetch("/api/cast/blocks", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          blockedId: data.id,
          blockedType: "guest",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to block user");
      }

      mutate({ ...data, isBlocked: true }, { revalidate: false });

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
      setIsBlocking(false);
    }
  };

  const handleUnblock = async () => {
    if (isUnblocking || !data) return;

    setIsUnblocking(true);

    try {
      const res = await fetch(`/api/cast/blocks?blocked_id=${data.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to unblock user");
      }

      mutate({ ...data, isBlocked: false }, { revalidate: false });

      toast({
        title: "ブロックを解除しました",
        description: "ユーザーのブロックを解除しました",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to unblock user:", error);
      toast({
        title: "エラー",
        description: "ブロック解除に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsUnblocking(false);
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

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-text-secondary">ゲストが見つかりません</p>
      </div>
    );
  }

  return (
    <div className="pb-24 bg-surface-secondary min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-full hover:bg-surface-secondary transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-text-primary" />
        </button>
        <h1 className="text-lg font-bold">ゲスト詳細</h1>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Profile Section */}
        <div className="bg-surface rounded-xl border border-border p-6 shadow-sm">
          <div className="flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full bg-surface-secondary mb-4">
              {data.avatarUrl ? (
                <img
                  src={data.avatarUrl}
                  alt={data.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-text-muted">
                  <Users className="h-12 w-12" />
                </div>
              )}
            </div>

            {/* Name */}
            <h2 className="text-xl font-bold text-text-primary mb-1">
              {data.name || "Guest"}
            </h2>

            {/* Tagline */}
            {data.tagline && (
              <p className="text-text-secondary text-sm mb-2">{data.tagline}</p>
            )}

            {/* Follow Status */}
            {data.isFollowing && (
              <div className="flex items-center gap-1 text-xs text-role-cast bg-role-cast/10 px-3 py-1 rounded-full">
                <Check className="h-3 w-3" />
                <span>{formatDate(data.followedAt)} からフォロー中</span>
              </div>
            )}
          </div>
        </div>

        {/* Bio Section */}
        {data.bio && (
          <div className="bg-surface rounded-xl border border-border p-4 shadow-sm">
            <h3 className="text-sm font-medium text-text-secondary mb-2">
              自己紹介
            </h3>
            <p className="text-text-primary whitespace-pre-wrap">{data.bio}</p>
          </div>
        )}

        {/* Actions Section */}
        <div className="bg-surface rounded-xl border border-border p-4 shadow-sm space-y-3">
          <h3 className="text-sm font-medium text-text-secondary mb-2">
            アクション
          </h3>

          {data.isBlocked ? (
            <button
              onClick={handleUnblock}
              disabled={isUnblocking}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-border bg-surface text-text-primary transition-colors hover:bg-surface-secondary disabled:opacity-50"
            >
              {isUnblocking ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Ban className="h-5 w-5" />
                  <span>ブロックを解除する</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleBlock}
              disabled={isBlocking}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-error/30 bg-error/5 text-error transition-colors hover:bg-error/10 disabled:opacity-50"
            >
              {isBlocking ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Ban className="h-5 w-5" />
                  <span>ブロックする</span>
                </>
              )}
            </button>
          )}
        </div>
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
