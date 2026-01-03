"use client";

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import React from "react";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface InvitationCardProps {
  onClick?: () => void;
  className?: string;
}

export const InvitationCard: React.FC<InvitationCardProps> = ({
  onClick,
  className,
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative cursor-pointer group transform transition hover:scale-[1.02] active:scale-95 duration-200 select-none",
        className
      )}
    >
      <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-700 via-yellow-500 to-yellow-700 rounded-xl opacity-40 blur-sm"></div>
      <div className="relative bg-slate-900 border border-yellow-800/50 rounded-xl p-5 overflow-hidden">
        <div className="absolute inset-0 animate-shimmer pointer-events-none"></div>
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-yellow-600 text-[10px] tracking-[0.2em] uppercase font-bold">
              Private Invitation
            </p>
            <h3 className="text-white text-lg font-serif-jp">美玲 様からの招待状</h3>
          </div>
        </div>
        <div className="space-y-2 mb-4 border-l-2 border-yellow-800 pl-3">
          <div className="text-slate-300 text-sm">12月10日 (土) 19:00 - 21:00</div>
          <div className="text-slate-300 text-sm">Club VENUS (歌舞伎町)</div>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-slate-800">
          <span className="text-xs text-slate-500">お二人だけの特別な時間</span>
          <span className="text-yellow-400 text-xs font-bold">
            タップして開封 &rarr;
          </span>
        </div>
      </div>
    </div>
  );
};
