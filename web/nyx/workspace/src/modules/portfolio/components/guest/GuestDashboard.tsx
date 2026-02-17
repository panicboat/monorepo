"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/modules/identity/hooks/useAuth";
import { useGuestData } from "@/modules/portfolio/hooks/useGuestData";
import { GuestProfileForm } from "./GuestProfileForm";
import { useFavorite, FavoriteCast, useFollow, FollowingCast } from "@/modules/relationship";
import { ChevronRight, Heart, Users } from "lucide-react";

const PREVIEW_LIMIT = 3;

export const GuestDashboard = () => {
  const { logout } = useAuth();
  const { profile, avatarUrl, saveProfile, uploadAvatar, loading } = useGuestData();
  const { fetchFavoritesList, favoriteCasts, loading: favoritesLoading } = useFavorite();
  const { fetchFollowingList, followingCasts, loading: followingLoading } = useFollow();

  useEffect(() => {
    fetchFavoritesList(PREVIEW_LIMIT);
    fetchFollowingList(PREVIEW_LIMIT);
  }, [fetchFavoritesList, fetchFollowingList]);

  return (
    <div className="bg-surface-secondary pb-24 md:pb-safe min-h-screen">
      <main className="p-4 space-y-6 pt-4 max-w-2xl mx-auto">
        {/* Favorites Preview Section */}
        <section className="rounded-2xl bg-surface shadow-sm border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-role-cast" />
              <h2 className="text-lg font-bold text-text-primary">Favorites</h2>
            </div>
            <Link
              href="/favorites"
              className="flex items-center gap-1 text-sm text-info hover:text-info-hover transition-colors"
            >
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <CastPreviewList
            casts={favoriteCasts}
            loading={favoritesLoading}
            emptyMessage="No favorites yet"
          />
        </section>

        {/* Following Preview Section */}
        <section className="rounded-2xl bg-surface shadow-sm border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-info" />
              <h2 className="text-lg font-bold text-text-primary">Following</h2>
            </div>
            <Link
              href="/following"
              className="flex items-center gap-1 text-sm text-info hover:text-info-hover transition-colors"
            >
              <span>View All</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <CastPreviewList
            casts={followingCasts}
            loading={followingLoading}
            emptyMessage="Not following anyone yet"
          />
        </section>

        {/* Profile Edit Section */}
        <section className="rounded-2xl bg-surface shadow-sm border border-border p-5">
          <h2 className="text-lg font-bold text-text-primary mb-4">Profile</h2>
          <GuestProfileForm
            initialData={profile}
            initialAvatarUrl={avatarUrl}
            onSubmit={saveProfile}
            onUploadAvatar={uploadAvatar}
            submitLabel="保存する"
            loading={loading}
          />
        </section>

        {/* Sign Out Button */}
        <button
          onClick={logout}
          className="w-full rounded-xl bg-surface-secondary py-3 text-sm font-bold text-text-secondary hover:bg-neutral-200 hover:text-text-secondary transition-colors"
        >
          Sign Out
        </button>
      </main>
    </div>
  );
};

interface CastPreviewListProps {
  casts: (FavoriteCast | FollowingCast)[];
  loading: boolean;
  emptyMessage: string;
}

function CastPreviewList({ casts, loading, emptyMessage }: CastPreviewListProps) {
  if (loading) {
    return (
      <div className="p-5 flex justify-center">
        <div className="w-6 h-6 border-2 border-info/30 border-t-info rounded-full animate-spin" />
      </div>
    );
  }

  if (casts.length === 0) {
    return (
      <div className="p-5 text-center text-sm text-text-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {casts.map((cast) => (
        <Link
          key={cast.id}
          href={`/casts/${cast.id}`}
          className="flex items-center gap-3 px-5 py-3 hover:bg-surface-secondary transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-surface-secondary overflow-hidden flex-shrink-0">
            {cast.imageUrl ? (
              <img
                src={cast.imageUrl}
                alt={cast.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-text-muted">
                👤
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {cast.name}
            </p>
            {cast.area && (
              <p className="text-xs text-text-muted truncate">{cast.area}</p>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
        </Link>
      ))}
    </div>
  );
}
