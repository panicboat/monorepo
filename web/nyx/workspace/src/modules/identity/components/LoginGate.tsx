"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { useAuth } from "@/modules/identity/hooks/useAuth";
import { Smartphone, CheckCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoginGateProps {
  variant?: "guest" | "cast";
}

export const LoginGate = ({ variant = "guest" }: LoginGateProps) => {
  const { requestSMS, verifySMS, register, login, isLoading: isAuthLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<
    "select" | "signin" | "signup_phone" | "signup_verify" | "signup_password"
  >("select");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [error, setError] = useState("");

  const isCast = variant === "cast";

  // Dynamic Styles
  const primaryBtnClass = isCast
    ? "bg-role-cast text-white shadow-role-cast-shadow hover:bg-role-cast-hover hover:shadow-role-cast-shadow"
    : "bg-role-guest text-white shadow-role-guest-shadow hover:bg-role-guest-hover hover:shadow-role-guest-shadow";

  const secondaryTextClass = isCast
    ? "text-role-cast hover:text-role-cast-hover"
    : "text-text-secondary hover:text-text-secondary";

  const focusRingClass = isCast ? "focus:ring-role-cast" : "focus:ring-role-guest";

  const handleSMSRequest = async () => {
    if (phone.length < 10) {
      setError("Please enter a valid phone number");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      await requestSMS(phone);
      setMode("signup_verify");
    } catch (e: any) {
      setError("Failed to send SMS. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSMSVerify = async () => {
    setIsSubmitting(true);
    try {
      const token = await verifySMS(phone, code);
      setVerificationToken(token);
      setMode("signup_password");
    } catch (e) {
      setError("Invalid code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    setIsSubmitting(true);
    try {
      const role = isCast ? 2 : 1; // 1=Guest, 2=Cast
      await register(phone, password, verificationToken, role);
    } catch (e: any) {
      setError(e.message || "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async () => {
    setIsSubmitting(true);
    try {
      const role = isCast ? 2 : 1;
      await login(phone, password, role);
    } catch (e: any) {
      setError(e.message || "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-text-primary font-serif">
            {isCast ? "Cast Portal" : "Nyx"}
          </h1>
          <p className="text-sm text-text-secondary">
            {isCast
              ? "Manage your schedule and connect with guests."
              : "The Ritual of Connection"}
          </p>
        </div>

        {mode === "select" && (
          <div className="space-y-4">
            <button
              onClick={() => setMode("signin")}
              className={cn(
                "flex w-full items-center justify-center gap-3 rounded-xl px-4 py-4 font-medium shadow-lg transition-all active:scale-95",
                primaryBtnClass,
              )}
            >
              <Smartphone className="h-5 w-5" />
              <span>Sign In with Phone</span>
            </button>
            <button
              onClick={() => setMode("signup_phone")}
              className={cn("w-full text-sm font-bold py-2", secondaryTextClass)}
            >
              Create New Account
            </button>
          </div>
        )}

        {mode === "signin" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-bold text-center">Sign In</h2>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone Number"
              className={cn(
                "w-full rounded-lg border-border bg-surface-secondary px-4 py-3 outline-none focus:ring-2 transition-all",
                focusRingClass,
              )}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className={cn(
                "w-full rounded-lg border-border bg-surface-secondary px-4 py-3 outline-none focus:ring-2 transition-all",
                focusRingClass,
              )}
            />
            {error && <p className="text-sm text-error">{error}</p>}
            <button
              onClick={handleLogin}
              disabled={isSubmitting}
              className={cn(
                "w-full rounded-xl py-4 font-bold shadow-md active:scale-95 disabled:opacity-70 transition-all",
                primaryBtnClass,
              )}
            >
              {isSubmitting ? "Signing In..." : "Sign In"}
            </button>
            <button
              onClick={() => setMode("select")}
              className="w-full text-sm text-text-muted hover:text-text-secondary"
            >
              Back
            </button>
          </div>
        )}

        {/* Signup Steps share similar UI, simplifying for brevity/consistency */}
        {mode === "signup_phone" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-bold text-center">Create Account</h2>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09012345678"
                className={cn(
                  "w-full rounded-lg border-border bg-surface-secondary px-4 py-3 text-lg outline-none ring-2 ring-transparent transition-all",
                  focusRingClass,
                )}
              />
            </div>
            {error && <p className="text-sm text-error">{error}</p>}

            <button
              onClick={handleSMSRequest}
              disabled={isSubmitting}
              className={cn(
                "w-full rounded-xl py-4 font-bold shadow-md active:scale-95 disabled:opacity-70 transition-all",
                primaryBtnClass,
              )}
            >
              {isSubmitting ? "Sending..." : "Send Verification Code"}
            </button>
            <button
              onClick={() => setMode("select")}
              className="w-full text-sm text-text-muted hover:text-text-secondary"
            >
              Back
            </button>
          </div>
        )}

        {mode === "signup_verify" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-bold text-center">Verify Phone</h2>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">
                Verification Code
              </label>
              <div className="text-xs text-text-muted">Sent to {phone}</div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="0000"
                className={cn(
                  "w-full rounded-lg border-border bg-surface-secondary px-4 py-3 text-lg text-center tracking-widest outline-none ring-2 ring-transparent transition-all",
                  focusRingClass,
                )}
              />
            </div>
            {error && <p className="text-sm text-error">{error}</p>}

            <button
              onClick={handleSMSVerify}
              disabled={isSubmitting}
              className={cn(
                "w-full rounded-xl py-4 font-bold shadow-md active:scale-95 disabled:opacity-70 transition-all",
                primaryBtnClass,
              )}
            >
              {isSubmitting ? "Verifying..." : "Verify Code"}
            </button>
            <button
              onClick={() => setMode("signup_phone")}
              className="w-full text-sm text-text-muted hover:text-text-secondary"
            >
              Back
            </button>
          </div>
        )}

        {mode === "signup_password" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-bold text-center">Set Password</h2>
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-secondary">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                className={cn(
                  "w-full rounded-lg border-border bg-surface-secondary px-4 py-3 outline-none focus:ring-2 transition-all",
                  focusRingClass,
                )}
              />
            </div>
            {error && <p className="text-sm text-error">{error}</p>}
            <button
              onClick={handleRegister}
              disabled={isSubmitting}
              className={cn(
                "w-full rounded-xl py-4 font-bold shadow-md active:scale-95 disabled:opacity-70 transition-all",
                primaryBtnClass,
              )}
            >
              {isSubmitting ? "Creating Account..." : "Create Account"}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
