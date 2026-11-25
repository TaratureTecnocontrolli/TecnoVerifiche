"use client";

import { useMemo, useState } from "react";
import {normalizeLabSite} from "@/lib/lab-sites";
import {readAllRows} from "@/lib/read-all-rows";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

type ImportKind =
  | "customers"
  | "customer_instruments"
  | "reference_instruments"
  | "internal_instruments";

type ImportWizardProps = {
  kind: ImportKind;
};

type ImportMappedRow = {
  customer_number: string;
  business_name: string;
  customer_name: string;
  address: string;
  postal_code: string;
  city: string;
  province: string;
  contact_person: string;
  email: string;
  phone: string;
  name: string;
  manufacturer: string;
  model: string;
  serial_number: string;
  internal_code: string;
  measurement_quantity: string;
  unit: string;
  measurement_range: string;
  certificate_number: string;
  certificate_date: string;
  certificate_expiry: string;
  status: string;
  department: string;
  location: string;
  notes: string;
};

type MetrologyImport = {site:string|null; values:Record<string,string|number>; errors:string[]};

type ParsedRow = {
  metrology?:MetrologyImport;
  rowNumber: number;
  raw: Record<string, unknown>;
  mapped: ImportMappedRow;
  status: "valid" | "warning" | "error" | "imported" | "updated" | "unchanged" | "conflict";
  messages: string[];
};

type ExistingCustomer = {
  id: string;
  customer_number: string | null;
  business_name: string;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  province?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
};

type ExistingInstrument = {
  lab_site?:string|null;
  id: string;
  customer_id?: string | null;
  name: string | null;
  manufacturer?: string | null;
  model?: string | null;
  internal_code: string | null;
  serial_number: string | null;
  measurement_quantity?: string | null;
  unit?: string | null;
  measurement_range?: string | null;
  certificate_number?: string | null;
  certificate_date?: string | null;
  certificate_expiry?: string | null;
  status?: string | null;
  department?: string | null;
  location?: string | null;
  notes?: string | null;
};

type ImportResult = {
  inserted: number;
  updated: number;
  unchanged: number;
  errors: number;
};

type ImportConfig = {
  title: string;
  description: string;
  tableName: string;
  requiredColumns: string[];
  templateColumns: string[];
};

const IMPORT_CONFIGS: Record<ImportKind, ImportConfig> = {
  customers: {
    title: "Importazione massiva clienti",
    description:
      "Importa clienti da file Excel o CSV. Le anagrafiche esistenti vengono riconosciute e completate senza sovrascrivere i dati già valorizzati.",
    tableName: "customers",
    requiredColumns: ["Ragione Sociale"],
    templateColumns: [
      "Codice Cliente",
      "Ragione Sociale",
      "Indirizzo",
      "CAP",
      "Città",
      "Provincia",
      "Referente",
      "Email",
      "Telefono",
      "Note",
    ],
  },
  customer_instruments: {
    title: "Importazione massiva strumenti cliente",
    description:
      "Importa strumenti collegandoli al cliente tramite Codice Cliente o Ragione Sociale.",
    tableName: "customer_instruments",
    requiredColumns: ["Cliente oppure Codice Cliente", "Nome Strumento"],
    templateColumns: [
      "Codice Cliente",
      "Cliente",
      "Nome Strumento",
      "Costruttore",
      "Modello",
      "Matricola",
      "Grandezza",
      "Unità",
      "Fondo Scala",
      "Note",
    ],
  },
  reference_instruments: {
    title: "Importazione massiva strumenti campione",
    description:
      "Importa strumenti campione. I dati certificato possono essere importati come informazioni, senza file allegato.",
    tableName: "reference_instruments",
    requiredColumns: ["Nome Strumento"],
    templateColumns: [
      "Nome Strumento",
      "Codice Interno",
      "Costruttore",
      "Modello",
      "Matricola",
      "Grandezza",
      "Unità",
      "Fondo Scala",
      "Numero Certificato",
      "Data Certificato",
      "Scadenza Certificato",
      "Stato",
      "Note",
      "Sede",
      "Codice OnTrack",
      "AVCP",
      "LAB",
      "Criteri di accettabilità",
      "Istruzione operativa",
      "Periodicità VI (mesi)",
      "Periodicità LAT (mesi)",
      "Periodicità RdT (mesi)",
      "Prima scadenza VI",
      "Prima scadenza LAT",
      "Prima scadenza RdT",
      "Note metrologiche",
    ],
  },
  internal_instruments: {
    title: "Importazione massiva strumenti interni",
    description:
      "Importa strumenti interni aziendali da usare per le verifiche interne VI.",
    tableName: "internal_instruments",
    requiredColumns: ["Nome Strumento"],
    templateColumns: [
      "Nome Strumento",
      "Codice Interno",
      "Costruttore",
      "Modello",
      "Matricola",
      "Grandezza",
      "Unità",
      "Fondo Scala",
      "Reparto",
      "Ubicazione",
      "Stato",
      "Note",
      "Sede",
      "AVCP",
      "LAB",
      "Criteri di accettabilità",
      "Istruzione operativa",
      "Periodicità VI (mesi)",
      "Periodicità LAT (mesi)",
      "Periodicità RdT (mesi)",
      "Prima scadenza VI",
      "Prima scadenza LAT",
      "Prima scadenza RdT",
      "Note metrologiche",
    ],
  },
};

