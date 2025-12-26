"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface Cast {
  id: string;
  name: string;
  status: string;
  message: string;
  avatar: string;
  badges: { text: string; color: string }[];
}

export function FollowingList() {
  const [casts, setCasts] = useState<Cast[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    fetch('/api/guest/home')
      .then(res => res.json())
      .then(data => {
        setCasts(data.following || []);
        setOnlineCount(data.onlineCount || 0);
      })
      .catch(err => console.error("Failed to fetch home data", err));
  }, []);

  if (casts.length === 0) return <div className="p-4 text-center text-slate-500 text-xs">Loading...</div>;

  return (
    <div className="space-y-4 pb-24 font-sans">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs text-slate-500 font-bold tracking-wider">
          NOW AVAILABLE
        </p>
        <span className="text-[10px] text-green-500 bg-green-900/20 px-2 py-0.5 rounded-full border border-green-900/50">
          {onlineCount} Online
        </span>
      </div>

      {casts.map((cast) => (
        <React.Fragment key={cast.id}>
          {/* Link wrapper for active cast */}
          {cast.id === 'mirei' ? (
            <Link href={`/casts/${cast.id}`} className="block">
              <CastItem cast={cast} isLink />
            </Link>
          ) : (
            <CastItem cast={cast} />
          )}
          {cast.id === 'jessica' && <div className="h-px bg-slate-800 my-4"></div>}
          {cast.id === 'jessica' && (
            <p className="text-xs text-slate-500 mb-2 font-bold tracking-wider">OTHERS</p>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function CastItem({ cast, isLink }: { cast: Cast, isLink?: boolean }) {
  const isOnline = cast.badges[0].text === 'Online';
  const isOffline = cast.badges[0].text === 'Offline';
  const isTonight = cast.badges[0].text === 'Tonight';

  return (
    <div className={`bg-slate-900 border ${isLink ? 'border-yellow-900/30' : (isOffline ? 'border-slate-800/50 opacity-60' : 'border-slate-800')} rounded-xl p-3 flex items-center gap-4 cursor-pointer hover:bg-slate-800 transition relative overflow-hidden group`}>
      {isLink && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] group-hover:shadow-[0_0_20px_rgba(34,197,94,0.8)] transition"></div>
      )}
      {isOnline && <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500/50"></div>}

      <div
        className={`w-14 h-14 rounded-full bg-slate-700 bg-cover ${isOffline ? 'grayscale' : ''} border border-slate-700 shrink-0`}
        style={{ backgroundImage: `url('${cast.avatar}')` }}
      ></div>

      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-1">
          <h3 className={`font-bold ${isOffline ? 'text-slate-300' : 'text-white'} ${isLink ? 'group-hover:text-yellow-500' : ''} transition`}>
            {cast.name}
          </h3>
          {cast.badges.map((badge, i) => (
            <span key={i} className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${badge.text === 'Tonight' ? 'bg-green-900/40 text-green-400 border-green-800/50' :
              badge.text === 'Online' ? 'bg-slate-800 text-green-500 border-slate-700' :
                'text-slate-600 bg-slate-900'
              }`}>
              {badge.text}
            </span>
          ))}
        </div>
        <p className={`text-xs ${isOffline ? 'text-slate-500' : 'text-slate-400'} line-clamp-1 ${isLink ? 'group-hover:text-slate-300' : ''}`}>
          {cast.message}
        </p>
      </div>
    </div>
  )
}
