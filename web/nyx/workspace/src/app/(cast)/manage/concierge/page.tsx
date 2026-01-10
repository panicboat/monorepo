import { Button } from "@/components/ui/Button";
import { MessageSquare, Search } from "lucide-react";
import Link from "next/link";

export default function ConciergePage() {
  return (
    <div className="flex flex-col min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100 p-4">
        <h1 className="text-xl font-bold text-slate-900">Concierge</h1>
        <p className="text-xs text-slate-500 mt-1">
          運営事務局やゲストからの連絡を確認できます
        </p>
      </div>

      {/* Search / Filter (Placeholder) */}
      <div className="p-4 bg-slate-50/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search messages..."
            className="w-full h-10 pl-10 pr-4 rounded-full bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 transition-all font-sans"
          />
        </div>
      </div>

      {/* Empty State / Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-forwards">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 rotate-3 transform transition-transform hover:rotate-6 hover:scale-105 duration-300">
          <MessageSquare className="text-slate-400" size={32} />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-2">No Messages Yet</h3>
        <p className="text-slate-500 text-sm max-w-xs leading-relaxed mb-8">
          現在はまだメッセージがありません。<br />
          新しい連絡やお知らせはここに表示されます。
        </p>

        <Button variant="outline" className="rounded-full px-6" disabled>
          Check Archives
        </Button>
      </div>
    </div>
  );
}
