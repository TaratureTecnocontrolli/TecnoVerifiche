import Link from "next/link";
import AppShell from "@/components/AppShell";
import { supabase } from "@/lib/supabase";

type AuditLog = {
  id: string;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

entity_type: string;
  entity_id: string | null;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
};

function formatItalianDateTime(date: string | null) {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

function actionLabel(action: string) {
  if (action === "status_change") {
    return "Cambio stato";
  }

  return action;
}

function entityLabel(entityType: string) {
  if (entityType === "calibration_record") {
    return "Verifica";
  }

  return entityType;
}

function valueToText(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

export default async function AuditLogPage() {
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      `
      id,
      entity_type,
      entity_id,
      action,
      old_data,
      new_data,
      created_by,
      created_at
    `
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const logs = (data ?? []) as AuditLog[];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link
            href="/"
            className="text-sm font-medium text-slate-500 hover:text-slate-950"
          >
            ← Torna alla dashboard
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-slate-950">
            Audit log
          </h1>

          <p className="mt-2 max-w-3xl text-slate-600">
            Registro delle operazioni rilevanti eseguite nel gestionale. Per ora
            tracciamo i cambi stato delle verifiche; più avanti aggiungeremo
            creazioni, modifiche, eliminazioni e validazioni complete.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
            Errore nel caricamento audit log: {error.message}
          </div>
        )}

        <section className="grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Eventi mostrati</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {logs.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Cambi stato</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {logs.filter((log) => log.action === "status_change").length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Ultimi eventi</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">100</p>
          </div>
        </section>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900">
              Registro eventi
            </h2>
            <p className="text-sm text-slate-500">
              Totale eventi caricati: {logs.length}
            </p>
          </div>

          {logs.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">
              Nessun evento registrato.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Data/ora</th>
                    <th className="px-4 py-3">Entità</th>
                    <th className="px-4 py-3">Azione</th>
                    <th className="px-4 py-3">Prima</th>
                    <th className="px-4 py-3">Dopo</th>
                    <th className="px-4 py-3">Utente</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700">
                        {formatItalianDateTime(log.created_at)}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        <p className="font-medium text-slate-900">
                          {entityLabel(log.entity_type)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {log.entity_id ?? "-"}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {actionLabel(log.action)}
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        <p>
                          Stato:{" "}
                          {valueToText(
                            log.old_data?.status_label ?? log.old_data?.status
                          )}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        <p>
                          Stato:{" "}
                          {valueToText(
                            log.new_data?.status_label ?? log.new_data?.status
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {valueToText(log.new_data?.record_number)}
                        </p>
                      </td>

                      <td className="px-4 py-3 text-slate-700">
                        {log.created_by ?? "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <strong>Nota:</strong> quando attiveremo login e RLS, il campo “Utente”
          verrà valorizzato automaticamente con l’utente reale.
        </div>
      </div>
    </AppShell>
  );
}
