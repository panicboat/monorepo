"use client";

import { useEffect, useState } from "react";
import { Loader2, UserPlus, Users, Check, X, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getAuthToken } from "@/lib/swr";
import { useFollowRequests } from "@/modules/relationship";
import { PendingReviewsSection } from "@/modules/trust";
import { useToast } from "@/components/ui/Toast";

export default function CastHomePage() {
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const {
    requests,
    pendingCount,
    loading: requestsLoading,
    approve,
    reject,
  } = useFollowRequests();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const checkOnboarding = async () => {
      const token = getAuthToken();
      if (!token) {
        window.location.href = "/cast/login";
        return;
      }

      try {
        const profileRes = await fetch("/api/cast/onboarding/profile", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!profileRes.ok) {
          if (profileRes.status === 404) {
            window.location.href = "/cast/onboarding/step-1";
            return;
          }
        }

        const profileData = await profileRes.json();
        const { profile } = profileData;

        if (!profile || !profile.registeredAt) {
          window.location.href = "/cast/onboarding/step-1";
          return;
        }
      } catch (error) {
        console.error("Failed to check onboarding status:", error);
      } finally {
        setLoading(false);
      }
    };

    checkOnboarding();
  }, []);

  const handleApprove = async (guestId: string) => {
    if (processingIds.has(guestId)) return;
    setProcessingIds((prev) => new Set([...prev, guestId]));

    try {
      await approve(guestId);
      toast({
        title: "承認しました",
        description: "フォローリクエストを承認しました",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to approve:", error);
      toast({
        title: "エラー",
        description: "承認に失敗しました",
        variant: "destructive",
      });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(guestId);
        return next;
      });
    }
  };

  const handleReject = async (guestId: string) => {
    if (processingIds.has(guestId)) return;
    setProcessingIds((prev) => new Set([...prev, guestId]));

    try {
      await reject(guestId);
      toast({
        title: "拒否しました",
        description: "フォローリクエストを拒否しました",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to reject:", error);
      toast({
        title: "エラー",
        description: "拒否に失敗しました",
        variant: "destructive",
      });
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(guestId);
        return next;
      });
    }
  };

  if (loading || requestsLoading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="animate-spin text-role-cast" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {/* Follow Requests Section */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-role-cast" />
            <h2 className="text-sm font-bold text-text-primary">
              フォローリクエスト
              {pendingCount > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-role-cast text-white rounded-full">
                  {pendingCount}
                </span>
              )}
            </h2>
          </div>
          <Link
            href="/cast/followers/requests"
            className="text-xs text-text-muted hover:text-role-cast flex items-center gap-1"
          >
            すべて見る
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {requests.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-center">
            <Users className="h-8 w-8 text-text-muted mx-auto mb-2" />
            <p className="text-sm text-text-secondary">
              フォローリクエストはありません
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.slice(0, 3).map((request) => (
              <div
                key={request.guestId}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3 shadow-sm"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-surface-secondary">
                  {request.guestImageUrl ? (
                    <img
                      src={request.guestImageUrl}
                      alt={request.guestName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-text-muted">
                      <Users className="h-5 w-5" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-text-primary truncate">
                    {request.guestName || "Guest"}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatRelativeTime(request.requestedAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(request.guestId)}
                    disabled={processingIds.has(request.guestId)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-role-cast text-white transition-colors hover:bg-role-cast-hover disabled:opacity-50"
                    title="承認"
                  >
                    {processingIds.has(request.guestId) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleReject(request.guestId)}
                    disabled={processingIds.has(request.guestId)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-secondary hover:text-error disabled:opacity-50"
                    title="拒否"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending Reviews Section */}
      <section className="bg-surface border border-border rounded-xl p-4 shadow-sm">
        <PendingReviewsSection />
      </section>

      {/* New Followers Section - Placeholder for now */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-special" />
            <h2 className="text-sm font-bold text-text-primary">新着フォロワー</h2>
          </div>
          <Link
            href="/cast/followers"
            className="text-xs text-text-muted hover:text-role-cast flex items-center gap-1"
          >
            すべて見る
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6 text-center">
          <Users className="h-8 w-8 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-secondary">
            新着フォロワーはいません
          </p>
        </div>
      </section>
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "たった今";
  if (diffMins < 60) return `${diffMins}分前`;
  if (diffHours < 24) return `${diffHours}時間前`;
  if (diffDays < 7) return `${diffDays}日前`;

  return date.toLocaleDateString("ja-JP");
}
