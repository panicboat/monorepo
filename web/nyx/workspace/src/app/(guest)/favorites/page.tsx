"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import Link from "next/link";
import { useFavorite, FavoriteCast } from "@/modules/social/hooks/useFavorite";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/Button";
import { UserListCard } from "@/components/ui/UserListCard";
import { Loader2, Heart } from "lucide-react";

export default function FavoritesPage() {
  const { fetchFavoritesList, removeFavorite, loading } = useFavorite();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const [actionId, setActionId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [localCasts, setLocalCasts] = useState<FavoriteCast[]>([]);

  useEffect(() => {
    if (isHydrated && isAuthenticated()) {
      fetchFavoritesList()
        .then(({ casts }) => setLocalCasts(casts))
        .finally(() => setInitialLoading(false));
    } else if (isHydrated) {
      setInitialLoading(false);
    }
  }, [isHydrated, isAuthenticated, fetchFavoritesList]);

  const handleRemove = async (castId: string) => {
    setActionId(castId);
    try {
      await removeFavorite(castId);
      setLocalCasts((prev) => prev.filter((c) => c.id !== castId));
    } catch (e) {
      console.error("Failed to remove favorite:", e);
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
        <p className="text-text-secondary">Please log in to see your favorites.</p>
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
              <Heart size={32} className="text-text-muted" />
            </div>
            <p className="text-text-secondary text-center">
              No favorites yet.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-text-muted mb-4">
              {localCasts.length} favorite{localCasts.length !== 1 ? "s" : ""}
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
                  actionLabel="Remove"
                  isLoading={actionId === cast.id || loading}
                  onAction={handleRemove}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
