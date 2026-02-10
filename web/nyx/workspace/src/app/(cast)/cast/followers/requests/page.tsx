"use client";

import { useState } from "react";
import { Loader2, UserPlus, Check, X, Users } from "lucide-react";
import { useFollowRequests } from "@/modules/social/hooks";
import { useToast } from "@/components/ui/Toast";

export default function FollowRequestsPage() {
  const { toast } = useToast();
  const { requests, pendingCount, loading, approve, reject } = useFollowRequests();
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const handleApprove = async (guestId: string) => {
    if (processingIds.has(guestId)) return;

    setProcessingIds((prev) => new Set([...prev, guestId]));

    try {
      await approve(guestId);
      toast({
        title: "Approved",
        description: "Follow request approved",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to approve:", error);
      toast({
        title: "Error",
        description: "Failed to approve follow request",
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
        title: "Rejected",
        description: "Follow request rejected",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to reject:", error);
      toast({
        title: "Error",
        description: "Failed to reject follow request",
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-role-cast" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-secondary pb-24">
      {/* Header */}
      <div className="bg-surface border-b border-border px-4 py-4">
        <div className="flex items-center gap-3">
          <UserPlus className="h-6 w-6 text-role-cast" />
          <div>
            <h1 className="text-lg font-bold text-text-primary">Follow Requests</h1>
            <p className="text-sm text-text-muted">
              {pendingCount > 0
                ? `${pendingCount} pending request${pendingCount > 1 ? "s" : ""}`
                : "No pending requests"}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="h-12 w-12 text-text-muted mb-4" />
            <p className="text-text-secondary font-medium">No pending requests</p>
            <p className="text-sm text-text-muted mt-1">
              When someone requests to follow you, it will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div
                key={request.guestId}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                {/* Avatar */}
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-surface-secondary">
                  {request.guestImageUrl ? (
                    <img
                      src={request.guestImageUrl}
                      alt={request.guestName}
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
                    {request.guestName || "Guest"}
                  </p>
                  <p className="text-xs text-text-muted">
                    {formatRelativeTime(request.requestedAt)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(request.guestId)}
                    disabled={processingIds.has(request.guestId)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-role-cast text-white transition-colors hover:bg-role-cast-hover disabled:opacity-50"
                    title="Approve"
                  >
                    {processingIds.has(request.guestId) ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Check className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    onClick={() => handleReject(request.guestId)}
                    disabled={processingIds.has(request.guestId)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-secondary hover:text-error disabled:opacity-50"
                    title="Reject"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
