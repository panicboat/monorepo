"use client";

import { use, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { ReviewListPage, useReviewStats } from "@/modules/trust";

interface CastData {
  profile: {
    id: string;
    name: string;
  };
}

export default function CastReviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [castData, setCastData] = useState<CastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { stats } = useReviewStats(id);

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
      targetId={id}
      targetName={castData.profile.name}
      targetType="cast"
      backUrl={`/casts/${id}`}
      stats={stats}
    />
  );
}
