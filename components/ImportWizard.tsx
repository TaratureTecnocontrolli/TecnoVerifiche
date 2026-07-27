"use client";

import { useMemo, useState } from "react";
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

type ParsedRow = {
  rowNumber: number;
  raw: Record<string, unknown>;
  mapped: ImportMappedRow;
  status: "valid" | "warning" | "error" | "imported" | "skipped";
  messages: string[];
};

type ExistingCustomer = {
  id: string;
  customer_number: string | null;
  business_name: string;
};

type ExistingInstrument = {
  id: string;
  customer_id?: string | null;
  name: string | null;
  internal_code: string | null;
  serial_number: string | null;
};

type ImportResult = {
  inserted: number;
  skipped: number;
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
      "Importa clienti da file Excel o CSV. I duplicati vengono saltati, non aggiornati.",
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
  location: ["ubicazione", "sede", "location"],
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
    return value.toISOString().slice(0, 10);
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
    if (column.includes("Data")) return "2026-01-01";
    if (column.includes("Scadenza")) return "2027-01-01";
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
            "Consigliato indicare Codice Interno o Matricola per evitare duplicati."
          );
          if (status !== "error") status = "warning";
        }

        return {
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
    let skipped = 0;
    let errors = 0;

    const { data: existingData, error } = await supabase
      .from("customers")
      .select("id, customer_number, business_name");

    if (error) throw new Error(error.message);

    const existing = (existingData ?? []) as ExistingCustomer[];
    const existingByNumber = new Set(
      existing
        .map((customer) => normalizeKey(customer.customer_number))
        .filter(Boolean)
    );
    const existingByName = new Set(
      existing.map((customer) => normalizeKey(customer.business_name))
    );

    for (const row of nextRows) {
      if (row.status === "error") {
        errors += 1;
        continue;
      }

      const numberKey = normalizeKey(row.mapped.customer_number);
      const nameKey = normalizeKey(row.mapped.business_name);

      if ((numberKey && existingByNumber.has(numberKey)) || existingByName.has(nameKey)) {
        row.status = "skipped";
        row.messages = ["Duplicato già presente. Riga saltata."];
        skipped += 1;
        continue;
      }

      const { error: insertError } = await supabase.from("customers").insert({
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
      });

      if (insertError) {
        row.status = "error";
        row.messages = [insertError.message];
        errors += 1;
      } else {
        row.status = "imported";
        row.messages = ["Importato."];
        inserted += 1;
        if (numberKey) existingByNumber.add(numberKey);
        existingByName.add(nameKey);
      }
    }

    return { inserted, skipped, errors };
  }

  async function importCustomerInstruments(nextRows: ParsedRow[]) {
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    const { data: customersData, error: customersError } = await supabase
      .from("customers")
      .select("id, customer_number, business_name")
      .eq("is_active", true);

    if (customersError) throw new Error(customersError.message);

    const customers = (customersData ?? []) as ExistingCustomer[];

    const { data: existingData, error: existingError } = await supabase
      .from("customer_instruments")
      .select("id, customer_id, name, serial_number, internal_code");

    if (existingError) throw new Error(existingError.message);

    const existingKeys = new Set<string>();

    ((existingData ?? []) as ExistingInstrument[]).forEach((item) => {
      if (item.customer_id && item.serial_number) {
        existingKeys.add(item.customer_id + "|serial:" + normalizeKey(item.serial_number));
      }
      if (item.customer_id && item.name && item.serial_number) {
        existingKeys.add(
          item.customer_id +
            "|name:" +
            normalizeKey(item.name) +
            "|serial:" +
            normalizeKey(item.serial_number)
        );
      }
    });

    for (const row of nextRows) {
      if (row.status === "error") {
        errors += 1;
        continue;
      }

      const customer =
        customers.find(
          (item) =>
            normalizeKey(item.customer_number) ===
            normalizeKey(row.mapped.customer_number)
        ) ??
        customers.find(
          (item) =>
            normalizeKey(item.business_name) ===
            normalizeKey(row.mapped.customer_name)
        );

      if (!customer) {
        row.status = "error";
        row.messages = ["Cliente non trovato. Controlla Codice Cliente o Cliente."];
        errors += 1;
        continue;
      }

      const duplicateKey = customer.id + "|serial:" + normalizeKey(row.mapped.serial_number);

      if (row.mapped.serial_number && existingKeys.has(duplicateKey)) {
        row.status = "skipped";
        row.messages = ["Strumento cliente duplicato. Riga saltata."];
        skipped += 1;
        continue;
      }

      const { error: insertError } = await supabase
        .from("customer_instruments")
        .insert({
          customer_id: customer.id,
          site_id: null,
          customer_name: customer.business_name,
          site: null,
          name: row.mapped.name,
          manufacturer: row.mapped.manufacturer || null,
          model: row.mapped.model || null,
          serial_number: row.mapped.serial_number || null,
          internal_code: null,
          measurement_quantity: row.mapped.measurement_quantity || null,
          unit: row.mapped.unit || null,
          measurement_range: row.mapped.measurement_range || null,
          resolution: null,
          acceptance_class: null,
          notes: row.mapped.notes || null,
        });

      if (insertError) {
        row.status = "error";
        row.messages = [insertError.message];
        errors += 1;
      } else {
        row.status = "imported";
        row.messages = ["Importato."];
        inserted += 1;
        if (row.mapped.serial_number) existingKeys.add(duplicateKey);
      }
    }

    return { inserted, skipped, errors };
  }

  async function importReferenceInstruments(nextRows: ParsedRow[]) {
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    const { data: existingData, error: existingError } = await supabase
      .from("reference_instruments")
      .select("id, name, serial_number, internal_code");

    if (existingError) throw new Error(existingError.message);

    const existingKeys = new Set<string>();
    ((existingData ?? []) as ExistingInstrument[]).forEach((item) => {
      buildExistingInstrumentKeys(item).forEach((key) => existingKeys.add(key));
    });

    for (const row of nextRows) {
      if (row.status === "error") {
        errors += 1;
        continue;
      }

      const keys = [
        row.mapped.internal_code ? "code:" + normalizeKey(row.mapped.internal_code) : "",
        row.mapped.serial_number ? "serial:" + normalizeKey(row.mapped.serial_number) : "",
      ].filter(Boolean);

      if (keys.some((key) => existingKeys.has(key))) {
        row.status = "skipped";
        row.messages = ["Strumento campione duplicato. Riga saltata."];
        skipped += 1;
        continue;
      }

      const statusToSave =
        row.mapped.status === "dismissed" || row.mapped.status === "out_of_service"
          ? row.mapped.status
          : "valid";

      const { data: insertedInstrument, error: insertError } = await supabase
        .from("reference_instruments")
        .insert({
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
        })
        .select("id")
        .single();

      if (insertError || !insertedInstrument) {
        row.status = "error";
        row.messages = [insertError?.message || "Errore inserimento."];
        errors += 1;
      } else {
        if (
          row.mapped.certificate_number ||
          row.mapped.certificate_date ||
          row.mapped.certificate_expiry
        ) {
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

        row.status = "imported";
        row.messages = ["Importato."];
        inserted += 1;
        keys.forEach((key) => existingKeys.add(key));
      }
    }

    return { inserted, skipped, errors };
  }

  async function importInternalInstruments(nextRows: ParsedRow[]) {
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    const { data: existingData, error: existingError } = await supabase
      .from("internal_instruments")
      .select("id, name, serial_number, internal_code");

    if (existingError) throw new Error(existingError.message);

    const existingKeys = new Set<string>();
    ((existingData ?? []) as ExistingInstrument[]).forEach((item) => {
      buildExistingInstrumentKeys(item).forEach((key) => existingKeys.add(key));
    });

    for (const row of nextRows) {
      if (row.status === "error") {
        errors += 1;
        continue;
      }

      const keys = [
        row.mapped.internal_code ? "code:" + normalizeKey(row.mapped.internal_code) : "",
        row.mapped.serial_number ? "serial:" + normalizeKey(row.mapped.serial_number) : "",
      ].filter(Boolean);

      if (keys.some((key) => existingKeys.has(key))) {
        row.status = "skipped";
        row.messages = ["Strumento interno duplicato. Riga saltata."];
        skipped += 1;
        continue;
      }

      const statusToSave =
        row.mapped.status === "dismissed" || row.mapped.status === "out_of_service"
          ? row.mapped.status
          : "active";

      const { error: insertError } = await supabase
        .from("internal_instruments")
        .insert({
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
        });

      if (insertError) {
        row.status = "error";
        row.messages = [insertError.message];
        errors += 1;
      } else {
        row.status = "imported";
        row.messages = ["Importato."];
        inserted += 1;
        keys.forEach((key) => existingKeys.add(key));
      }
    }

    return { inserted, skipped, errors };
  }

  async function importRows() {
    setIsImporting(true);
    setResult(null);
    setParseError("");

    try {
      const nextRows = [...rows];

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
          <p className="font-semibold">Regola importazione</p>
          <p className="mt-1">
            Il sistema inserisce solo le righe nuove. I duplicati vengono
            saltati, non aggiornati, così evitiamo sovrascritture involontarie.
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
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="text-xl font-bold">{result.inserted}</p>
                <p>Inseriti</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="text-xl font-bold">{result.skipped}</p>
                <p>Saltati</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                <p className="text-xl font-bold">{result.errors}</p>
                <p>Errori</p>
              </div>
            </div>
          )}

          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
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
                                ? "bg-blue-100 text-blue-800"
                                : row.status === "skipped"
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
