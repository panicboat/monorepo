"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Tag as TagIcon } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useTaggings } from "../hooks/useTaggings";
import { TagPill } from "./TagPill";

interface GuestTagsDisplayProps {
  targetId: string;
}

export function GuestTagsDisplay({ targetId }: GuestTagsDisplayProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const { targetTaggings, fetchTargetTags, loading } = useTaggings();
  const [initialized, setInitialized] = useState(false);

  const loadData = useCallback(async () => {
    try {
      await fetchTargetTags(targetId);
    } catch (e) {
      console.error("Failed to load tags:", e);
    } finally {
      setInitialized(true);
    }
  }, [fetchTargetTags, targetId]);

  useEffect(() => {
    if (isHydrated && isAuthenticated()) {
      loadData();
    } else if (isHydrated) {
      setInitialized(true);
    }
  }, [isHydrated, isAuthenticated, loadData]);

  if (!initialized) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-text-muted" />
      </div>
    );
  }

  if (targetTaggings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {targetTaggings.map((tagging) => (
          <TagPill
            key={tagging.id}
            name={tagging.tagName}
            variant="guest"
          />
        ))}
      </div>
    </div>
  );
}
