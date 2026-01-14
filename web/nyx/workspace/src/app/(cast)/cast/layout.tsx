import { CastTopNavBar } from "@/modules/shell/components/cast/CastTopNavBar";
import { CastBottomNavBar } from "@/modules/shell/components/cast/CastBottomNavBar";
import { ResponsiveMainContainer } from "@/modules/shell/components/ResponsiveMainContainer";

export default function CastLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <CastTopNavBar />
      <div className="flex justify-center items-start min-h-screen gap-4 bg-slate-50">
        <ResponsiveMainContainer className="bg-slate-50">
          {children}
        </ResponsiveMainContainer>

        <CastBottomNavBar />

        {/* Desktop Sidebar (Placeholder for Cast Side) */}
        {/* <CastRightSidebar /> */}
      </div>
    </>
  );
}
