"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";

import { ChevronLeft, Grid, List as ListIcon, Play } from "lucide-react";
import {
  MOCK_POSTS,
  EXTRA_POSTS,
  PostCard,
  PostItem,
} from "@/modules/portfolio/components/cast/detail/CastPosts";
import { MediaModal, MediaItem } from "@/components/shared/MediaModal";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";

// Combine available mocks
const ALL_POSTS = [...MOCK_POSTS, ...EXTRA_POSTS];

type FilterType = "all" | "image" | "video";
type LayoutType = "list" | "grid";

export default function TimelinePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>("all");
  const [layout, setLayout] = useState<LayoutType>("list");

  // Media Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);

  // Filter Logic
  const filteredPosts = ALL_POSTS.filter((post) => {
    if (filter === "all") return true;
    if (filter === "image")
      return post.media?.some((m) => m.type === "image" || m.type === "gif");
    if (filter === "video") return post.media?.some((m) => m.type === "video");
    return true;
  });

  const handleMediaClick = (media: MediaItem) => {
    setSelectedMedia(media);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-safe">
      {/* Filter Tabs & Layout Toggle */}
      <div className="sticky top-14 z-20 bg-slate-50 pt-4 pb-4 px-4 flex items-center justify-between border-b border-slate-100/50 backdrop-blur-sm bg-slate-50/95">
        <HorizontalScroll
          className="flex-1 min-w-0 mr-2"
          contentClassName="gap-2 cursor-grab active:cursor-grabbing"
        >
          {(["all", "image", "video"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-xs font-bold capitalize transition-colors whitespace-nowrap
                ${
                  filter === f
                    ? "bg-blue-400 text-white shadow-md"
                    : "bg-white text-slate-500 border border-slate-200"
                }
              `}
            >
              {f === "image" ? "Photos" : f === "video" ? "Videos" : "All"}
            </button>
          ))}
        </HorizontalScroll>

        {/* Layout Toggle */}
        <div className="flex bg-white rounded-lg p-0.5 border border-slate-200 shadow-sm ml-2 flex-shrink-0">
          <button
            onClick={() => setLayout("list")}
            className={`p-1.5 rounded-md transition-all ${layout === "list" ? "bg-slate-100 text-slate-900" : "text-slate-400"}`}
          >
            <ListIcon size={16} />
          </button>
          <button
            onClick={() => setLayout("grid")}
            className={`p-1.5 rounded-md transition-all ${layout === "grid" ? "bg-slate-100 text-slate-900" : "text-slate-400"}`}
          >
            <Grid size={16} />
          </button>
        </div>
      </div>
      {/* Content */}
      <div className="px-4 pb-24">
        {layout === "list" ? (
          // List View
          (<div className="space-y-4">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                onClick={() => {
                  // Creating simple click handler for demo - real impl might need more granular click tracking within PostCard
                  // For now, PostCard handles rendering. We might need to pass an onMediaClick prop to PostCard if we want to open modal from there.
                  // Actually, let's wrap PostCard or modify it.
                  // For now, let's assume PostCard is self-contained for list view or we just view it.
                  // To support modal opening, need to patch PostCard.
                }}
              >
                <PostCard post={post} />
              </div>
            ))}
          </div>)
        ) : (
          // Grid View
          (<div className="grid grid-cols-3 gap-1 auto-flow-dense pb-20 px-1">
            {filteredPosts
              .flatMap((post) => post.media || [])
              .map((media, idx) => {
                // Complex Mosaic Pattern (12-item cycle)
                // 0: Large (Left)
                // 7: Large (Right)
                const isLarge = idx % 12 === 0 || idx % 12 === 7;

                return (
                  <div
                    key={idx}
                    onClick={() => handleMediaClick(media)}
                    className={`relative cursor-pointer bg-slate-100 block w-full rounded-xl overflow-hidden
                     ${isLarge ? "col-span-2 row-span-2" : "col-span-1 row-span-1"}
                   `}
                    style={{
                      paddingBottom: "100%",
                    }}
                  >
                    <div className="absolute inset-0">
                      <img
                        src={
                          media.type === "video"
                            ? media.thumbnail || media.url
                            : media.url
                        }
                        alt="media"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {media.type === "video" && (
                      <div className="absolute top-2 right-2">
                        <div className="bg-black/50 text-white rounded-full p-1.5 backdrop-blur-sm">
                          <Play size={12} fill="currentColor" />
                        </div>
                      </div>
                    )}
                    {media.type === "gif" && (
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm">
                        GIF
                      </div>
                    )}
                  </div>
                );
              })}
          </div>)
        )}
      </div>
      {/* Modal */}
      <MediaModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        media={selectedMedia}
      />
    </div>
  );
}
