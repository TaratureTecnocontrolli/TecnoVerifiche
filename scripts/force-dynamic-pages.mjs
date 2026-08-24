import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "app");

const dynamicBlock = [
  'export const dynamic = "force-dynamic";',
  "export const revalidate = 0;",
  'export const fetchCache = "force-no-store";',
].join("\n");

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

function hasUseClientDirective(code) {
  const trimmedStart = code.trimStart();
  return (
    trimmedStart.startsWith('"use client";') ||
    trimmedStart.startsWith("'use client';") ||
    trimmedStart.startsWith('"use client"') ||
    trimmedStart.startsWith("'use client'")
  );
}

function hasDynamicBlock(code) {
  return (
    code.includes('export const dynamic = "force-dynamic"') ||
    code.includes("export const dynamic = 'force-dynamic'")
  );
}

function insertAfterImports(code) {
  const lines = code.split(/\r?\n/);

  let insertIndex = 0;

  // Preserve possible "use server" or other initial directives/comments.
  while (
    insertIndex < lines.length &&
    (
      lines[insertIndex].trim() === "" ||
      lines[insertIndex].trim().startsWith("//") ||
      lines[insertIndex].trim().startsWith("/*") ||
      lines[insertIndex].trim() === '"use server";' ||
      lines[insertIndex].trim() === "'use server';"
    )
  ) {
    insertIndex++;
  }

  // Move after contiguous import block.
  while (insertIndex < lines.length) {
    const line = lines[insertIndex];

    if (
      line.trim().startsWith("import ") ||
      line.trim().startsWith("} from ") ||
      line.trim().startsWith("from ") ||
      line.trim() === "" ||
      line.trim().startsWith("type ")
    ) {
      insertIndex++;
      continue;
    }

    // Multi-line import safety: continue until semicolon when currently in import block.
    if (insertIndex > 0 && !lines[insertIndex - 1].trim().endsWith(";")) {
      insertIndex++;
      continue;
    }

    break;
  }

  const before = lines.slice(0, insertIndex).join("\n").trimEnd();
  const after = lines.slice(insertIndex).join("\n").trimStart();

  return `${before}\n\n${dynamicBlock}\n\n${after}\n`;
}

if (!fs.existsSync(appDir)) {
  console.error("Cartella app non trovata. Esegui lo script dalla root del progetto Next.js.");
  process.exit(1);
}

const pages = walk(appDir);

let changed = 0;
let skippedClient = 0;
let alreadyDynamic = 0;

for (const filePath of pages) {
  const relativePath = path.relative(root, filePath);
  const code = fs.readFileSync(filePath, "utf8");

  if (hasUseClientDirective(code)) {
    console.log(`SKIP client page: ${relativePath}`);
    skippedClient++;
    continue;
  }

  if (hasDynamicBlock(code)) {
    console.log(`OK già dinamica: ${relativePath}`);
    alreadyDynamic++;
    continue;
  }

  const nextCode = insertAfterImports(code);
  fs.writeFileSync(filePath, nextCode, "utf8");

  console.log(`PATCH dinamica: ${relativePath}`);
  changed++;
}

console.log("");
console.log("Completato.");
console.log(`Pagine aggiornate: ${changed}`);
console.log(`Pagine già dinamiche: ${alreadyDynamic}`);
console.log(`Pagine client saltate: ${skippedClient}`);
