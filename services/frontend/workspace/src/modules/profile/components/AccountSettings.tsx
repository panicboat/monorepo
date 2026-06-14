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
  const [fetchedStatus, setFetchedStatus] = useState<{ available: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  // Derive `saved` from the last saved username instead of a separate state.
  // WHY: react-hooks/set-state-in-effect forbids resetting `saved` from the
  // username-watch effect; tracking the saved username lets `saved` flip back
  // to false automatically whenever the user edits the input.
  const [lastSavedUsername, setLastSavedUsername] = useState<string | null>(null);
  const saved = lastSavedUsername !== null && lastSavedUsername === username;

  // Treat the fetched status as null whenever the input is empty or unchanged
  // from the persisted username; deriving here avoids a synchronous setState
  // inside the debounce effect, which react-hooks/set-state-in-effect forbids.
  const isUsernameDirty = !!username && username !== profile.username;
  const status = isUsernameDirty ? fetchedStatus : null;

  useEffect(() => {
    if (!username || username === profile.username) {
      return;
    }
    const t = setTimeout(async () => {
      try {
        setFetchedStatus(await checkUsernameAvailability(username));
      } catch {
        setFetchedStatus(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [username, profile.username]);

  const blocked = isUsernameDirty && status !== null && !status.available;

  const handleSave = async () => {
    setSaving(true);
    try {
      await save({ ...profileViewToSavePayload(profile), username });
      setLastSavedUsername(username);
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
