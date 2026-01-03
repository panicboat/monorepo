"use client";

import React from "react";
import { useActionState } from "react";
import { registerAction } from "@/app/actions/auth";
import { Mail, Lock, ArrowRight, Loader } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(registerAction, null);

  return (
    <div className="bg-black text-slate-200 h-screen font-sans flex justify-center overflow-hidden">
      <div className="w-full max-w-md bg-slate-950 h-full relative shadow-2xl overflow-hidden flex flex-col items-center justify-center p-8">

        <div className="relative z-10 w-full flex flex-col items-center">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-white tracking-widest">
              REGISTER
            </h1>
            <p className="text-[10px] text-yellow-600/70 mt-2 tracking-[0.3em] uppercase">
              Join Private Heaven
            </p>
          </div>

          <form action={formAction} className="w-full space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-yellow-500 transition" />
              <input
                name="email"
                type="email"
                placeholder="Email Address"
                required
                className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-4 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-yellow-600/50 focus:bg-slate-900 transition text-sm font-mono"
              />
            </div>

            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-yellow-500 transition" />
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
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-xs text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="text-yellow-500 hover:underline">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
