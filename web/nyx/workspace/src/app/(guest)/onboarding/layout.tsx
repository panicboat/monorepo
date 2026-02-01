import { ResponsiveMainContainer } from "@/components/layout/ResponsiveMainContainer";

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex justify-center items-start min-h-screen">
      <ResponsiveMainContainer className="bg-white">
        {children}
      </ResponsiveMainContainer>
    </div>
  );
}
