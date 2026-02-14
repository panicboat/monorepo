"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useCastData } from "@/modules/portfolio/hooks";

export default function OnboardingStep5() {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);

  const {
    profile,
    images,
    plans,
    schedules,
    loading,
    initialized,
    fetchData,
    publishProfile,
  } = useCastData();

  // Initialize data on mount
  useEffect(() => {
    if (!initialized) {
      fetchData();
    }
  }, [initialized, fetchData]);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await publishProfile();
      console.log("Published!");
      router.push("/cast/home");
    } catch (e) {
      console.error(e);
      setIsPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-role-cast border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6 animate-in slide-in-from-right-8 fade-in duration-500">
      <div className="space-y-2">
        <h2 className="text-xl font-serif font-bold text-text-primary flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-sm text-white">
            5
          </span>
          Review & Publish
        </h2>
        <p className="text-sm text-text-secondary">
          入力内容を確認して、
          <br />
          プロフィールを公開しましょう。
        </p>
      </div>

      <div className="space-y-8">
        {/* 1. Basic Identity */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="font-bold text-text-primary">1. Basic Identity</h3>
            <Button
              variant="link"
              size="sm"
              onClick={() => router.push("/cast/onboarding/step-1")}
              className="text-xs font-bold text-role-cast hover:text-role-cast-hover hover:no-underline"
            >
              Edit
            </Button>
          </div>
          <div className="rounded-xl bg-surface p-4 shadow-sm border border-border space-y-4">
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase">
                Nickname
              </p>
              <p className="font-bold text-text-secondary">
                {profile.nickname || "-"}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase">
                Tagline
              </p>
              <p className="text-sm text-text-secondary">{profile.tagline || "-"}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase">
                Bio
              </p>
              <p className="text-sm text-text-secondary whitespace-pre-wrap">
                {profile.bio || "-"}
              </p>
            </div>
          </div>
        </section>

        {/* 2. Photos */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="font-bold text-text-primary">2. Photos</h3>
            <Button
              variant="link"
              size="sm"
              onClick={() => router.push("/cast/onboarding/step-2")}
              className="text-xs font-bold text-role-cast hover:text-role-cast-hover hover:no-underline"
            >
              Edit
            </Button>
          </div>
          <div className="rounded-xl bg-surface p-4 shadow-sm border border-border">
            <div className="grid grid-cols-3 gap-2">
              {images.map((item, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-lg bg-surface-secondary overflow-hidden relative"
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
              {images.length === 0 && (
                <div className="col-span-3 py-4 text-center text-sm text-text-muted">
                  No photos uploaded
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 3. Service Plans */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="font-bold text-text-primary">3. Service Plans</h3>
            <Button
              variant="link"
              size="sm"
              onClick={() => router.push("/cast/onboarding/step-3")}
              className="text-xs font-bold text-role-cast hover:text-role-cast-hover hover:no-underline"
            >
              Edit
            </Button>
          </div>
          <div className="rounded-xl bg-surface shadow-sm border border-border overflow-hidden">
            {plans.length > 0 ? (
              <div className="divide-y divide-border">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between p-3"
                  >
                    <div>
                      <div className="font-bold text-text-secondary">
                        {plan.name}
                      </div>
                      <div className="text-xs text-text-muted">
                        {plan.duration} mins
                      </div>
                    </div>
                    <div className="font-mono font-bold text-text-primary">
                      {plan.price > 0 ? `¥${plan.price.toLocaleString()}` : "Ask"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-text-muted">
                No plans configured (Optional)
              </div>
            )}
          </div>
        </section>

        {/* 4. Schedule */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h3 className="font-bold text-text-primary">4. Initial Schedule</h3>
            <Button
              variant="link"
              size="sm"
              onClick={() => router.push("/cast/onboarding/step-4")}
              className="text-xs font-bold text-role-cast hover:text-role-cast-hover hover:no-underline"
            >
              Edit
            </Button>
          </div>
          <div className="rounded-xl bg-surface shadow-sm border border-border overflow-hidden">
            {schedules.length > 0 ? (
              <div className="divide-y divide-border">
                {schedules.map((schedule, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-text-secondary">
                          {schedule.date}
                        </span>
                        <span className="rounded bg-surface-secondary px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
                          {schedule.start} - {schedule.end}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-sm text-text-muted">
                No schedules added
              </div>
            )}
          </div>
        </section>

        {/* Publish Button */}
        <Button
          onClick={handlePublish}
          disabled={isPublishing}
          className="relative w-full overflow-hidden rounded-xl bg-role-cast py-6 h-auto font-bold text-white shadow-xl shadow-role-cast-shadow transition-all hover:bg-role-cast-hover hover:shadow-2xl disabled:bg-neutral-400"
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
