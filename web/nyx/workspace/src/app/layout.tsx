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

import { AuthProvider } from "@/modules/identity/hooks/useAuth";
import { MSWProvider } from "@/mocks/MSWProvider";
import { SWRProvider } from "@/components/providers/SWRProvider";
import { ToastProvider } from "@/components/ui/Toast";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50`}
      >
        <AuthProvider>
          <SWRProvider>
            <MSWProvider>
              <ToastProvider>{children}</ToastProvider>
            </MSWProvider>
          </SWRProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
