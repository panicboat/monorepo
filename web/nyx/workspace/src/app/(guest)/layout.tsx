import { GuestBottomNavBar } from "@/modules/shell/components/guest/GuestBottomNavBar";
import { GuestDesktopSidebars } from "@/modules/shell/components/guest/GuestDesktopSidebars";
import { GuestTopNavBar } from "@/modules/shell/components/guest/GuestTopNavBar";
import { ResponsiveMainContainer } from "@/modules/shell/components/ResponsiveMainContainer";

export default function GuestLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <GuestTopNavBar />
      <div className="flex justify-center items-start min-h-screen gap-4">
        {/* Main Mobile App Container */}
        <ResponsiveMainContainer className="bg-white">
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
