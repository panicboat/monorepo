"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera } from "lucide-react";

interface OnboardingWizardProps {
  onFinish: () => void;
}

export default function OnboardingWizard({ onFinish }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isVisible, setIsVisible] = useState(true);

  // Animation variants for steps
  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? "100%" : "-100%",
      opacity: 0,
      pointerEvents: "none" as const,
    }),
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    setIsVisible(false);
    setTimeout(() => {
      onFinish();
    }, 800);
  };

  if (!isVisible && currentStep === 3) {
    // Allow transition to finish before unmounting is handled by parent if needed,
    // but here we handle the overlay fade out internally.
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
          className="absolute inset-0 bg-slate-950 z-[100] flex flex-col font-sans"
        >
          {/* Header / Progress */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex gap-1">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${step === currentStep ? "bg-yellow-500" : "bg-slate-700"
                    }`}
                />
              ))}
            </div>
            <span className="text-xs text-slate-500 font-mono">
              SETUP {currentStep}/3
            </span>
          </div>

          {/* Content Area */}
          <div className="flex-1 relative overflow-hidden p-6 flex flex-col items-center justify-center w-full">
            <AnimatePresence initial={false} custom={currentStep}>
              {/* Step 1: Identity */}
              {currentStep === 1 && (
                <motion.div
                  key="step1"
                  custom={1}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full absolute inset-x-0 px-6 top-1/2 -translate-y-1/2"
                >
                  <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-slate-800 rounded-full mx-auto mb-4 flex items-center justify-center border-2 border-dashed border-slate-600">
                      <Camera className="w-8 h-8 text-slate-500" />
                    </div>
                    <h2 className="text-2xl text-white font-serif mb-2" style={{ fontFamily: '"Yu Mincho", serif' }}>
                      あなたについて
                    </h2>
                    <p className="text-slate-400 text-sm">
                      まずは源氏名とアイコンを設定しましょう。
                    </p>
                  </div>
                  <input
                    type="text"
                    defaultValue="美玲"
                    className="w-full bg-slate-900 border-b border-slate-700 p-3 text-center text-xl text-white focus:outline-none focus:border-yellow-500 transition mb-8"
                    placeholder="源氏名"
                  />
                  <button
                    onClick={handleNext}
                    className="w-full bg-yellow-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-yellow-900/20 hover:bg-yellow-500 transition"
                  >
                    次へ
                  </button>
                </motion.div>
              )}

              {/* Step 2: Appeal */}
              {currentStep === 2 && (
                <motion.div
                  key="step2"
                  custom={1} // direction always forward for this demo
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full absolute inset-x-0 px-6 top-1/2 -translate-y-1/2"
                >
                  <div className="text-center mb-6">
                    <h2 className="text-xl text-white font-serif mb-2" style={{ fontFamily: '"Yu Mincho", serif' }}>
                      アピールポイント
                    </h2>
                    <p className="text-slate-400 text-sm">
                      タグを選んで、あなたの魅力を伝えましょう。
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 mb-8">
                    <button className="px-3 py-2 rounded-full bg-yellow-900/30 border border-yellow-600 text-yellow-400 text-xs">
                      #お酒飲める
                    </button>
                    <button className="px-3 py-2 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs">
                      #タバコ吸わない
                    </button>
                    <button className="px-3 py-2 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs">
                      #マッサージ得意
                    </button>
                  </div>
                  <button
                    onClick={handleNext}
                    className="w-full bg-slate-800 text-white font-bold py-4 rounded-xl border border-slate-700 hover:bg-slate-700 transition"
                  >
                    次へ
                  </button>
                </motion.div>
              )}

              {/* Step 3: Plan */}
              {currentStep === 3 && (
                <motion.div
                  key="step3"
                  custom={1}
                  variants={variants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full absolute inset-x-0 px-6 top-1/2 -translate-y-1/2"
                >
                  <div className="text-center mb-6">
                    <h2 className="text-xl text-white font-serif mb-2" style={{ fontFamily: '"Yu Mincho", serif' }}>
                      プラン作成
                    </h2>
                    <p className="text-slate-400 text-sm">
                      招待状で使う基本コースを登録します。
                    </p>
                  </div>

                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-6">
                    <div className="mb-3">
                      <label className="text-[10px] text-slate-500 uppercase">
                        プラン名
                      </label>
                      <input
                        type="text"
                        defaultValue="90分コース"
                        className="w-full bg-transparent border-b border-slate-700 py-1 text-white text-sm focus:outline-none focus:border-yellow-500"
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 uppercase">
                          時間 (分)
                        </label>
                        <input
                          type="number"
                          defaultValue="90"
                          className="w-full bg-transparent border-b border-slate-700 py-1 text-white text-sm focus:outline-none focus:border-yellow-500"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-500 uppercase">
                          金額目安
                        </label>
                        <input
                          type="number"
                          defaultValue="30000"
                          className="w-full bg-transparent border-b border-slate-700 py-1 text-white text-sm focus:outline-none focus:border-yellow-500"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleNext}
                    className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-bold py-4 rounded-xl shadow-lg shadow-yellow-500/20 hover:scale-[1.02] transition"
                  >
                    設定を完了して始める
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
