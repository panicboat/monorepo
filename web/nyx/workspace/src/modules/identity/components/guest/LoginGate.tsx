"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useAuth } from "@/modules/identity/hooks/useAuth";
// Note: We'll assume lucide-react is available, or use text if not.
import { Smartphone, Mail } from "lucide-react";

export const LoginGate = () => {
  const { loginWithGoogle, requestSMS, verifySMS, isLoading } = useAuth();
  const [mode, setMode] = useState<"select" | "sms_input" | "sms_verify">("select");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const handleGoogle = async () => {
    await loginWithGoogle();
  };

  const handleSMSRequest = async () => {
    if (phone.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }
    setError("");
    await requestSMS(phone);
    setMode("sms_verify");
  };

  const handleSMSVerify = async () => {
    try {
      await verifySMS(code);
    } catch (e) {
      setError("Invalid code (Try 1234)");
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 font-serif">Nyx</h1>
          <p className="mt-2 text-sm text-slate-600">The Ritual of Connection</p>
        </div>

        {mode === "select" && (
          <div className="space-y-4">
            <button
              onClick={handleGoogle}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span className="font-medium">Continue with Google</span>
            </button>

            <button
              onClick={() => setMode("sms_input")}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-4 py-4 text-white shadow-lg transition-all hover:bg-slate-800 active:scale-95"
            >
              <Smartphone className="h-5 w-5" />
              <span className="font-medium">Continue with Phone</span>
            </button>
          </div>
        )}

        {mode === "sms_input" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09012345678"
                className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-3 text-lg outline-none ring-2 ring-transparent focus:ring-pink-500 transition-all"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={handleSMSRequest}
              disabled={isLoading}
              className="w-full rounded-xl bg-slate-900 py-4 font-bold text-white shadow-md active:scale-95 disabled:opacity-70"
            >
              {isLoading ? "Sending..." : "Send Code"}
            </button>
            <button onClick={() => setMode("select")} className="w-full text-sm text-slate-400 hover:text-slate-600">Back</button>
          </div>
        )}

        {mode === "sms_verify" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Verification Code</label>
              <div className="text-xs text-slate-400">Mock code: 1234</div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="1234"
                className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-3 text-lg text-center tracking-widest outline-none ring-2 ring-transparent focus:ring-pink-500 transition-all"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={handleSMSVerify}
              disabled={isLoading}
              className="w-full rounded-xl bg-pink-500 py-4 font-bold text-white shadow-md shadow-pink-200 active:scale-95 disabled:opacity-70"
            >
              {isLoading ? "Verifying..." : "Verify"}
            </button>
            <button onClick={() => setMode("sms_input")} className="w-full text-sm text-slate-400 hover:text-slate-600">Back</button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
