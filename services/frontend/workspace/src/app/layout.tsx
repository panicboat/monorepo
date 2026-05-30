import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "dystopia.city",
  description: "The Ritual of Sovereign Love",
};

import { AuthProvider } from "@/modules/identity/hooks/useAuth";
import { SWRProvider } from "@/components/providers/SWRProvider";
import { ToastProvider } from "@/components/ui/Toast";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={notoSansJP.variable} suppressHydrationWarning>
      <body className="antialiased bg-bg">
        <AuthProvider>
          <SWRProvider>
            <ToastProvider>{children}</ToastProvider>
          </SWRProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
