import { BottomNavBar } from "@/modules/shell/components/BottomNavBar";
import { DesktopRightSidebar } from "@/modules/shell/components/DesktopSidebars";
import { TopNavBar } from "@/modules/shell/components/TopNavBar";
import { ResponsiveMainContainer } from "@/modules/shell/components/ResponsiveMainContainer";

export default function GuestLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <TopNavBar />
      <div className="flex justify-center items-start min-h-screen gap-4">
        {/* Main Mobile App Container */}
        <ResponsiveMainContainer>
          {children}
        </ResponsiveMainContainer>

        {/* Mobile Bottom Nav is fixed, but we keep it here logically or outside */}
        <BottomNavBar />

        {/* Desktop Sidebars (Positioned relative to center) */}
        <DesktopRightSidebar />
      </div>
    </>
  );
}
