"use client";

import { motion } from "framer-motion";
import { useState } from "react";

export const PriceSystem = () => {
  return (
    <div className="bg-slate-50 px-6 py-8 space-y-6">
      <h3 className="font-serif font-bold text-lg text-slate-800">System & Plan</h3>

      {/* Standard Plan */}
      <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 bg-pink-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">POPULAR</div>
        <div className="text-sm font-bold text-slate-500 uppercase mb-2">Standard Date</div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-slate-900">¥8,000</span>
          <span className="text-sm text-slate-400">/ 60min</span>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          <li className="flex items-center gap-2">✓ Includes Meal & Cafe</li>
          <li className="flex items-center gap-2">✓ Photo OK (Mobile)</li>
        </ul>
      </div>

      {/* Options */}
      <div className="space-y-3">
        <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-100">
          <span className="text-sm font-medium text-slate-700">Cosplay Request</span>
          <span className="text-sm font-bold text-slate-900">+¥2,000</span>
        </div>
        <div className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-100">
          <span className="text-sm font-medium text-slate-700">Extension (30min)</span>
          <span className="text-sm font-bold text-slate-900">+¥4,000</span>
        </div>
      </div>
    </div>
  );
};

export const ScheduleCalendar = () => {
  // Mock week
  const week = [
    { day: 'Mon', date: '20', status: '○' },
    { day: 'Tue', date: '21', status: '△' },
    { day: 'Wed', date: '22', status: '×' },
    { day: 'Thu', date: '23', status: '○' },
    { day: 'Fri', date: '24', status: '◎' },
    { day: 'Sat', date: '25', status: '◎' },
    { day: 'Sun', date: '26', status: '△' },
  ];

  return (
    <div className="px-6 py-8 bg-white">
      <h3 className="font-serif font-bold text-lg text-slate-800 mb-4">Availability</h3>
      <div className="flex justify-between gap-2 text-center">
        {week.map((item, idx) => (
          <div key={idx} className="flex flex-col items-center gap-2 flex-1">
            <div className="text-xs text-slate-400 font-bold">{item.day}</div>
            <div className={`
                            flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold
                            ${item.status === '◎' ? 'bg-pink-100 text-pink-600' : ''}
                            ${item.status === '○' ? 'bg-green-100 text-green-600' : ''}
                            ${item.status === '△' ? 'bg-yellow-100 text-yellow-600' : ''}
                            ${item.status === '×' ? 'bg-slate-100 text-slate-300' : ''}
                        `}>
              {item.status === '◎' || item.status === '○' || item.status === '△' ? item.date : '-'}
            </div>
            <div className="text-xs font-bold text-slate-500">
              {item.status}
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-slate-400 mt-4">
        ◎ Wide Open  ○ Open  △ Few Left  × Full
      </p>
    </div>
  );
};
