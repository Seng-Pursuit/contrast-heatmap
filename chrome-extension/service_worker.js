const SERVER_URL = "http://127.0.0.1:59212/";

async function checkServerHealthy() {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 1200);
  try {
    const res = await fetch(SERVER_URL, { method: "GET", signal: ac.signal });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const text = (await res.text()).trim();
    if (text !== "contrast-heatmap") return { ok: false, reason: `Unexpected response: ${text.slice(0, 200)}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: String(e) };
  } finally {
    clearTimeout(t);
  }
}

async function ensureOffscreen() {
  const exists = await chrome.offscreen.hasDocument?.();
  if (exists) return;
  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["DOM_SCRAPING"],
    justification: "Stitch full-page screenshot tiles into a single PNG.",
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function exec(tabId, func, args = []) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func,
    args,
  });
  return result;
}

async function getPageMetrics(tabId) {
  return exec(tabId, () => {
    const dpr = window.devicePixelRatio || 1;
    const doc = document.documentElement;
    const body = document.body;
    const fullHeight = Math.max(doc.scrollHeight, body?.scrollHeight || 0);
    const fullWidth = Math.max(doc.scrollWidth, body?.scrollWidth || 0);
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    return { dpr, fullHeight, fullWidth, viewportHeight, viewportWidth, x: window.scrollX, y: window.scrollY };
  });
}

async function scrollToY(tabId, y) {
  await exec(tabId, (yy) => window.scrollTo(0, yy), [y]);
}

async function captureFullPage(tab) {
  const { id: tabId, windowId } = tab;
  const m = await getPageMetrics(tabId);

  // Capture vertically; assume fixed viewport width.
  const tiles = [];
  for (let y = 0; y < m.fullHeight; y += m.viewportHeight) {
    await scrollToY(tabId, y);
    await sleep(250);
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: "png" });
    tiles.push({ y, dataUrl });
  }

  // Restore scroll position
  await scrollToY(tabId, m.y);

  await ensureOffscreen();
  const stitched = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: "STITCH",
        payload: {
          tiles,
          fullWidth: m.viewportWidth,
          fullHeight: m.fullHeight,
          devicePixelRatio: m.dpr,
        },
      },
      (resp) => resolve(resp),
    );
  });

  if (!stitched?.ok) throw new Error(stitched?.error || "stitch failed");
  return stitched.dataUrl;
}

function dataUrlToBlob(dataUrl) {
  const [meta, b64] = dataUrl.split(",", 2);
  const mime = (meta.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function blobToDataUrl(blob) {
  const ab = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(ab);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  return `data:${blob.type || "application/octet-stream"};base64,${b64}`;
}

async function sendToServer(pngDataUrl) {
  const blob = dataUrlToBlob(pngDataUrl);
  const res = await fetch(SERVER_URL, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: blob,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`server error ${res.status}: ${t}`);
  }
  return res.blob();
}

async function openViewerWithBlob(blob) {
  const dataUrl = await blobToDataUrl(blob);
  const url = chrome.runtime.getURL("viewer.html") + "#" + encodeURIComponent(dataUrl);
  await chrome.tabs.create({ url });
}

async function openViewerWithText(message) {
  const dataUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(message)}`;
  const url = chrome.runtime.getURL("viewer.html") + "#" + encodeURIComponent(dataUrl);
  await chrome.tabs.create({ url });
}

chrome.action.onClicked.addListener(async (tab) => {
  try {
    const health = await checkServerHealthy();
    if (!health.ok) {
      await openViewerWithText(
        `You should open the Tauri app first.\n\nHealth check failed:\n${health.reason}\n\nExpected:\nGET ${SERVER_URL} -> contrast-heatmap`,
      );
      return;
    }

    if (!tab?.id) throw new Error("No active tab.");
    const screenshotDataUrl = await captureFullPage(tab);
    const outBlob = await sendToServer(screenshotDataUrl);
    await openViewerWithBlob(outBlob);
  } catch (e) {
    await openViewerWithText(String(e));
  }
});


