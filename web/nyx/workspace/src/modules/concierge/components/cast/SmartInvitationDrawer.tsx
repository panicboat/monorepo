import React from "react";
import { Button } from "@/components/ui/Button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/Sheet";
import { Calendar, Send, Sparkles } from "lucide-react";

interface SmartInvitationDrawerProps {
  onSend?: (details: { time: string; planId: number }) => void;
  children?: React.ReactNode;
}

export function SmartInvitationDrawer({ onSend, children }: SmartInvitationDrawerProps) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<"main" | "picker">("main");
  const [selectedTime, setSelectedTime] = React.useState<string | null>(null);
  const [selectedDateIndex, setSelectedDateIndex] = React.useState<number>(0);
  const [selectedPlanId, setSelectedPlanId] = React.useState<number>(1);

  // Mock Plans
  const plans = [
    { id: 1, name: "90分 VIPコース", price: 35000, type: "vip" },
    { id: 2, name: "60分 ショート", price: 20000, type: "standard" },
  ];

  const handleSend = () => {
    if (onSend) {
      onSend({
        time: selectedTime || "21:00 - 22:30", // Default or selected
        planId: selectedPlanId,
      });
    }
    setOpen(false);
    setStep("main");
    setSelectedTime(null);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {children || (
          <Button
            variant="cast"
            className="w-full shadow-md shadow-role-cast-shadow bg-gradient-to-r from-role-cast to-role-cast-hover text-white border-0"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            招待状を作成
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl border-t border-border bg-surface text-text-primary p-0 max-h-[90vh] flex flex-col gap-0 border-x-0 sm:max-w-[450px] sm:mx-auto">
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-border rounded-full"></div>
        </div>

        <SheetHeader className="px-6 py-2 border-b border-border h-14 flex flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-text-primary flex items-center gap-2 font-serif text-lg">
            {step === "main" ? (
              <>
                <Sparkles className="w-4 h-4 text-role-cast" />
                招待状を作成
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 text-role-cast" />
                日時を指定
              </>
            )}
          </SheetTitle>
          {step === "picker" && (
            <button
              onClick={() => setStep("main")}
              className="text-xs text-text-muted font-bold hover:text-text-secondary flex items-center gap-1"
            >
              Back
            </button>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {step === "main" ? (
            <div className="space-y-6">
              {/* Date Selection */}
              <div>
                <label className="text-xs text-text-muted font-bold uppercase mb-3 block">
                  日時を選択
                </label>
                <div className="flex flex-col gap-3 mb-3">
                  <button
                    onClick={() => setSelectedTime("21:00 - 22:30")}
                    className={`w-full bg-gradient-to-r from-success-lighter to-white border text-left p-4 rounded-2xl relative overflow-hidden group hover:scale-[0.98] transition shadow-sm flex items-center justify-between ${selectedTime === "21:00 - 22:30" ? "border-success ring-1 ring-success" : "border-success-light"}`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-success text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                          Today
                        </span>
                        <span className="text-success-hover font-bold text-sm">
                          21:00 - 22:30
                        </span>
                      </div>
                      <p className="text-[10px] text-success/70 font-medium pl-1">
                        空き枠から自動提案
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedTime === "21:00 - 22:30" ? "border-success" : "border-border"}`}>
                      {selectedTime === "21:00 - 22:30" && <div className="w-2.5 h-2.5 bg-success rounded-full" />}
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedTime("19:00 - 20:30")}
                    className={`w-full bg-surface border text-left p-4 rounded-2xl group hover:bg-surface-secondary transition shadow-sm flex items-center justify-between ${selectedTime === "19:00 - 20:30" ? "border-info ring-1 ring-info bg-info-lighter" : "border-border"}`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-surface-secondary text-text-secondary text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Tomorrow
                        </span>
                        <p className="text-text-secondary font-bold text-sm">19:00 - 20:30</p>
                      </div>
                      <p className="text-[10px] text-text-muted pl-1">
                        空き枠あり
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedTime === "19:00 - 20:30" ? "border-info" : "border-border"}`}>
                      {selectedTime === "19:00 - 20:30" && <div className="w-2.5 h-2.5 bg-info rounded-full" />}
                    </div>
                  </button>

                  {/* Custom Selection Display */}
                  {selectedTime && selectedTime !== "21:00 - 22:30" && selectedTime !== "19:00 - 20:30" && (
                    <button
                      onClick={() => setStep("picker")}
                      className={`w-full bg-surface border text-left p-4 rounded-2xl group hover:bg-surface-secondary transition shadow-sm flex items-center justify-between border-role-cast ring-1 ring-role-cast bg-role-cast-lighter`}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-role-cast-lighter text-role-cast text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {["Today", "Wed", "Thu", "Fri", "Sat"][selectedDateIndex]}
                          </span>
                          <p className="text-role-cast-hover font-bold text-sm">{selectedTime}</p>
                        </div>
                        <p className="text-[10px] text-role-cast/70 pl-1 font-medium">
                          指定日時
                        </p>
                      </div>
                      <div className="w-5 h-5 rounded-full border-2 border-role-cast flex items-center justify-center">
                        <div className="w-2.5 h-2.5 bg-role-cast rounded-full" />
                      </div>
                    </button>
                  )}

                  <div
                    onClick={() => setStep("picker")}
                    className="w-full p-4 bg-surface border border-dashed border-border-secondary rounded-2xl text-text-secondary text-xs flex items-center justify-between hover:bg-surface-secondary cursor-pointer hover:border-border-secondary transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-secondary flex items-center justify-center group-hover:bg-surface-tertiary transition">
                        <Calendar className="w-4 h-4 text-text-secondary" />
                      </div>
                      <span className="font-bold text-text-secondary">その他の日時を指定</span>
                    </div>
                    <span className="text-text-muted text-lg">›</span>
                  </div>
                </div>
              </div>

              {/* Plan Selection */}
              <div>
                <label className="text-xs text-text-muted font-bold uppercase mb-3 block">
                  プランを選択
                </label>
                <div className="space-y-2">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`border rounded-xl p-3 flex justify-between items-center cursor-pointer transition shadow-sm ${selectedPlanId === plan.id
                        ? "bg-role-cast-lighter border-role-cast ring-1 ring-role-cast"
                        : "bg-surface border-border hover:border-role-cast-light"
                        }`}
                    >
                      <div>
                        <p
                          className={`text-sm font-bold ${selectedPlanId === plan.id
                            ? "text-role-cast-hover"
                            : "text-text-secondary"
                            }`}
                        >
                          {plan.name}
                        </p>
                        <p
                          className={`text-xs ${selectedPlanId === plan.id
                            ? "text-role-cast"
                            : "text-text-secondary"
                            }`}
                        >
                          ¥{plan.price.toLocaleString()}
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPlanId === plan.id
                          ? "border-role-cast"
                          : "border-border-secondary"
                          }`}
                      >
                        {selectedPlanId === plan.id && (
                          <div className="w-2.5 h-2.5 rounded-full bg-role-cast"></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Time Picker View */
            (<div className="h-full flex flex-col">
              {/* Selected Plan Context */}
              <div className="mb-4 bg-surface-secondary p-3 rounded-xl border border-border flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-text-muted font-bold uppercase">選択中のプラン</p>
                  <p className="font-bold text-text-primary text-sm">
                    {plans.find(p => p.id === selectedPlanId)?.name}
                  </p>
                </div>
                <div className="font-bold text-text-secondary text-sm">
                  ¥{plans.find(p => p.id === selectedPlanId)?.price.toLocaleString()}
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar mb-6 pb-2 min-h-[5rem]">
                {[...Array(5)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedDateIndex(i)}
                    className={`flex-shrink-0 w-14 h-16 rounded-xl flex flex-col items-center justify-center border shadow-sm transition ${i === selectedDateIndex
                      ? "bg-role-cast border-role-cast shadow-md shadow-role-cast-shadow text-white"
                      : "bg-surface border-border text-text-muted hover:border-role-cast-light"
                      }`}
                  >
                    <span
                      className={`text-[10px] font-bold ${i === selectedDateIndex ? "text-white/70" : ""
                        }`}
                    >
                      {["Today", "Wed", "Thu", "Fri", "Sat"][i]}
                    </span>
                    <span className={`text-lg font-bold ${i === selectedDateIndex ? "text-white" : "text-text-secondary"}`}>{23 + i}</span>
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto">
                <label className="text-xs text-text-muted font-bold uppercase mb-3 block">
                  開始時間を選択
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {["19:00", "19:30", "20:00", "20:30"].map((time) => (
                    <button
                      key={time}
                      disabled
                      className="py-2 rounded-lg bg-surface-secondary text-text-muted text-xs border border-border line-through cursor-not-allowed"
                    >
                      {time}
                    </button>
                  ))}
                  {["21:00", "21:30", "22:00", "22:30"].map((time) => (
                    <button
                      key={time}
                      onClick={() => {
                        setSelectedTime(time);
                        setStep("main");
                      }}
                      className={`py-2 rounded-lg text-xs border transition font-bold bg-surface text-text-secondary border-border hover:bg-role-cast-lighter hover:border-role-cast-light hover:text-role-cast active:scale-95`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            </div>)
          )}
        </div>

        {step === "main" && (
          <div className="p-4 border-t border-border bg-surface">
            <Button
              onClick={handleSend}
              variant="cast"
              className="w-full bg-gradient-to-r from-role-cast to-role-cast-hover border-none shadow-lg shadow-role-cast-shadow hover:shadow-role-cast-light transition-all active:scale-[0.98]"
            >
              <Send className="w-4 h-4 mr-2" />
              招待状を送る
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
