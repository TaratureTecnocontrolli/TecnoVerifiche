import fs from "node:fs";

const files = [
  "components/CustomerInstrumentForm.tsx",
  "components/EditCustomerInstrumentForm.tsx",
  "components/InternalInstrumentForm.tsx",
  "components/EditInternalInstrumentForm.tsx",
  "components/ReferenceInstrumentForm.tsx",
  "components/EditReferenceInstrumentForm.tsx",
];

let changed = 0;

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.warn(`Saltato: ${file} non trovato.`);
    continue;
  }

  const current = fs.readFileSync(file, "utf8");

  if (current.includes('"kN/bar"')) {
    console.log(`OK: ${file} contiene già kN/bar.`);
    continue;
  }

  const next = current.replace(
    /(const unitOptions[^=]*=\s*\[\s*\r?\n\s*"kN",)/,
    (match) => match + '\n  "kN/bar",'
  );

  if (next === current) {
    console.warn(`Non modificato: non trovo unitOptions in ${file}.`);
    continue;
  }

  fs.writeFileSync(file, next, "utf8");
  changed += 1;
  console.log(`Aggiornato: ${file}`);
}

console.log(`Completato. File modificati: ${changed}.`);
