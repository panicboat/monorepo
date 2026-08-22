"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { profileViewToSavePayload } from "@/modules/profile/lib/mappers";
import type { ProfileView, SaveProfilePayload } from "@/modules/profile/types";

interface PanelProps {
  profile: ProfileView;
  save: (payload: SaveProfilePayload) => Promise<unknown>;
}

export function PrivacySettings({ profile, save }: PanelProps) {
  const [isPrivate, setIsPrivate] = useState(profile.isPrivate);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
          <span className="text-sm font-medium text-text-primary">鍵アカウント</span>
          <span className="text-xs text-text-muted">フォローを承認した人だけが閲覧できます</span>
        </div>
        <Toggle checked={isPrivate} onCheckedChange={setIsPrivate} aria-label="鍵アカウント" />
      </div>
      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </Button>
        {saved && <span className="text-sm text-accent">保存しました</span>}
      </div>
    </div>
  );
}
