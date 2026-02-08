"use client";

import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { overlayVariants, slideUpVariants, springTransition } from "@/lib/motion";

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
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black"
          />

          {/* Drawer */}
          <motion.div
            variants={slideUpVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={springTransition}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl bg-surface p-6 shadow-xl"
            style={{ maxHeight: "80vh" }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-text-primary">Suggest Date</h3>
              <button onClick={onClose} className="text-sm text-text-muted">
                Close
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                Tonight's Smart Picks
              </p>
              <div className="grid grid-cols-2 gap-3">
                {MOCK_SLOTS.map((slot) => (
                  <button
                    key={slot.id}
                    className={`relative flex flex-col items-center justify-center rounded-xl border p-4 transition-colors
                                            ${slot.smart ? "border-info-light bg-info-lighter" : "border-border bg-surface"}
                                        `}
                  >
                    <span className="text-lg font-bold text-text-primary">
                      {slot.time}
                    </span>
                    {slot.smart && (
                      <span className="absolute -top-2 rounded-full bg-role-guest px-2 py-0.5 text-[10px] text-white shadow-sm">
                        {slot.label}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <button className="w-full rounded-full bg-role-guest py-3 font-bold text-white shadow-lg">
                Send Invitation
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
