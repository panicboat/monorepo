"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, List } from "lucide-react";
import {
  PlanEditor,
  ServicePlan,
} from "@/modules/portfolio/components/cast/PlanEditor";

import { useOnboarding } from "../context";

export default function OnboardingStep3() {
  const router = useRouter();
  const { data, setPlans, savePlans, loading } = useOnboarding();
  const [plans, setPlansState] = useState<ServicePlan[]>(data.plans);

  // Sync plans from context when data is loaded
  useEffect(() => {
    if (!loading && data.plans.length > 0) {
      setPlansState(data.plans);
    }
  }, [loading, data.plans]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Save to context and backend
    setPlans(plans);
    await savePlans(plans);
    router.push("/cast/onboarding/step-4");
  };

  const isNextEnabled = plans.every(
    (p) => p.name.trim() !== "" && p.price > 0 && p.duration > 0,
  );

  return (
    <div className="px-4 py-6 space-y-6 animate-in slide-in-from-right-8 fade-in duration-500">
      <div className="space-y-2">
        <h2 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm text-white">
            3
          </span>
          Service Plans (Optional)
        </h2>
        <p className="text-sm text-slate-500">
          提供するサービスプランを設定しましょう。
          <br />
          設定しない場合はスキップできます。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 p-4 text-xs font-bold text-blue-700">
            <List size={16} />
            <span>プランの登録は任意です</span>
          </div>

          <PlanEditor plans={plans} onChange={setPlansState} />
        </div>

        <button
          type="submit"
          disabled={!isNextEnabled}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 py-4 font-bold text-white shadow-lg shadow-pink-200 transition-all hover:bg-pink-600 hover:shadow-pink-300 disabled:bg-slate-300 disabled:shadow-none"
        >
          <span>Next Step: Initial Schedule</span>
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
}
