"use client";

import { useCallback, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import type { Tagging, PendingTagging } from "../types";

interface ListTargetTagsResponse {
  taggings: Tagging[];
}

interface AddTaggingResponse {
  success: boolean;
  status: string;
}

interface ListPendingResponse {
  taggings: PendingTagging[];
  nextCursor: string;
  hasMore: boolean;
}

export function useTaggings() {
  const [targetTaggings, setTargetTaggings] = useState<Tagging[]>([]);
  const [pendingTaggings, setPendingTaggings] = useState<PendingTagging[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTargetTags = useCallback(async (targetId: string) => {
    if (!getAuthToken()) return [];

    setLoading(true);
    try {
      const data = await authFetch<ListTargetTagsResponse>(
        `/api/me/trust/taggings?target_id=${targetId}`
      );
      setTargetTaggings(data.taggings || []);
      return data.taggings || [];
    } catch (e) {
      console.error("Fetch target tags error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const addTagging = useCallback(async (tagId: string, targetId: string) => {
    if (!getAuthToken()) return null;

    setLoading(true);
    try {
      const data = await authFetch<AddTaggingResponse>(
        "/api/me/trust/taggings",
        { method: "POST", body: { tagId, targetId } }
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

  const fetchPendingTaggings = useCallback(async (limit: number = 20) => {
    if (!getAuthToken()) return { taggings: [], hasMore: false };

    setLoading(true);
    try {
      const data = await authFetch<ListPendingResponse>(
        `/api/cast/trust/taggings/pending?limit=${limit}`
      );
      setPendingTaggings(data.taggings || []);
      return data;
    } catch (e) {
      console.error("Fetch pending taggings error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const approveTagging = useCallback(async (id: string) => {
    if (!getAuthToken()) return false;

    try {
      const data = await authFetch<{ success: boolean }>(
        `/api/cast/trust/taggings/${id}/approve`,
        { method: "POST" }
      );

      if (data.success) {
        setPendingTaggings((prev) => prev.filter((t) => t.id !== id));
      }
      return data.success;
    } catch (e) {
      console.error("Approve tagging error:", e);
      throw e;
    }
  }, []);

  const rejectTagging = useCallback(async (id: string) => {
    if (!getAuthToken()) return false;

    try {
      const data = await authFetch<{ success: boolean }>(
        `/api/cast/trust/taggings/${id}/reject`,
        { method: "POST" }
      );

      if (data.success) {
        setPendingTaggings((prev) => prev.filter((t) => t.id !== id));
      }
      return data.success;
    } catch (e) {
      console.error("Reject tagging error:", e);
      throw e;
    }
  }, []);

  return {
    targetTaggings,
    pendingTaggings,
    fetchTargetTags,
    addTagging,
    removeTagging,
    fetchPendingTaggings,
    approveTagging,
    rejectTagging,
    loading,
  };
}
