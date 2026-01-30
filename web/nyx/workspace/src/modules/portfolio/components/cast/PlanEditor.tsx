"use client";

import { useState } from "react";
import { Plus, Trash2, Banknote, Clock, Tag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export type ServicePlan = {
  id: string; // Temporary ID for list management
  name: string;
  duration: number; // minutes
  price: number; // yen
};

interface PlanEditorProps {
  plans: ServicePlan[];
  onChange: (plans: ServicePlan[]) => void;
}

export const PlanEditor = ({ plans, onChange }: PlanEditorProps) => {
  const addPlan = () => {
    const newPlan: ServicePlan = {
      id: crypto.randomUUID(),
      name: "",
      duration: 0,
      price: 0,
    };
    onChange([...plans, newPlan]);
  };

  const removePlan = (id: string) => {
    onChange(plans.filter((p) => p.id !== id));
  };

  const updatePlan = (id: string, field: keyof ServicePlan, value: any) => {
    onChange(plans.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  return (
    <div className="space-y-4">
      {plans.map((plan, index) => (
        <div
          key={plan.id}
          className="relative flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-in fade-in slide-in-from-top-2"
        >
          <div className="flex items-start justify-between">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Plan #{index + 1}
            </h4>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removePlan(plan.id)}
              className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
            >
              <Trash2 size={16} />
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="col-span-1 sm:col-span-2">
              <Label className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500">
                <Tag size={12} />
                Plan Name
                <span className="ml-2 text-xs font-normal text-slate-400">
                  コース名
                </span>
              </Label>
              <Input
                type="text"
                value={plan.name}
                onChange={(e) => updatePlan(plan.id, "name", e.target.value)}
                placeholder=""
                className="focus-visible:ring-pink-500"
              />
            </div>

            <div>
              <Label className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500">
                <Clock size={12} />
                Duration (min)
                <span className="ml-2 text-xs font-normal text-slate-400">
                  所要時間
                </span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  value={plan.duration || ""}
                  onChange={(e) =>
                    updatePlan(plan.id, "duration", Number(e.target.value))
                  }
                  min={10}
                  step={10}
                  className="focus-visible:ring-pink-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold pointer-events-none">
                  min
                </span>
              </div>
            </div>

            <div>
              <Label className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500">
                <Banknote size={12} />
                Price (JPY)
                <span className="ml-2 text-xs font-normal text-slate-400">
                  基本料金
                </span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  value={plan.price || ""}
                  onChange={(e) =>
                    updatePlan(plan.id, "price", Number(e.target.value))
                  }
                  min={1000}
                  step={1000}
                  className="focus-visible:ring-pink-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold pointer-events-none">
                  ¥
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addPlan}
        className="w-full h-12 border-2 border-dashed border-slate-200 bg-slate-50 text-slate-500 hover:border-pink-300 hover:bg-pink-50 hover:text-pink-600 font-bold"
      >
        <Plus size={16} className="mr-2" />
        Add New Plan
      </Button>
    </div>
  );
};
