"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { checkUsernameAvailability } from "@/modules/profile/hooks";
import { profileViewToSavePayload } from "@/modules/profile/lib/mappers";
import type { ProfileView, SaveProfilePayload } from "@/modules/profile/types";

interface PanelProps {
  profile: ProfileView;
  save: (payload: SaveProfilePayload) => Promise<unknown>;
}

export function AccountSettings({ profile, save }: PanelProps) {
  const [username, setUsername] = useState(profile.username);
  const [status, setStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(false);
    if (!username || username === profile.username) {
      setStatus(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        setStatus(await checkUsernameAvailability(username));
      } catch {
        setStatus(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username, profile.username]);

  const blocked = !!username && username !== profile.username && status !== null && !status.available;

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ ...profileViewToSavePayload(profile), username });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <FormField
        label="ユーザー名"
        htmlFor="username"
        error={blocked ? status?.message : undefined}
        hint={status?.available ? "使用できます" : undefined}
      >
        <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
      </FormField>
      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || blocked}>
          {saving ? "保存中…" : "保存"}
        </Button>
        {saved && <span className="text-sm text-accent">保存しました</span>}
      </div>
    </div>
  );
}
