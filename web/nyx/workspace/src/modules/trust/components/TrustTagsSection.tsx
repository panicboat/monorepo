"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Tag as TagIcon } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useToast } from "@/components/ui/Toast";
import { useMyTagNames } from "../hooks/useMyTagNames";
import { useTaggings } from "../hooks/useTaggings";
import { TagPill } from "./TagPill";
import { TagSelector } from "./TagSelector";

interface TrustTagsSectionProps {
  targetId: string;
}

export function TrustTagsSection({ targetId }: TrustTagsSectionProps) {
  const { toast } = useToast();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);

  const { tagNames } = useMyTagNames();
  const {
    targetTaggings,
    fetchTargetTags,
    addTagging,
    removeTagging,
    loading: taggingsLoading,
  } = useTaggings();

  const [initialized, setInitialized] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [addingTag, setAddingTag] = useState(false);

  const loadData = useCallback(async () => {
    try {
      await fetchTargetTags(targetId);
    } catch (e) {
      console.error("Failed to load trust data:", e);
    } finally {
      setInitialized(true);
    }
  }, [fetchTargetTags, targetId]);

  useEffect(() => {
    if (isHydrated && isAuthenticated()) {
      loadData();
    }
  }, [isHydrated, isAuthenticated, loadData]);

  const handleAdd = async (tagName: string) => {
    setAddingTag(true);
    try {
      await addTagging(tagName, targetId);
      await fetchTargetTags(targetId);
      toast({
        title: "タグを追加しました",
        variant: "success",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "タグの追加に失敗しました";
      toast({
        title: "エラー",
        description: message,
        variant: "destructive",
      });
    } finally {
      setAddingTag(false);
    }
  };

  const handleRemove = async (taggingId: string) => {
    setRemovingIds((prev) => new Set([...prev, taggingId]));
    try {
      await removeTagging(taggingId);
      toast({
        title: "タグを解除しました",
        variant: "success",
      });
    } catch (e) {
      console.error("Failed to remove tagging:", e);
      toast({
        title: "エラー",
        description: "タグの解除に失敗しました",
        variant: "destructive",
      });
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(taggingId);
        return next;
      });
    }
  };

  if (!isHydrated || !isAuthenticated()) {
    return null;
  }

  if (!initialized) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      </div>
    );
  }

  const appliedTagNames = targetTaggings.map((t) => t.tagName);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <TagIcon className="h-4 w-4 text-text-muted" />
        <h4 className="text-sm font-bold text-text-primary">ノートタグ</h4>
      </div>

      {/* Tags */}
      {targetTaggings.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {targetTaggings.map((tagging) => (
            <TagPill
              key={tagging.id}
              name={tagging.tagName}
              onRemove={() => handleRemove(tagging.id)}
              removing={removingIds.has(tagging.id)}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {targetTaggings.length === 0 && (
        <p className="text-sm text-text-muted">タグはまだありません</p>
      )}

      {/* Tag selector */}
      <TagSelector
        suggestions={tagNames}
        appliedTagNames={appliedTagNames}
        onAdd={handleAdd}
        loading={addingTag || taggingsLoading}
      />
    </div>
  );
}
