"use client";

import { useState } from "react";
import { Loader2, ShieldAlert, UserX } from "lucide-react";
import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import { useToast } from "@/components/ui/Toast";

interface BlockedUser {
  id: string;
  userType: string;
  name: string;
  imageUrl: string;
  blockedAt: string;
}

interface BlockedResponse {
  users: BlockedUser[];
  nextCursor: string;
  hasMore: boolean;
}

export default function BlocksPage() {
  const { toast } = useToast();
  const token = getAuthToken();
  const [unblockingIds, setUnblockingIds] = useState<Set<string>>(new Set());

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<BlockedResponse>(
    token ? "/api/cast/blocks" : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  const handleUnblock = async (blockedId: string) => {
    if (unblockingIds.has(blockedId)) return;

    setUnblockingIds((prev) => new Set([...prev, blockedId]));

    try {
      const res = await fetch(`/api/cast/blocks?blocked_id=${blockedId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to unblock user");
      }

      mutate(
        (current) => {
          if (!current) return current;
          return {
            ...current,
            users: current.users.filter((u) => u.id !== blockedId),
          };
        },
        { revalidate: false }
      );

      toast({
        title: "ブロック解除しました",
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
      setUnblockingIds((prev) => {
        const next = new Set(prev);
        next.delete(blockedId);
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

  const users = data?.users || [];

  return (
    <div className="pb-24 bg-surface-secondary min-h-screen">
      <div className="px-4 py-6 space-y-4">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">ブロックリスト</h1>
          <p className="text-text-secondary text-sm">
            {users.length} 人をブロック中
          </p>
        </div>

        {users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldAlert className="h-12 w-12 text-text-muted mb-4" />
            <p className="text-text-secondary font-medium">ブロックしているユーザーはいません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-surface-secondary">
                  {user.imageUrl ? (
                    <img
                      src={user.imageUrl}
                      alt={user.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-text-muted">
                      <UserX className="h-6 w-6" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary truncate">
                    {user.name || "Unknown"}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatDate(user.blockedAt)} にブロック
                  </p>
                </div>

                <button
                  onClick={() => handleUnblock(user.id)}
                  disabled={unblockingIds.has(user.id)}
                  className="px-3 py-2 text-sm font-medium rounded-lg border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-secondary disabled:opacity-50"
                >
                  {unblockingIds.has(user.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "解除"
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
