"use client";

import { useState } from "react";
import { ReviewList, Review, MOCK_REVIEWS, EXTRA_MOCK_REVIEWS } from "@/modules/trust/components/guest/ReviewList";
import { Info } from "lucide-react";

export default function CastReviewsPage() {
  // Combine all mocks for initial state
  const [reviews, setReviews] = useState<Review[]>([
    ...MOCK_REVIEWS,
    ...EXTRA_MOCK_REVIEWS,
    // Add a pending review explicitly for demo
    {
      id: "demo-pending",
      userName: "Guest_Demo",
      rating: 5,
      date: "Just now",
      comment: "This is a demo review waiting for approval!",
      tags: ["Demo"],
      status: "pending",
      castId: "1",
    }
  ]);

  const handleStatusChange = (id: string, status: Review["status"]) => {
    setReviews(reviews.map((r) => r.id === id ? { ...r, status } : r));
  };

  const pendingCount = reviews.filter(r => r.status === "pending").length;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold text-text-primary">Reviews</h1>
      </div>

      {pendingCount > 0 && (
        <div className="bg-warning-lighter border border-warning-light rounded-xl p-4 flex gap-3 text-warning-hover animate-in fade-in slide-in-from-top-2">
          <Info className="shrink-0" size={20} />
          <div className="text-sm">
            <p className="font-bold">You have {pendingCount} reviews waiting for approval.</p>
            <p className="opacity-80">Approve them to make them visible on your profile.</p>
          </div>
        </div>
      )}

      <ReviewList
        items={reviews}
        mode="cast"
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
