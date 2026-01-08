import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Focused Header */}
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link href="/manage" className="text-slate-400 hover:text-slate-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="text-sm font-bold text-slate-700">Cast Onboarding</div>
          <div className="w-5" /> {/* Spacer for balance */}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-md px-4 py-6">
        {children}
      </main>
    </div>
  );
}
