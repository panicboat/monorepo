"use client";

import { PhotoGallery } from "@/modules/portfolio/components/detail/PhotoGallery";
import { ProfileSpecs } from "@/modules/portfolio/components/detail/ProfileSpecs";
import { PriceSystem, ScheduleCalendar } from "@/modules/portfolio/components/detail/CostAndSchedule";
import { CastPosts } from "@/modules/portfolio/components/detail/CastPosts";
import { TrustRadar } from "@/modules/trust/components/TrustRadar";
import { ReviewList } from "@/modules/trust/components/ReviewList";
import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { use, useState } from "react";
import { ChevronLeft, MessageCircle, Heart, AlertTriangle } from "lucide-react";
import { useSocial } from "@/modules/social/hooks/useSocial";

function BlockSection({ castId }: { castId: string }) {
  const { isBlocking, toggleBlock } = useSocial();
  const blocked = isBlocking(castId);

  return (
    <div className="flex flex-col items-center gap-2 border-t border-slate-100 pt-8">
      <button
        onClick={() => toggleBlock(castId)}
        className={`flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-full transition-colors ${blocked ? "bg-slate-900 text-white" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          }`}
      >
        <AlertTriangle size={14} />
        {blocked ? "Unblock Cast" : "Block / Report"}
      </button>
      {blocked && <p className="text-[10px] text-red-500 font-medium">You have blocked this user.</p>}
    </div>
  );
}

export default function CastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 200], [0, 1]);

  return (
    <div className="bg-white pb-24">
      {/* Floating Header handled by Global MobileHeader */}
      {/* Back Button handled by Global MobileHeader */}

      <PhotoGallery castId={id} />
      <ProfileSpecs castId={id} />
      <ScheduleCalendar />
      <TrustRadar scores={[90, 85, 70, 95, 80]} />
      <PriceSystem />
      <CastPosts />

      <ReviewList />

      <div className="mt-8 mb-8 px-6">
        <BlockSection castId={id} />
      </div>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex w-full max-w-md justify-end px-4 pb-24 pointer-events-none">
        <div className="flex flex-col gap-3 pointer-events-auto">
          <FavoriteButton />

          <Link href={`/concierge/${id}`}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-500 text-white shadow-xl shadow-pink-200 transition-colors hover:bg-pink-600"
            >
              <MessageCircle size={24} color="white" />
            </motion.button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function FavoriteButton() {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={`flex h-12 w-12 items-center justify-center rounded-full shadow-xl shadow-slate-300 transition-colors border ${isFavorite ? "bg-pink-500 border-pink-500 text-white" : "bg-white border-pink-100 text-pink-500 hover:bg-pink-50"
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
    </motion.button>
  );
}
