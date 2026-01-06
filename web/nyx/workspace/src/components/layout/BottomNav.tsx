"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, History } from "lucide-react";
import clsx from "clsx";

export function BottomNav() {
  const pathname = usePathname();

  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <nav className="bg-slate-950 border-t border-slate-800 h-16 flex items-center justify-around z-20 pb-safe">
      <Link
        href="/guest/home"
        className={clsx(
          "flex flex-col items-center gap-1 w-16 transition",
          isActive("/guest/home") ? "text-yellow-500" : "text-slate-500 hover:text-white"
        )}
      >
        <Home className="w-6 h-6" />
        <span className="text-[9px] font-bold">Home</span>
      </Link>

      <Link
        href="/guest/chats"
        className={clsx(
          "flex flex-col items-center gap-1 w-16 transition",
          isActive("/guest/chats") ? "text-yellow-500" : "text-slate-500 hover:text-white"
        )}
      >
        <div className="relative">
          <MessageSquare className={clsx("w-6 h-6", isActive("/guest/chats") && "fill-yellow-500/20")} />
          {/* Mock notification badge */}
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-950"></div>
        </div>
        <span className="text-[9px] font-bold">Talk</span>
      </Link>

      <Link
        href="/guest/history"
        className={clsx(
          "flex flex-col items-center gap-1 w-16 transition",
          isActive("/guest/history") ? "text-yellow-500" : "text-slate-500 hover:text-white"
        )}
      >
        <History className="w-6 h-6" />
        <span className="text-[9px]">History</span>
      </Link>
    </nav>
  );
}
