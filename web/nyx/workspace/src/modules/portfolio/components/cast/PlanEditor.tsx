"use client";

import { useState } from "react";
import { Plus, Trash2, Banknote, Clock, Tag } from "lucide-react";

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
      name: "Standard Course",
      duration: 60,
      price: 15000,
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
            <button
              type="button"
              onClick={() => removePlan(plan.id)}
              className="text-slate-400 hover:text-red-500"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="col-span-1 sm:col-span-2">
              <label className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500">
                <Tag size={12} />
                Plan Name
              </label>
              <input
                type="text"
                value={plan.name}
                onChange={(e) => updatePlan(plan.id, "name", e.target.value)}
                placeholder="e.g. Standard Course"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500">
                <Clock size={12} />
                Duration (min)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={plan.duration || ""}
                  onChange={(e) =>
                    updatePlan(plan.id, "duration", Number(e.target.value))
                  }
                  min={10}
                  step={10}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">
                  min
                </span>
              </div>
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-bold text-slate-500">
                <Banknote size={12} />
                Price (JPY)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={plan.price || ""}
                  onChange={(e) =>
                    updatePlan(plan.id, "price", Number(e.target.value))
                  }
                  min={1000}
                  step={1000}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-pink-500 focus:outline-none"
                />
                <span className="absolute right-3 top-2 text-xs text-slate-400 font-bold">
                  ¥
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addPlan}
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-3 text-sm font-bold text-slate-500 transition-colors hover:border-pink-300 hover:bg-pink-50 hover:text-pink-600"
      >
        <Plus size={16} />
        <span>Add New Plan</span>
      </button>
    </div>
  );
};
