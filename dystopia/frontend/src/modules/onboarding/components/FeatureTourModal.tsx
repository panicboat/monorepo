"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FEATURE_ICONS } from "@/components/ui/feature-icons";
import { hasSeenFeatureTour, markFeatureTourSeen } from "@/modules/onboarding/lib/feature-tour-storage";

export interface FeatureItem {
  key: string;
  icon: LucideIcon;
  label: string;
  description: string;
}

// Keep descriptions centralized so the tour and page headers cannot drift.
export const FEATURES: FeatureItem[] = [
  { key: "home", icon: FEATURE_ICONS.home, label: "ホーム", description: "フォロー中のアカウントの投稿が並ぶタイムライン" },
  { key: "search", icon: FEATURE_ICONS.search, label: "検索", description: "ユーザーや投稿をキーワードで検索" },
  { key: "notifications", icon: FEATURE_ICONS.notifications, label: "通知", description: "いいね・コメントなどのお知らせ" },
  { key: "footprints", icon: FEATURE_ICONS.footprints, label: "足跡", description: "プロフィールを見に来た人の一覧" },
  { key: "messages", icon: FEATURE_ICONS.messages, label: "メッセージ", description: "個別のダイレクトメッセージ" },
  { key: "bookmarks", icon: FEATURE_ICONS.bookmarks, label: "ブックマーク", description: "保存した投稿の一覧" },
  { key: "ranking", icon: FEATURE_ICONS.ranking, label: "ランキング", description: "期間別の人気投稿ランキング" },
  { key: "profile", icon: FEATURE_ICONS.profile, label: "プロフィール", description: "自分のプロフィールの確認・編集" },
  { key: "settings", icon: FEATURE_ICONS.settings, label: "設定", description: "アカウント・プライバシーなどの設定" },
  { key: "karte", icon: FEATURE_ICONS.karte, label: "カルテ（キャスト向け・有料機能）", description: "ゲストについて書いたレビューの管理・共有" },
];

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
          <f.icon className="mt-0.5 size-6 shrink-0 text-text-secondary" />
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
