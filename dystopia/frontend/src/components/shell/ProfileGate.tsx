"use client";

import { Button } from "@/components/ui/button";

export interface ProfileGateProps {
  reason: "error" | "unavailable";
  onRetry: () => void;
}

const messages = {
  error: {
    heading: "プロフィールを読み込めませんでした",
    body: "通信状況を確認して、もう一度お試しください。",
  },
  unavailable: {
    heading: "このプロフィールは利用できません",
    body: "時間をおいて、もう一度お試しください。",
  },
} as const;

export function ProfileGate({ reason, onRetry }: ProfileGateProps) {
  const { heading, body } = messages[reason];

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-text-primary">{heading}</h1>
        <p className="mb-8 text-center text-sm text-text-secondary">{body}</p>
        <Button type="button" className="w-full" onClick={onRetry}>
          再試行
        </Button>
      </div>
    </main>
  );
}
