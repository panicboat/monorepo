import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function UserMyPage() {
  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen font-sans p-4">
      <header className="mb-6 flex items-center gap-2">
        <Link href="/home">
          <ChevronLeft className="w-6 h-6 text-slate-400" />
        </Link>
        <h1 className="text-xl font-bold text-white">My Page</h1>
      </header>

      <div className="text-center py-20 bg-slate-900/30 rounded-xl border border-dashed border-slate-800">
        <p className="text-slate-500">History, Reviews, and Payment Settings (Mock)</p>
      </div>
    </div>
  );
}
