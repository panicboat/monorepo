"use client";

import { useCallback, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import type { Tagging } from "../types";

interface ListTargetTagsResponse {
  taggings: Tagging[];
}

interface AddTaggingResponse {
  success: boolean;
}

export function useTaggings() {
  const [targetTaggings, setTargetTaggings] = useState<Tagging[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTargetTags = useCallback(async (targetId: string) => {
    // FALLBACK: Returns empty array when not authenticated
    if (!getAuthToken()) return [];

    setLoading(true);
    try {
      const data = await authFetch<ListTargetTagsResponse>(
        `/api/me/trust/taggings?target_id=${targetId}`
      );
      // FALLBACK: Returns empty array when response field is missing
      setTargetTaggings(data.taggings || []);
      return data.taggings || [];
    } catch (e) {
      console.error("Fetch target tags error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const addTagging = useCallback(async (tagName: string, targetId: string) => {
    // FALLBACK: Returns null when not authenticated
    if (!getAuthToken()) return null;

    setLoading(true);
    try {
      const data = await authFetch<AddTaggingResponse>(
        "/api/me/trust/taggings",
        { method: "POST", body: { tagName, targetId } }
      );
      return data;
    } catch (e) {
      console.error("Add tagging error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeTagging = useCallback(async (id: string) => {
    // FALLBACK: Returns false when not authenticated
    if (!getAuthToken()) return false;

    setLoading(true);
    try {
      const data = await authFetch<{ success: boolean }>(
        `/api/me/trust/taggings/${id}`,
        { method: "DELETE" }
      );

      if (data.success) {
        setTargetTaggings((prev) => prev.filter((t) => t.id !== id));
      }
      return data.success;
    } catch (e) {
      console.error("Remove tagging error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    targetTaggings,
    fetchTargetTags,
    addTagging,
    removeTagging,
    loading,
  };
}
