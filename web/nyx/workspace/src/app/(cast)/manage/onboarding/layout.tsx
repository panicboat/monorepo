import { OnboardingHeader } from "./onboarding-header";
import { OnboardingProvider } from "./onboarding-context";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <OnboardingHeader />

        {/* Main Content Area */}
        <main className="mx-auto max-w-md px-4 py-6">
          {children}
        </main>
      </div>
    </OnboardingProvider>
  );
}
