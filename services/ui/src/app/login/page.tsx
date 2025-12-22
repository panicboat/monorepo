import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full space-y-8 text-center">
        <h1 className="text-3xl font-bold text-white tracking-wider font-serif">PrivateHeaven</h1>

        <div className="space-y-4">
          <Link href="/home" className="block w-full py-4 bg-slate-800 rounded-xl hover:bg-slate-700 transition flex items-center justify-between px-6 group">
            <span className="font-bold text-white">Guest Entry</span>
            <ChevronRight className="text-slate-500 group-hover:text-white transition" />
          </Link>

          <Link href="/cast/home" className="block w-full py-4 bg-yellow-900/20 border border-yellow-800/50 rounded-xl hover:bg-yellow-900/30 transition flex items-center justify-between px-6 group">
            <span className="font-bold text-yellow-500">Cast Login</span>
            <ChevronRight className="text-yellow-700 group-hover:text-yellow-500 transition" />
          </Link>
        </div>
      </div>
    </div>
  );
}
