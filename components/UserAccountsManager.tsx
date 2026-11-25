"use client";

import { useEffect, useMemo, useState } from "react";

type Technician = {
  id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
};

type UserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  role: "master" | "technician" | null;
  technician_id: string | null;
  technician_name: string | null;
  is_active: boolean;
};

type EditableUser = UserRow & {
  password: string;
};

function roleLabel(role: UserRow["role"]) {
  if (role === "master") return "MASTER";
  if (role === "technician") return "TECNICO";
  return "NON CONFIGURATO";
}

export default function UserAccountsManager() {
  const [users, setUsers] = useState<EditableUser[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"master" | "technician">("technician");
  const [newTechnicianId, setNewTechnicianId] = useState("");

  const activeTechnicians = useMemo(
    () => technicians.filter((technician) => technician.is_active),
    [technicians]
  );

  async function load() {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Errore caricamento utenti.");

      setUsers(
        (payload.users ?? []).map((user: UserRow) => ({ ...user, password: "" }))
      );
      setTechnicians((payload.technicians ?? []) as Technician[]);
      setCurrentUserId(typeof payload.current_user_id === "string" ? payload.current_user_id : "");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Errore caricamento utenti.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // Il caricamento iniziale avviene una sola volta all'apertura della pagina.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          role: newRole,
          technician_id: newRole === "technician" ? newTechnicianId : newTechnicianId || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Errore creazione utente.");

      setNewEmail("");
      setNewPassword("");
      setNewRole("technician");
      setNewTechnicianId("");
      setMessage("Account creato correttamente.");
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Errore creazione utente.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateLocalUser(userId: string, patch: Partial<EditableUser>) {
    setUsers((current) =>
      current.map((user) => (user.id === userId ? { ...user, ...patch } : user))
    );
    setMessage("");
    setErrorMessage("");
  }

  async function saveUser(user: EditableUser) {
    setIsSaving(true);
    setMessage("");
    setErrorMessage("");

    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          role: user.role ?? "technician",
          technician_id: user.technician_id,
          is_active: user.is_active,
          password: user.password || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Errore aggiornamento utente.");

      setMessage(`Profilo ${user.email ?? user.id} aggiornato.`);
      await load();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Errore aggiornamento utente.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Caricamento utenti...</div>;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">Crea account</h2>
        <p className="mt-1 text-sm text-slate-600">
          I profili TECNICO devono essere collegati a un nominativo presente in “Tecnici e firme”.
        </p>

        <form onSubmit={createUser} className="mt-5 grid gap-4 lg:grid-cols-4">
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Email *</span>
            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Password iniziale *</span>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Profilo *</span>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as "master" | "technician")} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="technician">TECNICO</option>
              <option value="master">MASTER</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium text-slate-700">Tecnico associato {newRole === "technician" ? "*" : ""}</span>
            <select value={newTechnicianId} onChange={(e) => setNewTechnicianId(e.target.value)} required={newRole === "technician"} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="">Nessuno</option>
              {activeTechnicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.full_name}</option>)}
            </select>
          </label>
          <div className="lg:col-span-4 flex justify-end">
            <button disabled={isSaving} className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-60">{isSaving ? "Salvataggio..." : "Crea account"}</button>
          </div>
        </form>
      </section>

      {errorMessage && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{errorMessage}</div>}
      {message && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{message}</div>}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-bold text-slate-950">Utenti configurati</h2>
          <p className="text-sm text-slate-500">Totale account: {users.length}</p>
        </div>
        <div className="overflow-x-auto tc-sticky-table" tabIndex={0} role="region" aria-label="Tabella scorrevole">
          <table className="w-full min-w-[1150px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Profilo</th>
                <th className="px-4 py-3">Tecnico associato</th>
                <th className="px-4 py-3">Attivo</th>
                <th className="px-4 py-3">Nuova password</th>
                <th className="px-4 py-3">Ultimo accesso</th>
                <th className="px-4 py-3">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3"><p className="font-semibold text-slate-900">{user.email ?? "-"}{user.id === currentUserId ? " (tu)" : ""}</p><p className="text-xs text-slate-400">{user.id}</p></td>
                  <td className="px-4 py-3">
                    <select value={user.role ?? "technician"} onChange={(e) => updateLocalUser(user.id, { role: e.target.value as "master" | "technician" })} disabled={user.id === currentUserId} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 disabled:bg-slate-100">
                      <option value="technician">TECNICO</option><option value="master">MASTER</option>
                    </select>
                    {!user.role && <p className="mt-1 text-xs text-amber-700">{roleLabel(user.role)}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <select value={user.technician_id ?? ""} onChange={(e) => updateLocalUser(user.id, { technician_id: e.target.value || null })} className="min-w-[220px] rounded-lg border border-slate-300 bg-white px-2 py-1.5">
                      <option value="">Nessuno</option>
                      {technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.full_name}{technician.is_active ? "" : " (non attivo)"}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3"><input type="checkbox" checked={user.is_active} onChange={(e) => updateLocalUser(user.id, { is_active: e.target.checked })} disabled={user.id === currentUserId} /></td>
                  <td className="px-4 py-3"><input type="password" value={user.password} onChange={(e) => updateLocalUser(user.id, { password: e.target.value })} placeholder="Lascia vuoto" className="w-44 rounded-lg border border-slate-300 px-2 py-1.5" /></td>
                  <td className="px-4 py-3 text-slate-600">{user.last_sign_in_at ? new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short" }).format(new Date(user.last_sign_in_at)) : "-"}</td>
                  <td className="px-4 py-3"><button type="button" onClick={() => void saveUser(user)} disabled={isSaving} className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">Salva</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
