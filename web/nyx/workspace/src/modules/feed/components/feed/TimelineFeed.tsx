"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useSocialStore, selectIsHydrated } from "@/stores/socialStore";
import { useGuestTimeline } from "@/modules/post";
import { useAuthStore } from "@/stores/authStore";
import { FeedItem, mapPostToFeedItem } from "./types";
import { TimelineItem } from "./TimelineItem";
import { TimelineFilters, FilterType } from "./TimelineFilters";

interface TimelineFeedProps {
  items?: FeedItem[];
  mode?: "guest" | "cast";
  onDelete?: (id: string) => void;
  onToggleVisibility?: (id: string, visibility: "public" | "private") => void;
  onItemClick?: (id: string) => void;
}

export function TimelineFeed({
  items,
  mode = "guest",
  onDelete,
  onToggleVisibility,
  onItemClick,
}: TimelineFeedProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const isLoaded = useSocialStore(selectIsHydrated);
  const { posts, loading, error, hasMore, fetchPosts, loadMore, setPosts } = useGuestTimeline();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  // Fetch posts on mount (only in guest mode without items prop)
  useEffect(() => {
    if (mode === "guest" && !items && isHydrated) {
      // "all" filter: public posts + private posts from followed casts
      if (isAuthenticated()) {
        fetchPosts(undefined, "all");
      } else {
        fetchPosts();
      }
    }
  }, [mode, items, fetchPosts, isHydrated, isAuthenticated]);

  // Handle filter change
  const handleFilterChange = useCallback(async (newFilter: FilterType) => {
    setFilter(newFilter);

    if (mode === "guest" && !items) {
      if (newFilter === "following" && isAuthenticated()) {
        setPosts([]);
        await fetchPosts(undefined, "following");
      } else if (newFilter === "favorites" && isAuthenticated()) {
        setPosts([]);
        await fetchPosts(undefined, "favorites");
      } else if (newFilter === "all") {
        setPosts([]);
        // "all" filter: public posts + private posts from followed casts
        if (isAuthenticated()) {
          await fetchPosts(undefined, "all");
        } else {
          await fetchPosts();
        }
      }
    }
  }, [mode, items, isAuthenticated, fetchPosts, setPosts]);

  // Infinite scroll
  useEffect(() => {
    if (mode !== "guest" || items || !loadMoreRef.current || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          // Determine filter param for loadMore
          const filterParam = filter === "favorites" ? "favorites" :
            filter === "following" ? "following" :
            (filter === "all" && isAuthenticated()) ? "all" : undefined;
          loadMore(filterParam);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [mode, items, hasMore, loading, loadMore, filter]);

  // Convert API posts to FeedItem format
  const sourceFeed: FeedItem[] = items || posts.map(mapPostToFeedItem);

  // No client-side filtering needed - server handles following/favorites filtering
  const filteredFeed = sourceFeed;

  const isInitialLoading = loading && posts.length === 0;

  const renderEmptyState = () => {
    if (mode === "cast") return "No posts yet. Share something!";
    if (filter === "all") return "No posts yet.";
    if (filter === "following") return "You are not following anyone yet.";
    return "No favorites yet.";
  };

  return (
    <div className="space-y-4 py-4 min-h-screen">
      {mode === "guest" && (
        <TimelineFilters filter={filter} onChange={handleFilterChange} />
      )}

      <div className="space-y-6 px-4 pb-20">
        {isInitialLoading || (!items && !isLoaded) ? (
          <div className="py-10 text-center text-text-muted text-sm">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading...
          </div>
        ) : error ? (
          <div className="py-10 text-center text-error text-sm">
            Failed to load posts. Please try again.
          </div>
        ) : filteredFeed.length > 0 ? (
          <>
            {filteredFeed.map((item: FeedItem) => (
              <TimelineItem
                key={item.id}
                item={item}
                mode={mode}
                onDelete={onDelete}
                onToggleVisibility={onToggleVisibility}
                onClick={() => onItemClick?.(item.id)}
              />
            ))}
            {mode === "guest" && !items && hasMore && (
              <div ref={loadMoreRef} className="pt-4 text-center">
                {loading && (
                  <div className="flex items-center justify-center gap-2 text-text-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading...</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="py-10 text-center text-text-muted text-sm">
            {renderEmptyState()}
          </div>
        )}
      </div>
    </div>
  );
}
