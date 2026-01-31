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
            className="w-full shadow-md shadow-pink-500/20 bg-gradient-to-r from-pink-500 to-rose-500 text-white border-0"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            招待状を作成
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl border-t border-slate-200 bg-white text-slate-800 p-0 max-h-[90vh] flex flex-col gap-0 border-x-0 sm:max-w-[450px] sm:mx-auto">
        <div className="w-full flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full"></div>
        </div>

        <SheetHeader className="px-6 py-2 border-b border-slate-100 h-14 flex flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-slate-800 flex items-center gap-2 font-serif text-lg">
            {step === "main" ? (
              <>
                <Sparkles className="w-4 h-4 text-pink-500" />
                招待状を作成
              </>
            ) : (
              <>
                <Calendar className="w-4 h-4 text-pink-500" />
                日時を指定
              </>
            )}
          </SheetTitle>
          {step === "picker" && (
            <button
              onClick={() => setStep("main")}
              className="text-xs text-slate-400 font-bold hover:text-slate-600 flex items-center gap-1"
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
                <label className="text-xs text-slate-400 font-bold uppercase mb-3 block">
                  日時を選択
                </label>
                <div className="flex flex-col gap-3 mb-3">
                  <button
                    onClick={() => setSelectedTime("21:00 - 22:30")}
                    className={`w-full bg-gradient-to-r from-green-50 to-white border text-left p-4 rounded-2xl relative overflow-hidden group hover:scale-[0.98] transition shadow-sm flex items-center justify-between ${selectedTime === "21:00 - 22:30" ? "border-green-500 ring-1 ring-green-500" : "border-green-200"}`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                          Today
                        </span>
                        <span className="text-green-600 font-bold text-sm">
                          21:00 - 22:30
                        </span>
                      </div>
                      <p className="text-[10px] text-green-600/70 font-medium pl-1">
                        空き枠から自動提案
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedTime === "21:00 - 22:30" ? "border-green-500" : "border-gray-200"}`}>
                      {selectedTime === "21:00 - 22:30" && <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />}
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedTime("19:00 - 20:30")}
                    className={`w-full bg-white border text-left p-4 rounded-2xl group hover:bg-slate-50 transition shadow-sm flex items-center justify-between ${selectedTime === "19:00 - 20:30" ? "border-blue-500 ring-1 ring-blue-500 bg-blue-50" : "border-slate-200"}`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          Tomorrow
                        </span>
                        <p className="text-slate-700 font-bold text-sm">19:00 - 20:30</p>
                      </div>
                      <p className="text-[10px] text-slate-400 pl-1">
                        空き枠あり
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedTime === "19:00 - 20:30" ? "border-blue-500" : "border-gray-200"}`}>
                      {selectedTime === "19:00 - 20:30" && <div className="w-2.5 h-2.5 bg-blue-500 rounded-full" />}
                    </div>
                  </button>

                  {/* Custom Selection Display */}
                  {selectedTime && selectedTime !== "21:00 - 22:30" && selectedTime !== "19:00 - 20:30" && (
                    <button
                      onClick={() => setStep("picker")}
                      className={`w-full bg-white border text-left p-4 rounded-2xl group hover:bg-slate-50 transition shadow-sm flex items-center justify-between border-pink-500 ring-1 ring-pink-500 bg-pink-50`}
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="bg-pink-100 text-pink-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            {["Today", "Wed", "Thu", "Fri", "Sat"][selectedDateIndex]}
                          </span>
                          <p className="text-pink-700 font-bold text-sm">{selectedTime}</p>
                        </div>
                        <p className="text-[10px] text-pink-600/70 pl-1 font-medium">
                          指定日時
                        </p>
                      </div>
                      <div className="w-5 h-5 rounded-full border-2 border-pink-500 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 bg-pink-500 rounded-full" />
                      </div>
                    </button>
                  )}

                  <div
                    onClick={() => setStep("picker")}
                    className="w-full p-4 bg-white border border-dashed border-slate-300 rounded-2xl text-slate-500 text-xs flex items-center justify-between hover:bg-slate-50 cursor-pointer hover:border-slate-400 transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition">
                        <Calendar className="w-4 h-4 text-slate-500" />
                      </div>
                      <span className="font-bold text-slate-600">その他の日時を指定</span>
                    </div>
                    <span className="text-slate-400 text-lg">›</span>
                  </div>
                </div>
              </div>

              {/* Plan Selection */}
              <div>
                <label className="text-xs text-slate-400 font-bold uppercase mb-3 block">
                  プランを選択
                </label>
                <div className="space-y-2">
                  {plans.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`border rounded-xl p-3 flex justify-between items-center cursor-pointer transition shadow-sm ${selectedPlanId === plan.id
                        ? "bg-pink-50 border-pink-500 ring-1 ring-pink-500"
                        : "bg-white border-slate-200 hover:border-pink-200"
                        }`}
                    >
                      <div>
                        <p
                          className={`text-sm font-bold ${selectedPlanId === plan.id
                            ? "text-pink-700"
                            : "text-slate-700"
                            }`}
                        >
                          {plan.name}
                        </p>
                        <p
                          className={`text-xs ${selectedPlanId === plan.id
                            ? "text-pink-600"
                            : "text-slate-500"
                            }`}
                        >
                          ¥{plan.price.toLocaleString()}
                        </p>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPlanId === plan.id
                          ? "border-pink-500"
                          : "border-slate-300"
                          }`}
                      >
                        {selectedPlanId === plan.id && (
                          <div className="w-2.5 h-2.5 rounded-full bg-pink-500"></div>
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
              <div className="mb-4 bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">選択中のプラン</p>
                  <p className="font-bold text-slate-800 text-sm">
                    {plans.find(p => p.id === selectedPlanId)?.name}
                  </p>
                </div>
                <div className="font-bold text-slate-600 text-sm">
                  ¥{plans.find(p => p.id === selectedPlanId)?.price.toLocaleString()}
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar mb-6 pb-2 min-h-[5rem]">
                {[...Array(5)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedDateIndex(i)}
                    className={`flex-shrink-0 w-14 h-16 rounded-xl flex flex-col items-center justify-center border shadow-sm transition ${i === selectedDateIndex
                      ? "bg-pink-500 border-pink-600 shadow-md shadow-pink-200 text-white"
                      : "bg-white border-slate-200 text-slate-400 hover:border-pink-200"
                      }`}
                  >
                    <span
                      className={`text-[10px] font-bold ${i === selectedDateIndex ? "text-pink-100" : ""
                        }`}
                    >
                      {["Today", "Wed", "Thu", "Fri", "Sat"][i]}
                    </span>
                    <span className={`text-lg font-bold ${i === selectedDateIndex ? "text-white" : "text-slate-700"}`}>{23 + i}</span>
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto">
                <label className="text-xs text-slate-400 font-bold uppercase mb-3 block">
                  開始時間を選択
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {["19:00", "19:30", "20:00", "20:30"].map((time) => (
                    <button
                      key={time}
                      disabled
                      className="py-2 rounded-lg bg-slate-50 text-slate-400 text-xs border border-slate-100 line-through cursor-not-allowed"
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
                      className={`py-2 rounded-lg text-xs border transition font-bold bg-white text-slate-700 border-slate-200 hover:bg-pink-50 hover:border-pink-300 hover:text-pink-600 active:scale-95`}
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
          <div className="p-4 border-t border-slate-100 bg-white">
            <Button
              onClick={handleSend}
              variant="cast"
              className="w-full bg-gradient-to-r from-pink-500 to-rose-500 border-none shadow-lg shadow-pink-200 hover:shadow-pink-300 transition-all active:scale-[0.98]"
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
