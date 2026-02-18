"use client";

import { useCallback, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import type { Tag } from "../types";

interface CreateTagResponse {
  success: boolean;
  tag: Tag;
}

interface ListTagsResponse {
  tags: Tag[];
}

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTags = useCallback(async () => {
    if (!getAuthToken()) return [];

    setLoading(true);
    try {
      const data = await authFetch<ListTagsResponse>("/api/me/trust/tags");
      setTags(data.tags || []);
      return data.tags || [];
    } catch (e) {
      console.error("Fetch tags error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const createTag = useCallback(async (name: string) => {
    if (!getAuthToken()) return null;

    setLoading(true);
    try {
      const data = await authFetch<CreateTagResponse>("/api/me/trust/tags", {
        method: "POST",
        body: { name },
      });

      if (data.success && data.tag) {
        setTags((prev) => [...prev, data.tag]);
      }
      return data;
    } catch (e) {
      console.error("Create tag error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTag = useCallback(async (id: string) => {
    if (!getAuthToken()) return false;

    setLoading(true);
    try {
      const data = await authFetch<{ success: boolean }>(
        `/api/me/trust/tags/${id}`,
        { method: "DELETE" }
      );

      if (data.success) {
        setTags((prev) => prev.filter((tag) => tag.id !== id));
      }
      return data.success;
    } catch (e) {
      console.error("Delete tag error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { tags, fetchTags, createTag, deleteTag, loading };
}
