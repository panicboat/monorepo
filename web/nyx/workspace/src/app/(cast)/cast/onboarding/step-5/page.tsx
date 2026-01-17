"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";

import { useOnboarding } from "../context";

export default function OnboardingStep5() {
  const router = useRouter();
  const { data } = useOnboarding();
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    setIsPublishing(true);
    // Simulate API call with real data
    console.log("FINAL SUBMISSION:", data);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log("Published!");
    router.push("/cast/home");
  };

  if (!data) return null;

  const { profile, photos, plans, shifts } = data;
  const coverPhoto =
    photos.cover || "https://placehold.co/400x600/pink/white?text=No+Image";

  return (
    <div className="px-4 py-6 space-y-6 animate-in slide-in-from-right-8 fade-in duration-500">
      <div className="space-y-2">
        <h2 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm text-white">
            5
          </span>
          Review & Publish
        </h2>
        <p className="text-sm text-slate-500">
          入力内容を確認して、
          <br />
          プロフィールを公開しましょう。
        </p>
      </div>

      <div className="space-y-8">
        {/* 1. Basic Identity */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-900">1. Basic Identity</h3>
            <Button
              variant="link"
              size="sm"
              onClick={() => router.push("/cast/onboarding/step-1")}
              className="text-xs font-bold text-pink-500 hover:text-pink-600 hover:no-underline"
            >
              Edit
            </Button>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-100 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Nickname
                </p>
                <p className="font-bold text-slate-700">
                  {profile.nickname || "-"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Category
                </p>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600 uppercase">
                    {profile.serviceCategory}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Location Type
                </p>
                <p className="capitalize text-slate-700">
                  {profile.locationType}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Area
                </p>
                <p className="text-slate-700">{profile.area || "-"}</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">
                Tagline
              </p>
              <p className="text-sm text-slate-600">{profile.tagline || "-"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">
                Bio
              </p>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">
                {profile.bio || "-"}
              </p>
            </div>
          </div>
        </section>

        {/* 2. Photos */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-900">2. Photos</h3>
            <Button
              variant="link"
              size="sm"
              onClick={() => router.push("/cast/onboarding/step-2")}
              className="text-xs font-bold text-pink-500 hover:text-pink-600 hover:no-underline"
            >
              Edit
            </Button>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-100">
            <div className="grid grid-cols-3 gap-2">
              {photos.gallery.map((item, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-lg bg-slate-100 overflow-hidden relative"
                >
                  {item.type === "video" ? (
                    <video
                      src={item.url}
                      className="h-full w-full object-cover"
                      muted
                      autoPlay
                      loop
                      playsInline
                    />
                  ) : (
                    <img
                      src={item.url}
                      alt={`Gallery ${i}`}
                      className="h-full w-full object-cover"
                    />
                  )}
                  {i === 0 && (
                    <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                      Cover
                    </div>
                  )}
                </div>
              ))}
              {photos.gallery.length === 0 && (
                <div className="col-span-3 py-4 text-center text-sm text-slate-400">
                  No photos uploaded
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 3. Service Plans */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-900">3. Service Plans</h3>
            <Button
              variant="link"
              size="sm"
              onClick={() => router.push("/cast/onboarding/step-3")}
              className="text-xs font-bold text-pink-500 hover:text-pink-600 hover:no-underline"
            >
              Edit
            </Button>
          </div>
          <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
            {plans.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between p-3"
                  >
                    <div>
                      <div className="font-bold text-slate-700">
                        {plan.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {plan.duration} mins
                      </div>
                    </div>
                    <div className="font-mono font-bold text-slate-900">
                      ¥{plan.price.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-slate-400">
                No plans configured (Optional)
              </div>
            )}
          </div>
        </section>

        {/* 4. Schedule */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="font-bold text-slate-900">4. Initial Schedule</h3>
            <Button
              variant="link"
              size="sm"
              onClick={() => router.push("/cast/onboarding/step-4")}
              className="text-xs font-bold text-pink-500 hover:text-pink-600 hover:no-underline"
            >
              Edit
            </Button>
          </div>
          <div className="rounded-xl bg-white shadow-sm border border-slate-100 overflow-hidden">
            {shifts.length > 0 ? (
              <div className="divide-y divide-slate-50">
                {shifts.map((shift, i) => {
                  const plan = plans.find((p) => p.id === shift.planId);
                  return (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700">
                            {shift.date}
                          </span>
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                            {shift.start} - {shift.end}
                          </span>
                        </div>
                      </div>
                      {plan && (
                        <div className="text-xs font-bold text-pink-500 bg-pink-50 px-2 py-1 rounded">
                          {plan.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-slate-400">
                No shifts added
              </div>
            )}
          </div>
        </section>

        {/* Publish Button */}
        <Button
          onClick={handlePublish}
          disabled={isPublishing}
          className="relative w-full overflow-hidden rounded-xl bg-slate-900 py-6 h-auto font-bold text-white shadow-xl shadow-slate-200 transition-all hover:bg-slate-800 hover:shadow-2xl disabled:bg-slate-400"
        >
          {isPublishing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Publishing...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Publish & Start
              <ArrowRight size={18} />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
