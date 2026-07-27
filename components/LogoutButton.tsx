"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LogoutButton() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setEmail(user?.email ?? "");
    }

    loadUser();
  }, []);

  async function logout() {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-slate-600">
      {email && (
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
          {email}
        </span>
      )}

      <button
        type="button"
        onClick={logout}
        disabled={isLoggingOut}
        className="rounded-full border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {isLoggingOut ? "Uscita..." : "Esci"}
      </button>
    </div>
  );
}
