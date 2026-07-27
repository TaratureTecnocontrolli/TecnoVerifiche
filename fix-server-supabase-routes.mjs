import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "app");

const browserSupabaseImportRegex =
  /import\s*\{\s*supabase\s*\}\s*from\s*["']@\/lib\/supabase["'];?/;

const serverSupabaseImport =
  'import { createServerSupabaseClient } from "@/lib/supabase-server";';

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") {
        continue;
      }

      files.push(...walk(fullPath));
      continue;
    }

    if (
      entry.isFile() &&
      (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts"))
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

function startsAsClientFile(text) {
  const trimmed = text.trimStart();

  return (
    trimmed.startsWith('"use client";') ||
    trimmed.startsWith("'use client';") ||
    trimmed.startsWith('"use client"') ||
    trimmed.startsWith("'use client'")
  );
}

function findMatchingParen(text, openIndex) {
  let depth = 0;

  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];

    if (char === "(") {
      depth += 1;
    }

    if (char === ")") {
      depth -= 1;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function findFunctionBodyOpenBrace(text, functionStartIndex) {
  const openParenIndex = text.indexOf("(", functionStartIndex);

  if (openParenIndex === -1) {
    return -1;
  }

  const closeParenIndex = findMatchingParen(text, openParenIndex);

  if (closeParenIndex === -1) {
    return -1;
  }

  for (let index = closeParenIndex + 1; index < text.length; index += 1) {
    const char = text[index];

    if (char === "{") {
      return index;
    }

    if (char === ";") {
      return -1;
    }
  }

  return -1;
}

function makeDefaultFunctionAsync(text) {
  if (/export\s+default\s+async\s+function\s+/.test(text)) {
    return text;
  }

  return text.replace(
    /export\s+default\s+function\s+/,
    "export default async function "
  );
}

function insertServerClient(text) {
  if (text.includes("const supabase = await createServerSupabaseClient();")) {
    return text;
  }

  const asyncFunctionMatch = text.match(
    /export\s+default\s+async\s+function\s+[A-Za-z0-9_$]+\s*\(/
  );

  const normalFunctionMatch = text.match(
    /export\s+default\s+function\s+[A-Za-z0-9_$]+\s*\(/
  );

  let nextText = text;
  let functionStartIndex = -1;

  if (asyncFunctionMatch?.index !== undefined) {
    functionStartIndex = asyncFunctionMatch.index;
  } else if (normalFunctionMatch?.index !== undefined) {
    nextText = makeDefaultFunctionAsync(nextText);

    const rematch = nextText.match(
      /export\s+default\s+async\s+function\s+[A-Za-z0-9_$]+\s*\(/
    );

    functionStartIndex = rematch?.index ?? -1;
  }

  if (functionStartIndex === -1) {
    return null;
  }

  const bodyOpenIndex = findFunctionBodyOpenBrace(nextText, functionStartIndex);

  if (bodyOpenIndex === -1) {
    return null;
  }

  return (
    nextText.slice(0, bodyOpenIndex + 1) +
    "\n  const supabase = await createServerSupabaseClient();\n" +
    nextText.slice(bodyOpenIndex + 1)
  );
}

if (!fs.existsSync(appDir)) {
  console.error("Cartella app non trovata. Esegui lo script dalla root del progetto.");
  process.exit(1);
}

const files = walk(appDir);

const changed = [];
const skippedClient = [];
const skippedNoDefaultFunction = [];
const skippedNoSupabaseImport = [];

for (const filePath of files) {
  const originalText = fs.readFileSync(filePath, "utf8");
  const relativePath = path.relative(root, filePath);

  if (!browserSupabaseImportRegex.test(originalText)) {
    skippedNoSupabaseImport.push(relativePath);
    continue;
  }

  if (startsAsClientFile(originalText)) {
    skippedClient.push(relativePath);
    continue;
  }

  let nextText = originalText.replace(
    browserSupabaseImportRegex,
    serverSupabaseImport
  );

  nextText = insertServerClient(nextText);

  if (!nextText) {
    skippedNoDefaultFunction.push(relativePath);
    continue;
  }

  if (nextText !== originalText) {
    fs.writeFileSync(filePath + ".bak-rls-fix", originalText, "utf8");
    fs.writeFileSync(filePath, nextText, "utf8");
    changed.push(relativePath);
  }
}

console.log("");
console.log("============================================================");
console.log("FIX RLS PAGINE SERVER - RISULTATO");
console.log("============================================================");
console.log("");

console.log("File corretti:");
if (changed.length === 0) {
  console.log("  Nessuno");
} else {
  for (const file of changed) {
    console.log("  - " + file);
  }
}

console.log("");
console.log("File client lasciati invariati:");
if (skippedClient.length === 0) {
  console.log("  Nessuno");
} else {
  for (const file of skippedClient) {
    console.log("  - " + file);
  }
}

console.log("");
console.log("File con import Supabase ma senza default function riconosciuta:");
if (skippedNoDefaultFunction.length === 0) {
  console.log("  Nessuno");
} else {
  for (const file of skippedNoDefaultFunction) {
    console.log("  - " + file);
  }
}

console.log("");
console.log("Backup creati con estensione:");
console.log("  .bak-rls-fix");
console.log("");
console.log("Ora esegui:");
console.log("  npm run build");
console.log("============================================================");
