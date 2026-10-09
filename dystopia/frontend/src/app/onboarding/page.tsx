"use client";

import { useRouter } from "next/navigation";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { useProfile } from "@/modules/profile/hooks/useProfile";
import { ProfileNameForm } from "@/modules/profile/components/ProfileNameForm";

export default function OnboardingPage() {
  const router = useRouter();
  const role = useAuthStore(selectRole);
  const { createProfile } = useProfile();

  const isCast = role === "cast";

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-text-primary">
          プロフィール設定
        </h1>
        <p className="mb-8 text-center text-sm text-text-secondary">
          {isCast
            ? "キャストとして表示される名前とユーザー名を設定してください。"
            : "表示名とユーザー名を設定してください。"}
        </p>

        <ProfileNameForm
          submitLabel="完了"
          onSubmit={async (payload) => {
            await createProfile(payload);
            router.replace("/");
          }}
        />
      </div>
    </main>
  );
}
