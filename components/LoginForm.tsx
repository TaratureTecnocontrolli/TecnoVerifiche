"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsLoggingIn(true);
    setErrorMessage("");

    try {
      if (!email.trim()) {
        throw new Error("Inserisci l'email.");
      }

      if (!password) {
        throw new Error("Inserisci la password.");
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw new Error(error.message || "Credenziali non valide.");
      }

      router.replace("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Errore durante l'accesso."
      );
    } finally {
      setIsLoggingIn(false);
    }
  }

  return (
    <form onSubmit={handleLogin} className="space-y-5">
      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setErrorMessage("");
          }}
          autoComplete="email"
          placeholder="nome@azienda.it"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-700">Password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrorMessage("");
          }}
          autoComplete="current-password"
          placeholder="Password"
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
      </label>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoggingIn}
        className="w-full rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        {isLoggingIn ? "Accesso in corso..." : "Accedi"}
      </button>
    </form>
  );
}
