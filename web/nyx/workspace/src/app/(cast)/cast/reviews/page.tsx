"use client";

import { Loader2 } from "lucide-react";
import { useCastProfile } from "@/modules/portfolio/hooks/useCastProfile";
import { CastReviewsPage } from "@/modules/trust/components/CastReviewsPage";

export default function CastReviewsRoute() {
  const { userId, loading } = useCastProfile();

  if (loading || !userId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
      </div>
    );
  }

  return <CastReviewsPage castId={userId} />;
}
