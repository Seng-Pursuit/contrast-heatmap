let selectedPath = null;

const fileInput = document.getElementById("file");
const runBtn = document.getElementById("runBtn");
const statusEl = document.getElementById("status");
const dropEl = document.getElementById("drop");
const previewEl = document.getElementById("preview");
const outImg = document.getElementById("outImg");

function setStatus(msg) {
  statusEl.textContent = msg;
}

function setBusy(busy) {
  runBtn.disabled = busy || !selectedPath;
  runBtn.textContent = busy ? "Generating..." : "Generate heatmap";
}

async function pickFileFromDialog() {
  // No-bundler setup: use Tauri's injected global instead of ESM imports.
  const tauri = window.__TAURI__;
  if (!tauri?.dialog?.open) {
    throw new Error(
      "Tauri dialog API not available. Make sure you're running via `cargo tauri dev` (not opening ui/index.html in a browser).",
    );
  }

  const picked = await tauri.dialog.open({
    multiple: false,
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "bmp", "gif", "tif", "tiff"] }],
  });
  if (!picked) return null;
  return picked;
}

async function invokeGenerate(inputPath) {
  const tauri = window.__TAURI__;
  const invoke = tauri?.core?.invoke;
  if (!invoke) {
    throw new Error(
      "Tauri invoke API not available. Make sure you're running via `cargo tauri dev` (not opening ui/index.html in a browser).",
    );
  }
  return invoke("generate_heatmap_base64_png", { inputPath });
}

async function onFileChosen(path) {
  selectedPath = path;
  previewEl.style.display = "none";
  outImg.removeAttribute("src");
  setStatus(`Selected: ${path}`);
  setBusy(false);
}

// Fallback: basic <input type=file> lets us pick a file, but browsers don’t expose full paths.
// We keep it for nicer UX on web preview; in Tauri you should use the native dialog button.
fileInput.addEventListener("change", async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  setStatus(`Selected: ${f.name} (Tip: use “Choose file” in Tauri for full path access)`);
  selectedPath = null;
  setBusy(false);
});

document.getElementById("chooseBtn").addEventListener("click", async () => {
  try {
    const path = await pickFileFromDialog();
    if (path) await onFileChosen(path);
  } catch (e) {
    setStatus(`Pick file failed: ${String(e)}`);
  }
});

runBtn.addEventListener("click", async () => {
  if (!selectedPath) return;
  setBusy(true);
  setStatus("Generating heatmap...");
  try {
    const b64 = await invokeGenerate(selectedPath);
    outImg.src = `data:image/png;base64,${b64}`;
    previewEl.style.display = "";
    setStatus("Done.");
  } catch (e) {
    setStatus(`Failed: ${String(e)}`);
  } finally {
    setBusy(false);
  }
});

// Drag/drop UX (Tauri drop events will be better, but this is a nice baseline)
dropEl.addEventListener("dragover", (e) => {
  e.preventDefault();
});
dropEl.addEventListener("drop", async (e) => {
  e.preventDefault();
  setStatus("Drop detected. Tip: wire Tauri drop events to get file paths.");
});


