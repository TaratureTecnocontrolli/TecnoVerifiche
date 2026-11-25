"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { isTechnicalProvisionalRecordNumber } from "@/lib/document-number";

export type ViParticipant = { id: string; name: string; confirmedAt: string | null; mine: boolean; canRevoke: boolean; owner: boolean };
export type ViWorkflow = {
  status: string; saveState: string; saveStartedAt: string | null; canAbandonSave: boolean; operatorName: string | null; ownerAssigned: boolean; editorName: string | null;
  editorAssigned: boolean; isMaster: boolean; isEditor: boolean; isOwner: boolean; canEditMeasures: boolean;
  canClaim: boolean; canRelease: boolean; canManageParticipants: boolean; canEditNumber: boolean;
  canReady: boolean; canIssue: boolean; canReopen: boolean; canReset: boolean;
  myTechnicianId: string | null; mySignatureAvailable: boolean; directorName: string | null; directorAvailable: boolean;
  participants: ViParticipant[]; candidates: { id: string; name: string; userId: string; historical: boolean }[];
  legacyUnmapped: boolean; number: string | null; fallbackNumber: string | null;
  issuedAt: string | null; reopenedAt: string | null;
};
const statusLabels: Record<string, string> = { draft: "Bozza", ready: "Pronto", issued: "Emesso", reopened: "Da correggere" };
const actionClass = "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-50";
function dateLabel(s: string | null) { if (!s) return ""; const d = new Date(s); return Number.isNaN(d.valueOf()) ? "" : d.toLocaleString("it-IT"); }
export default function ViReportWorkflow({ recordId, workflow: w }: { recordId: string; workflow: ViWorkflow }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [number, setNumber] = useState(w.number ?? (isTechnicalProvisionalRecordNumber(w.fallbackNumber) ? "" : w.fallbackNumber ?? ""));
  const [invite, setInvite] = useState("");
  const [owner, setOwner] = useState("");
  const open = w.status !== "issued";
  const allConfirmed = w.participants.length > 0 && w.participants.every(p => p.confirmedAt);
  const numberPresent = Boolean(w.number?.trim() || (w.fallbackNumber?.trim() && !isTechnicalProvisionalRecordNumber(w.fallbackNumber)));
  const prerequisites = w.saveState === "complete" && w.ownerAssigned && allConfirmed && !w.legacyUnmapped && numberPresent && w.directorAvailable && w.mySignatureAvailable;
  const eligible = w.candidates.filter(c => !w.participants.some(p => p.id === c.id));
  const ownerCandidates = w.candidates.filter(c => c.name.trim().toLocaleLowerCase("it-IT") === (w.operatorName ?? "").trim().toLocaleLowerCase("it-IT") || c.historical);
  async function run(action: string, target: string | null = null, value: string | null = null, confirmText?: string) {
    if (busy || (confirmText && !window.confirm(confirmText))) return;
    setBusy(true); setError("");
    try {
      const { error: rpcError } = await supabase.rpc("tv12_action", { p_record_id: recordId, p_action: action, p_target: target, p_number: value });
      if (rpcError) throw new Error(rpcError.message);
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Operazione non riuscita."); setBusy(false); }
  }
  return <section className="print-hidden space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold text-slate-900">Gestione rapportino VI</h2><p className="text-sm text-slate-600">Esecutori, redazione e conferme personali.</p></div>
      <span className={"rounded-full px-4 py-1.5 text-sm font-bold " + (w.status === "issued" ? "bg-emerald-100 text-emerald-900" : w.status === "ready" ? "bg-sky-100 text-sky-900" : "bg-amber-100 text-amber-900")}>{statusLabels[w.status] ?? w.status}</span>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border p-3"><p className="text-xs font-semibold uppercase text-slate-500">Esecutore originale</p><p className="font-semibold">{w.operatorName || "Non indicato"}</p>{!w.ownerAssigned && open && <p className="text-xs text-amber-800">Identità storica da associare a un account dal MASTER.</p>}</div>
      <div className="rounded-xl border p-3"><p className="text-xs font-semibold uppercase text-slate-500">Redattore</p><p className="font-semibold">{w.editorName || (w.status === "issued" ? "Rapportino storico" : "Non assegnato")}{w.isEditor && " (tu)"}</p></div>
    </div>
    <div className="flex flex-wrap gap-2">
      {w.canClaim && <button type="button" className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={busy} onClick={() => run("claim", null, null, "Prendere in carico la redazione? Le misure e le firme degli esecutori restano invariate.")}>Prendi in carico il rapportino</button>}
      {w.canRelease && <button type="button" className={actionClass} disabled={busy} onClick={() => run("release", null, null, "Liberare la redazione? Le firme degli esecutori rimangono salvate.")}>Libera presa in carico</button>}
      {w.canReopen && <button type="button" className={actionClass} disabled={busy} onClick={() => run("reopen", null, null, "Riaprire questa VI? Il rapporto torna da correggere; le firme degli esecutori restano registrate.")}>Riapri per correzione</button>}
    </div>
    {open && w.saveState !== "complete" && <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><p>Salvataggio misure {w.saveState === "incomplete" ? "non completato: correggere e salvare nuovamente le misure" : "in corso o interrotto"}. Conferma ed emissione sospese.</p>{w.saveStartedAt && <p className="text-xs">Avviato il {dateLabel(w.saveStartedAt)}</p>}{w.canAbandonSave && <button type="button" className={actionClass + " mt-2"} disabled={busy} onClick={() => run("abandon_save", null, null, "Confermi che nessuno sta più salvando? Il salvataggio risulterà incompleto fino a un nuovo salvataggio corretto.")}>Recupera salvataggio interrotto</button>}</div>}
    {open && !w.editorAssigned && !w.canClaim && <p className="text-sm text-amber-800">Per la presa in carico occorre un account associato a una firma personale. Il MASTER senza firma può far prendere in carico il documento a un tecnico.</p>}
    {open && w.isMaster && !w.ownerAssigned && <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-semibold">Associa l'esecutore storico (senza cambiare il nominativo originale)</p><div className="flex flex-wrap gap-2"><select className="rounded-lg border p-2 text-sm" value={owner} onChange={e => setOwner(e.target.value)}><option value="">Seleziona account corrispondente</option>{ownerCandidates.map(c => <option key={c.userId} value={c.userId}>{c.name}</option>)}</select><button type="button" className={actionClass} disabled={busy || !owner} onClick={() => run("assign_owner", owner, null, "Confermi l'associazione all'esecutore storico?")}>Associa</button></div>{ownerCandidates.length === 0 && <p className="text-xs">Nessuna corrispondenza univoca: controlla l'anagrafica Tecnici e firme e Utenti e permessi.</p>}</div>}
    <div className="space-y-2">
      <h3 className="font-semibold">Tecnici addetti alle prove</h3>
      {w.participants.length === 0 && <p className="text-sm text-slate-500">Nessun esecutore associato al nuovo workflow.</p>}
      {w.participants.map(p => <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"><div><p className="font-semibold text-sm">{p.name}{p.owner && " · principale"}{p.mine && " (tu)"}</p><p className={"text-xs " + (p.confirmedAt ? "text-emerald-800" : "text-slate-600")}>{p.confirmedAt ? "Confermata il " + dateLabel(p.confirmedAt) : open ? "In attesa di conferma personale" : "Firma storica / non registrata con REV.12"}</p></div><div className="flex flex-wrap gap-2">
      {open && p.mine && !p.confirmedAt && <button type="button" className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !w.mySignatureAvailable || w.saveState !== "complete"} onClick={() => run("confirm", null, null, "Confermi di aver eseguito le prove e verificato le misure salvate? La tua firma sarà registrata e le misure congelate.")}>Conferma la mia firma</button>}
      {p.canRevoke && <button type="button" className={actionClass} disabled={busy} onClick={() => run("revoke", null, null, "Revocare la tua conferma? Dovrai confermare nuovamente dopo eventuali correzioni.")}>Revoca mia conferma</button>}
      {w.canManageParticipants && !p.owner && !p.confirmedAt && <button type="button" className={actionClass} disabled={busy} onClick={() => run("remove", p.id, null, "Rimuovere il partecipante non confermato? I firmatari storici non sono rimovibili.")}>Rimuovi</button>}
      </div></div>)}
      {w.canManageParticipants && <div className="flex flex-wrap gap-2"><select value={invite} onChange={e => setInvite(e.target.value)} className="rounded-lg border p-2 text-sm"><option value="">Aggiungi un co-esecutore</option>{eligible.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><button type="button" className={actionClass} disabled={busy || !invite} onClick={() => run("invite", invite)}>Aggiungi</button></div>}
      {w.canReset && <button type="button" className={actionClass} disabled={busy} onClick={() => run("reset", null, null, "Revocare tutte le conferme per correggere le misure? Le firme precedenti restano nell'audit; gli esecutori dovranno riconfermare personalmente.")}>Sblocca misure (revoca conferme)</button>}
      {open && !w.canEditMeasures && <p className="text-xs text-slate-600">Misure in sola lettura per il tuo profilo oppure già confermate da un esecutore.</p>}
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border p-3 space-y-2"><h3 className="font-semibold text-sm">Numero rapportino VI</h3><p className="text-xs text-slate-500">Numero definitivo comunicato dall'ufficio.</p>{w.canEditNumber ? <div className="flex flex-wrap gap-2"><input value={number} onChange={e => setNumber(e.target.value)} placeholder="VI-001A-26" className="min-w-0 flex-1 rounded-lg border p-2 text-sm"/><button type="button" className={actionClass} disabled={busy} onClick={() => run("number", null, number)}>Salva numero</button></div> : <p className="font-semibold">{number || "Non assegnato"}</p>}</div>
      <div className="rounded-xl border p-3"><h3 className="font-semibold text-sm">Direzione laboratorio</h3><p className="text-sm">{w.directorName || "Non configurata"}</p>{open && !w.directorAvailable && <p className="text-xs text-amber-800">Firma del direttore mancante: configurare in Tecnici e firme.</p>}<p className="text-xs text-slate-500">Firmatario fisso secondo la configurazione esistente.</p></div>
    </div>
    {w.legacyUnmapped && open && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Esiste una firma storica senza identificativo. Non viene cancellata automaticamente: emissione sospesa fino a verifica del MASTER.</p>}
    {open && w.isEditor && <div className="space-y-2 rounded-xl bg-slate-50 p-3"><p className="font-semibold text-sm">Emissione</p><p className="text-xs text-slate-600">Occorrono numero definitivo, conferme di tutti gli esecutori, firma personale del redattore e firma del direttore. La firma del redattore viene registrata soltanto all'emissione.</p><div className="flex flex-wrap gap-2">{w.canReady && <button type="button" className={actionClass} disabled={busy || !prerequisites} onClick={() => run("ready")}>Segna pronto</button>}{w.canIssue && <button type="button" className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50" disabled={busy || !prerequisites} onClick={() => run("issue", null, null, "Confermi di avere redatto e verificato il rapportino? La tua firma sarà registrata e la VI sarà emessa e bloccata.")}>Emetti rapportino</button>}</div></div>}
    {w.status === "issued" && <p className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">Emesso. Documento in sola lettura. Solo il MASTER può riaprire.</p>}
    {busy && <p className="text-sm text-slate-600">Registrazione in corso...</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
  </section>;
}
