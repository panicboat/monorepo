import { BottomNav } from "@/components/layout/BottomNav";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200">
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
