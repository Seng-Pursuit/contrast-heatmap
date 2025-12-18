import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always run the frontend build script from the repo root (one level up from src-tauri/).
const repoRoot = path.resolve(__dirname, "..");
const script = path.join(repoRoot, "ui", "build.mjs");

const res = spawnSync(process.execPath, [script], {
  cwd: repoRoot,
  stdio: "inherit",
});

process.exit(res.status ?? 1);


