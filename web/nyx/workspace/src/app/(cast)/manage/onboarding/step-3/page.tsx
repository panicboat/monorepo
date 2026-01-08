"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Calendar } from "lucide-react";
import { WeeklyShiftInput, Shift } from "@/modules/ritual/components/cast/WeeklyShiftInput";

export default function OnboardingStep3() {
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (shifts.length < 1) return;
    console.log("Submitting Schedule:", shifts);
    // TODO: Save to context/local storage/server
    router.push("/manage/onboarding/step-4"); // Assuming Step 4 is Review or Plans
  };

  const isNextEnabled = shifts.length >= 1;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-500">
      <div className="space-y-2">
        <h2 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm text-white">
            3
          </span>
          Initial Schedule
        </h2>
        <p className="text-sm text-slate-500">
          直近のスケジュールを登録しましょう。<br />
          あとからいつでも変更できます。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 p-4 text-xs font-bold text-blue-700">
            <Calendar size={16} />
            <span>最低1日以上の登録が必要です</span>
          </div>

          <WeeklyShiftInput shifts={shifts} onChange={setShifts} />
        </div>

        <button
          type="submit"
          disabled={!isNextEnabled}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 py-4 font-bold text-white shadow-lg shadow-pink-200 transition-all hover:bg-pink-600 hover:shadow-pink-300 disabled:bg-slate-300 disabled:shadow-none"
        >
          <span>Next Step: Review</span>
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
}
