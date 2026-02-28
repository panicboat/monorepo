"use client";

import { use } from "react";
import { Loader2 } from "lucide-react";
import useSWR from "swr";
import { fetcher, getAuthToken } from "@/lib/swr";
import { ReviewListPage } from "@/modules/trust";

interface GuestDetail {
  userId: string;
  name: string;
}

export default function GuestReviewsPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const token = getAuthToken();

  const { data, error, isLoading } = useSWR<GuestDetail>(
    token ? `/api/cast/guests/${userId}` : null,
    fetcher,
    { revalidateOnFocus: false }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <Loader2 className="w-8 h-8 animate-spin text-role-cast" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <p className="text-text-secondary">ゲストが見つかりません</p>
      </div>
    );
  }

  return (
    <ReviewListPage
      targetId={data.userId}
      targetName={data.name || "ゲスト"}
      targetType="guest"
      backUrl={`/cast/guests/${userId}`}
      stats={null}
    />
  );
}
