"use client";

import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";

// Mock Availabilities
const MOCK_SLOTS = [
  { id: 1, time: "21:00", smart: true, label: "Recommended" },
  { id: 2, time: "21:30", smart: false, label: "" },
  { id: 3, time: "22:00", smart: true, label: "High Match" },
  { id: 4, time: "22:30", smart: false, label: "" },
];

export const SmartDrawer = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-white p-6 shadow-xl"
            style={{ maxHeight: "80vh" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Suggest Date</h3>
              <button onClick={onClose} className="text-sm text-slate-400">
                Close
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Tonight's Smart Picks
              </p>
              <div className="grid grid-cols-2 gap-3">
                {MOCK_SLOTS.map((slot) => (
                  <button
                    key={slot.id}
                    className={`relative flex flex-col items-center justify-center rounded-xl border p-4 transition-colors
                                            ${slot.smart ? "border-pink-200 bg-pink-50" : "border-slate-100 bg-white"}
                                        `}
                  >
                    <span className="text-lg font-bold text-slate-800">
                      {slot.time}
                    </span>
                    {slot.smart && (
                      <span className="absolute -top-2 rounded-full bg-pink-500 px-2 py-0.5 text-[10px] text-white shadow-sm">
                        {slot.label}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <button className="w-full rounded-full bg-slate-900 py-3 font-bold text-white shadow-lg">
                Send Invitation
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
