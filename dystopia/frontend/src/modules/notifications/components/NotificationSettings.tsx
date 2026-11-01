"use client";

import { useNotificationPreferences } from "@/modules/notifications/hooks/useNotificationPreferences";
import { usePushDevice, type PushDeviceState } from "@/modules/notifications/hooks/usePushDevice";
import { Toggle } from "@/components/ui/toggle";
import type { NotificationPreferences } from "@/modules/notifications/types";

type ToggleField = keyof NotificationPreferences;

interface Row {
  field: ToggleField;
  label: string;
}

const PUSH_TYPE_ROWS: Row[] = [
  { field: "like", label: "いいね" },
  { field: "comment", label: "コメント" },
  { field: "reply", label: "リプライ" },
  { field: "mention", label: "メンション" },
  { field: "quote", label: "引用" },
  { field: "follow", label: "フォロー" },
  { field: "message", label: "メッセージ" },
];

const DEVICE_NOTES: Partial<Record<PushDeviceState, string>> = {
  unsupported: "この端末では受け取れません",
  "needs-install": "ホーム画面に追加すると受け取れます",
  denied: "ブラウザの設定で通知を許可してください",
  unconfigured: "この環境では受け取れません",
};

export function NotificationSettings() {
  const { preferences, loading, updating, error, update } = useNotificationPreferences();
  const device = usePushDevice();

  if (loading) {
    return <div className="py-4 text-sm text-text-secondary">読み込み中…</div>;
  }
  if (error) {
    return <div className="py-4 text-sm text-text-secondary">通知設定を取得できませんでした。</div>;
  }

  const onToggle = (field: ToggleField) => (value: boolean) => {
    void update({ [field]: value } as Partial<NotificationPreferences>);
  };
  const deviceSwitchable = device.state === "on" || device.state === "off";

  return (
    <div className="flex flex-col gap-6 py-4">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-text-secondary">この端末</h2>
        <ToggleRow
          label="この端末で受け取る"
          description={DEVICE_NOTES[device.state] ?? "オンにすると、このプロフィール宛ての通知がこの端末に届きます"}
          checked={device.state === "on"}
          onCheckedChange={(value) => void (value ? device.enable() : device.disable())}
          disabled={device.busy || !deviceSwitchable}
        />
        {device.failed && <p className="text-xs text-text-secondary">端末の設定を変更できませんでした</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-text-secondary">端末に送る通知</h2>
        <p className="text-xs text-text-muted">アプリ内の通知一覧には、設定に関係なくすべて表示されます。メッセージは通知一覧には載らず、「メッセージ」の未読件数でお知らせします</p>
        {PUSH_TYPE_ROWS.map((row) => (
          <ToggleRow
            key={row.field}
            label={row.label}
            checked={preferences[row.field]}
            onCheckedChange={onToggle(row.field)}
            disabled={updating}
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
        <ToggleRow
          label="他人のプロフィール訪問時に足跡を残す"
          description="オフにすると訪問先のユーザーに自分の足跡が残りません"
          checked={preferences.footprintsRecordMyVisits}
          onCheckedChange={onToggle("footprintsRecordMyVisits")}
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
