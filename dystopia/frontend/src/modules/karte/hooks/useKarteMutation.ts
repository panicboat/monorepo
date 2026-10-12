"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { authFetch, type AuthFetchOptions } from "@/lib/auth/fetch";
import { useAuthStore } from "@/stores/authStore";

export function useKarteMutation<T>() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(false);
  const pending = useRef(false);
  const { mutate, cache } = useSWRConfig();

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const run = useCallback(async (url: string, options: AuthFetchOptions): Promise<T> => {
    if (pending.current) throw new Error("保存処理中です");
    pending.current = true;
    const { accountId, activeProfileId } = useAuthStore.getState();
    const isCurrent = () => mounted.current && useAuthStore.getState().accountId === accountId && useAuthStore.getState().activeProfileId === activeProfileId;
    setLoading(true);
    setError(null);
    try {
      const result = await authFetch<T>(url, options);
      if (!isCurrent()) throw new Error("操作元のプロフィールが変わりました");
      // SILENT: Read errors stay with SWR readers so a saved mutation is never retried as a failed save.
      await mutate((key) => typeof key === "string" && key.startsWith("/api/karte") && key !== "/api/karte/access", undefined, { revalidate: true, throwOnError: false });
      const infinitePrefix = unstable_serialize(() => "/api/karte");
      await Promise.all(Array.from(cache.keys()).filter((key) => key.startsWith(infinitePrefix)).map((key) => mutate(key, undefined, { revalidate: true, throwOnError: false })));
      if (!isCurrent()) throw new Error("操作元のプロフィールが変わりました");
      return result;
    } catch (cause) {
      const failure = cause instanceof Error ? cause : new Error("保存できませんでした");
      if (isCurrent()) setError(failure);
      throw failure;
    } finally {
      pending.current = false;
      if (mounted.current) setLoading(false);
    }
  }, [mutate, cache]);

  return { run, loading, error };
}
