import { GuestBottomNavBar } from "@/components/layout/guest/GuestBottomNavBar";
import { GuestDesktopSidebars } from "@/components/layout/guest/GuestDesktopSidebars";
import { GuestTopNavBar } from "@/components/layout/guest/GuestTopNavBar";
import { ResponsiveMainContainer } from "@/components/layout/ResponsiveMainContainer";

export default function GuestLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <GuestTopNavBar />
      <div className="flex justify-center items-start min-h-screen gap-4 bg-background">
        {/* Main Mobile App Container */}
        <ResponsiveMainContainer className="bg-surface">
          {children}
        </ResponsiveMainContainer>

        {/* Mobile Bottom Nav is fixed, but we keep it here logically or outside */}
        <GuestBottomNavBar />

        {/* Desktop Sidebars (Positioned relative to center) */}
        <GuestDesktopSidebars />
      </div>
    </>
  );
}
