"use client";

import React, { useState, useEffect } from "react";
import { Crown, Phone, KeyRound, ArrowRight, Loader } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";

type Role = "guest" | "cast";

export default function LoginGatePage() {
  const [role, setRole] = useState<Role>("guest");
  // const [isSuccess, setIsSuccess] = useState(false);

  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className="bg-black text-slate-200 h-screen font-sans flex justify-center overflow-hidden">
      <AnimatePresence>
        <motion.div
          key="container"
          exit={{ scale: 1.2, opacity: 0, filter: "blur(10px)" }}
          transition={{ duration: 1.5, ease: [0.7, 0, 0.3, 1] }}
          className="w-full max-w-md bg-slate-950 h-full relative shadow-2xl overflow-hidden flex flex-col items-center justify-center p-8"
        >
          {/* Particles Background */}
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <Particle key={i} />
            ))}
          </div>

          <div className="relative z-10 w-full flex flex-col items-center">
            <div className="mb-12 text-center">
              <div className="w-16 h-16 border border-yellow-600/30 rounded-full flex items-center justify-center mx-auto mb-4 bg-yellow-900/10 rotate-45">
                <div className="w-12 h-12 border border-yellow-500/50 rounded-full flex items-center justify-center -rotate-45">
                  <Crown className="w-6 h-6 text-yellow-500" />
                </div>
              </div>
              <h1
                className="text-3xl font-bold text-white tracking-widest"
                style={{ fontFamily: '"Yu Mincho", "Hiragino Mincho ProN", serif' }}
              >
                NYX
              </h1>
              <p className="text-[10px] text-yellow-600/70 mt-3 tracking-[0.3em] uppercase">
                Invitation Only
              </p>
            </div>

            {/* Role Switcher */}
            <div className="bg-slate-900/80 p-1 rounded-xl flex w-full mb-8 border border-slate-800 backdrop-blur-sm">
              <button
                onClick={() => setRole("guest")}
                className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all duration-300 ${role === "guest"
                  ? "text-black bg-white shadow"
                  : "text-slate-500 hover:text-white"
                  }`}
              >
                Guest
              </button>
              <button
                onClick={() => setRole("cast")}
                className={`flex-1 py-3 rounded-lg text-xs font-bold transition-all duration-300 ${role === "cast"
                  ? "text-black bg-yellow-500 shadow"
                  : "text-slate-500 hover:text-white"
                  }`}
              >
                Cast
              </button>
            </div>

            {/* Inputs */}
            <form action={formAction} className="w-full space-y-4">
              <input type="hidden" name="role" value={role} />
              <div className="relative group">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-yellow-500 transition" />
                <input
                  name="email"
                  type="email"
                  placeholder="Email Address"
                  required
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-yellow-600/50 focus:bg-slate-900 transition text-sm font-mono"
                />
              </div>

              <div className="relative group">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-yellow-500 transition" />
                <input
                  name="password"
                  type="password"
                  placeholder="Password"
                  required
                  className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-yellow-600/50 focus:bg-slate-900 transition text-sm font-mono tracking-widest"
                />
              </div>

              {state?.error && <p className="text-red-500 text-xs text-center">{state.error}</p>}

              <button
                type="submit"
                disabled={isPending}
                className="w-full bg-gradient-to-r from-yellow-700 to-yellow-600 hover:from-yellow-600 hover:to-yellow-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-yellow-900/20 mt-4 transition active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isPending ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <span>{role === "guest" ? "Enter as Guest" : "Login to Dashboard"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-4 text-xs text-slate-500 text-center">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-yellow-500 hover:underline">
                Create Account
              </Link>
            </p>

            <p className="mt-8 text-[10px] text-slate-600 text-center leading-relaxed">
              By entering, you agree to our
              <br />
              <a href="#" className="text-slate-500 underline">
                Terms of Service
              </a>{" "}
              &{" "}
              <a href="#" className="text-slate-500 underline">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const Particle = () => {
  const [config, setConfig] = useState({ duration: 5, delay: 0, left: 0, size: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Timeout to avoid synchronization warning and match client-side randomness
    const timer = setTimeout(() => {
      setConfig({
        duration: Math.random() * 10 + 5,
        delay: Math.random() * 5,
        left: Math.random() * 100,
        size: Math.random() * 4 + 1,
      });
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <motion.div
      initial={{ y: "100vh", opacity: 0, scale: 0 }}
      animate={{
        y: "-20vh",
        opacity: [0, 0.5, 0.5, 0],
        scale: [0, 1, 1, 1.5],
      }}
      transition={{
        duration: config.duration,
        repeat: Infinity,
        delay: config.delay,
        ease: "linear",
      }}
      className="absolute rounded-full bg-yellow-500/30"
      style={{
        width: config.size,
        height: config.size,
        left: `${config.left}%`,
      }}
    />
  );
};
