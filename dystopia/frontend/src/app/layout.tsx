import type { Metadata, Viewport } from "next";
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
  // "black" keeps the page below the status bar; "black-translucent" would draw the top bar under it.
  appleWebApp: { capable: true, title: "dystopia.city", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#14161a" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

import { AuthProvider } from "@/modules/identity/hooks/useAuth";
import { SWRProvider } from "@/components/providers/SWRProvider";
import { AppShell } from "@/components/shell";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { ToastHost } from "@/components/ui/ToastHost";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={notoSansJP.variable} suppressHydrationWarning>
      <body className="antialiased bg-bg">
        {/* Set the theme before first paint because next/script is not guaranteed to run before body paint. */}
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
        <ToastHost />
      </body>
    </html>
  );
}
