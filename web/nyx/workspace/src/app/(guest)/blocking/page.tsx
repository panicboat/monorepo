"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import Link from "next/link";
import { useBlock, BlockedUser } from "@/modules/social/hooks/useBlock";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/Button";
import { UserListCard } from "@/components/ui/UserListCard";
import { Loader2, UserX } from "lucide-react";

export default function BlockingPage() {
  const { fetchBlockedList, unblock, blockedList, loading } = useBlock();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const [actionId, setActionId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [localList, setLocalList] = useState<BlockedUser[]>([]);

  useEffect(() => {
    if (isHydrated && isAuthenticated()) {
      fetchBlockedList()
        .then((users) => setLocalList(users))
        .finally(() => setInitialLoading(false));
    } else if (isHydrated) {
      setInitialLoading(false);
    }
  }, [isHydrated, isAuthenticated, fetchBlockedList]);

  const handleUnblock = async (userId: string) => {
    setActionId(userId);
    try {
      await unblock(userId);
      setLocalList((prev) => prev.filter((u) => u.id !== userId));
    } catch (e) {
      console.error("Failed to unblock:", e);
    } finally {
      setActionId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!isHydrated || initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-info" />
      </div>
    );
  }

  if (!isAuthenticated()) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-surface gap-4 px-6">
        <p className="text-text-secondary">Please log in to manage blocked users.</p>
        <Link href="/login">
          <Button variant="guest">Log In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary min-h-screen pb-20">
      <main className="px-4 pt-4">
        {localList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-surface-secondary flex items-center justify-center">
              <UserX size={32} className="text-text-muted" />
            </div>
            <p className="text-text-secondary text-center">
              You haven&apos;t blocked anyone yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text-muted mb-4">
              {localList.length} blocked user{localList.length !== 1 ? "s" : ""}
            </p>
            <AnimatePresence mode="popLayout">
              {localList.map((user) => (
                <UserListCard
                  key={user.id}
                  user={{
                    id: user.id,
                    name: user.name,
                    imageUrl: user.imageUrl,
                    subtitle: `Blocked on ${formatDate(user.blockedAt)}`,
                  }}
                  actionLabel="Unblock"
                  isLoading={actionId === user.id || loading}
                  onAction={handleUnblock}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
