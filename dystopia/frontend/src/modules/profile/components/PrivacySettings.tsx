"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { profileViewToSavePayload } from "@/modules/profile/lib/mappers";
import { useAccountProfiles } from "@/modules/profile/context/AccountProfilesContext";
import type { ProfileView, SaveProfilePayload } from "@/modules/profile/types";

interface PanelProps {
  profile: ProfileView;
  save: (payload: SaveProfilePayload) => Promise<unknown>;
}

export function PrivacySettings({ profile, save }: PanelProps) {
  const [isPrivate, setIsPrivate] = useState(profile.isPrivate);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { profiles } = useAccountProfiles();

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await save({ ...profileViewToSavePayload(profile), isPrivate });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-text-primary">プロフィールに鍵をかける</span>
          <span className="text-xs text-text-muted">
            @{profile.username} の設定です。フォローを承認した人だけが閲覧できます
          </span>
        </div>
        <Toggle checked={isPrivate} onCheckedChange={setIsPrivate} aria-label="プロフィールに鍵をかける" />
      </div>
      {profiles.length > 1 && (
        <p className="text-xs text-text-muted">
          鍵はプロフィールごとの設定です。ほかのプロフィールは、切り替えてから設定してください。
        </p>
      )}
      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </Button>
        {saved && <span className="text-sm text-accent">保存しました</span>}
      </div>
      <Button asChild variant="secondary" size="sm" className="self-start">
        <Link href="/settings/blocks">ブロックしたアカウント</Link>
      </Button>
    </div>
  );
}
