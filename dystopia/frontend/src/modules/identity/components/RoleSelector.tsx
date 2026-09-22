export interface RoleSelectorProps {
  value: 1 | 2;
  onChange: (role: 1 | 2) => void;
}

const ROLES = [
  { value: 1 as const, label: "ゲスト", description: "女性と遊びたい方" },
  { value: 2 as const, label: "キャスト", description: "働いて稼ぎたい方" },
];

export function RoleSelector({ value, onChange }: RoleSelectorProps) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-text-primary">
        登録種別
      </legend>
      <div className="space-y-2">
        {ROLES.map((role) => (
          <label
            key={role.value}
            className="flex cursor-pointer flex-col gap-0.5 rounded-md border border-border p-3 has-[:checked]:border-accent"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-text-primary has-[:checked]:text-accent">
              <input
                type="radio"
                name="role"
                value={role.value}
                checked={value === role.value}
                onChange={() => onChange(role.value)}
                className="sr-only"
              />
              {role.label}
            </span>
            <span className="text-xs text-text-secondary">
              {role.description}
            </span>
          </label>
        ))}
      </div>
      <p className="text-xs text-text-muted">
        ※ 登録後にゲスト/キャストを変更することはできません
      </p>
    </fieldset>
  );
}
