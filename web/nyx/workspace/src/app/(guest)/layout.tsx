import { BottomNavBar } from "@/modules/shell/components/guest/BottomNavBar";
import { DesktopRightSidebar } from "@/modules/shell/components/guest/DesktopSidebars";
import { TopNavBar } from "@/modules/shell/components/guest/TopNavBar";
import { ResponsiveMainContainer } from "@/modules/shell/components/guest/ResponsiveMainContainer";

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
