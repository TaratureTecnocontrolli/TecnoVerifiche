import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "app");

const browserSupabaseImportRegex =
  /import\s*\{\s*supabase\s*\}\s*from\s*["']@\/lib\/supabase["'];?/;

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

if (!fs.existsSync(appDir)) {
  console.error("Cartella app non trovata. Esegui lo script dalla root del progetto.");
  process.exit(1);
}

const files = walk(appDir);

const serverFilesStillUsingBrowserSupabase = [];

for (const filePath of files) {
  const text = fs.readFileSync(filePath, "utf8");

  if (!browserSupabaseImportRegex.test(text)) {
    continue;
  }

  if (startsAsClientFile(text)) {
    continue;
  }

  serverFilesStillUsingBrowserSupabase.push(path.relative(root, filePath));
}

console.log("");
console.log("============================================================");
console.log("CONTROLLO RLS PAGINE SERVER");
console.log("============================================================");

if (serverFilesStillUsingBrowserSupabase.length === 0) {
  console.log("OK: nessuna pagina server in app/** usa ancora '@/lib/supabase'.");
} else {
  console.log("ATTENZIONE: questi file server usano ancora '@/lib/supabase':");
  for (const file of serverFilesStillUsingBrowserSupabase) {
    console.log("  - " + file);
  }
}

console.log("============================================================");
