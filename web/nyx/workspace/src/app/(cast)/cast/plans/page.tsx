"use client";

import { useState } from "react";
import { PlanEditor, ServicePlan } from "@/modules/portfolio/components/cast/PlanEditor";
import { ActionButton } from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/Toast";

// Mock Data - In real implementation, this would fetch from API
const MOCK_PLANS: ServicePlan[] = [
  {
    id: "1",
    name: "Standard Course",
    duration: 60,
    price: 15000,
  },
  {
    id: "2",
    name: "Long Course",
    duration: 90,
    price: 22000,
  },
];

export default function ManagePlanPage() {
  const [plans, setPlans] = useState<ServicePlan[]>(MOCK_PLANS);
  const { toast } = useToast();

  const handleSave = async () => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast({
      title: "Saved",
      description: "Your plans have been updated successfully.",
      variant: "success",
    });
  };

  return (
    <div className="container max-w-lg mx-auto pb-24 px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Manage Plans</h1>
        <p className="text-slate-500 text-sm">
          Set up your service plans. These will be displayed on your profile for guests to book.
        </p>
      </div>

      <PlanEditor plans={plans} onChange={setPlans} />

      <div className="flex flex-col gap-4 px-4 pb-12 items-center mt-8">
        <ActionButton
          mode="save"
          label="Save Changes"
          onClick={handleSave}
          className="max-w-md"
        />
      </div>
    </div>
  );
}
