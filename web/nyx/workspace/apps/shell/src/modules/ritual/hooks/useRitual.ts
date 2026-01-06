"use client";

import { useState, useCallback } from "react";

export type RitualStatus = "idle" | "pledging" | "sealed" | "error";

export const useRitual = (ritualId: string) => {
  const [status, setStatus] = useState<RitualStatus>("idle");

  // Mock server action
  const seal = useCallback(async () => {
    // In a real app, this would call an API endoint (e.g., POST /api/rituals/:id/seal)
    // For now, we simulate network latency and success
    console.log(`Sealing ritual ${ritualId}...`);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        setStatus("sealed");
        console.log(`Ritual ${ritualId} sealed.`);
        resolve();
      }, 500); // Simulate subtle delay for "weight" of the action
    });
  }, [ritualId]);

  const reset = useCallback(() => {
    setStatus("idle");
  }, []);

  return {
    status,
    setStatus, // Exporting setter for UI "pressing" state management if needed locally
    seal,
    reset
  };
};
