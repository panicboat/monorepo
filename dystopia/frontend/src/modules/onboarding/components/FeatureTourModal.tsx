"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { hasSeenFeatureTour, markFeatureTourSeen } from "@/modules/onboarding/lib/feature-tour-storage";

export interface FeatureItem {
  key: string;
  icon: string;
  label: string;
  description: string;
}

export const FEATURES: FeatureItem[] = [
  { key: "home", icon: "🏠", label: "ホーム", description: "フォロー中のアカウントの投稿が並ぶタイムライン" },
  { key: "search", icon: "🔍", label: "検索", description: "ユーザーや投稿をキーワードで検索" },
  { key: "notifications", icon: "🔔", label: "通知", description: "いいね・コメントなどのお知らせ" },
  { key: "footprints", icon: "👣", label: "足跡", description: "プロフィールを見に来た人の一覧" },
  { key: "messages", icon: "💬", label: "メッセージ", description: "個別のダイレクトメッセージ" },
  { key: "bookmarks", icon: "🔖", label: "ブックマーク", description: "保存した投稿の一覧" },
  { key: "ranking", icon: "🏆", label: "ランキング", description: "期間別の人気投稿ランキング" },
  { key: "profile", icon: "👤", label: "プロフィール", description: "自分のプロフィールの確認・編集" },
  { key: "settings", icon: "⚙", label: "設定", description: "アカウント・プライバシーなどの設定" },
  { key: "karte", icon: "📋", label: "カルテ（キャスト向け・有料機能）", description: "ゲストについて書いたレビューの管理・共有" },
];

// Single source of truth for header descriptions so the tour and in-page page headers can't drift apart.
export function getFeatureDescription(key: string): string {
  const feature = FEATURES.find((f) => f.key === key);
  if (!feature) throw new Error(`Unknown feature key: ${key}`);
  return feature.description;
}

export function FeatureTourList() {
  return (
    <div className="flex flex-col gap-3 overflow-y-auto px-4 py-4">
      {FEATURES.map((f) => (
        <div key={f.label} className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden="true">{f.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-text-primary">{f.label}</p>
            <p className="text-sm text-text-secondary">{f.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeatureTourModal() {
  const [open, setOpen] = useState(() => !hasSeenFeatureTour());

  const close = () => {
    markFeatureTourSeen();
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-surface">
          <div className="border-b border-divider px-4 py-3">
            <Dialog.Title className="text-base font-bold text-text-primary">できること</Dialog.Title>
          </div>

          <FeatureTourList />

          <div className="flex justify-end border-t border-divider px-4 py-3">
            <Button variant="primary" size="sm" onClick={close}>
              はじめる
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
