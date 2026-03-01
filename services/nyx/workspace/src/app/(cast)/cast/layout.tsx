import { CastTopNavBar } from "@/components/layout/cast/CastTopNavBar";
import { CastBottomNavBar } from "@/components/layout/cast/CastBottomNavBar";
import { ResponsiveMainContainer } from "@/components/layout/ResponsiveMainContainer";
import { CastAuthGuard } from "@/modules/identity/components/CastAuthGuard";
import { ToastProvider } from "@/components/ui/Toast";

export default function CastLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ToastProvider>
      <CastAuthGuard>
        <CastTopNavBar />
        <div className="flex justify-center items-start min-h-screen gap-4 bg-surface-secondary">
          <ResponsiveMainContainer className="bg-surface-secondary">
            {children}
          </ResponsiveMainContainer>

          <CastBottomNavBar />

          {/* Desktop Sidebar (Placeholder for Cast Side) */}
          {/* <CastRightSidebar /> */}
        </div>
      </CastAuthGuard>
    </ToastProvider>
  );
}
