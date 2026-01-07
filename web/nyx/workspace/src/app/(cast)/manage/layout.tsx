export default function CastLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <main className="container mx-auto p-4">
        {children}
      </main>
    </div>
  );
}
