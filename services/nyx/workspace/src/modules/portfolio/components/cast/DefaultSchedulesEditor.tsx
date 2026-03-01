"use client";

import { Plus, Trash2, Clock } from "lucide-react";
import { DefaultSchedule } from "@/modules/portfolio/types";

interface DefaultSchedulesEditorProps {
  schedules: DefaultSchedule[];
  onChange: (schedules: DefaultSchedule[]) => void;
}

export const DefaultSchedulesEditor = ({
  schedules,
  onChange,
}: DefaultSchedulesEditorProps) => {
  const addSchedule = () => {
    onChange([...schedules, { start: "18:00", end: "23:00" }]);
  };

  const updateSchedule = (index: number, field: keyof DefaultSchedule, value: string) => {
    const newSchedules = [...schedules];
    newSchedules[index] = { ...newSchedules[index], [field]: value };
    onChange(newSchedules);
  };

  const removeSchedule = (index: number) => {
    if (schedules.length <= 1) return;
    onChange(schedules.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-secondary">
          デフォルトスケジュール
        </label>
        <button
          type="button"
          onClick={addSchedule}
          className="flex items-center gap-1 rounded-lg bg-role-cast-lighter px-3 py-1.5 text-xs font-bold text-role-cast transition-colors hover:bg-role-cast-light border border-role-cast-light"
        >
          <Plus size={14} />
          <span>追加</span>
        </button>
      </div>

      <div className="space-y-2">
        {schedules.map((schedule, index) => (
          <div
            key={index}
            className="flex items-center gap-2 rounded-lg bg-surface border border-border p-3"
          >
            <Clock size={16} className="text-text-muted shrink-0" />
            <span className="text-sm text-text-muted w-6">{index + 1}.</span>
            <input
              type="time"
              value={schedule.start}
              onChange={(e) => updateSchedule(index, "start", e.target.value)}
              className="bg-surface-secondary font-medium text-text-secondary focus:outline-none focus:ring-2 focus:ring-role-cast text-sm border border-border rounded px-2 py-1.5 w-28"
            />
            <span className="text-text-muted">〜</span>
            <input
              type="time"
              value={schedule.end}
              onChange={(e) => updateSchedule(index, "end", e.target.value)}
              className="bg-surface-secondary font-medium text-text-secondary focus:outline-none focus:ring-2 focus:ring-role-cast text-sm border border-border rounded px-2 py-1.5 w-28"
            />
            {schedules.length > 1 && (
              <button
                type="button"
                onClick={() => removeSchedule(index)}
                className="ml-auto rounded-lg p-1.5 text-text-muted hover:bg-error-lighter hover:text-error transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-text-muted">
        新規スケジュール追加時にこの時間帯がデフォルトとして設定されます
      </p>
    </div>
  );
};
