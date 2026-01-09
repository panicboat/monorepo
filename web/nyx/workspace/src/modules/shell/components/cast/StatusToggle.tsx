"use client";

import { useState } from "react";
import { ChevronDown, Moon, Sun, MessageCircle, Star } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

type Status = "offline" | "asking" | "online" | "tonight";

interface StatusOption {
  value: Status;
  label: string;
  icon: React.ElementType;
  colorClass: string;
  dotClass: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "online",
    label: "Online",
    icon: Sun,
    colorClass: "text-emerald-600 bg-emerald-50",
    dotClass: "bg-emerald-500",
  },
  {
    value: "asking",
    label: "Asking",
    icon: MessageCircle,
    colorClass: "text-amber-600 bg-amber-50",
    dotClass: "bg-amber-500",
  },
  {
    value: "tonight",
    label: "Tonight",
    icon: Star,
    colorClass: "text-blue-600 bg-blue-50",
    dotClass: "bg-blue-500",
  },
  {
    value: "offline",
    label: "Offline",
    icon: Moon,
    colorClass: "text-slate-600 bg-slate-100",
    dotClass: "bg-slate-500",
  },
];

export const StatusToggle = () => {
  const [status, setStatus] = useState<Status>("offline");
  const [isOpen, setIsOpen] = useState(false);

  const currentStatus =
    STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[3];

  const handleStatusChange = async (newStatus: Status) => {
    setStatus(newStatus); // Optimistic update
    setIsOpen(false);

    try {
      await fetch("/api/cast/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (error) {
      console.error("Failed to update status:", error);
      // Ideally revert status here if needed
    }
  };

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          className={`
            flex items-center gap-2 pl-2 pr-2 py-1.5 rounded-full text-xs font-bold transition-all border
            ${currentStatus.colorClass} border-transparent hover:border-black/5 active:scale-95
          `}
        >
          <span
            className={`w-2 h-2 rounded-full ${currentStatus.dotClass} animate-pulse`}
          />
          <span>{currentStatus.label}</span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[160px] bg-white rounded-xl shadow-lg ring-1 ring-black/5 p-1 z-50 animate-in fade-in zoom-in-95 duration-200"
          sideOffset={5}
          align="end"
        >
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              onClick={() => handleStatusChange(option.value)}
              className={`
                flex items-center gap-3 px-3 py-2.5 outline-none cursor-pointer rounded-lg text-sm font-medium transition-colors
                ${status === option.value ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}
              `}
            >
              <option.icon
                className={`w-4 h-4 ${option.value === status ? option.dotClass.replace("bg-", "text-") : "text-slate-400"}`}
              />
              {option.label}
              {status === option.value && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-slate-900" />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
