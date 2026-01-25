"use client";

import { PhotoGallery } from "@/modules/portfolio/components/guest/detail/PhotoGallery";
import { ProfileSpecs } from "@/modules/portfolio/components/guest/detail/ProfileSpecs";
import {
  PriceSystem,
  ScheduleCalendar,
} from "@/modules/portfolio/components/guest/detail/CostAndSchedule";
import { motion } from "motion/react";
import Link from "next/link";
import { use, useState, useEffect } from "react";
import { MessageCircle, Heart, AlertTriangle, Loader2 } from "lucide-react";
import { useSocial } from "@/modules/social/hooks/useSocial";
import { Button } from "@/components/ui/Button";
import { CastProfile, MediaItem, ServicePlan, WeeklySchedule } from "@/modules/portfolio/types";

interface CastData {
  profile: CastProfile;
  plans: ServicePlan[];
  schedules: WeeklySchedule[];
}

function BlockSection({ castId }: { castId: string }) {
  const { isBlocking, toggleBlock } = useSocial();
  const blocked = isBlocking(castId);

  return (
    <div className="flex flex-col items-center gap-2 border-t border-slate-100 pt-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => toggleBlock(castId)}
        className={`flex items-center gap-2 text-xs font-bold rounded-full transition-colors ${blocked
          ? "bg-slate-900 text-white hover:bg-slate-800 hover:text-white"
          : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          }`}
      >
        <AlertTriangle size={14} />
        {blocked ? "Unblock Cast" : "Block / Report"}
      </Button>
      {blocked && (
        <p className="text-[10px] text-red-500 font-medium">
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
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white gap-4">
        <p className="text-slate-500">{error || "Cast not found"}</p>
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
    <div className="bg-white pb-24">
      <PhotoGallery castId={id} images={images} />
      <ProfileSpecs castId={id} profileData={data.profile} />
      <ScheduleCalendar schedules={data.schedules} />
      {/* TODO: TrustRadar - implement backend data source */}
      <PriceSystem plans={data.plans} />
      {/* TODO: CastPosts - implement timeline/posts backend */}
      {/* TODO: ReviewList - implement reviews backend */}

      <div className="mt-8 mb-8 px-6">
        <BlockSection castId={id} />
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex w-full max-w-md justify-end px-4 pb-24 pointer-events-none">
        <div className="flex flex-col gap-3 pointer-events-auto">
          <FavoriteButton />

          <Link href={`/concierge/${id}`}>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                size="icon"
                className="h-14 w-14 rounded-full bg-pink-500 text-white shadow-xl shadow-pink-200 transition-colors hover:bg-pink-600"
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

function FavoriteButton() {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
      <Button
        size="icon"
        className={`h-12 w-12 rounded-full shadow-xl shadow-slate-300 transition-colors border ${isFavorite
          ? "bg-pink-500 border-pink-500 text-white hover:bg-pink-600 hover:text-white"
          : "bg-white border-pink-100 text-pink-500 hover:bg-pink-50"
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
