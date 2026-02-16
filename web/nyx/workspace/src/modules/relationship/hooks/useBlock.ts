"use client";

import { useCallback, useState } from "react";
import { authFetch, getAuthToken } from "@/lib/auth";
import type { BlockedUser, BlockState } from "../types";

interface BlockResponse {
  success: boolean;
}

interface BlockListResponse {
  users: BlockedUser[];
  nextCursor: string;
  hasMore: boolean;
}

interface BlockStatusResponse {
  blocked: Record<string, boolean>;
}

export function useBlock() {
  const [blockState, setBlockState] = useState<BlockState>({});
  const [blockedList, setBlockedList] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);

  const block = useCallback(
    async (blockedId: string, blockedType: "guest" | "cast") => {
      if (!getAuthToken()) {
        console.warn("Cannot block: not authenticated");
        return false;
      }

      setLoading(true);
      try {
        const data = await authFetch<BlockResponse>("/api/guest/blocks", {
          method: "POST",
          body: { blockedId, blockedType },
        });

        if (data.success) {
          setBlockState((prev) => ({ ...prev, [blockedId]: true }));
        }
        return data.success;
      } catch (e) {
        console.error("Block error:", e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const unblock = useCallback(async (blockedId: string) => {
    if (!getAuthToken()) {
      console.warn("Cannot unblock: not authenticated");
      return false;
    }

    setLoading(true);
    try {
      const data = await authFetch<BlockResponse>(
        `/api/guest/blocks?blocked_id=${blockedId}`,
        { method: "DELETE" }
      );

      if (data.success) {
        setBlockState((prev) => ({ ...prev, [blockedId]: false }));
        setBlockedList((prev) => prev.filter((u) => u.id !== blockedId));
      }
      return data.success;
    } catch (e) {
      console.error("Unblock error:", e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleBlock = useCallback(
    async (blockedId: string, blockedType: "guest" | "cast" = "cast") => {
      return blockState[blockedId]
        ? unblock(blockedId)
        : block(blockedId, blockedType);
    },
    [block, unblock, blockState]
  );

  const fetchBlockedList = useCallback(async (limit: number = 50) => {
    if (!getAuthToken()) {
      console.warn("Cannot fetch blocked list: not authenticated");
      return [];
    }

    setLoading(true);
    try {
      const data = await authFetch<BlockListResponse>(
        `/api/guest/blocks?limit=${limit}`
      );

      const users = data.users || [];
      setBlockedList(users);

      const newState: BlockState = {};
      users.forEach((user) => {
        newState[user.id] = true;
      });
      setBlockState((prev) => ({ ...prev, ...newState }));

      return users;
    } catch (e) {
      console.error("Fetch blocked list error:", e);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBlockStatus = useCallback(async (userIds: string[]) => {
    if (userIds.length === 0) return {};

    try {
      const data = await authFetch<BlockStatusResponse>(
        `/api/guest/blocks/status?user_ids=${userIds.join(",")}`,
        { requireAuth: false }
      );

      setBlockState((prev) => ({
        ...prev,
        ...data.blocked,
      }));

      return data.blocked;
    } catch (e) {
      console.error("Fetch block status error:", e);
      return {};
    }
  }, []);

  const isBlocking = useCallback(
    (userId: string) => blockState[userId] ?? false,
    [blockState]
  );

  return {
    block,
    unblock,
    toggleBlock,
    fetchBlockedList,
    fetchBlockStatus,
    isBlocking,
    blockedList,
    loading,
  };
}
