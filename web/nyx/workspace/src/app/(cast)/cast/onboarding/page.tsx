"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { useCastData } from "@/modules/portfolio/hooks";

export default function OnboardingWelcomePage() {
  const {
    profile,
    images,
    plans,
    schedules,
    loading,
    initialized,
    fetchData,
  } = useCastData();

  // Initialize data on mount
  useEffect(() => {
    if (!initialized) {
      fetchData();
    }
  }, [initialized, fetchData]);

  const getNextStep = () => {
    if (!profile.nickname) return "/cast/onboarding/step-1";
    if (images.length === 0) return "/cast/onboarding/step-2";
    if (plans.length === 0) return "/cast/onboarding/step-3";
    if (schedules.length === 0) return "/cast/onboarding/step-4";
    return "/cast/onboarding/step-5";
  };

  const nextStep = getNextStep();
  const isResuming = nextStep !== "/cast/onboarding/step-1";

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-pink-500" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 py-4 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-serif font-bold text-slate-900 mb-2">
          Welcome to Nyx
        </h1>
        <p className="text-slate-500 leading-relaxed">
          あなただけのファンを見つけ、
          <br />
          自由なスタイルで活動しましょう。
        </p>
      </div>

      {/* Benefits / Features */}
      <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-500">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">No Shop, Just You</h3>
            <p className="text-xs text-slate-500 mt-1 leading-normal">
              店舗に所属する必要はありません。あなたのブランドを確立し、直接ゲストとつながることができます。
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-500">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Smart Scheduling</h3>
            <p className="text-xs text-slate-500 mt-1 leading-normal">
              働きたい時間だけシフトを公開。無理な出勤強要は一切ありません。
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-500">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Safe & Trust</h3>
            <p className="text-xs text-slate-500 mt-1 leading-normal">
              ゲストはSMS認証済み。評価システムにより、安心できるユーザーとのみマッチングします。
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="mt-4">
        <Link
          href={nextStep}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-pink-500 py-4 font-bold text-white shadow-lg shadow-pink-300 transition-transform active:scale-95"
        >
          <span>{isResuming ? "続きから再開する" : "プロフィールを作成する"}</span>
          <ArrowRight size={18} />
        </Link>
        <p className="text-center text-[10px] text-slate-400 mt-4">
          登録することで、利用規約およびプライバシーポリシーに同意したものとみなされます。
        </p>
      </div>
    </div>
  );
}
