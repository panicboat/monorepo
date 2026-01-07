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
import { DesktopRightSidebar } from "../modules/shell/components/DesktopSidebars";
import { TopNavBar } from "../modules/shell/components/TopNavBar";

import { ResponsiveMainContainer } from "../modules/shell/components/ResponsiveMainContainer";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50`}
      >
        <AuthProvider>
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
        </AuthProvider>
      </body>
    </html>
  );
}
