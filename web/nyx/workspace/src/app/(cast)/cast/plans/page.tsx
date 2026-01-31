"use client";

import { useEffect } from "react";
import { PlanEditor } from "@/modules/portfolio/components/cast/PlanEditor";
import { ActionButton } from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/Toast";
import { useCastPlans } from "@/modules/portfolio/hooks";

export default function ManagePlanPage() {
  const { toast } = useToast();
  const { plans, loading, fetchPlans, updatePlans, savePlans } = useCastPlans();

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleSave = async () => {
    try {
      await savePlans(plans);
      toast({
        title: "Saved",
        description: "Your plans have been updated successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to save plans:", error);
      toast({
        title: "Error",
        description: "Failed to save plans. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container max-w-lg mx-auto pb-24 px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Manage Plans</h1>
          <p className="text-slate-500 text-sm">
            Set up your service plans. These will be displayed on your profile for guests to book.
          </p>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-slate-200 rounded"></div>
          <div className="h-24 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-lg mx-auto pb-24 px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Manage Plans</h1>
        <p className="text-slate-500 text-sm">
          Set up your service plans. These will be displayed on your profile for guests to book.
        </p>
      </div>

      <PlanEditor plans={plans} onChange={updatePlans} />

      <div className="flex flex-col gap-4 px-4 pb-12 items-center mt-8">
        <ActionButton
          mode="save"
          label="Save Changes"
          onClick={handleSave}
          className="max-w-md"
          role="cast"
        />
      </div>
    </div>
  );
}
