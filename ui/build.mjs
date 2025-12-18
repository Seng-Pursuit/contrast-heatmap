import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = path.resolve(new URL(".", import.meta.url).pathname, "..");
const uiDir = path.join(repoRoot, "ui");
const outDir = path.join(repoRoot, "ui-dist");

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function cleanDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  const indexHtml = path.join(uiDir, "index.html");
  const mainJs = path.join(uiDir, "main.js");

  if (!(await exists(indexHtml)) || !(await exists(mainJs))) {
    throw new Error("Expected ui/index.html and ui/main.js to exist.");
  }

  await cleanDir(outDir);
  await fs.copyFile(indexHtml, path.join(outDir, "index.html"));
  await fs.copyFile(mainJs, path.join(outDir, "main.js"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


