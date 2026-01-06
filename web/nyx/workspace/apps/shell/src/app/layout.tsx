import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nyx.place",
  description: "The Ritual of Sovereign Love",
};

import { AuthProvider } from "../modules/identity/hooks/useAuth";

import { BottomNavBar } from "../modules/shell/components/BottomNavBar";
import { DesktopNav } from "../modules/shell/components/DesktopNav";
import { DesktopRightSidebar } from "../modules/shell/components/DesktopSidebars";
import { MobileHeader } from "../modules/shell/components/MobileHeader";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 md:pt-16`}
      >
        <AuthProvider>
          <DesktopNav />
          <div className="relative flex justify-center">
            {/* Main Mobile App Container */}
            <div className="mx-auto min-h-screen w-full max-w-md bg-white relative">
              <MobileHeader />
              {children}
              <BottomNavBar />
            </div>

            {/* Desktop Sidebars (Positioned relative to center) */}
            <DesktopRightSidebar />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
