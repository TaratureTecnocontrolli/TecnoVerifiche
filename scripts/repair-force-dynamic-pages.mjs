import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "app");

const dynamicLines = [
  'export const dynamic = "force-dynamic";',
  "export const revalidate = 0;",
  'export const fetchCache = "force-no-store";',
];

const dynamicBlock = dynamicLines.join("\n");

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === ".git"
      ) {
        continue;
      }

      files.push(...walk(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name === "page.tsx") {
      files.push(fullPath);
    }
  }

  return files;
}

function isUseClientPage(code) {
  const trimmed = code.trimStart();

  return (
    trimmed.startsWith('"use client";') ||
    trimmed.startsWith("'use client';") ||
    trimmed.startsWith('"use client"') ||
    trimmed.startsWith("'use client'")
  );
}

function removeDynamicExportsEverywhere(code) {
  let next = code;

  for (const line of dynamicLines) {
    const escaped = line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(new RegExp(`^[ \\t]*${escaped}[ \\t]*\\r?\\n?`, "gm"), "");
  }

  next = next.replace(/\n{4,}/g, "\n\n\n");

  return next;
}

function findInsertionIndexAfterImports(code) {
  let i = 0;

  if (code.charCodeAt(0) === 0xfeff) {
    i = 1;
  }

  const directiveMatch = code.slice(i).match(/^(\s*(?:"use server"|'use server');\s*)/);
  if (directiveMatch) {
    i += directiveMatch[0].length;
  }

  while (i < code.length && /\s/.test(code[i])) {
    i++;
  }

  while (code.startsWith("import", i)) {
    const semi = code.indexOf(";", i);

    if (semi === -1) {
      break;
    }

    i = semi + 1;

    while (i < code.length && /\s/.test(code[i])) {
      i++;
    }
  }

  return i;
}

function insertDynamicBlock(code) {
  const cleanCode = removeDynamicExportsEverywhere(code);

  if (isUseClientPage(cleanCode)) {
    return { code: cleanCode, skippedClient: true };
  }

  const insertAt = findInsertionIndexAfterImports(cleanCode);
  const before = cleanCode.slice(0, insertAt).trimEnd();
  const after = cleanCode.slice(insertAt).trimStart();

  const nextCode = `${before}\n\n${dynamicBlock}\n\n${after}`;

  return { code: nextCode.endsWith("\n") ? nextCode : nextCode + "\n", skippedClient: false };
}

if (!fs.existsSync(appDir)) {
  console.error("Cartella app non trovata. Esegui lo script dalla root del progetto Next.js.");
  process.exit(1);
}

const pages = walk(appDir);

let fixed = 0;
let skippedClient = 0;

for (const filePath of pages) {
  const relativePath = path.relative(root, filePath);
  const code = fs.readFileSync(filePath, "utf8");

  const { code: nextCode, skippedClient: isClient } = insertDynamicBlock(code);

  if (isClient) {
    skippedClient++;
    if (nextCode !== code) {
      fs.writeFileSync(filePath, nextCode, "utf8");
      console.log(`PULITO client page: ${relativePath}`);
    } else {
      console.log(`SKIP client page: ${relativePath}`);
    }
    continue;
  }

  if (nextCode !== code) {
    fs.writeFileSync(filePath, nextCode, "utf8");
    fixed++;
    console.log(`FIX dinamica: ${relativePath}`);
  } else {
    console.log(`OK invariata: ${relativePath}`);
  }
}

console.log("");
console.log("Riparazione completata.");
console.log(`Pagine server sistemate: ${fixed}`);
console.log(`Pagine client saltate: ${skippedClient}`);
