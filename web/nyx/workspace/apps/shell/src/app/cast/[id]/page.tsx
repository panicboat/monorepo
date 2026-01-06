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
import { ChevronLeft, MessageCircle, Heart } from "lucide-react";

export default function CastDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { scrollY } = useScroll();
  const headerOpacity = useTransform(scrollY, [0, 200], [0, 1]);

  return (
    <div className="bg-white pb-24">
      {/* Floating Header handled by Global MobileHeader */}
      {/* Back Button handled by Global MobileHeader */}

      <PhotoGallery castId={id} />
      <ProfileSpecs />
      <ScheduleCalendar />
      <TrustRadar scores={[90, 85, 70, 95, 80]} />
      <PriceSystem />
      <CastPosts />

      <ReviewList />

      {/* Floating Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex w-full max-w-md justify-end px-4 pb-24 pointer-events-none">
        <div className="flex flex-col gap-3 pointer-events-auto">
          <FavoriteButton />

          <Link href={`/concierge/${id}`}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl shadow-slate-300 transition-colors hover:bg-slate-800"
            >
              <MessageCircle size={24} className="text-pink-400" />
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
