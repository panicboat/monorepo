"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, List } from "lucide-react";
import {
  PlanEditor,
  ServicePlan,
} from "@/modules/portfolio/components/cast/PlanEditor";
import { useOnboardingStore, PlanData } from "@/stores/onboarding";

export default function OnboardingStep3() {
  const router = useRouter();

  // Zustand store
  const plans = useOnboardingStore((s) => s.plans);
  const setPlans = useOnboardingStore((s) => s.setPlans);
  const savePlans = useOnboardingStore((s) => s.savePlans);
  const loading = useOnboardingStore((s) => s.loading);
  const initialized = useOnboardingStore((s) => s.initialized);
  const fetchProfile = useOnboardingStore((s) => s.fetchProfile);

  // Initialize data on mount
  useEffect(() => {
    if (!initialized) {
      fetchProfile();
    }
  }, [initialized, fetchProfile]);

  // Convert PlanData[] to ServicePlan[]
  const plansAsServicePlans: ServicePlan[] = plans.map((p) => ({
    id: p.id,
    name: p.name,
    duration: p.duration,
    price: p.price,
  }));

  const handlePlansChange = (servicePlans: ServicePlan[]) => {
    const planData: PlanData[] = servicePlans.map((p) => ({
      id: p.id,
      name: p.name,
      duration: p.duration,
      price: p.price,
    }));
    setPlans(planData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await savePlans(plans);
    router.push("/cast/onboarding/step-4");
  };

  const isNextEnabled = plans.every(
    (p) => p.name.trim() !== "" && p.price > 0 && p.duration > 0
  );

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
      </div>
    );
  }

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

          <PlanEditor plans={plansAsServicePlans} onChange={handlePlansChange} />
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
