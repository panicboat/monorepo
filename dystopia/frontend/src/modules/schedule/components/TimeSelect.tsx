const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const STEP_MINUTES = ["00", "15", "30", "45"];

export interface TimeSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function TimeSelect({ label, value, onChange }: TimeSelectProps) {
  const [hour = "", minute = ""] = value ? value.split(":") : [];
  // Keep a stored minute that is off the 15-minute step selectable: reopening an entry must not change its time.
  const minutes = !minute || STEP_MINUTES.includes(minute) ? STEP_MINUTES : [...STEP_MINUTES, minute].sort();
  const selectClass = "rounded border border-border bg-bg px-2 py-1 text-sm text-text-primary";

  return (
    <span className="flex items-center gap-1">
      <select
        value={hour}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}:${minute || "00"}` : "")}
        aria-label={`${label}（時）`}
        className={selectClass}
      >
        <option value="">--</option>
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-text-secondary">:</span>
      <select
        value={minute}
        onChange={(e) => onChange(`${hour}:${e.target.value}`)}
        disabled={!hour}
        aria-label={`${label}（分）`}
        className={`${selectClass} disabled:opacity-50`}
      >
        {!hour && <option value="">--</option>}
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </span>
  );
}
