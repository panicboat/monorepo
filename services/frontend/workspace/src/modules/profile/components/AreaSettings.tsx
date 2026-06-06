"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AreaAccordion } from "@/modules/profile/components/AreaAccordion";
import { useAreas } from "@/modules/profile/hooks";
import { profileViewToSavePayload } from "@/modules/profile/lib/mappers";
import type { ProfileView, SaveProfilePayload } from "@/modules/profile/types";

interface PanelProps {
  profile: ProfileView;
  save: (payload: SaveProfilePayload) => Promise<unknown>;
}

export function AreaSettings({ profile, save }: PanelProps) {
  const { areas, loading } = useAreas();
  const [selectedIds, setSelectedIds] = useState<string[]>(profile.areas.map((a) => a.id));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await save({ ...profileViewToSavePayload(profile), areaIds: selectedIds });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 py-4">
      <p className="text-sm text-text-secondary">活動エリアを設定してください</p>
      {loading ? (
        <p className="text-sm text-text-muted">読み込み中…</p>
      ) : (
        <AreaAccordion areas={areas} selectedIds={selectedIds} onChange={setSelectedIds} max={2} />
      )}
      <div className="flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "保存中…" : "保存"}
        </Button>
        {saved && <span className="text-sm text-accent">保存しました</span>}
      </div>
    </div>
  );
}
