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
  setStatus("Capturing full page…");

  const port = chrome.runtime.connect({ name: "CAPTURE_ANALYZE_PROGRESS" });

  // We'll keep listening until done/error.
  await new Promise((resolve) => {
    port.onMessage.addListener(async (msg) => {
      if (msg?.type === "stage") {
        setStatus(msg.message || "Working…");
        return;
      }
      if (msg?.type === "error") {
        setStatus(msg.error || "Unknown error");
        setLoading(false);
        try {
          port.disconnect();
        } catch {}
        resolve();
        return;
      }
      if (msg?.type === "done") {
        setStatus("Opening result tab…");
        await chrome.tabs.create({ url: msg.resultUrl });
        setStatus("Done. Opened result tab.");
        try {
          port.disconnect();
        } catch {}
        resolve();
      }
    });
  });

  // Keep disabled to prevent quota issues from repeated clicks.
  captureBtn.disabled = true;
  captureBtn.textContent = "Done";
});

run().catch((e) => {
  setStatus(String(e));
  captureBtn.disabled = true;
});


