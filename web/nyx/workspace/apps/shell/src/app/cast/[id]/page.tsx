"use client";

import { PhotoGallery } from "@/modules/portfolio/components/detail/PhotoGallery";
import { ProfileSpecs } from "@/modules/portfolio/components/detail/ProfileSpecs";
import { PriceSystem, ScheduleCalendar } from "@/modules/portfolio/components/detail/CostAndSchedule";
import { CastPosts } from "@/modules/portfolio/components/detail/CastPosts";
import { TrustRadar } from "@/modules/trust/components/TrustRadar";
import { ReviewList } from "@/modules/trust/components/ReviewList";
import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { use } from "react";
import { ChevronLeft, MessageCircle } from "lucide-react";

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

      {/* Floating Action Button (FAB) */}
      <div className="fixed bottom-24 right-4 z-50">
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
  );
}
