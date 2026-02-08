"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import Link from "next/link";
import { useFollow, FollowingCast } from "@/modules/social/hooks/useFollow";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/Button";
import { UserListCard } from "@/components/ui/UserListCard";
import { Loader2, Users } from "lucide-react";

export default function FollowingPage() {
  const { fetchFollowingList, unfollow, loading } = useFollow();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const [actionId, setActionId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [localCasts, setLocalCasts] = useState<FollowingCast[]>([]);

  useEffect(() => {
    if (isHydrated && isAuthenticated()) {
      fetchFollowingList()
        .then(({ casts }) => setLocalCasts(casts))
        .finally(() => setInitialLoading(false));
    } else if (isHydrated) {
      setInitialLoading(false);
    }
  }, [isHydrated, isAuthenticated, fetchFollowingList]);

  const handleUnfollow = async (castId: string) => {
    setActionId(castId);
    try {
      await unfollow(castId);
      setLocalCasts((prev) => prev.filter((c) => c.id !== castId));
    } catch (e) {
      console.error("Failed to unfollow:", e);
    } finally {
      setActionId(null);
    }
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
        <p className="text-text-secondary">Please log in to see who you follow.</p>
        <Link href="/login">
          <Button variant="guest">Log In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary min-h-screen pb-20">
      <main className="px-4 pt-4">
        {localCasts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-surface-secondary flex items-center justify-center">
              <Users size={32} className="text-text-muted" />
            </div>
            <p className="text-text-secondary text-center">
              Not following anyone yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text-muted mb-4">
              {localCasts.length} following
            </p>
            <AnimatePresence mode="popLayout">
              {localCasts.map((cast) => (
                <UserListCard
                  key={cast.id}
                  user={{
                    id: cast.id,
                    name: cast.name,
                    imageUrl: cast.imageUrl,
                    subtitle: cast.area,
                  }}
                  href={`/casts/${cast.id}`}
                  actionLabel="Unfollow"
                  isLoading={actionId === cast.id || loading}
                  onAction={handleUnfollow}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
