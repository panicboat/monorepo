"use client";

import { useState } from "react";
import { Star } from "lucide-react";

type Review = {
  id: string;
  userName: string;
  rating: number;
  date: string;
  comment: string;
  tags: string[];
};

const MOCK_REVIEWS: Review[] = [
  {
    id: "1",
    userName: "Guest_8823",
    rating: 5,
    date: "2 days ago",
    comment:
      "Yuna was incredibly attentive and sweet. The conversation flowed naturally and I felt very relaxed.",
    tags: ["Good Listener", "Charming"],
  },
  {
    id: "2",
    userName: "Guest_1102",
    rating: 4,
    date: "1 week ago",
    comment:
      "Great experience overall. Just wished the connection was a bit more stable at the start.",
    tags: ["Cute", "Funny"],
  },
  {
    id: "3",
    userName: "Guest_5599",
    rating: 5,
    date: "2 weeks ago",
    comment: "Perfect ritual. She knew exactly what I needed to hear.",
    tags: ["Healer"],
  },
];

const EXTRA_MOCK_REVIEWS: Review[] = [
  {
    id: "4",
    userName: "Guest_9999",
    rating: 5,
    date: "3 weeks ago",
    comment: "Absolutely stunning service. Will definitely pledge again.",
    tags: ["Professional", "Beautiful"],
  },
  {
    id: "5",
    userName: "Guest_0000",
    rating: 3,
    date: "1 month ago",
    comment: "She was nice but seemed a bit tired. Hope she gets some rest.",
    tags: ["Honest"],
  },
];

export const ReviewList = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const displayedReviews = isExpanded
    ? [...MOCK_REVIEWS, ...EXTRA_MOCK_REVIEWS]
    : MOCK_REVIEWS;

  return (
    <div className="bg-slate-50 py-6">
      <div className="px-4 mb-4 flex items-center justify-between">
        <h3 className="font-serif text-lg font-bold text-slate-800">
          Recent Reviews
        </h3>
        <span className="text-sm text-pink-500 font-bold">
          4.8 <Star size={12} className="inline fill-pink-500" /> (124)
        </span>
      </div>

      <div className="space-y-4 px-4">
        {displayedReviews.map((review) => (
          <div
            key={review.id}
            className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
          >
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
        ))}
      </div>

      {!isExpanded && (
        <div className="mt-4 px-4">
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-md transition-colors hover:bg-slate-800"
          >
            Read All Reviews
          </button>
        </div>
      )}
    </div>
  );
};
