"use client";

import { useState } from "react";
import { Star, Eye, EyeOff, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";

export type Review = {
  id: string;
  userName: string;
  rating: number;
  date: string;
  comment: string;
  tags: string[];
  status: "pending" | "public" | "hidden";
  castId: string; // Added to act as filter if needed
};

// Mock data with status
export const MOCK_REVIEWS: Review[] = [
  {
    id: "1",
    userName: "Guest_8823",
    rating: 5,
    date: "2 days ago",
    comment:
      "Yuna was incredibly attentive and sweet. The conversation flowed naturally and I felt very relaxed.",
    tags: ["Good Listener", "Charming"],
    status: "public",
    castId: "1",
  },
  {
    id: "2",
    userName: "Guest_1102",
    rating: 4,
    date: "1 week ago",
    comment:
      "Great experience overall. Just wished the connection was a bit more stable at the start.",
    tags: ["Cute", "Funny"],
    status: "public",
    castId: "1",
  },
  {
    id: "3",
    userName: "Guest_5599",
    rating: 5,
    date: "2 weeks ago",
    comment: "Perfect ritual. She knew exactly what I needed to hear.",
    tags: ["Healer"],
    status: "public",
    castId: "1",
  },
];

export const EXTRA_MOCK_REVIEWS: Review[] = [
  {
    id: "4",
    userName: "Guest_9999",
    rating: 5,
    date: "3 weeks ago",
    comment: "Absolutely stunning service. Will definitely pledge again.",
    tags: ["Professional", "Beautiful"],
    status: "public",
    castId: "1",
  },
  {
    id: "5",
    userName: "Guest_0000",
    rating: 3,
    date: "1 month ago",
    comment: "She was nice but seemed a bit tired. Hope she gets some rest.",
    tags: ["Honest"],
    status: "hidden", // Example hidden
    castId: "1",
  },
  {
    id: "6",
    userName: "Guest_New",
    rating: 5,
    date: "1 hour ago",
    comment: "Waiting for approval review example.",
    tags: ["New"],
    status: "pending", // Example pending
    castId: "1",
  },
];

type ReviewListProps = {
  items?: Review[];
  mode?: "guest" | "cast";
  onStatusChange?: (id: string, status: Review["status"]) => void;
};

export const ReviewList = ({
  items,
  mode = "guest",
  onStatusChange,
}: ReviewListProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Combine mocks if no items provided
  const allMocks = [...MOCK_REVIEWS, ...EXTRA_MOCK_REVIEWS];
  const sourceItems = items || allMocks;

  // Filter based on mode
  const displayedReviews = sourceItems.filter((review) => {
    if (mode === "cast") return true; // Show all to cast
    return review.status === "public"; // Only show public to guests
  });

  // Pagination logic (simple)
  const visibleReviews = isExpanded ? displayedReviews : displayedReviews.slice(0, 3);

  return (
    <div className="bg-slate-50 py-6">
      <div className="px-4 mb-4 flex items-center justify-between">
        <h3 className="font-serif text-lg font-bold text-slate-800">
          {mode === "cast" ? "All Reviews" : "Recent Reviews"}
        </h3>
        <span className="text-sm text-blue-400 font-bold">
          4.8 <Star size={12} className="inline fill-blue-400" /> ({displayedReviews.length})
        </span>
      </div>

      <div className="space-y-4 px-4">
        {visibleReviews.map((review) => (
          <ReviewItem
            key={review.id}
            review={review}
            mode={mode}
            onStatusChange={onStatusChange}
          />
        ))}
      </div>

      {!isExpanded && displayedReviews.length > 3 && (
        <div className="mt-4 px-4">
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full rounded-xl bg-blue-400 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-blue-500"
          >
            Read All Reviews
          </button>
        </div>
      )}
    </div>
  );
};

const ReviewItem = ({
  review,
  mode,
  onStatusChange
}: {
  review: Review;
  mode: "guest" | "cast";
  onStatusChange?: (id: string, status: Review["status"]) => void;
}) => {
  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm relative transition-all ${review.status === "pending" ? "border-amber-200 bg-amber-50/50" :
        review.status === "hidden" ? "border-slate-100 opacity-60 bg-slate-50" :
          "border-green-100 bg-white ring-1 ring-green-50"
      }`}>
      {/* Status Badge for Cast */}
      {mode === "cast" && (
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {/* Actions based on Status */}
          {review.status === "pending" && (
            <Button
              size="sm"
              variant="guest"
              onClick={() => onStatusChange?.(review.id, "public")}
              className="h-8 px-4 gap-1.5 shadow-sm"
            >
              <CheckCircle size={14} />
              <span className="font-bold">Approve & Publish</span>
            </Button>
          )}

          {review.status === "public" && (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full uppercase tracking-wider">
                <Eye size={10} /> Published
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 gap-1"
                onClick={() => onStatusChange?.(review.id, "hidden")}
                title="Hide from profile"
              >
                <EyeOff size={14} />
                <span className="text-xs">Hide</span>
              </Button>
            </div>
          )}

          {review.status === "hidden" && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-1 rounded-full uppercase tracking-wider">
                Hidden
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-3 text-slate-400 hover:text-blue-400 hover:bg-blue-50 gap-1"
                onClick={() => onStatusChange?.(review.id, "public")}
                title="Show on profile"
              >
                <Eye size={14} />
                <span className="text-xs">Show</span>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Cast View: Status Label for Pending */}
      {mode === "cast" && review.status === "pending" && (
        <div className="mb-2">
          <span className="text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider bg-amber-100 text-amber-700 flex w-fit items-center gap-1">
            <Clock size={10} /> Approval Required
          </span>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500">
          {review.userName}
        </span>
        <span className="text-xs text-slate-400">{review.date}</span>
      </div>

      <div className="mb-2 flex text-yellow-400">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            size={14}
            className={
              i < review.rating
                ? "fill-yellow-400"
                : "fill-slate-200 text-slate-200"
            }
          />
        ))}
      </div>

      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        {review.comment}
      </p>

      <div className="flex gap-2">
        {review.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-500"
          >
            #{tag}
          </span>
        ))}
      </div>
    </div>
  );
};
