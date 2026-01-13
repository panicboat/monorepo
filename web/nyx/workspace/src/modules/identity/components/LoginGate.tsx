"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { useAuth } from "@/modules/identity/hooks/useAuth";
// Note: We'll assume lucide-react is available, or use text if not.
import { Smartphone, Mail } from "lucide-react";

export const LoginGate = () => {
  const { requestSMS, verifySMS, register, login, isLoading } = useAuth();
  const [mode, setMode] = useState<"select" | "signin" | "signup_phone" | "signup_verify" | "signup_password">("select");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [error, setError] = useState("");

  const handleSMSRequest = async () => {
    if (phone.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }
    setError("");
    try {
      await requestSMS(phone);
      setMode("signup_verify");
    } catch (e: any) {
       setError("Failed to send SMS. Try again.");
    }
  };

  const handleSMSVerify = async () => {
    try {
      const token = await verifySMS(phone, code);
      setVerificationToken(token);
      setMode("signup_password");
    } catch (e) {
      setError("Invalid code.");
    }
  };

  const handleRegister = async () => {
      try {
          await register(phone, password, verificationToken);
      } catch (e: any) {
          setError(e.message || "Registration failed");
      }
  }

  const handleLogin = async () => {
     try {
         await login(phone, password);
     } catch (e: any) {
         setError("Login failed. Check phone and password.");
     }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 font-serif">
            Nyx
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            The Ritual of Connection
          </p>
        </div>

        {mode === "select" && (
          <div className="space-y-4">
            <button
              onClick={() => setMode("signin")}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 px-4 py-4 text-white shadow-lg transition-all hover:bg-slate-800 active:scale-95"
            >
              <Smartphone className="h-5 w-5" />
              <span className="font-medium">Sign In with Phone</span>
            </button>
            <button
               onClick={() => setMode("signup_phone")}
               className="w-full text-sm font-bold text-pink-500 hover:text-pink-600 py-2"
            >
                Create New Account
            </button>
          </div>
        )}

        {mode === "signin" && (
            <div className="space-y-4">
                 <h2 className="text-xl font-bold text-center">Sign In</h2>
                 <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone Number"
                    className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-pink-500"
                  />
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  <button
                    onClick={handleLogin}
                    disabled={isLoading}
                    className="w-full rounded-xl bg-slate-900 py-4 font-bold text-white shadow-md active:scale-95 disabled:opacity-70"
                  >
                    {isLoading ? "Signing In..." : "Sign In"}
                  </button>
                  <button onClick={() => setMode("select")} className="w-full text-sm text-slate-400">Back</button>
            </div>
        )}

        {mode === "signup_phone" && (
          <div className="space-y-4">
             <h2 className="text-xl font-bold text-center">Create Account</h2>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Phone Number
              </label>
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
              {isLoading ? "Sending..." : "Send Verification Code"}
            </button>
            <button
              onClick={() => setMode("select")}
              className="w-full text-sm text-slate-400 hover:text-slate-600"
            >
              Back
            </button>
          </div>
        )}

        {mode === "signup_verify" && (
          <div className="space-y-4">
             <h2 className="text-xl font-bold text-center">Verify Phone</h2>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Verification Code
              </label>
              <div className="text-xs text-slate-400">Sent to {phone}</div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="0000"
                className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-3 text-lg text-center tracking-widest outline-none ring-2 ring-transparent focus:ring-pink-500 transition-all"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
              onClick={handleSMSVerify}
              disabled={isLoading}
              className="w-full rounded-xl bg-pink-500 py-4 font-bold text-white shadow-md shadow-pink-200 active:scale-95 disabled:opacity-70"
            >
              {isLoading ? "Verifying..." : "Verify Code"}
            </button>
            <button
              onClick={() => setMode("signup_phone")}
              className="w-full text-sm text-slate-400 hover:text-slate-600"
            >
              Back
            </button>
          </div>
        )}

        {mode === "signup_password" && (
            <div className="space-y-4">
                 <h2 className="text-xl font-bold text-center">Set Password</h2>
                 <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min 8 characters"
                        className="w-full rounded-lg border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:ring-pink-500"
                    />
                 </div>
                 {error && <p className="text-sm text-red-500">{error}</p>}
                 <button
                    onClick={handleRegister}
                    disabled={isLoading}
                    className="w-full rounded-xl bg-pink-600 py-4 font-bold text-white shadow-md active:scale-95 disabled:opacity-70"
                 >
                    {isLoading ? "Creating Account..." : "Create Account"}
                 </button>
            </div>
        )}

      </motion.div>
    </div>
  );
};
