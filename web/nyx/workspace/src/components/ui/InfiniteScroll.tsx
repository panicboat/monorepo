"use client";

import { useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";

interface InfiniteScrollProps {
  /** 追加データがあるか */
  hasMore: boolean;
  /** 追加読み込み中か */
  loading: boolean;
  /** 追加読み込み関数 */
  onLoadMore: () => void;
  /** IntersectionObserver の rootMargin (default: "100px") */
  rootMargin?: string;
  /** 終端メッセージ (optional) */
  endMessage?: string;
  /** children */
  children: React.ReactNode;
}

export function InfiniteScroll({
  hasMore,
  loading,
  onLoadMore,
  rootMargin = "100px",
  endMessage,
  children,
}: InfiniteScrollProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loading) {
        onLoadMore();
      }
    },
    [hasMore, loading, onLoadMore]
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleObserver, {
      rootMargin,
    });
    observer.observe(element);

    return () => observer.disconnect();
  }, [handleObserver, rootMargin]);

  return (
    <>
      {children}

      {/* Load more trigger */}
      <div ref={loadMoreRef} className="h-4" />

      {loading && (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
        </div>
      )}

      {!hasMore && !loading && endMessage && (
        <div className="text-center py-4 text-sm text-text-muted">
          {endMessage}
        </div>
      )}
    </>
  );
}
