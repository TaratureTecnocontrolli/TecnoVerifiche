import { readFileSync, writeFileSync, existsSync } from "node:fs";

const filePath = "components/ForceCalibrationTable.tsx";

if (!existsSync(filePath)) {
  throw new Error("File non trovato: " + filePath);
}

let code = readFileSync(filePath, "utf8");

if (!code.includes("forceUnitLabel")) {
  console.log("Nessuna occorrenza di forceUnitLabel trovata. Nessuna modifica necessaria.");
  process.exit(0);
}

const alreadyFixedPattern = /const\s+forceUnit\s*=\s*[\s\S]*?const\s+forceUnitLabel\s*=\s*forceUnit\s*\?\s*" \("\s*\+\s*forceUnit\s*\+\s*"\)"\s*:\s*"";\s*return\s*\(/;

if (alreadyFixedPattern.test(code)) {
  console.log("ForceCalibrationTable già sistemato.");
  process.exit(0);
}

const target = `        return (
          <div
            key={scale.id}`;

const insertion = `        const forceUnit =
          selectedCustomerInstrument?.unit ||
          selectedInternalInstrument?.unit ||
          scaleReferenceInstruments[0]?.unit ||
          "";

        const forceUnitLabel = forceUnit ? " (" + forceUnit + ")" : "";

        return (
          <div
            key={scale.id}`;

if (!code.includes(target)) {
  throw new Error("Punto di inserimento non trovato in ForceCalibrationTable.tsx.");
}

code = code.replace(target, insertion);

writeFileSync(filePath, code, "utf8");

console.log("Corretto ForceCalibrationTable.tsx: aggiunto forceUnitLabel nel render delle scale.");
