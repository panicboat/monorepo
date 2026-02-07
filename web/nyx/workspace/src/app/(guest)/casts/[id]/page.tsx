"use client";

import { CastDetailView } from "@/modules/portfolio/components/CastDetailView";
import { CastTimeline } from "@/modules/social/components/guest/CastTimeline";
import { motion } from "motion/react";
import Link from "next/link";
import { use, useState, useEffect } from "react";
import { MessageCircle, Heart, AlertTriangle, Loader2, UserPlus, UserCheck } from "lucide-react";
import { useFollow } from "@/modules/social/hooks/useFollow";
import { useBlock } from "@/modules/social/hooks/useBlock";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/Button";
import { CastProfile, MediaItem, ServicePlan, WeeklySchedule } from "@/modules/portfolio/types";

interface CastData {
  profile: CastProfile;
  plans: ServicePlan[];
  schedules: WeeklySchedule[];
}

function BlockSection({ castId }: { castId: string }) {
  const { isBlocking, toggleBlock, fetchBlockStatus, loading } = useBlock();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isHydrated && isAuthenticated() && castId) {
      fetchBlockStatus([castId]);
    }
  }, [isHydrated, isAuthenticated, castId, fetchBlockStatus]);

  const blocked = isBlocking(castId);

  const handleClick = async () => {
    if (!isAuthenticated()) {
      return;
    }

    setIsProcessing(true);
    try {
      await toggleBlock(castId, "cast");
    } catch (e) {
      console.error("Failed to toggle block:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 border-t border-border pt-8">
      <Button
        variant="ghost"
        size="sm"
        disabled={isProcessing || loading}
        onClick={handleClick}
        className={`flex items-center gap-2 text-xs font-bold rounded-full transition-colors ${blocked
          ? "bg-info text-white hover:bg-info-hover hover:text-white"
          : "text-text-muted hover:text-text-secondary hover:bg-surface-secondary"
          } ${isProcessing || loading ? "opacity-50" : ""}`}
      >
        <AlertTriangle size={14} />
        {blocked ? "Unblock Cast" : "Block / Report"}
      </Button>
      {blocked && (
        <p className="text-[10px] text-error font-medium">
          You have blocked this user.
        </p>
      )}
    </div>
  );
}

export default function CastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<CastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCast() {
      try {
        const res = await fetch(`/api/guest/casts/${id}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Cast not found");
          } else {
            setError("Failed to load cast");
          }
          return;
        }
        const json = await res.json();
        setData(json);
      } catch (e) {
        setError("Failed to load cast");
      } finally {
        setLoading(false);
      }
    }
    fetchCast();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-info" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-surface gap-4">
        <p className="text-text-secondary">{error || "Cast not found"}</p>
        <Link href="/">
          <Button variant="outline">Back to Home</Button>
        </Link>
      </div>
    );
  }

  // Build images array for PhotoGallery
  const images: MediaItem[] = [];
  if (data.profile.images?.hero) {
    const hero = data.profile.images.hero;
    if (typeof hero === "object") {
      images.push(hero as MediaItem);
    }
  }
  if (data.profile.images?.portfolio) {
    images.push(...data.profile.images.portfolio);
  }

  return (
    <div className="bg-surface pb-24">
      <CastDetailView
        castId={id}
        profileData={data.profile}
        images={images}
        plans={data.plans}
        schedules={data.schedules}
      />

      {/* Cast Timeline */}
      <CastTimeline castId={data.profile.id} />

      {/* TODO: TrustRadar - implement backend data source */}
      {/* TODO: ReviewList - implement reviews backend */}

      <div className="mt-8 mb-8 px-6">
        <BlockSection castId={data.profile.id} />
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex w-full max-w-md justify-end px-4 pb-24 pointer-events-none">
        <div className="flex flex-col gap-3 pointer-events-auto">
          <FollowButton castId={data.profile.id} />

          <FavoriteButton />

          <Link href={`/concierge/${id}`}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                size="icon"
                className="h-14 w-14 rounded-full bg-info text-white shadow-xl shadow-info/30 transition-colors hover:bg-info-hover"
              >
                <MessageCircle size={24} color="white" />
              </Button>
            </motion.div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function FollowButton({ castId }: { castId: string }) {
  const { toggleFollow, fetchFollowStatus, isFollowing, loading } = useFollow();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch follow status on mount
  useEffect(() => {
    if (isHydrated && isAuthenticated() && castId) {
      fetchFollowStatus([castId]);
    }
  }, [isHydrated, isAuthenticated, castId, fetchFollowStatus]);

  const following = isFollowing(castId);

  const handleClick = async () => {
    if (!isAuthenticated()) {
      // TODO: Show login prompt
      return;
    }

    setIsProcessing(true);
    try {
      await toggleFollow(castId);
    } catch (e) {
      console.error("Failed to toggle follow:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
      <Button
        size="icon"
        disabled={isProcessing || loading}
        className={`h-12 w-12 rounded-full shadow-xl shadow-border transition-colors border ${following
          ? "bg-info border-info text-white hover:bg-info-hover hover:text-white"
          : "bg-surface border-info-light text-info hover:bg-info-lighter"
          } ${isProcessing || loading ? "opacity-50" : ""}`}
        onClick={handleClick}
      >
        <motion.div
          key={following ? "following" : "not-following"}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          {following ? <UserCheck size={24} /> : <UserPlus size={24} />}
        </motion.div>
      </Button>
    </motion.div>
  );
}

function FavoriteButton() {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
      <Button
        size="icon"
        className={`h-12 w-12 rounded-full shadow-xl shadow-border transition-colors border ${isFavorite
          ? "bg-role-cast border-role-cast text-white hover:bg-role-cast-hover hover:text-white"
          : "bg-surface border-role-cast-light text-role-cast hover:bg-role-cast-lighter"
          }`}
        onClick={() => setIsFavorite(!isFavorite)}
      >
        <motion.div
          key={isFavorite ? "fav" : "not-fav"}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <Heart size={24} className={isFavorite ? "fill-current" : ""} />
        </motion.div>
      </Button>
    </motion.div>
  );
}
