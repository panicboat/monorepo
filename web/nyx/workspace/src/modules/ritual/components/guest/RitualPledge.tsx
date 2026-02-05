"use client";

import { motion, useAnimation } from "motion/react";
import { useRef } from "react";
import { useRitual } from "../../hooks/useRitual";

export const RitualPledge = ({
  ritualId = "mock-ritual-1",
}: {
  ritualId?: string;
}) => {
  const { status, setStatus, seal } = useRitual(ritualId);
  const controls = useAnimation();
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const startPress = () => {
    if (status === "sealed") return;
    setStatus("pledging"); // Using 'pledging' maps to 'pressing' UI state conceptually
    controls.start({ scale: 0.95 });

    // 2 seconds to seal
    pressTimer.current = setTimeout(() => {
      completeSeal();
    }, 2000);
  };

  const cancelPress = () => {
    if (status === "sealed") return;
    setStatus("idle");
    controls.start({ scale: 1 });
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const completeSeal = async () => {
    await seal();
    controls.start({
      scale: 1.1,
      textShadow: "0px 0px 20px rgba(255,215,0,0.8)",
    });
  };

  return (
    <div className="flex flex-col items-center gap-6 p-8">
      <div className="text-center">
        <h2 className="text-2xl font-serif font-bold text-text-primary">
          The Pledge
        </h2>
        <p className="text-sm text-text-secondary">
          Long press to seal your promise.
        </p>
      </div>

      <motion.button
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        animate={controls}
        className={`relative flex h-32 w-32 items-center justify-center rounded-full border-4 transition-colors duration-500
          ${status === "idle" ? "border-border bg-surface" : ""}
          ${status === "pledging" ? "border-info-light bg-info-lighter" : ""}
          ${status === "sealed" ? "border-error-hover bg-error" : ""}
        `}
      >
        {status === "idle" && (
          <span className="font-serif text-text-muted">PLEDGE</span>
        )}
        {status === "pledging" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 rounded-full border-4 border-info"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0% 100%)" }}
            transition={{ duration: 0.2 }}
          />
        )}
        {status === "sealed" && (
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="text-4xl"
          >
            🔥
          </motion.div>
        )}
      </motion.button>

      {status === "sealed" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="font-serif text-lg font-bold text-error-hover"
        >
          PLEDGE SEALED
        </motion.div>
      )}
    </div>
  );
};
