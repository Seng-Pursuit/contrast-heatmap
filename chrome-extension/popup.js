const statusEl = document.getElementById("status");
const captureBtn = document.getElementById("captureBtn");

function setStatus(msg) {
  statusEl.textContent = msg;
}

function setLoading(loading) {
  captureBtn.disabled = loading || !captureBtn.dataset.ready;
  captureBtn.textContent = loading ? "Loading…" : "Capture and analyse";
}

async function checkServer() {
  const resp = await chrome.runtime.sendMessage({ type: "CHECK_SERVER" });
  return resp;
}

async function run() {
  captureBtn.dataset.ready = "";
  setLoading(true);

  const health = await checkServer();
  if (!health?.ok) {
    setStatus(
      `You should open the Tauri app first.\n\nHealth check failed:\n${health?.reason || "unknown"}\n\nExpected:\nGET http://127.0.0.1:59212/ -> contrast-heatmap`,
    );
    captureBtn.dataset.ready = "";
    captureBtn.disabled = true;
    captureBtn.textContent = "Capture and analyse";
    return;
  }

  setStatus("Server OK. Ready.");
  captureBtn.dataset.ready = "1";
  setLoading(false);
}

captureBtn.addEventListener("click", async () => {
  setLoading(true);
  setStatus("Loading… capturing full page, processing, and opening result tab…");

  const resp = await chrome.runtime.sendMessage({ type: "CAPTURE_ANALYZE" });
  if (!resp?.ok) {
    setStatus(resp?.error || "Unknown error");
    setLoading(false);
    return;
  }

  // Only open once we have the processed image data URL.
  const url = chrome.runtime.getURL("viewer.html") + "#" + encodeURIComponent(resp.dataUrl);
  await chrome.tabs.create({ url });

  setStatus("Done. Opened result tab.");
  // Keep disabled to prevent quota issues from repeated clicks.
  captureBtn.disabled = true;
  captureBtn.textContent = "Done";
});

run().catch((e) => {
  setStatus(String(e));
  captureBtn.disabled = true;
});


