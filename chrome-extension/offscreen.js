async function dataUrlToImageBitmap(dataUrl) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    if (msg?.type !== "STITCH") return;

    const { tiles, fullWidth, fullHeight, devicePixelRatio } = msg.payload;
    // Tiles are captured at DPR scale; compute canvas in physical pixels.
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(fullWidth * devicePixelRatio);
    canvas.height = Math.round(fullHeight * devicePixelRatio);
    const ctx = canvas.getContext("2d");

    for (const t of tiles) {
      const bmp = await dataUrlToImageBitmap(t.dataUrl);
      // y is in CSS pixels; scale by DPR for placement.
      ctx.drawImage(bmp, 0, Math.round(t.y * devicePixelRatio));
      bmp.close?.();
    }

    const outDataUrl = canvas.toDataURL("image/png");
    sendResponse({ ok: true, dataUrl: outDataUrl });
  })().catch((e) => {
    sendResponse({ ok: false, error: String(e) });
  });

  return true; // async
});


