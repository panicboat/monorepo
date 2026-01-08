import { OnboardingProvider } from "./onboarding-context";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OnboardingProvider>
      <div className="bg-slate-50 text-slate-900 pb-20">
        {/* Main Content Area */}
        <div className="mx-auto max-w-md px-4 py-6">
          {children}
        </div>
      </div>
    </OnboardingProvider>
  );
}
