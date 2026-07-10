"use client";

export type ReferenceInstrumentOption = {
  id: string;
  name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serial_number?: string | null;
  internal_code?: string | null;
  measurement_quantity?: string | null;
  unit?: string | null;
  measurement_range?: string | null;
  range?: string | null;
  resolution?: string | null;
  certificate_number?: string | null;
  certificate_expiry?: string | null;
  certificate_file_url?: string | null;
  certificate_file_name?: string | null;
  status?: string | null;
};

function daysToExpiry(date: string | null | undefined) {
  if (!date) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(date);
  expiry.setHours(0, 0, 0, 0);

  const differenceMs = expiry.getTime() - today.getTime();

  return Math.ceil(differenceMs / (1000 * 60 * 60 * 24));
}

export function getEffectiveReferenceInstrumentStatus(
  status: string | null | undefined,
  certificateExpiry: string | null | undefined
) {
  const baseStatus = status || "valid";

  if (baseStatus === "out_of_service") {
    return "out_of_service";
  }

  const days = daysToExpiry(certificateExpiry);

  if (days === null) {
    return baseStatus;
  }

  if (days < 0) {
    return "expired";
  }

  if (days <= 30) {
    return "expiring";
  }

  return "valid";
}

export function isReferenceInstrumentBlocked(status: string) {
  return status === "expired" || status === "out_of_service";
}

function statusLabel(status: string) {
  if (status === "valid") return "Valido";
  if (status === "expiring") return "In scadenza";
  if (status === "expired") return "Scaduto";
  if (status === "out_of_service") return "Fuori servizio";

  return status;
}

function statusBadgeClass(status: string) {
  if (status === "valid") return "bg-emerald-100 text-emerald-800";
  if (status === "expiring") return "bg-amber-100 text-amber-800";
  if (status === "expired") return "bg-red-100 text-red-800";
  if (status === "out_of_service") return "bg-slate-200 text-slate-700";

  return "bg-slate-100 text-slate-700";
}

export function getInstrumentRange(instrument: {
  measurement_range?: string | null;
  range?: string | null;
}) {
  return instrument.measurement_range || instrument.range || null;
}

type ReferenceInstrumentMultiSelectProps = {
  instruments: ReferenceInstrumentOption[];
  selectedIds: string[];
  onToggle: (instrumentId: string) => void;
  label?: string;
  emptyLabel?: string;
};

export default function ReferenceInstrumentMultiSelect({
  instruments,
  selectedIds,
  onToggle,
  label = "Strumenti campione usati *",
  emptyLabel = "Nessuno strumento campione disponibile.",
}: ReferenceInstrumentMultiSelectProps) {
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>

      <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-slate-300 p-3">
        {instruments.length === 0 ? (
          <p className="text-sm text-slate-500">{emptyLabel}</p>
        ) : (
          instruments.map((instrument) => {
            const effectiveStatus = getEffectiveReferenceInstrumentStatus(
              instrument.status,
              instrument.certificate_expiry
            );
            const blocked = isReferenceInstrumentBlocked(effectiveStatus);
            const checked = selectedIds.includes(instrument.id);
            const range = getInstrumentRange(instrument);

            return (
              <label
                key={instrument.id}
                className={
                  "flex items-start gap-3 rounded-lg border p-2 text-sm " +
                  (blocked
                    ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-60"
                    : "cursor-pointer border-slate-100 hover:bg-slate-50")
                }
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={blocked}
                  onChange={() => onToggle(instrument.id)}
                  className="mt-1"
                />

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {instrument.name || "Strumento campione"}
                    </span>

                    <span
                      className={
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold " +
                        statusBadgeClass(effectiveStatus)
                      }
                    >
                      {statusLabel(effectiveStatus)}
                    </span>
                  </div>

                  <p className="mt-0.5 text-xs text-slate-500">
                    {[
                      instrument.internal_code
                        ? "Cod. " + instrument.internal_code
                        : "",
                      range || "",
                      instrument.serial_number
                        ? "Mat. " + instrument.serial_number
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" · ") || "-"}
                  </p>

                  {!instrument.certificate_file_url && (
                    <p className="mt-0.5 text-xs text-amber-700">
                      Certificato file mancante
                    </p>
                  )}
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
