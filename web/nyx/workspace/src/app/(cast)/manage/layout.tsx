import { CastHeader } from "@/modules/shell/components/cast/CastHeader";

export default function CastLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-50">
      <CastHeader />
      <main>
        {children}
      </main>
    </div>
  );
}
