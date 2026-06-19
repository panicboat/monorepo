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
import { AppShell } from "@/components/shell";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={notoSansJP.variable} suppressHydrationWarning>
      <body className="antialiased bg-bg">
        {/* Blocking script: set data-theme before first paint to prevent a theme
            flash. A raw <script> as the first body child is intentional —
            next/script beforeInteractive lands in <head> and is not guaranteed
            to run before the body paints. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme")||"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){}})();`,
          }}
        />
        <ThemeProvider>
          <AuthProvider>
            <SWRProvider>
              <AppShell>{children}</AppShell>
            </SWRProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
