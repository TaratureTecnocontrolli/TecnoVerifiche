import fs from "node:fs";
import path from "node:path";

const filePath = path.join(process.cwd(), "components", "ForceCalibrationTable.tsx");

if (!fs.existsSync(filePath)) {
  throw new Error("File non trovato: components/ForceCalibrationTable.tsx");
}

let code = fs.readFileSync(filePath, "utf8");

if (!code.includes("forceUnitLabel")) {
  console.log("Nessun riferimento a forceUnitLabel trovato. Nessuna modifica necessaria.");
  process.exit(0);
}

if (code.includes("const forceUnitLabel")) {
  console.log("forceUnitLabel è già dichiarato. Nessuna modifica necessaria.");
  process.exit(0);
}

const marker = "  const hasBlockedReferenceInstrument = selectedReferenceInstruments.some(";

if (!code.includes(marker)) {
  throw new Error(
    "Punto di inserimento non trovato. Mandami components/ForceCalibrationTable.tsx attuale."
  );
}

const block = `  const forceUnit =
    selectedCustomerInstrument?.unit ||
    selectedInternalInstrument?.unit ||
    selectedReferenceInstruments[0]?.unit ||
    "";

  const forceUnitLabel = forceUnit ? " (" + forceUnit + ")" : "";

`;

code = code.replace(marker, block + marker);

fs.writeFileSync(filePath, code, "utf8");

console.log("Corretto components/ForceCalibrationTable.tsx: aggiunta dichiarazione forceUnitLabel.");
