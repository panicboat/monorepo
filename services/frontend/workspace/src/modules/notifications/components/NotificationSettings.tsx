"use client";

import { useNotificationPreferences } from "@/modules/notifications/hooks/useNotificationPreferences";
import { Toggle } from "@/components/ui/toggle";
import type { NotificationPreferences } from "@/modules/notifications/types";

type ToggleField = keyof NotificationPreferences;

interface Row {
  field: ToggleField;
  label: string;
  description?: string;
}

const PUSH_TYPE_ROWS: Row[] = [
  { field: "post", label: "ポスト" },
  { field: "like", label: "いいね" },
  { field: "repost", label: "リポスト" },
  { field: "quote", label: "引用" },
  { field: "reply", label: "リプライ" },
  { field: "follow", label: "フォロー" },
  { field: "mention", label: "メンション" },
  { field: "message", label: "メッセージ" },
  { field: "oshi", label: "推し！" },
];

export function NotificationSettings() {
  const { preferences, loading, updating, error, update } = useNotificationPreferences();

  if (loading) {
    return <div className="py-4 text-sm text-text-secondary">読み込み中…</div>;
  }
  if (error) {
    return <div className="py-4 text-sm text-text-secondary">通知設定を取得できませんでした。</div>;
  }

  const onToggle = (field: ToggleField) => (value: boolean) => {
    void update({ [field]: value } as Partial<NotificationPreferences>);
  };

  return (
    <div className="flex flex-col gap-6 py-4">
      <section className="flex flex-col gap-3">
        <ToggleRow
          label="プッシュ通知を受け取る"
          description="オフにするとすべての種別の通知が届きません"
          checked={preferences.pushEnabled}
          onCheckedChange={onToggle("pushEnabled")}
          disabled={updating}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-text-secondary">プッシュ通知の個別設定</h2>
        {PUSH_TYPE_ROWS.map((row) => (
          <ToggleRow
            key={row.field}
            label={row.label}
            checked={preferences[row.field]}
            onCheckedChange={onToggle(row.field)}
            disabled={updating || !preferences.pushEnabled}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-text-secondary">その他</h2>
        <ToggleRow
          label="足跡の未読バッジ"
          description="新しい足跡があるときバッジを表示します"
          checked={preferences.footprintUnreadBadge}
          onCheckedChange={onToggle("footprintUnreadBadge")}
          disabled={updating}
        />
      </section>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ label, description, checked, onCheckedChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-text-primary">{label}</span>
        {description && <span className="text-xs text-text-muted">{description}</span>}
      </div>
      <Toggle
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}
