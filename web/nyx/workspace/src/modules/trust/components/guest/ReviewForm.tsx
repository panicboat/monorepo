"use client";

import { useState } from "react";
import { X, Star } from "lucide-react";

type ReviewFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { rating: number; comment: string; tags: string[] }) => void;
  castName: string;
};

const TAG_OPTIONS = [
  "Cute",
  "Talkative",
  "Punctual",
  "Stylish",
  "Good Listener",
  "Energetic",
];

export const ReviewForm = ({
  isOpen,
  onClose,
  onSubmit,
  castName,
}: ReviewFormProps) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit({ rating, comment, tags: selectedTags });
    onClose();
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-secondary/50">
          <h3 className="font-bold text-text-primary">Review for {castName}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-surface-secondary transition-colors"
          >
            <X size={20} className="text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Rating */}
          <div className="flex flex-col items-center gap-2">
            <label className="text-sm font-bold text-text-secondary uppercase tracking-wider">
              Rating
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`transition-transform hover:scale-110 active:scale-95 ${rating >= star ? "text-amber-400" : "text-border"}`}
                >
                  <Star size={32} fill="currentColor" />
                </button>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary uppercase">
              What was good?
            </label>
            <div className="flex flex-wrap gap-2">
              {TAG_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors
                    ${
                      selectedTags.includes(tag)
                        ? "bg-info-lighter border-info-light text-info"
                        : "bg-surface border-border text-text-secondary hover:border-border-secondary"
                    }
                  `}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-secondary uppercase">
              Comment
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={`Write a review for ${castName}...`}
              className="w-full h-32 p-3 text-sm rounded-xl border border-border bg-surface-secondary focus:bg-surface focus:border-info focus:outline-none focus:ring-2 focus:ring-info-light transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-surface-secondary/50">
          <button
            onClick={handleSubmit}
            disabled={rating === 0}
            className="w-full py-3 rounded-xl bg-info text-white font-bold shadow-md hover:bg-info-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            Submit Review
          </button>
        </div>
      </div>
    </div>
  );
};
