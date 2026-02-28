"use client";

import { use, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ReviewListPage, useReviewStats } from "@/modules/trust";

interface CastData {
  profile: {
    userId: string;
    name: string;
  };
}

export default function CastReviewsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId: id } = use(params);
  const [castData, setCastData] = useState<CastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCast() {
      try {
        const res = await fetch(`/api/guest/casts/${id}`);
        if (!res.ok) {
          setError("Cast not found");
          return;
        }
        const json = await res.json();
        setCastData(json);
      } catch (e) {
        setError("Failed to load cast");
      } finally {
        setLoading(false);
      }
    }
    fetchCast();
  }, [id]);

  const { stats } = useReviewStats(castData?.profile.userId ?? null);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-info" />
      </div>
    );
  }

  if (error || !castData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <p className="text-text-secondary">{error || "Cast not found"}</p>
      </div>
    );
  }

  return (
    <ReviewListPage
      targetId={castData.profile.userId}
      targetName={castData.profile.name}
      targetType="cast"
      backUrl={`/casts/${id}`}
      stats={stats}
    />
  );
}
