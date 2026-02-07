"use client";

import { useEffect, useState } from "react";
import { useBlock, BlockedUser } from "@/modules/social/hooks/useBlock";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/Button";
import { Loader2, UserX } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";

export default function BlockingPage() {
  const { fetchBlockedList, unblock, blockedList, loading } = useBlock();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (isHydrated && isAuthenticated()) {
      fetchBlockedList().finally(() => setInitialLoading(false));
    } else if (isHydrated) {
      setInitialLoading(false);
    }
  }, [isHydrated, isAuthenticated, fetchBlockedList]);

  const handleUnblock = async (userId: string) => {
    setUnblockingId(userId);
    try {
      await unblock(userId);
    } catch (e) {
      console.error("Failed to unblock:", e);
    } finally {
      setUnblockingId(null);
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
          <Button variant="primary">Log In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary min-h-screen pb-20">
      <main className="px-4 pt-4">
        {blockedList.length === 0 ? (
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
              {blockedList.length} blocked user{blockedList.length !== 1 ? "s" : ""}
            </p>
            <AnimatePresence mode="popLayout">
              {blockedList.map((user: BlockedUser) => (
                <motion.div
                  key={user.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  className="flex items-center gap-4 p-4 rounded-xl bg-surface shadow-sm border border-border"
                >
                  {/* Avatar */}
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-surface-tertiary flex-shrink-0">
                    {user.imageUrl && user.imageUrl.startsWith("http") ? (
                      <img
                        src={user.imageUrl}
                        alt={user.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-muted">
                        <UserX size={20} />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-text-muted">
                      Blocked on {formatDate(user.blockedAt)}
                    </p>
                  </div>

                  {/* Unblock Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={unblockingId === user.id || loading}
                    onClick={() => handleUnblock(user.id)}
                    className="flex-shrink-0"
                  >
                    {unblockingId === user.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      "Unblock"
                    )}
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
