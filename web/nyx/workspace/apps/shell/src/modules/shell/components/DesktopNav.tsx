"use client";

import Link from "next/link";
import { Home, Search, MessageCircle, User } from "lucide-react";
import { useAuth } from "../../identity/hooks/useAuth";

export const DesktopNav = () => {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) return null;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 hidden h-16 items-center justify-between bg-white px-8 shadow-sm md:flex">
      <div className="flex items-center gap-8">
        <Link href="/" className="font-serif text-2xl font-bold tracking-tight text-slate-900">
          Nyx.
        </Link>
        <div className="flex items-center gap-6">
          <NavLink href="/" icon={Home} label="Home" />
          <NavLink href="/search" icon={Search} label="Search" />
          <NavLink href="/concierge" icon={MessageCircle} label="Concierge" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Link href="/mypage" className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100">
          <User size={18} />
          <span>My Page</span>
        </Link>
      </div>
    </nav>
  );
};

const NavLink = ({ href, icon: Icon, label }: { href: string; icon: any; label: string }) => (
  <Link href={href} className="flex items-center gap-2 text-slate-500 hover:text-pink-500 transition-colors">
    <Icon size={20} />
    <span className="font-bold">{label}</span>
  </Link>
);
