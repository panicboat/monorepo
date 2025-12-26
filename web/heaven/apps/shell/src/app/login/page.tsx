"use client";

import React, { useState } from "react";
import { Crown, Phone, KeyRound, ArrowRight, Loader } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

type Role = "guest" | "cast";

export default function LoginGatePage() {
  const [role, setRole] = useState<Role>("guest");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    // MSW Integration
    try {
      const res = await fetch('/api/identity/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: phoneNumber || '1234567890',
          verificationCode: verificationCode || '0000'
        })
      });

      if (res.ok) {
        setIsSuccess(true);
        setTimeout(() => {
          if (role === 'cast') {
            router.push("/cast/dashboard");
          } else {
            router.push("/guest/home"); // Landing page for guests
          }
        }, 1500);
      } else {
        setError("Login failed (Invalid code?)");
      }
    } catch (e) {
      console.error(e);
      setError("Network error");
    } finally {
      if (!isSuccess) setTimeout(() => setIsLoading(false), 500);
    }
  };

  return (
    <div className="bg-black text-slate-200 h-screen font-sans flex justify-center overflow-hidden">
      <AnimatePresence>
        {!isSuccess ? (
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
                  PRIVATE
                  <br />
                  HEAVEN
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
              <div className="w-full space-y-4">
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-yellow-500 transition" />
                  <input
                    type="tel"
                    placeholder="Phone Number (Any)"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-yellow-600/50 focus:bg-slate-900 transition text-sm font-mono"
                  />
                </div>

                <div className="relative group">
                  <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-yellow-500 transition" />
                  <input
                    type="password"
                    placeholder="SMS Code (0000)"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-yellow-600/50 focus:bg-slate-900 transition text-sm font-mono tracking-widest"
                  />
                </div>

                {error && <p className="text-red-500 text-xs text-center">{error}</p>}

                <button
                  onClick={handleLogin}
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-yellow-700 to-yellow-600 hover:from-yellow-600 hover:to-yellow-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-yellow-900/20 mt-4 transition active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>{role === "guest" ? "Enter as Guest" : "Login to Dashboard"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

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
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const Particle = () => {
  const size = Math.random() * 4 + 1;
  const duration = Math.random() * 10 + 5;
  const delay = Math.random() * 5;
  const left = Math.random() * 100;

  return (
    <motion.div
      initial={{ y: "100vh", opacity: 0, scale: 0 }}
      animate={{
        y: "-20vh",
        opacity: [0, 0.5, 0.5, 0],
        scale: [0, 1, 1, 1.5],
      }}
      transition={{
        duration: duration,
        repeat: Infinity,
        delay: delay,
        ease: "linear",
      }}
      className="absolute rounded-full bg-yellow-500/30"
      style={{
        width: size,
        height: size,
        left: `${left}%`,
      }}
    />
  );
};