const HEADER_ALIASES: Record<keyof ImportMappedRow, string[]> = {
  customer_number: [
    "codice cliente",
    "codice_cliente",
    "numero cliente",
    "numero_cliente",
    "customer number",
    "customer_number",
  ],
  business_name: [
    "ragione sociale",
    "ragione_sociale",
    "cliente",
    "business name",
    "business_name",
    "denominazione",
  ],
  customer_name: [
    "cliente",
    "ragione sociale",
    "ragione_sociale",
    "business name",
    "business_name",
    "denominazione",
  ],
  address: ["indirizzo", "address", "via"],
  postal_code: ["cap", "postal code", "postal_code", "codice postale"],
  city: ["città", "citta", "city", "comune"],
  province: ["provincia", "province", "prov"],
  contact_person: [
    "referente",
    "contact person",
    "contact_person",
    "contatto",
    "persona contatto",
  ],
  email: ["email", "e-mail", "mail"],
  phone: ["telefono", "phone", "tel", "cellulare"],
  name: [
    "nome strumento",
    "nome_strumento",
    "strumento",
    "name",
    "instrument",
  ],
  manufacturer: ["costruttore", "manufacturer", "marca", "produttore"],
  model: ["modello", "model"],
  serial_number: [
    "matricola",
    "serial number",
    "serial_number",
    "seriale",
    "s/n",
    "sn",
  ],
  internal_code: [
    "codice interno",
    "codice_interno",
    "internal code",
    "internal_code",
    "codice",
  ],
  measurement_quantity: [
    "grandezza",
    "grandezza misurata",
    "grandezza_misurata",
    "measurement quantity",
    "measurement_quantity",
  ],
  unit: ["unità", "unita", "unità misura", "unita misura", "unit"],
  measurement_range: [
    "fondo scala",
    "fondo_scala",
    "campo",
    "campo misura",
    "campo di misura",
    "measurement range",
    "measurement_range",
  ],
  certificate_number: [
    "numero certificato",
    "numero_certificato",
    "certificato",
    "certificate number",
    "certificate_number",
  ],
  certificate_date: [
    "data certificato",
    "data_certificato",
    "certificate date",
    "certificate_date",
  ],
  certificate_expiry: [
    "scadenza certificato",
    "scadenza_certificato",
    "certificate expiry",
    "certificate_expiry",
    "scadenza",
  ],
  status: ["stato", "status"],
  department: ["reparto", "settore", "department"],
  location: ["ubicazione", "location"],
  notes: ["note", "notes", "annotazioni"],
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeKey(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeStatus(value: string, kind: ImportKind) {
  const normalized = normalizeKey(value);

  if (!normalized) {
    return kind === "reference_instruments" ? "valid" : "active";
  }

  if (["dismesso", "dismessa", "dismissed"].includes(normalized)) {
    return "dismissed";
  }

  if (
    [
      "fuori servizio",
      "fuori servizio ",
      "out of service",
      "out_of_service",
      "non operativo",
    ].includes(normalized)
  ) {
    return "out_of_service";
  }

  if (kind === "reference_instruments") {
    return "valid";
  }

  return "active";
}

function normalizeDate(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const month = String(parsed.m).padStart(2, "0");
      const day = String(parsed.d).padStart(2, "0");
      return `${parsed.y}-${month}-${day}`;
    }
  }

  const text = normalizeText(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const italianMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (italianMatch) {
    const day = italianMatch[1].padStart(2, "0");
    const month = italianMatch[2].padStart(2, "0");
    const year = italianMatch[3];
    return `${year}-${month}-${day}`;
  }

  return text;
}

function findValue(row: Record<string, unknown>, field: keyof ImportMappedRow) {
  const aliases = HEADER_ALIASES[field] ?? [field];

  for (const [key, value] of Object.entries(row)) {
    const normalizedHeader = normalizeKey(key);
    if (aliases.some((alias) => normalizeKey(alias) === normalizedHeader)) {
      return normalizeText(value);
    }
  }

  return "";
}

function emptyMappedRow(): ImportMappedRow {
  return {
    customer_number: "",
    business_name: "",
    customer_name: "",
    address: "",
    postal_code: "",
    city: "",
    province: "",
    contact_person: "",
    email: "",
    phone: "",
    name: "",
    manufacturer: "",
    model: "",
    serial_number: "",
    internal_code: "",
    measurement_quantity: "",
    unit: "",
    measurement_range: "",
    certificate_number: "",
    certificate_date: "",
    certificate_expiry: "",
    status: "",
    department: "",
    location: "",
    notes: "",
  };
}

function mapRow(kind: ImportKind, row: Record<string, unknown>): ImportMappedRow {
  const mapped = emptyMappedRow();

  mapped.name = findValue(row, "name");
  mapped.manufacturer = findValue(row, "manufacturer");
  mapped.model = findValue(row, "model");
  mapped.serial_number = findValue(row, "serial_number");
  mapped.internal_code = findValue(row, "internal_code");
  mapped.measurement_quantity = findValue(row, "measurement_quantity");
  mapped.unit = findValue(row, "unit");
  mapped.measurement_range = findValue(row, "measurement_range");
  mapped.notes = findValue(row, "notes");

  if (kind === "customers") {
    mapped.customer_number = findValue(row, "customer_number");
    mapped.business_name = findValue(row, "business_name");
    mapped.address = findValue(row, "address");
    mapped.postal_code = findValue(row, "postal_code");
    mapped.city = findValue(row, "city");
    mapped.province = findValue(row, "province").toUpperCase();
    mapped.contact_person = findValue(row, "contact_person");
    mapped.email = findValue(row, "email");
    mapped.phone = findValue(row, "phone");
    return mapped;
  }

  if (kind === "customer_instruments") {
    mapped.customer_number = findValue(row, "customer_number");
    mapped.customer_name = findValue(row, "customer_name") || findValue(row, "business_name");
    return mapped;
  }

  if (kind === "reference_instruments") {
    mapped.certificate_number = findValue(row, "certificate_number");
    mapped.certificate_date = normalizeDate(findValue(row, "certificate_date"));
    mapped.certificate_expiry = normalizeDate(findValue(row, "certificate_expiry"));
    mapped.status = normalizeStatus(findValue(row, "status"), kind);
    return mapped;
  }

  mapped.department = findValue(row, "department");
  mapped.location = findValue(row, "location");
  mapped.status = normalizeStatus(findValue(row, "status"), kind);
  return mapped;
}

const metrologyTextFields = {"Codice OnTrack":"ontrack_code","AVCP":"avcp","LAB":"lab_authorization","Criteri di accettabilità":"acceptance_criteria","Istruzione operativa":"operating_instruction","Note metrologiche":"notes"} as const;
function parseMetrology(raw:Record<string,unknown>):MetrologyImport {
 const field=(name:string)=>Object.entries(raw).find(([k])=>normalizeKey(k)===normalizeKey(name))?.[1];
 const siteRaw=normalizeText(field("Sede"));const site=normalizeLabSite(siteRaw);const errors:string[]=[];const values:Record<string,string|number>={};
 if(siteRaw&&!site)errors.push("Sede non valida: "+siteRaw);
 for(const [label,key] of Object.entries(metrologyTextFields)){const v=normalizeText(field(label));if(v)values[key]=v;}
 for(const [label,key] of [["VI","vi"],["LAT","lat"],["RdT","rdt"]]){
  const period=normalizeText(field(`Periodicità ${label} (mesi)`));if(period){const n=Number(period);if(!/^\d+$/.test(period)||!Number.isInteger(n)||n<1||n>120)errors.push(`Periodicità ${label}: usare 1–120 mesi interi.`);else values[key+"_months"]=n;}
  const rawDate=field(`Prima scadenza ${label}`);if(normalizeText(rawDate)){const d=normalizeDate(rawDate);const ms=Date.parse(d+"T00:00:00Z");if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==d)errors.push(`Prima scadenza ${label}: data non valida.`);else values[key+"_first_due"]=d;}
 }
 return {site,values,errors};
}
async function importMetrology(kind:ImportKind,id:string,row:ParsedRow){
 const m=row.metrology;if(!m||(!m.site&&!Object.keys(m.values).length))return false;
 const {data,error}=await supabase.rpc("tv15_import_metrology",{p_kind:kind==="internal_instruments"?"interni":"campioni",p_id:id,p_site:m.site,p_fields:m.values});
 if(error||typeof data?.changed!=="boolean")throw new Error("Anagrafica eventualmente già salvata; configurazione non confermata: "+(error?.message||"risposta non valida")+". Correggere e reimportare.");
 if(Array.isArray(data.protected)&&data.protected.length)row.messages.push("Configurazioni esistenti conservate: "+data.protected.join(", "));
 return data.changed as boolean;
}
function buildCsvContent(columns: string[]) {
  const example = columns.map((column) => {
    if (column === "Ragione Sociale") return "Cliente Esempio S.r.l.";
    if (column === "Cliente") return "Cliente Esempio S.r.l.";
    if (column === "Nome Strumento") return "Strumento esempio";
    if (column === "Codice Cliente") return "C001";
    if (column === "Codice Interno") return "INT001";
    if (column === "Grandezza") return "Forza";
    if (column === "Unità") return "kN";
    if (column === "Stato") return "active";
    if (column === "Data Certificato") return "2026-01-01";
    if (column === "Scadenza Certificato") return "2027-01-01";
    return "";
  });

  return (
    columns.join(";") +
    "\n" +
    example.map((value) => String(value).replace(/;/g, ",")).join(";") +
    "\n"
  );
}

function downloadTemplate(kind: ImportKind) {
  const config = IMPORT_CONFIGS[kind];
  const csv = buildCsvContent(config.templateColumns);
  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${kind}_template.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function readFile(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    raw: true,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Il file non contiene fogli leggibili.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
  });
}

function buildExistingInstrumentKeys(item: ExistingInstrument) {
  return [
    item.internal_code ? "code:" + normalizeKey(item.internal_code) : "",
    item.serial_number ? "serial:" + normalizeKey(item.serial_number) : "",
  ].filter(Boolean);
}

function isBlank(value: unknown) {
  return value === null || value === undefined || String(value).trim() === "";
}

function buildFillMissingUpdate(
  existing: Record<string, unknown>,
  incoming: Record<string, string | null | undefined>
) {
  const update: Record<string, string | null> = {};
  const addedFields: string[] = [];
  const protectedFields: string[] = [];

  Object.entries(incoming).forEach(([field, rawValue]) => {
    const value = typeof rawValue === "string" ? rawValue.trim() : rawValue;
    if (isBlank(value)) return;

    if (isBlank(existing[field])) {
      update[field] = String(value);
      addedFields.push(field);
      return;
    }

    if (normalizeKey(existing[field]) !== normalizeKey(value)) {
      protectedFields.push(field);
    }
  });

  return { update, addedFields, protectedFields };
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function instrumentMatchCandidates(
  existing: ExistingInstrument[],
  mapped: ImportMappedRow,
  customerId?: string
) {
  const pool = customerId
    ? existing.filter((item) => item.customer_id === customerId)
    : existing;
  const codeKey = normalizeKey(mapped.internal_code);
  const serialKey = normalizeKey(mapped.serial_number);

  const strongMatches = uniqueById(
    pool.filter((item) =>
      Boolean(
        (codeKey && normalizeKey(item.internal_code) === codeKey) ||
          (serialKey && normalizeKey(item.serial_number) === serialKey)
      )
    )
  );

  if (strongMatches.length > 0) return strongMatches;

  const nameKey = normalizeKey(mapped.name);
  const manufacturerKey = normalizeKey(mapped.manufacturer);
  const modelKey = normalizeKey(mapped.model);
  if (!nameKey) return [];

  return uniqueById(
    pool.filter((item) => {
      if (normalizeKey(item.name) !== nameKey) return false;
      if (manufacturerKey && normalizeKey(item.manufacturer) !== manufacturerKey) return false;
      if (modelKey && normalizeKey(item.model) !== modelKey) return false;
      return Boolean(manufacturerKey || modelKey);
    })
  );
}

export default function ImportWizard({ kind }: ImportWizardProps) {
  const config = IMPORT_CONFIGS[kind];

  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parseError, setParseError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const validRows = useMemo(() => {
    return rows.filter((row) => row.status === "valid" || row.status === "warning");
  }, [rows]);

  async function parseSelectedFile(file: File | null) {
    setRows([]);
    setResult(null);
    setParseError("");

    if (!file) {
      setFileName("");
      return;
    }

    setFileName(file.name);
    setIsParsing(true);

    try {
      const rawRows = await readFile(file);

      if (rawRows.length === 0) {
        throw new Error("Il file non contiene righe da importare.");
      }

      const parsedRows: ParsedRow[] = rawRows.map((raw, index) => {
        const mapped = mapRow(kind, raw);
        const messages: string[] = [];
        let status: ParsedRow["status"] = "valid";

        if (kind === "customers" && !mapped.business_name) {
          messages.push("Ragione sociale obbligatoria.");
          status = "error";
        }

        if (kind !== "customers" && !mapped.name) {
          messages.push("Nome strumento obbligatorio.");
          status = "error";
        }

        if (
          kind === "customer_instruments" &&
          !mapped.customer_name &&
          !mapped.customer_number
        ) {
          messages.push("Indica Cliente o Codice Cliente.");
          status = "error";
        }

        if (
          (kind === "reference_instruments" || kind === "internal_instruments") &&
          !mapped.internal_code &&
          !mapped.serial_number
        ) {
          messages.push(
            "Codice Interno o Matricola obbligatori per importare senza duplicati."
          );
          status = "error";
        }

        const metrology=(kind==="internal_instruments"||kind==="reference_instruments")?parseMetrology(raw):undefined;
        // Per gli strumenti interni, il codice OnTrack coincide con il codice interno.
        // Accetta anche i vecchi modelli, ma segnala eventuali valori discordanti.
        if(kind==="internal_instruments"&&metrology){
          const legacyCode=metrology.values.ontrack_code;
          if(legacyCode&&(!mapped.internal_code||String(legacyCode).trim()!==mapped.internal_code.trim())){
            metrology.errors.push("Codice OnTrack discordante dal Codice Interno: compilare soltanto Codice Interno.");
          }
          if(mapped.internal_code)metrology.values.ontrack_code=mapped.internal_code;
        }
        if(metrology?.errors.length){messages.push(...metrology.errors);status="error";}
        return {
          metrology,
          rowNumber: index + 2,
          raw,
          mapped,
          status,
          messages,
        };
      });

      setRows(parsedRows);
    } catch (error) {
      setParseError(
        error instanceof Error
          ? error.message
          : "Errore durante la lettura del file."
      );
    } finally {
      setIsParsing(false);
    }
  }

  async function importCustomers(nextRows: ParsedRow[]) {
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    const { data: existingData, error } = await supabase
      .from("customers")
      .select("id, customer_number, business_name, address, postal_code, city, province, contact_person, email, phone, notes");

    if (error) throw new Error(error.message);

    const existing = (existingData ?? []) as ExistingCustomer[];

    for (const row of nextRows) {
      if (row.status === "error") {
        errors += 1;
        continue;
      }

      const numberKey = normalizeKey(row.mapped.customer_number);
      const nameKey = normalizeKey(row.mapped.business_name);
      const candidates = uniqueById(
        existing.filter((customer) =>
          Boolean(
            (numberKey && normalizeKey(customer.customer_number) === numberKey) ||
              (nameKey && normalizeKey(customer.business_name) === nameKey)
          )
        )
      );

      if (candidates.length > 1) {
        row.status = "conflict";
        row.messages = ["Conflitto: Codice Cliente/Ragione Sociale corrispondono a più anagrafiche. Nessuna modifica eseguita."];
        errors += 1;
        continue;
      }

      if (candidates.length === 1) {
        const current = candidates[0];
        const merge = buildFillMissingUpdate(current as unknown as Record<string, unknown>, {
          customer_number: row.mapped.customer_number || null,
          business_name: row.mapped.business_name || null,
          address: row.mapped.address || null,
          postal_code: row.mapped.postal_code || null,
          city: row.mapped.city || null,
          province: row.mapped.province || null,
          contact_person: row.mapped.contact_person || null,
          email: row.mapped.email || null,
          phone: row.mapped.phone || null,
          notes: row.mapped.notes || null,
        });

        if (Object.keys(merge.update).length === 0) {
          row.status = "unchanged";
          row.messages = [
            merge.protectedFields.length > 0
              ? "Anagrafica già presente. I valori esistenti diversi dal CSV non sono stati sovrascritti."
              : "Anagrafica già completa: nessuna modifica necessaria.",
          ];
          unchanged += 1;
          continue;
        }

        const { error: updateError } = await supabase
          .from("customers")
          .update(merge.update)
          .eq("id", current.id);

        if (updateError) {
          row.status = "error";
          row.messages = [updateError.message];
          errors += 1;
        } else {
          Object.assign(current, merge.update);
          row.status = "updated";
          row.messages = [
            `Anagrafica esistente completata: ${merge.addedFields.join(", ")}.`,
            ...(merge.protectedFields.length > 0
              ? [`Campi già valorizzati e non sovrascritti: ${merge.protectedFields.join(", ")}.`]
              : []),
          ];
          updated += 1;
        }
        continue;
      }

      const payload = {
        customer_number: row.mapped.customer_number || null,
        business_name: row.mapped.business_name,
        vat_number: null,
        tax_code: null,
        address: row.mapped.address || null,
        city: row.mapped.city || null,
        province: row.mapped.province || null,
        postal_code: row.mapped.postal_code || null,
        email: row.mapped.email || null,
        phone: row.mapped.phone || null,
        contact_person: row.mapped.contact_person || null,
        notes: row.mapped.notes || null,
        is_active: true,
      };
      const { data: insertedRow, error: insertError } = await supabase
        .from("customers")
        .insert(payload)
        .select("id")
        .single();

      if (insertError || !insertedRow) {
        row.status = "error";
        row.messages = [insertError?.message || "Errore inserimento."];
        errors += 1;
      } else {
        existing.push({ id: insertedRow.id, ...payload } as ExistingCustomer);
        row.status = "imported";
        row.messages = ["Nuova anagrafica inserita."];
        inserted += 1;
      }
    }

    return { inserted, updated, unchanged, errors };
  }

  async function importCustomerInstruments(nextRows: ParsedRow[]) {
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    const { data: customersData, error: customersError } = await supabase
      .from("customers")
      .select("id, customer_number, business_name")
      .eq("is_active", true);
    if (customersError) throw new Error(customersError.message);
    const customers = (customersData ?? []) as ExistingCustomer[];

    const { data: existingData, error: existingError } = await supabase
      .from("customer_instruments")
      .select("id, customer_id, name, manufacturer, model, serial_number, internal_code, measurement_quantity, unit, measurement_range, notes");
    if (existingError) throw new Error(existingError.message);
    const existing = (existingData ?? []) as ExistingInstrument[];

    for (const row of nextRows) {
      if (row.status === "error") {
        errors += 1;
        continue;
      }

      const customerCandidates = uniqueById(
        customers.filter((item) =>
          Boolean(
            (row.mapped.customer_number && normalizeKey(item.customer_number) === normalizeKey(row.mapped.customer_number)) ||
              (row.mapped.customer_name && normalizeKey(item.business_name) === normalizeKey(row.mapped.customer_name))
          )
        )
      );

      if (customerCandidates.length !== 1) {
        row.status = customerCandidates.length > 1 ? "conflict" : "error";
        row.messages = [customerCandidates.length > 1
          ? "Conflitto cliente: il CSV identifica più anagrafiche."
          : "Cliente non trovato. Controlla Codice Cliente o Cliente."];
        errors += 1;
        continue;
      }

      const customer = customerCandidates[0];
      const candidates = instrumentMatchCandidates(existing, row.mapped, customer.id);
      if (candidates.length > 1) {
        row.status = "conflict";
        row.messages = ["Conflitto strumento: più strumenti del cliente corrispondono ai dati CSV. Nessuna modifica eseguita."];
        errors += 1;
        continue;
      }

      if (candidates.length === 1) {
        const current = candidates[0];
        const merge = buildFillMissingUpdate(current as unknown as Record<string, unknown>, {
          name: row.mapped.name || null,
          manufacturer: row.mapped.manufacturer || null,
          model: row.mapped.model || null,
          serial_number: row.mapped.serial_number || null,
          internal_code: row.mapped.internal_code || null,
          measurement_quantity: row.mapped.measurement_quantity || null,
          unit: row.mapped.unit || null,
          measurement_range: row.mapped.measurement_range || null,
          notes: row.mapped.notes || null,
        });
        if (Object.keys(merge.update).length === 0) {
          row.status = "unchanged";
          row.messages = [merge.protectedFields.length > 0
            ? "Strumento già presente. I dati esistenti diversi non sono stati sovrascritti."
            : "Strumento già completo: nessuna modifica necessaria.", ...row.messages];
          unchanged += 1;
          continue;
        }
        const { error: updateError } = await supabase
          .from("customer_instruments")
          .update(merge.update)
          .eq("id", current.id);
        if (updateError) {
          row.status = "error";
          row.messages = [updateError.message];
          errors += 1;
        } else {
          Object.assign(current, merge.update);
          row.status = "updated";
          row.messages = [`Strumento esistente completato: ${merge.addedFields.join(", ")}.`];
          updated += 1;
        }
        continue;
      }

      const payload = {
        customer_id: customer.id,
        site_id: null,
        customer_name: customer.business_name,
        site: null,
        name: row.mapped.name,
        manufacturer: row.mapped.manufacturer || null,
        model: row.mapped.model || null,
        serial_number: row.mapped.serial_number || null,
        internal_code: row.mapped.internal_code || null,
        measurement_quantity: row.mapped.measurement_quantity || null,
        unit: row.mapped.unit || null,
        measurement_range: row.mapped.measurement_range || null,
        resolution: null,
        acceptance_class: null,
        notes: row.mapped.notes || null,
      };
      const { data: insertedRow, error: insertError } = await supabase
        .from("customer_instruments")
        .insert(payload)
        .select("id")
        .single();
      if (insertError || !insertedRow) {
        row.status = "error";
        row.messages = [insertError?.message || "Errore inserimento."];
        errors += 1;
      } else {
        existing.push({ id: insertedRow.id, ...payload } as ExistingInstrument);
        row.status = "imported";
        row.messages = ["Nuovo strumento inserito."];
        inserted += 1;
      }
    }

    return { inserted, updated, unchanged, errors };
  }

  async function importReferenceInstruments(nextRows: ParsedRow[]) {
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    const { data: existingData, error: existingError } = await readAllRows((from,to)=>supabase
      .from("reference_instruments")
      .select("lab_site, id, name, manufacturer, model, serial_number, internal_code, measurement_quantity, unit, measurement_range, certificate_number, certificate_date, certificate_expiry, status, notes").order("id").range(from,to));
    if (existingError) throw new Error(existingError.message);
    const existing = (existingData ?? []) as ExistingInstrument[];

    for (const row of nextRows) {
      if (row.status !== "valid" && row.status !== "warning") {
        errors += 1;
        continue;
      }
      if(!row.mapped.internal_code&&!row.mapped.serial_number){row.status="conflict";row.messages=["Indicare codice interno o matricola: senza identificativo non è possibile importare in modo ripetibile."];errors++;continue;}
      const candidates = existing.filter(i=>Boolean((row.mapped.internal_code&&normalizeKey(i.internal_code)===normalizeKey(row.mapped.internal_code))||(row.mapped.serial_number&&normalizeKey(i.serial_number)===normalizeKey(row.mapped.serial_number))));
      if (candidates.length > 1) {
        row.status = "conflict";
        row.messages = ["Conflitto: Codice Interno/Matricola identificano più strumenti campione."];
        errors += 1;
        continue;
      }
      const statusToSave = row.mapped.status === "dismissed" || row.mapped.status === "out_of_service"
        ? row.mapped.status
        : "valid";

      if (candidates.length === 1) {
        const current = candidates[0];
        if((row.metrology?.site&&current.lab_site&&row.metrology.site!==current.lab_site)||(row.mapped.internal_code&&current.internal_code&&normalizeKey(row.mapped.internal_code)!==normalizeKey(current.internal_code))||(row.mapped.serial_number&&current.serial_number&&normalizeKey(row.mapped.serial_number)!==normalizeKey(current.serial_number))){row.status="conflict";row.messages=["Sede o identificativi discordanti: nessun dato modificato. Verificare l’anagrafica."];errors++;continue;}
        
        const merge = buildFillMissingUpdate(current as unknown as Record<string, unknown>, {
          name: row.mapped.name || null,
          manufacturer: row.mapped.manufacturer || null,
          model: row.mapped.model || null,
          serial_number: row.mapped.serial_number || null,
          internal_code: row.mapped.internal_code || null,
          measurement_quantity: row.mapped.measurement_quantity || null,
          unit: row.mapped.unit || null,
          measurement_range: row.mapped.measurement_range || null,
          certificate_number: row.mapped.certificate_number || null,
          certificate_date: row.mapped.certificate_date || null,
          certificate_expiry: row.mapped.certificate_expiry || null,
          status: statusToSave,
          notes: row.mapped.notes || null,
        });
        try {
        const metaChanged=await importMetrology(kind,current.id,row); if(row.metrology?.site)current.lab_site=row.metrology.site;
        if (Object.keys(merge.update).length === 0) {
          if(metaChanged){row.status="updated";row.messages.push("Configurazione metrologica completata.");updated++;continue;}
          row.status = "unchanged";
          row.messages = [merge.protectedFields.length > 0
            ? "Strumento già presente. I dati esistenti diversi non sono stati sovrascritti."
            : "Strumento già completo: nessuna modifica necessaria.", ...row.messages];
          unchanged += 1;
          continue;
        }
        const { error: updateError } = await supabase
          .from("reference_instruments")
          .update(merge.update)
          .eq("id", current.id);
        if (updateError) {
          row.status = "error";
          row.messages = [updateError.message];
          errors += 1;
        } else {
          Object.assign(current, merge.update);
          row.status = "updated";
          row.messages = [`Strumento campione esistente completato: ${merge.addedFields.join(", ")}.`, ...row.messages];
          updated += 1;
        }
        } catch(e){row.status="error";row.messages.push(e instanceof Error?e.message:"Errore configurazione");errors++;}
        continue;
      }

      const payload = {
        lab_site: row.metrology?.site??null,
        name: row.mapped.name,
        manufacturer: row.mapped.manufacturer || null,
        model: row.mapped.model || null,
        serial_number: row.mapped.serial_number || null,
        internal_code: row.mapped.internal_code || null,
        measurement_quantity: row.mapped.measurement_quantity || null,
        unit: row.mapped.unit || null,
        measurement_range: row.mapped.measurement_range || null,
        resolution: null,
        certificate_number: row.mapped.certificate_number || null,
        certificate_date: row.mapped.certificate_date || null,
        certificate_expiry: row.mapped.certificate_expiry || null,
        certificate_file_url: null,
        certificate_file_name: null,
        status: statusToSave,
        notes: row.mapped.notes || null,
      };
      const { data: insertedInstrument, error: insertError } = await supabase
        .from("reference_instruments")
        .insert(payload)
        .select("id")
        .single();
      if (insertError || !insertedInstrument) {
        row.status = "error";
        row.messages = [insertError?.message || "Errore inserimento."];
        errors += 1;
      } else {
        if (row.mapped.certificate_number || row.mapped.certificate_date || row.mapped.certificate_expiry) {
          await supabase.from("reference_instrument_certificates").insert({
            reference_instrument_id: insertedInstrument.id,
            certificate_number: row.mapped.certificate_number || null,
            certificate_date: row.mapped.certificate_date || null,
            certificate_expiry: row.mapped.certificate_expiry || null,
            file_url: null,
            file_name: null,
            is_current: true,
            notes: "Certificato importato da caricamento massivo, senza file allegato.",
          });
        }
        existing.push({ id: insertedInstrument.id, ...payload } as ExistingInstrument);
        row.status = "imported";
        row.messages = ["Nuovo strumento campione inserito."];
        try {await importMetrology(kind,insertedInstrument.id,row);inserted += 1;}catch(e){row.status="error";row.messages.push(e instanceof Error?e.message:"Errore configurazione");errors++;}
      }
    }

    return { inserted, updated, unchanged, errors };
  }

  async function importInternalInstruments(nextRows: ParsedRow[]) {
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    let errors = 0;

    const { data: existingData, error: existingError } = await readAllRows((from,to)=>supabase
      .from("internal_instruments")
      .select("lab_site, id, name, manufacturer, model, serial_number, internal_code, measurement_quantity, unit, measurement_range, location, department, status, notes").order("id").range(from,to));
    if (existingError) throw new Error(existingError.message);
    const existing = (existingData ?? []) as ExistingInstrument[];

    type ExistingInternalMeasurement = {
      id: string;
      internal_instrument_id: string;
      measurement_quantity: string | null;
      unit: string | null;
      measurement_range: string | null;
      resolution: string | null;
      notes: string | null;
      is_primary: boolean;
      sort_order: number;
    };

    const { data: existingMeasurementsData, error: existingMeasurementsError } =
      await readAllRows((from,to)=>supabase
        .from("internal_instrument_measurements")
        .select(
          "id, internal_instrument_id, measurement_quantity, unit, measurement_range, resolution, notes, is_primary, sort_order"
        )
        .order("sort_order", { ascending: true }).order("id").range(from,to));

    if (existingMeasurementsError) {
      throw new Error(
        "Impossibile leggere le grandezze degli strumenti interni. Esegui prima la migrazione Fase B. " +
          existingMeasurementsError.message
      );
    }

    const instrumentMeasurements = (existingMeasurementsData ?? []) as ExistingInternalMeasurement[];

    function measurementsForInstrument(instrumentId: string) {
      return instrumentMeasurements
        .filter((measurement) => measurement.internal_instrument_id === instrumentId)
        .sort((a, b) => {
          if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
          return a.sort_order - b.sort_order;
        });
    }

    async function syncImportedPrimaryMeasurement(
      current: ExistingInstrument,
      mapped: ImportMappedRow
    ) {
      const incomingMeasurement = {
        measurement_quantity: mapped.measurement_quantity || null,
        unit: mapped.unit || null,
        measurement_range: mapped.measurement_range || null,
      };

      const hasIncomingMeasurement = Object.values(incomingMeasurement).some(
        (value) => !isBlank(value)
      );
      const currentMeasurements = measurementsForInstrument(current.id);
      const primaryMeasurement = currentMeasurements[0] ?? null;

      if (primaryMeasurement) {
        if (!hasIncomingMeasurement) {
          return { changed: false, addedFields: [] as string[], protectedFields: [] as string[] };
        }

        const merge = buildFillMissingUpdate(
          primaryMeasurement as unknown as Record<string, unknown>,
          incomingMeasurement
        );

        if (Object.keys(merge.update).length > 0) {
          const { error } = await supabase
            .from("internal_instrument_measurements")
            .update(merge.update)
            .eq("id", primaryMeasurement.id);

          if (error) throw new Error(error.message);
          Object.assign(primaryMeasurement, merge.update);
        }

        return {
          changed: Object.keys(merge.update).length > 0,
          addedFields: merge.addedFields,
          protectedFields: merge.protectedFields,
        };
      }

      const quantity = mapped.measurement_quantity || current.measurement_quantity || "";
      const unit = mapped.unit || current.unit || null;
      const measurementRange = mapped.measurement_range || current.measurement_range || null;

      if (!quantity.trim()) {
        return { changed: false, addedFields: [] as string[], protectedFields: [] as string[] };
      }

      const payload = [
        {
          measurement_quantity: quantity.trim(),
          unit: unit || null,
          measurement_range: measurementRange || null,
          resolution: null,
          notes: null,
          is_primary: true,
        },
      ];

      const { error } = await supabase.rpc("replace_internal_instrument_measurements", {
        p_internal_instrument_id: current.id,
        p_measurements: payload,
      });
      if (error) throw new Error(error.message);

      const { data: createdMeasurement, error: reloadError } = await supabase
        .from("internal_instrument_measurements")
        .select(
          "id, internal_instrument_id, measurement_quantity, unit, measurement_range, resolution, notes, is_primary, sort_order"
        )
        .eq("internal_instrument_id", current.id)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (reloadError) throw new Error(reloadError.message);
      if (createdMeasurement) {
        instrumentMeasurements.push(createdMeasurement as ExistingInternalMeasurement);
      }

      return {
        changed: true,
        addedFields: ["grandezza principale"],
        protectedFields: [] as string[],
      };
    }

    for (const row of nextRows) {
      if (row.status !== "valid" && row.status !== "warning") {
        errors += 1;
        continue;
      }
      if(!row.mapped.internal_code&&!row.mapped.serial_number){row.status="conflict";row.messages=["Indicare codice interno o matricola: senza identificativo non è possibile importare in modo ripetibile."];errors++;continue;}
      const candidates = existing.filter(i=>Boolean((row.mapped.internal_code&&normalizeKey(i.internal_code)===normalizeKey(row.mapped.internal_code))||(row.mapped.serial_number&&normalizeKey(i.serial_number)===normalizeKey(row.mapped.serial_number))));
      if (candidates.length > 1) {
        row.status = "conflict";
        row.messages = ["Conflitto: Codice Interno/Matricola identificano più strumenti interni."];
        errors += 1;
        continue;
      }
      const statusToSave = row.mapped.status === "dismissed" || row.mapped.status === "out_of_service"
        ? row.mapped.status
        : "active";

      if (candidates.length === 1) {
        const current = candidates[0];
        if((row.metrology?.site&&current.lab_site&&row.metrology.site!==current.lab_site)||(row.mapped.internal_code&&current.internal_code&&normalizeKey(row.mapped.internal_code)!==normalizeKey(current.internal_code))||(row.mapped.serial_number&&current.serial_number&&normalizeKey(row.mapped.serial_number)!==normalizeKey(current.serial_number))){row.status="conflict";row.messages=["Sede o identificativi discordanti: nessun dato modificato. Verificare l’anagrafica."];errors++;continue;}
        
        const merge = buildFillMissingUpdate(current as unknown as Record<string, unknown>, {
          name: row.mapped.name || null,
          manufacturer: row.mapped.manufacturer || null,
          model: row.mapped.model || null,
          serial_number: row.mapped.serial_number || null,
          internal_code: row.mapped.internal_code || null,
          location: row.mapped.location || null,
          department: row.mapped.department || null,
          status: statusToSave,
          notes: row.mapped.notes || null,
        });

        try {
          let parentChanged = false;
          if (Object.keys(merge.update).length > 0) {
            const { error: updateError } = await supabase
              .from("internal_instruments")
              .update(merge.update)
              .eq("id", current.id);
            if (updateError) throw new Error(updateError.message);
            Object.assign(current, merge.update);
            parentChanged = true;
          }

          const measurementMerge = await syncImportedPrimaryMeasurement(current, row.mapped);
          const metaChanged=await importMetrology(kind,current.id,row); if(row.metrology?.site)current.lab_site=row.metrology.site;
          const changed = parentChanged || measurementMerge.changed || metaChanged;
          const addedFields = [...merge.addedFields, ...measurementMerge.addedFields,...(metaChanged?["configurazione metrologica"]:[])];
          const protectedFields = [
            ...merge.protectedFields,
            ...measurementMerge.protectedFields,
          ];

          if (changed) {
            row.status = "updated";
            row.messages = [
              `Strumento interno esistente completato: ${addedFields.join(", ")}.`,
              ...row.messages,
              ...(protectedFields.length > 0
                ? ["Dati già valorizzati e diversi non sovrascritti: " + protectedFields.join(", ") + "."]
                : []),
            ];
            updated += 1;
          } else {
            row.status = "unchanged";
            row.messages = [
              protectedFields.length > 0
                ? "Strumento già presente. I dati esistenti diversi non sono stati sovrascritti."
                : "Strumento già completo: nessuna modifica necessaria.",
              ...row.messages,
            ];
            unchanged += 1;
          }
        } catch (error) {
          row.status = "error";
          row.messages = [
            error instanceof Error ? error.message : "Errore aggiornamento strumento interno.",
          ];
          errors += 1;
        }
        continue;
      }

      const payload = {
        lab_site: row.metrology?.site??null,
        name: row.mapped.name,
        manufacturer: row.mapped.manufacturer || null,
        model: row.mapped.model || null,
        serial_number: row.mapped.serial_number || null,
        internal_code: row.mapped.internal_code || null,
        measurement_quantity: row.mapped.measurement_quantity || null,
        unit: row.mapped.unit || null,
        measurement_range: row.mapped.measurement_range || null,
        location: row.mapped.location || null,
        department: row.mapped.department || null,
        status: statusToSave,
        notes: row.mapped.notes || null,
        is_active: statusToSave !== "dismissed",
      };
      const { data: insertedRow, error: insertError } = await supabase
        .from("internal_instruments")
        .insert(payload)
        .select("id")
        .single();
      if (insertError || !insertedRow) {
        row.status = "error";
        row.messages = [insertError?.message || "Errore inserimento."];
        errors += 1;
      } else {
        try {
          if (row.mapped.measurement_quantity) {
            const { error: measurementError } = await supabase.rpc(
              "replace_internal_instrument_measurements",
              {
                p_internal_instrument_id: insertedRow.id,
                p_measurements: [
                  {
                    measurement_quantity: row.mapped.measurement_quantity,
                    unit: row.mapped.unit || null,
                    measurement_range: row.mapped.measurement_range || null,
                    resolution: null,
                    notes: null,
                    is_primary: true,
                  },
                ],
              }
            );
            if (measurementError) throw new Error(measurementError.message);
          }

          existing.push({ id: insertedRow.id, ...payload } as ExistingInstrument);
          row.status = "imported";
          row.messages = ["Nuovo strumento interno inserito."];
          try {await importMetrology(kind,insertedRow.id,row);inserted += 1;}catch(e){row.status="error";row.messages.push(e instanceof Error?e.message:"Errore configurazione");errors++;}
        } catch (error) {
          await supabase.from("internal_instruments").delete().eq("id", insertedRow.id);
          row.status = "error";
          row.messages = [
            "Inserimento annullato: " +
              (error instanceof Error ? error.message : "errore nella grandezza dello strumento."),
          ];
          errors += 1;
        }
      }
    }

    return { inserted, updated, unchanged, errors };
  }

  async function importRows() {
    setIsImporting(true);
    setResult(null);
    setParseError("");

    try {
      const nextRows = rows.map(row=>({...row,messages:[...row.messages]}));

      let importResult: ImportResult;

      if (kind === "customers") {
        importResult = await importCustomers(nextRows);
      } else if (kind === "customer_instruments") {
        importResult = await importCustomerInstruments(nextRows);
      } else if (kind === "reference_instruments") {
        importResult = await importReferenceInstruments(nextRows);
      } else {
        importResult = await importInternalInstruments(nextRows);
      }

      setRows(nextRows);
      setResult(importResult);
    } catch (error) {
      setParseError(
        error instanceof Error
          ? error.message
          : "Errore durante l'importazione."
      );
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              {config.title}
            </h1>
            <p className="mt-1 text-sm text-slate-600">{config.description}</p>
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              Tabella di destinazione: {config.tableName}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Colonne obbligatorie: {config.requiredColumns.join(", ")}
            </p>
          </div>

          <button
            type="button"
            onClick={() => downloadTemplate(kind)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Scarica modello CSV
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Regola importazione sicura</p>
          <p className="mt-1">
            Il sistema riconosce gli strumenti interni e campione tramite codice interno o matricola. Una sede o un identificativo discordante produce un conflitto. Per gli altri archivi si applicano le chiavi anagrafiche già previste.
            Se trova un record esistente, completa soltanto i campi vuoti: i dati già valorizzati non vengono sovrascritti.
            I casi ambigui vengono marcati come conflitto e non vengono modificati.
          </p>
        </div>

        <div className="mt-5">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              File Excel o CSV
            </span>

            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(event) =>
                parseSelectedFile(event.target.files?.[0] ?? null)
              }
              className="block w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
            />
          </label>

          {fileName && (
            <p className="mt-2 text-sm text-slate-600">
              File selezionato: <strong>{fileName}</strong>
            </p>
          )}
        </div>
      </section>

      {parseError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          {parseError}
        </div>
      )}

      {isParsing && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">
          Lettura file in corso...
        </div>
      )}

      {rows.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Anteprima righe
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Righe lette: {rows.length}. Righe importabili: {validRows.length}.
              </p>
            </div>

            <button
              type="button"
              onClick={importRows}
              disabled={isImporting || validRows.length === 0}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isImporting ? "Importazione..." : "Importa righe valide"}
            </button>
          </div>

          {result && (
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="text-xl font-bold">{result.inserted}</p>
                <p>Nuovi</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <p className="text-xl font-bold">{result.updated}</p>
                <p>Aggiornati</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                <p className="text-xl font-bold">{result.unchanged}</p>
                <p>Invariati</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                <p className="text-xl font-bold">{result.errors}</p>
                <p>Errori / conflitti</p>
              </div>
            </div>
          )}

          <div className="mt-5 tc-sticky-table overflow-x-auto rounded-xl border border-slate-200" tabIndex={0}>
            <table className="min-w-full border-collapse text-left text-xs">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="border-b border-slate-200 px-3 py-2">Riga</th>
                  <th className="border-b border-slate-200 px-3 py-2">Stato</th>
                  <th className="border-b border-slate-200 px-3 py-2">
                    Dati principali
                  </th>
                  <th className="border-b border-slate-200 px-3 py-2">
                    Messaggi
                  </th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row) => (
                  <tr key={row.rowNumber} className="odd:bg-white even:bg-slate-50">
                    <td className="border-b border-slate-100 px-3 py-2">
                      {row.rowNumber}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      <span
                        className={
                          "rounded-full px-2 py-1 text-[11px] font-semibold " +
                          (row.status === "valid"
                            ? "bg-emerald-100 text-emerald-800"
                            : row.status === "warning"
                              ? "bg-amber-100 text-amber-900"
                              : row.status === "imported"
                                ? "bg-emerald-100 text-emerald-800"
                                : row.status === "updated"
                                  ? "bg-blue-100 text-blue-800"
                                  : row.status === "unchanged"
                                    ? "bg-slate-200 text-slate-700"
                                    : "bg-red-100 text-red-800")
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      {kind === "customers" ? (
                        <>
                          <strong>{row.mapped.business_name || "-"}</strong>
                          <br />
                          {row.mapped.customer_number || "-"}
                        </>
                      ) : kind === "customer_instruments" ? (
                        <>
                          <strong>{row.mapped.name || "-"}</strong>
                          <br />
                          Cliente:{" "}
                          {row.mapped.customer_name ||
                            row.mapped.customer_number ||
                            "-"}
                        </>
                      ) : (
                        <>
                          <strong>{row.mapped.name || "-"}</strong>
                          <br />
                          Codice: {row.mapped.internal_code || "-"} · Matricola:{" "}
                          {row.mapped.serial_number || "-"}
                          {row.metrology&&<div className="mt-1 text-slate-600">Sede: {row.metrology.site||"Non indicata"} · VI {row.metrology.values.vi_months??"—"} mesi · LAT {row.metrology.values.lat_months??"—"} mesi · RdT {row.metrology.values.rdt_months??"—"} mesi{Object.entries(row.metrology.values).filter(([k])=>k.endsWith("_first_due")).map(([k,v])=><div key={k}>{k.startsWith("vi_")?"VI":k.startsWith("lat_")?"LAT":"RdT"}: {String(v).split("-").reverse().join("/")}</div>)}</div>}
                        </>
                      )}
                    </td>
                    <td className="border-b border-slate-100 px-3 py-2">
                      {row.messages.length > 0 ? row.messages.join(" | ") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
